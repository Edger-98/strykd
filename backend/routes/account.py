from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from deps import get_current_user
from models.billing import Billing
from models.encouragement import Encouragement
from models.goal import Goal
from models.signal_wall import SignalWall
from models.task import DailyTask
from models.theme import Theme
from models.user import DEFAULT_EMAIL_PREFERENCES, User
from routes.auth import _hash_password, _verify_password
from services.cache import bust_public_page
from trial import trial_status

router = APIRouter(tags=["account"])

MAX_AVATAR_CHARS = 7_500_000  # ~5MB image as base64


class ProfileUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    email_reminders: bool | None = None
    email_preferences: dict | None = None
    push_enabled: bool | None = None
    timezone: str | None = None
    page_public: bool | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


def _user_dict(u: User) -> dict:
    return {
        "id": str(u.id), "name": u.name, "email": u.email, "slug": u.slug,
        "bio": u.bio or "", "avatar_url": u.avatar_url, "page_public": u.page_public,
        "email_reminders": u.email_reminders, "timezone": u.timezone,
        "email_preferences": {**DEFAULT_EMAIL_PREFERENCES, **(u.email_preferences or {})},
        "push_enabled": u.push_enabled,
        "streak_days": u.streak_days,
    }


@router.get("/me")
async def get_me(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    billing = await db.scalar(select(Billing).where(Billing.user_id == current_user.id))
    refund_eligible = False
    if current_user.subscription_active and billing and billing.started_at:
        refund_eligible = (datetime.now(timezone.utc) - billing.started_at) <= timedelta(days=7)
    return {
        "user": _user_dict(current_user),
        "subscription": {
            "active": current_user.subscription_active,
            "status": billing.status if billing else None,
            "next_billing_date": billing.next_billing_date.isoformat() if billing and billing.next_billing_date else None,
            "refund_eligible": refund_eligible,
        },
        "trial": trial_status(current_user),
    }


@router.patch("/me")
async def update_me(body: ProfileUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if body.name is not None:
        current_user.name = body.name.strip() or current_user.name
    if body.slug is not None:
        slug = body.slug.strip().lower()
        if slug and slug != current_user.slug:
            taken = await db.scalar(select(User).where(User.slug == slug, User.id != current_user.id))
            if taken:
                raise HTTPException(status_code=400, detail="Slug already taken")
            current_user.slug = slug
    if body.bio is not None:
        if len(body.bio) > 160:
            raise HTTPException(status_code=422, detail="Bio must be 160 characters or fewer")
        current_user.bio = body.bio
    if body.avatar_url is not None:
        if len(body.avatar_url) > MAX_AVATAR_CHARS:
            raise HTTPException(status_code=413, detail="Image too large (max 5MB)")
        current_user.avatar_url = body.avatar_url or None
    if body.email_reminders is not None:
        current_user.email_reminders = body.email_reminders
    if body.email_preferences is not None:
        # Merge over known keys only; ignore anything unexpected.
        merged = {**DEFAULT_EMAIL_PREFERENCES, **(current_user.email_preferences or {})}
        for k in DEFAULT_EMAIL_PREFERENCES:
            if k in body.email_preferences:
                merged[k] = bool(body.email_preferences[k])
        current_user.email_preferences = merged
    if body.push_enabled is not None:
        current_user.push_enabled = body.push_enabled
    if body.timezone is not None:
        current_user.timezone = body.timezone
    if body.page_public is not None:
        current_user.page_public = body.page_public

    await db.commit()
    await bust_public_page(current_user.slug)
    return _user_dict(current_user)


@router.post("/me/password")
async def change_password(body: PasswordChange, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not _verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=422, detail="New password must be at least 6 characters")
    current_user.hashed_password = _hash_password(body.new_password)
    await db.commit()
    return {"message": "Password updated"}


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    uid = current_user.id
    slug = current_user.slug
    # Remove all dependent rows, then the user
    await db.execute(delete(DailyTask).where(DailyTask.user_id == uid))
    await db.execute(delete(SignalWall).where(SignalWall.user_id == uid))
    await db.execute(delete(Encouragement).where(Encouragement.user_id == uid))
    await db.execute(delete(Theme).where(Theme.user_id == uid))
    await db.execute(delete(Billing).where(Billing.user_id == uid))
    await db.execute(delete(Goal).where(Goal.user_id == uid))
    await db.execute(delete(User).where(User.id == uid))
    await db.commit()
    await bust_public_page(slug)
    return
