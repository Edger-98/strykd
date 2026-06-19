import uuid as _uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.user import User

_bearer = HTTPBearer()


def _new_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    # type="access" marks this as a session token. Email-action tokens (reset,
    # unsubscribe) carry their own type and must NOT be accepted as auth — see
    # the type check in get_current_user.
    return jwt.encode(
        {"sub": user_id, "type": "access", "exp": expire},
        settings.jwt_secret, algorithm=settings.jwt_algorithm,
    )


async def get_current_user(
    response: Response,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise exc
        # Token-type enforcement: reject email-action tokens (reset / unsubscribe)
        # being replayed as session credentials. Access tokens are minted with
        # type="access"; legacy tokens predating this carry no type and are still
        # accepted so existing sessions don't break. Anything with a non-access
        # type (reset, unsub, …) is refused.
        token_type = payload.get("type")
        if token_type is not None and token_type != "access":
            raise exc
    except JWTError:
        raise exc

    user = await db.scalar(select(User).where(User.id == _uuid.UUID(user_id)))
    if user is None:
        raise exc

    # Silent refresh: when the token is within the refresh window of expiry, mint
    # a fresh 30-day token and hand it back via a response header. The frontend
    # swaps it in transparently, so an active user never gets signed out.
    exp = payload.get("exp")
    if exp is not None:
        remaining = datetime.fromtimestamp(exp, tz=timezone.utc) - datetime.now(timezone.utc)
        if remaining < timedelta(minutes=settings.jwt_refresh_within_minutes):
            response.headers["X-New-Token"] = _new_token(user_id)

    return user
