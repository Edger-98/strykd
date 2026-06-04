from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from deps import get_current_user
from models.billing import Billing
from models.user import User
from services import stripe as stripe_service

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
            await _upsert_billing(
                db,
                user.id,
                stripe_customer_id=obj.get("customer"),
                stripe_subscription_id=obj.get("id"),
                status="active",
                next_billing_date=datetime.fromtimestamp(next_billing, tz=timezone.utc)
                if next_billing else None,
            )
            user.subscription_active = True
            await db.commit()

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

    # Acknowledge all other events without action
    return {"received": True}
