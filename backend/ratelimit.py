"""Rate limiting (slowapi).

Protects abuse-prone endpoints: auth (brute force, reset-email bombing) and the
LLM-backed endpoints (brainstorm, plan/itinerary generation, vision proof) which
cost real Anthropic spend — especially now that Strykd is free and anyone can
register.

Keying: authenticated requests are limited PER USER (the token `sub`), so a
single account can't fan out across IPs; unauthenticated requests fall back to
the real client IP from X-Forwarded-For / X-Real-IP (we sit behind nginx, so
request.client.host is always 127.0.0.1 and must not be used directly).

Storage is in-memory, which is correct for the current single-uvicorn-process
deployment. If the backend is ever scaled to multiple workers/hosts, point the
Limiter at Redis via `storage_uri=settings.redis_url`.
"""
from jose import JWTError, jwt
from slowapi import Limiter

from config import settings


def client_key(request) -> str:
    """Per-user when authenticated, else per real client IP."""
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        try:
            payload = jwt.decode(
                auth[7:], settings.jwt_secret, algorithms=[settings.jwt_algorithm],
                options={"verify_exp": False},  # keying only; real validation happens in deps
            )
            sub = payload.get("sub")
            if sub:
                return f"user:{sub}"
        except JWTError:
            pass
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return f"ip:{xff.split(',')[0].strip()}"
    real = request.headers.get("x-real-ip")
    if real:
        return f"ip:{real.strip()}"
    return f"ip:{request.client.host if request.client else 'unknown'}"


limiter = Limiter(key_func=client_key)
