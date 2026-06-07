import json
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import AsyncSessionLocal, get_db
from deps import get_current_user
from models.goal import Goal
from models.signal_wall import SignalWall
from models.task import DailyTask
from models.theme import Theme
from models.user import User
from services.llm import (
    assemble_plan, day1_contents, generate_plan, plan_analysis, plan_chapters,
    plan_inputs, plan_mission, plan_signal_day1, plan_tasks, plan_theme,
)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class OnboardingRequest(BaseModel):
    goals: str
    duration_days: int
    aesthetic: str  # e.g. "dark-ember", "arctic-focus", "soft-earth"
    life_area: str  # career | fitness | business | creative | personal-growth
    why_now: str
    past_blockers: str
    hours_per_day: int
    daily_rhythm: str  # morning | evening
    page_public: bool = True  # public or private page


class OnboardingResponse(BaseModel):
    slug: str
    public_url: str
    message: str


async def _persist_plan(db: AsyncSession, user: User, body: OnboardingRequest, plan: dict) -> None:
    """Persist a generated plan: goal, daily tasks, theme (first goal), Day 1 signal."""
    today = date.today()
    end_date = today + timedelta(days=body.duration_days - 1)

    # Honor the public/private page toggle
    user.page_public = body.page_public

    # Start the 7-day free trial clock on first onboarding
    if user.trial_start_date is None:
        user.trial_start_date = datetime.now(timezone.utc)

    goal = Goal(
        user_id=user.id,
        description=body.goals,
        duration_days=body.duration_days,
        start_date=today,
        end_date=end_date,
        status="active",
        life_area=body.life_area,
        why_now=body.why_now,
        past_blockers=body.past_blockers,
        hours_per_day=body.hours_per_day,
        daily_rhythm=body.daily_rhythm,
        chapter_titles=plan.get("chapter_titles", []),
        streak_days=0,
    )
    db.add(goal)
    await db.flush()  # populate goal.id before FK refs

    task_count_day1 = 0
    for day_entry in plan.get("daily_tasks", []):
        day_num = int(day_entry["day"])
        task_date = today + timedelta(days=day_num - 1)
        for task in day_entry.get("tasks", []):
            db.add(DailyTask(
                goal_id=goal.id,
                user_id=user.id,
                task_date=task_date,
                content=task["content"],
                voice_style=task.get("voice_style", "direct"),
            ))
        if day_num == 1:
            task_count_day1 = len(day_entry.get("tasks", []))

    # Theme is the user's single visual identity: create on first goal, reuse after
    existing_theme = await db.scalar(select(Theme).where(Theme.user_id == user.id))
    if existing_theme is None:
        theme_data = plan.get("theme", {})
        db.add(Theme(
            user_id=user.id,
            color_palette=theme_data.get("color_palette", "arctic-focus"),
            typography_variant=theme_data.get("typography_variant", "minimal"),
            layout_variant=theme_data.get("layout_variant", "dashboard"),
            mission_statement=plan.get("mission_statement", ""),
        ))

    db.add(SignalWall(
        user_id=user.id,
        goal_id=goal.id,
        entry_date=today,
        ai_summary=plan.get("day_1_signal_wall_entry", ""),
        tasks_completed=0,
        tasks_total=task_count_day1,
    ))

    await db.commit()


@router.post("", response_model=OnboardingResponse)
async def onboard(
    body: OnboardingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # No payment required: completing onboarding starts a 7-day, no-card free trial.
    if body.duration_days < 1 or body.duration_days > 365:
        raise HTTPException(status_code=422, detail="duration_days must be between 1 and 365")

    try:
        plan = await generate_plan(
            goals=body.goals,
            duration_days=body.duration_days,
            aesthetic=body.aesthetic,
            life_area=body.life_area,
            why_now=body.why_now,
            past_blockers=body.past_blockers,
            hours_per_day=body.hours_per_day,
            daily_rhythm=body.daily_rhythm,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Plan generation failed: {exc}")

    await _persist_plan(db, current_user, body, plan)

    public_url = f"https://{current_user.slug}.{settings.base_domain}"
    return OnboardingResponse(
        slug=current_user.slug,
        public_url=public_url,
        message="Your accountability plan is live.",
    )


# Progress copy for each streamed stage (fired as that stage completes)
_STAGE_MESSAGES = {
    "analyzing": "Analyzing your goal and what's blocked you before...",
    "chapters": "Building your chapter map...",
    "tasks": "Writing your personalized daily tasks...",
    "mission": "Crafting your mission statement...",
    "theme": "Creating your visual identity...",
    "signal": "Writing your Day 1 signal wall entry...",
}


@router.get("/stream")
async def onboard_stream(
    goals: str = Query(...),
    duration_days: int = Query(...),
    aesthetic: str = Query(...),
    life_area: str = Query(...),
    why_now: str = Query(...),
    past_blockers: str = Query(...),
    hours_per_day: int = Query(...),
    daily_rhythm: str = Query(...),
    page_public: bool = Query(True),
    current_user: User = Depends(get_current_user),
):
    """Generate the plan stage by stage, streaming an SSE event as each completes."""
    if duration_days < 1 or duration_days > 365:
        raise HTTPException(status_code=422, detail="duration_days must be between 1 and 365")

    body = OnboardingRequest(
        goals=goals, duration_days=duration_days, aesthetic=aesthetic, life_area=life_area,
        why_now=why_now, past_blockers=past_blockers, hours_per_day=hours_per_day,
        daily_rhythm=daily_rhythm, page_public=page_public,
    )
    user_id = current_user.id
    slug = current_user.slug

    async def event_stream():
        def sse(obj) -> str:
            return f"data: {json.dumps(obj)}\n\n"

        def stage(name) -> str:
            return sse({"event": name, "message": _STAGE_MESSAGES[name]})

        try:
            ctx = plan_inputs(
                goals=goals, duration_days=duration_days, aesthetic=aesthetic, life_area=life_area,
                why_now=why_now, past_blockers=past_blockers, hours_per_day=hours_per_day,
                daily_rhythm=daily_rhythm,
            )

            analysis = await plan_analysis(ctx)
            yield stage("analyzing")

            chapters = await plan_chapters(ctx, analysis)
            yield stage("chapters")

            tasks = await plan_tasks(ctx, analysis, chapters)
            yield stage("tasks")

            mission = await plan_mission(ctx, analysis)
            yield stage("mission")

            theme = await plan_theme(ctx)
            yield stage("theme")

            signal = await plan_signal_day1(ctx, day1_contents(tasks))
            yield stage("signal")

            plan = assemble_plan(theme, mission, chapters, signal, tasks)

            # Persist in a fresh session (request-scoped deps may be torn down mid-stream)
            async with AsyncSessionLocal() as db:
                user = await db.scalar(select(User).where(User.id == user_id))
                await _persist_plan(db, user, body, plan)

            resp = {
                "slug": slug,
                "public_url": f"https://{slug}.{settings.base_domain}",
                "message": "Your accountability plan is live.",
            }
            yield sse({"event": "done", "data": resp})
        except Exception as exc:
            yield sse({"event": "error", "message": f"Plan generation failed: {exc}"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
