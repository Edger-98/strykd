import asyncio
import json
import logging
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
from services.cache import bust_public_page
from services.llm import (
    assemble_plan, assess_feasibility, clarify_goal, day1_contents, generate_plan,
    plan_chapters, plan_inputs, plan_mission, plan_signal_day1, plan_task_range, plan_theme,
)

logger = logging.getLogger("strykd.onboarding")

# Days generated up front in the request; the rest fill in via a background task.
SEED_DAYS = 7
# Keep references to background tasks so they are not garbage collected mid-run.
_BG_TASKS: set = set()

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class ClarifyMessage(BaseModel):
    role: str  # 'ai' | 'user'
    content: str


class ClarifyRequest(BaseModel):
    conversation: list[ClarifyMessage]
    life_area: str | None = None


@router.post("/clarify")
async def clarify(
    body: ClarifyRequest,
    current_user: User = Depends(get_current_user),
):
    """Lightweight goal-clarification chat turn. No plan generation here."""
    convo = [{"role": m.role, "content": m.content} for m in body.conversation]
    try:
        return await clarify_goal(convo, body.life_area)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Clarification failed: {exc}")


class FeasibilityRequest(BaseModel):
    goal: str
    duration_days: int
    goal_type: str = "sprint"


@router.post("/validate-goal")
async def validate_goal(body: FeasibilityRequest, current_user: User = Depends(get_current_user)):
    """Check if the chosen duration is realistic for the goal. Never blocks onboarding."""
    try:
        return await assess_feasibility(body.goal, body.duration_days, body.goal_type)
    except Exception:
        return {"feasible": True, "recommended_days": body.duration_days, "message": ""}


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
    goal_type: str = "sprint"  # sprint (finite) | lifestyle (ongoing habit)
    ai_recommended_days: int | None = None


class OnboardingResponse(BaseModel):
    slug: str
    public_url: str
    message: str


async def _persist_plan(db: AsyncSession, user: User, body: OnboardingRequest, plan: dict) -> Goal:
    """Persist a generated plan: goal, daily tasks, theme (first goal), Day 1 signal."""
    today = date.today()
    lifestyle = body.goal_type == "lifestyle"
    end_date = None if lifestyle else today + timedelta(days=body.duration_days - 1)

    # Honor the public/private page toggle
    user.page_public = body.page_public

    # Start the 3-day free trial clock on first onboarding
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
        goal_type=body.goal_type,
        ai_recommended_days=body.ai_recommended_days,
    )
    db.add(goal)
    await db.flush()  # populate goal.id before FK refs

    task_count_day1 = 0
    for day_entry in plan.get("daily_tasks", []):
        day_num = int(day_entry["day"])
        task_date = today + timedelta(days=day_num - 1)
        for task in day_entry.get("tasks", []):
            dur = task.get("duration")
            db.add(DailyTask(
                goal_id=goal.id,
                user_id=user.id,
                task_date=task_date,
                content=task["content"],
                voice_style=task.get("voice_style", "direct"),
                duration_minutes=int(dur) if isinstance(dur, (int, float)) else None,
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
    await db.refresh(goal)
    return goal


@router.post("", response_model=OnboardingResponse)
async def onboard(
    body: OnboardingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # No payment required: completing onboarding starts a 3-day, no-card free trial.
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
    "chapters": "Building your chapter map...",
    "tasks": "Writing your personalized daily tasks...",
    "mission": "Crafting your mission statement...",
    "theme": "Creating your visual identity...",
    "signal": "Writing your Day 1 signal wall entry...",
}


async def _generate_remaining_days(goal_id, ctx: dict, start_day: int, end_day: int, base_date: date, slug: str):
    """Background fill of day start..end after the user already has their plan.
    Generated in concurrent chunks; skips any day the nightly cron already wrote."""
    try:
        async with AsyncSessionLocal() as db:
            goal = await db.scalar(select(Goal).where(Goal.id == goal_id))
            if goal is None:
                return
            d = start_day
            while d <= end_day:
                chunk_end = min(d + SEED_DAYS - 1, end_day)
                entries = await plan_task_range(ctx, d, chunk_end)
                for entry in entries:
                    td = base_date + timedelta(days=int(entry["day"]) - 1)
                    exists = await db.scalar(
                        select(DailyTask).where(DailyTask.goal_id == goal_id, DailyTask.task_date == td)
                    )
                    if exists:
                        continue
                    for t in entry.get("tasks", []):
                        dur = t.get("duration")
                        db.add(DailyTask(
                            goal_id=goal_id, user_id=goal.user_id, task_date=td,
                            content=t["content"], voice_style=t.get("voice_style", "direct"),
                            duration_minutes=int(dur) if isinstance(dur, (int, float)) else None,
                        ))
                await db.commit()
                d = chunk_end + 1
        await bust_public_page(slug)
    except Exception as exc:  # background, never surfaces to the user
        logger.error("Background day generation failed for goal %s: %s", goal_id, exc)


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
    goal_type: str = Query("sprint"),
    ai_recommended_days: int | None = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Generate the plan stage by stage, streaming an SSE event as each completes."""
    if duration_days < 1 or duration_days > 365:
        raise HTTPException(status_code=422, detail="duration_days must be between 1 and 365")

    body = OnboardingRequest(
        goals=goals, duration_days=duration_days, aesthetic=aesthetic, life_area=life_area,
        why_now=why_now, past_blockers=past_blockers, hours_per_day=hours_per_day,
        daily_rhythm=daily_rhythm, page_public=page_public,
        goal_type=goal_type, ai_recommended_days=ai_recommended_days,
    )
    user_id = current_user.id
    slug = current_user.slug

    async def event_stream():
        def sse(obj) -> str:
            return f"data: {json.dumps(obj)}\n\n"

        try:
            ctx = plan_inputs(
                goals=goals, duration_days=duration_days, aesthetic=aesthetic, life_area=life_area,
                why_now=why_now, past_blockers=past_blockers, hours_per_day=hours_per_day,
                daily_rhythm=daily_rhythm,
            )
            seed_end = min(duration_days, SEED_DAYS)

            # Theme, chapters, mission, and the first week of tasks all run at once;
            # each emits its event the moment it finishes (order is whoever wins).
            async def labeled(name, coro):
                return name, await coro

            pending = {
                asyncio.ensure_future(labeled("theme", plan_theme(ctx))),
                asyncio.ensure_future(labeled("chapters", plan_chapters(ctx, {}))),
                asyncio.ensure_future(labeled("mission", plan_mission(ctx, {}))),
                asyncio.ensure_future(labeled("tasks", plan_task_range(ctx, 1, seed_end))),
            }
            results = {}
            for fut in asyncio.as_completed(pending):
                name, value = await fut
                results[name] = value
                yield sse({"event": name, "message": _STAGE_MESSAGES[name]})

            # Day 1 signal needs the first day's tasks, so it runs last (quick).
            signal = await plan_signal_day1(ctx, day1_contents(results["tasks"]))
            yield sse({"event": "signal", "message": _STAGE_MESSAGES["signal"]})

            plan = assemble_plan(results["theme"], results["mission"], results["chapters"], signal, results["tasks"])

            async with AsyncSessionLocal() as db:
                user = await db.scalar(select(User).where(User.id == user_id))
                goal = await _persist_plan(db, user, body, plan)
                goal_id = goal.id

            # Remaining days generate in the background; user is already done.
            # Lifestyle goals have no end: seed a ~30-day runway, the nightly cron rolls forever.
            fill_end = min(duration_days, seed_end + 23) if goal_type == "lifestyle" else duration_days
            if fill_end > seed_end:
                t = asyncio.ensure_future(
                    _generate_remaining_days(goal_id, ctx, seed_end + 1, fill_end, date.today(), slug)
                )
                _BG_TASKS.add(t)
                t.add_done_callback(_BG_TASKS.discard)

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
