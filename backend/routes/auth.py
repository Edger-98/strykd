from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.user import User
from services.email import send_password_reset_email, send_welcome_email

router = APIRouter(prefix="/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    slug: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode({"sub": user_id, "exp": expire}, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _create_reset_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    return jwt.encode(
        {"sub": user_id, "type": "reset", "exp": expire},
        settings.jwt_secret, algorithm=settings.jwt_algorithm,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(User).where(User.email == body.email))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    slug_taken = await db.scalar(select(User).where(User.slug == body.slug))
    if slug_taken:
        raise HTTPException(status_code=400, detail="Slug already taken")

    user = User(
        email=body.email,
        name=body.name,
        slug=body.slug,
        hashed_password=_hash_password(body.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Welcome email — best-effort, never blocks registration
    await send_welcome_email(user.email, user.name)

    return TokenResponse(access_token=_create_token(str(user.id)))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email))
    if not user or not _verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return TokenResponse(access_token=_create_token(str(user.id)))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout():
    # JWT is stateless; client drops the token
    return


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Send a time-limited reset link. Always returns 200 to avoid leaking which
    emails are registered."""
    user = await db.scalar(select(User).where(User.email == body.email))
    if user:
        token = _create_reset_token(str(user.id))
        reset_url = f"{settings.frontend_url}/reset-password/{token}"
        await send_password_reset_email(user.email, user.name, reset_url)
    return {"message": "If that email is registered, a reset link is on its way."}


@router.get("/reset-password/{token}")
async def validate_reset_token(token: str):
    """Validate a reset token before showing the reset form."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "reset":
            raise ValueError("wrong token type")
    except Exception:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")
    return {"valid": True}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(body.token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "reset":
            raise ValueError("wrong token type")
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")

    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = _hash_password(body.new_password)
    await db.commit()
    return {"message": "Password updated. You can now log in."}
