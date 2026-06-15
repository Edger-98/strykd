"""No-auth public endpoints: one-click email unsubscribe + client config."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.user import User
from services.tokens import read_unsubscribe_token

router = APIRouter(tags=["public"])


class UnsubscribeRequest(BaseModel):
    token: str


@router.post("/unsubscribe")
async def unsubscribe(body: UnsubscribeRequest, db: AsyncSession = Depends(get_db)):
    """One-click unsubscribe (CAN-SPAM). Flips the master email switch off.

    No login required — the signed token carries the user id. Idempotent: an
    already-unsubscribed (or unknown) token still returns success so the page
    never leaks whether a token is valid.
    """
    user_id = read_unsubscribe_token(body.token)
    if user_id is None:
        raise HTTPException(status_code=400, detail="This unsubscribe link is invalid.")
    user = await db.scalar(select(User).where(User.id == user_id))
    if user:
        user.email_reminders = False
        await db.commit()
    return {"message": "You have been unsubscribed from Strykd emails."}


@router.get("/public-config")
async def public_config():
    """Build-agnostic client config. The frontend fetches this at runtime so the
    OneSignal app id doesn't have to be baked into the static build."""
    return {"onesignal_app_id": settings.onesignal_app_id}
