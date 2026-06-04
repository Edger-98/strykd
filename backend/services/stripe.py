from config import settings


async def create_checkout_session(user_id: str, email: str) -> str:
    # TODO: stripe.checkout.Session.create(...), return session.url
    raise NotImplementedError


async def handle_webhook_event(payload: bytes, sig_header: str) -> None:
    # TODO: stripe.Webhook.construct_event(...), update billing + subscription_active
    raise NotImplementedError
