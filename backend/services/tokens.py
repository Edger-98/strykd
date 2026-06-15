"""Signed tokens for no-login email actions (one-click unsubscribe).

The unsubscribe token is a long-lived signed JWT carrying the user id. It never
expires — an unsubscribe link must keep working long after the email was sent —
and is namespaced with type="unsub" so it can't be replayed as an auth token.
"""
import uuid as _uuid

from jose import JWTError, jwt

from config import settings


def make_unsubscribe_token(user_id) -> str:
    return jwt.encode(
        {"sub": str(user_id), "type": "unsub"},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def read_unsubscribe_token(token: str) -> _uuid.UUID | None:
    """Return the user id encoded in a valid unsubscribe token, else None."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    if payload.get("type") != "unsub":
        return None
    sub = payload.get("sub")
    try:
        return _uuid.UUID(sub)
    except (ValueError, TypeError):
        return None
