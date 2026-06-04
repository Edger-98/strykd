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
        "success_url": f"{settings.frontend_url}/onboard?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{settings.frontend_url}/?checkout=cancelled",
        # client_reference_id lets the webhook map the session back to our user
        "client_reference_id": user_id,
        "metadata": {"user_id": user_id},
        # carry the user_id onto the subscription too, so subscription.* events have it
        "subscription_data": {"metadata": {"user_id": user_id}},
    }
    if customer_id:
        params["customer"] = customer_id
    else:
        params["customer_email"] = email

    session = await stripe.checkout.Session.create_async(**params)
    return session.url


def construct_event(payload: bytes, sig_header: str):
    """Verify the webhook signature and return the parsed Stripe event.

    Raises stripe.error.SignatureVerificationError on a bad signature.
    """
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.stripe_webhook_secret
    )
