from datetime import datetime, timedelta, timezone

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from deps import get_current_user
from models.billing import Billing
from models.user import User
from services import stripe as stripe_service
from services.email import send_subscription_confirmation_email

router = APIRouter(prefix="/billing", tags=["billing"])


class CheckoutResponse:
    pass


@router.post("/checkout")
async def create_checkout(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a Stripe Checkout session for the authenticated user."""
    # Reuse an existing Stripe customer if we have one on file
    existing = await db.scalar(select(Billing).where(Billing.user_id == current_user.id))
    customer_id = existing.stripe_customer_id if existing else None

    try:
        url = await stripe_service.create_checkout_session(
            user_id=str(current_user.id),
            email=current_user.email,
            customer_id=customer_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Stripe checkout failed: {exc}")

    return {"checkout_url": url}


@router.post("/portal")
async def billing_portal(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stripe billing portal URL so the user can manage/update their subscription."""
    billing = await db.scalar(select(Billing).where(Billing.user_id == current_user.id))
    if not billing or not billing.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No subscription to manage yet")
    try:
        url = await stripe_service.create_portal_session(billing.stripe_customer_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Stripe portal failed: {exc}")
    return {"portal_url": url}


@router.post("/cancel")
async def cancel(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel the subscription at period end."""
    billing = await db.scalar(select(Billing).where(Billing.user_id == current_user.id))
    if not billing or not billing.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription")
    try:
        await stripe_service.cancel_subscription(billing.stripe_subscription_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Stripe cancel failed: {exc}")
    billing.status = "cancelled"
    await db.commit()
    return {"message": "Subscription will end at the close of the current period"}


REFUND_WINDOW_DAYS = 7


@router.post("/refund")
async def refund(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel immediately and refund the last payment, within the 7-day window."""
    billing = await db.scalar(select(Billing).where(Billing.user_id == current_user.id))
    if not billing or not billing.stripe_subscription_id or not billing.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No active subscription")

    started = billing.started_at
    if started is None or (datetime.now(timezone.utc) - started) > timedelta(days=REFUND_WINDOW_DAYS):
        raise HTTPException(status_code=400, detail="Refunds are only available within 7 days of subscribing.")

    try:
        await stripe_service.refund_last_payment(billing.stripe_customer_id)
        await stripe_service.cancel_subscription_now(billing.stripe_subscription_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Refund failed: {exc}")

    billing.status = "refunded"
    current_user.subscription_active = False
    await db.commit()
    return {"message": "Your payment has been refunded and your subscription cancelled."}


async def _upsert_billing(db: AsyncSession, user_id, **fields) -> Billing:
    billing = await db.scalar(select(Billing).where(Billing.user_id == user_id))
    if billing is None:
        billing = Billing(user_id=user_id, **fields)
        db.add(billing)
    else:
        for k, v in fields.items():
            if v is not None:
                setattr(billing, k, v)
    return billing


async def _user_from_event_object(db: AsyncSession, obj) -> User | None:
    """Resolve our User from a Stripe object via metadata, then customer id."""
    user_id = (obj.get("metadata") or {}).get("user_id")
    if user_id:
        user = await db.scalar(select(User).where(User.id == user_id))
        if user:
            return user

    customer_id = obj.get("customer")
    if customer_id:
        billing = await db.scalar(
            select(Billing).where(Billing.stripe_customer_id == customer_id)
        )
        if billing:
            return await db.scalar(select(User).where(User.id == billing.user_id))
    return None


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
    db: AsyncSession = Depends(get_db),
):
    payload = await request.body()
    try:
        event = stripe_service.construct_event(payload, stripe_signature)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Webhook error: {exc}")

    etype = event["type"]
    obj = event["data"]["object"]

    if etype == "checkout.session.completed":
        # Bind the Stripe customer to our user as early as possible
        user = await _user_from_event_object(db, obj)
        if user:
            await _upsert_billing(
                db,
                user.id,
                stripe_customer_id=obj.get("customer"),
                stripe_subscription_id=obj.get("subscription"),
                status="active",
            )
            await db.commit()

    elif etype == "customer.subscription.created":
        user = await _user_from_event_object(db, obj)
        if user:
            next_billing = obj.get("current_period_end")
            started = obj.get("start_date") or obj.get("created")
            await _upsert_billing(
                db,
                user.id,
                stripe_customer_id=obj.get("customer"),
                stripe_subscription_id=obj.get("id"),
                status="active",
                next_billing_date=datetime.fromtimestamp(next_billing, tz=timezone.utc)
                if next_billing else None,
                started_at=datetime.fromtimestamp(started, tz=timezone.utc) if started else datetime.now(timezone.utc),
            )
            user.subscription_active = True
            await db.commit()
            await send_subscription_confirmation_email(user.email, user.name, user.id)

    elif etype == "customer.subscription.deleted":
        user = await _user_from_event_object(db, obj)
        if user:
            await _upsert_billing(db, user.id, status="cancelled")
            user.subscription_active = False
            await db.commit()

    elif etype == "invoice.payment_failed":
        user = await _user_from_event_object(db, obj)
        if user:
            await _upsert_billing(db, user.id, status="past_due")
            user.subscription_active = False
            await db.commit()

    # customer.subscription.trial_will_end is intentionally ignored: Strykd is
    # free and sends no trial-ending warnings.

    # Acknowledge all other events without action
    return {"received": True}
