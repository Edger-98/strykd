from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from deps import get_current_user
from models.goal import Goal
from models.signal_wall import SignalWall
from models.task import DailyTask
from models.theme import Theme
from models.user import User
from services.llm import generate_plan

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class OnboardingRequest(BaseModel):
    goals: str
    duration_days: int
    aesthetic: str  # e.g. "dark-ember", "arctic-focus", "soft-earth"


class OnboardingResponse(BaseModel):
    slug: str
    public_url: str
    message: str


@router.post("", response_model=OnboardingResponse)
async def onboard(
    body: OnboardingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.subscription_active:
        raise HTTPException(
            status_code=402,
            detail="Active subscription required. Complete checkout to unlock your plan.",
        )

    if body.duration_days < 1 or body.duration_days > 365:
        raise HTTPException(status_code=422, detail="duration_days must be between 1 and 365")

    # Generate full plan via LLM
    try:
        plan = await generate_plan(
            goals=body.goals,
            duration_days=body.duration_days,
            aesthetic=body.aesthetic,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Plan generation failed: {exc}")

    today = date.today()
    end_date = today + timedelta(days=body.duration_days - 1)

    # Persist Goal
    goal = Goal(
        user_id=current_user.id,
        description=body.goals,
        duration_days=body.duration_days,
        start_date=today,
        end_date=end_date,
        status="active",
    )
    db.add(goal)
    await db.flush()  # populate goal.id before FK refs

    # Persist DailyTasks
    task_count_day1 = 0
    for day_entry in plan.get("daily_tasks", []):
        day_num = int(day_entry["day"])
        task_date = today + timedelta(days=day_num - 1)
        for task in day_entry.get("tasks", []):
            db.add(
                DailyTask(
                    goal_id=goal.id,
                    task_date=task_date,
                    content=task["content"],
                    voice_style=task.get("voice_style", "direct"),
                )
            )
        if day_num == 1:
            task_count_day1 = len(day_entry.get("tasks", []))

    # Persist Theme
    theme_data = plan.get("theme", {})
    db.add(
        Theme(
            user_id=current_user.id,
            color_palette=theme_data.get("color_palette", "arctic-focus"),
            typography_variant=theme_data.get("typography_variant", "minimal"),
            layout_variant=theme_data.get("layout_variant", "dashboard"),
            mission_statement=plan.get("mission_statement", ""),
            chapter_titles=plan.get("chapter_titles", []),
        )
    )

    # Persist Day 1 Signal Wall entry
    db.add(
        SignalWall(
            user_id=current_user.id,
            entry_date=today,
            ai_summary=plan.get("day_1_signal_wall_entry", ""),
            tasks_completed=0,
            tasks_total=task_count_day1,
        )
    )

    await db.commit()

    public_url = f"https://{current_user.slug}.{settings.base_domain}"
    return OnboardingResponse(
        slug=current_user.slug,
        public_url=public_url,
        message="Your accountability plan is live.",
    )
