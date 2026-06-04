from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.goal import Goal
from models.theme import Theme

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class OnboardingRequest(BaseModel):
    user_id: str
    goals: str
    duration_days: int
    aesthetic: str  # e.g. "dark-ember", "arctic-focus"


class OnboardingResponse(BaseModel):
    message: str
    slug: str


@router.post("", response_model=OnboardingResponse)
async def onboard(body: OnboardingRequest, db: AsyncSession = Depends(get_db)):
    # TODO: verify JWT, fetch user, call LLM service, save plan + theme
    # Placeholder — full implementation in Day 2
    raise HTTPException(status_code=501, detail="Not implemented yet")
