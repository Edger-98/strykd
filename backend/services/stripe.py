"""Stripe subscription integration.

The Stripe Python SDK (v11) exposes async variants (`*_async`) of every
network method. We use those so the FastAPI event loop is never blocked.
"""
import stripe

from config import settings

stripe.api_key = settings.stripe_secret_key


async def create_checkout_session(user_id: str, email: str, customer_id: str | None = None) -> str:
    """Create a Stripe Checkout session for the monthly subscription.

    Returns the hosted checkout URL the frontend should redirect to.
    """
    params = {
        "mode": "subscription",
        "line_items": [{"price": settings.stripe_price_id, "quantity": 1}],
        "success_url": f"{settings.frontend_url}/dashboard?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{settings.frontend_url}/?checkout=cancelled",
        # client_reference_id lets the webhook map the session back to our user
        "client_reference_id": user_id,
        "metadata": {"user_id": user_id},
        # No Stripe trial: the 7-day free week is handled app-side, so subscribing
        # charges $9/month immediately. Carry user_id onto the subscription so
        # subscription.* events can map back to our user.
        "subscription_data": {
            "metadata": {"user_id": user_id},
        },
    }
    if customer_id:
        params["customer"] = customer_id
    else:
        params["customer_email"] = email

    session = await stripe.checkout.Session.create_async(**params)
    return session.url


async def create_portal_session(customer_id: str) -> str:
    """Create a Stripe billing portal session so the user can manage their plan."""
    session = await stripe.billing_portal.Session.create_async(
        customer=customer_id,
        return_url=f"{settings.frontend_url}/dashboard/settings",
    )
    return session.url


async def cancel_subscription(subscription_id: str):
    """Cancel at period end (keeps access until the paid period runs out)."""
    return await stripe.Subscription.modify_async(subscription_id, cancel_at_period_end=True)


def construct_event(payload: bytes, sig_header: str):
    """Verify the webhook signature and return the parsed Stripe event.

    Raises stripe.error.SignatureVerificationError on a bad signature.
    """
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.stripe_webhook_secret
    )
