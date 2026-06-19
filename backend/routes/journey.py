import math
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from deps import get_current_user
from models.goal import Goal
from models.signal_wall import SignalWall
from models.task import DailyTask
from models.theme import Theme
from models.user import User
from routes.dashboard import build_grid
from services import s3
from services.cache import bust_public_page
from services.llm import generate_projected_outcome
from trial import require_active_access

router = APIRouter(tags=["journey"])


def _d(d) -> str | None:
    return d.isoformat() if d else None


async def _goal_journey(goal: Goal, db: AsyncSession, today: date) -> dict:
    # Generate + cache the projected outcome per goal on first visit
    if not goal.projected_outcome:
        try:
            goal.projected_outcome = await generate_projected_outcome(
                goal_description=goal.description,
                duration_days=goal.duration_days,
                hours_per_day=goal.hours_per_day,
                life_area=goal.life_area,
            )
            await db.commit()
        except Exception:
            await db.rollback()

    tasks_res = await db.execute(
        select(DailyTask).where(DailyTask.goal_id == goal.id).order_by(DailyTask.id)
    )
    tasks_by_date: dict[date, list[DailyTask]] = {}
    for t in tasks_res.scalars().all():
        tasks_by_date.setdefault(t.task_date, []).append(t)

    sw_res = await db.execute(select(SignalWall).where(SignalWall.goal_id == goal.id))
    signal_by_date = {sw.entry_date: sw for sw in sw_res.scalars().all()}

    start = goal.start_date
    total_days = goal.duration_days
    num_weeks = math.ceil(total_days / 7)
    today_day_number = (today - start).days + 1
    if today_day_number < 1:
        current_week_index = -1
    elif today_day_number > total_days:
        current_week_index = num_weeks
    else:
        current_week_index = (today_day_number - 1) // 7

    total_tasks = total_completed = 0
    weeks = []
    titles = goal.chapter_titles or []

    for w in range(num_weeks):
        start_day = w * 7 + 1
        end_day = min((w + 1) * 7, total_days)
        days = []
        wk_total = wk_completed = 0
        for day_number in range(start_day, end_day + 1):
            d = start + timedelta(days=day_number - 1)
            day_tasks = tasks_by_date.get(d, [])
            t_total = len(day_tasks)
            t_done = sum(1 for t in day_tasks if t.completed)
            wk_total += t_total
            wk_completed += t_done
            total_tasks += t_total
            total_completed += t_done
            sw = signal_by_date.get(d)
            proof_url = next((t.proof_url for t in day_tasks if t.proof_url), None)
            days.append({
                "day_number": day_number, "date": _d(d),
                "is_today": d == today, "is_past": d < today, "is_future": d > today,
                "completed": t_total > 0 and t_done == t_total,
                "tasks_total": t_total, "tasks_completed": t_done,
                "proof_url": s3.presign_get(proof_url),
                "is_video": bool(proof_url and proof_url.lower().endswith(".mp4")),
                "tasks": [{"content": t.content, "voice_style": t.voice_style, "completed": t.completed,
                           "proof_url": s3.presign_get(t.proof_url)} for t in day_tasks],
                "signal": {"ai_summary": sw.ai_summary, "tasks_completed": sw.tasks_completed,
                           "tasks_total": sw.tasks_total} if sw else None,
            })
        status = "completed" if w < current_week_index else ("current" if w == current_week_index else "future")
        weeks.append({
            "index": w, "title": titles[w] if w < len(titles) else f"Week {w + 1}",
            "status": status, "start_day": start_day, "end_day": end_day,
            "tasks_total": wk_total, "tasks_completed": wk_completed, "days": days,
        })

    pct = round((total_completed / total_tasks) * 100) if total_tasks else 0
    lifestyle = goal.goal_type == "lifestyle"
    prog_day = max(today_day_number, 1) if lifestyle else min(max(today_day_number, 1), total_days)
    return {
        "id": str(goal.id), "description": goal.description, "life_area": goal.life_area,
        "duration_days": total_days, "start_date": _d(goal.start_date), "end_date": _d(goal.end_date),
        "goal_type": goal.goal_type,
        "status": goal.status, "page_public": goal.page_public,
        "streak_days": goal.streak_days, "projected_outcome": goal.projected_outcome,
        "progress": {"day": prog_day, "total_days": None if lifestyle else total_days,
                     "pct": pct, "tasks_completed": total_completed, "tasks_total": total_tasks,
                     "current_week": current_week_index},
        "weeks": weeks,
    }


@router.get("/journey")
async def journey(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Viewing and managing your own goals (pause, delete) is never paywalled;
    # only the AI generation/replan features are gated by require_active_access.
    goals_res = await db.execute(
        select(Goal).where(
            Goal.user_id == current_user.id, Goal.status.in_(["active", "paused"])
        ).order_by(Goal.start_date)
    )
    goals = goals_res.scalars().all()
    if not goals:
        raise HTTPException(status_code=404, detail="No active journey found")

    theme = await db.scalar(select(Theme).where(Theme.user_id == current_user.id))
    today = date.today()
    goal_journeys = [await _goal_journey(g, db, today) for g in goals]

    return {
        "user": {"name": current_user.name, "slug": current_user.slug,
                 "streak_days": current_user.streak_days, "page_public": current_user.page_public},
        "theme": {"mission_statement": theme.mission_statement} if theme else None,
        "goals": goal_journeys,
    }


class GoalUpdate(BaseModel):
    status: str | None = None
    page_public: bool | None = None


@router.patch("/goals/{goal_id}")
async def update_goal(
    goal_id: str,
    body: GoalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pause/resume a goal or toggle its public visibility."""
    try:
        gid = uuid.UUID(goal_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid goal ID")
    goal = await db.scalar(
        select(Goal).where(Goal.id == gid, Goal.user_id == current_user.id)
    )
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    if body.status is not None:
        if body.status not in ("active", "paused"):
            raise HTTPException(status_code=422, detail="Status must be active or paused")
        goal.status = body.status
    if body.page_public is not None:
        goal.page_public = body.page_public

    await db.commit()
    await db.refresh(goal)
    await bust_public_page(current_user.slug)
    return {"id": str(goal.id), "status": goal.status, "page_public": goal.page_public}


@router.delete("/goals/{goal_id}", status_code=204)
async def delete_goal(
    goal_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete a goal and everything tied to it."""
    try:
        gid = uuid.UUID(goal_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid goal ID")
    goal = await db.scalar(select(Goal).where(Goal.id == gid, Goal.user_id == current_user.id))
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    await db.execute(delete(SignalWall).where(SignalWall.goal_id == gid))
    await db.execute(delete(DailyTask).where(DailyTask.goal_id == gid))
    await db.delete(goal)
    await db.commit()
    await bust_public_page(current_user.slug)
    return


@router.get("/goals/{goal_id}/grid")
async def goal_grid(
    goal_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Daily completion stats for every day in the goal period (contribution grid)."""
    try:
        gid = uuid.UUID(goal_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid goal ID")
    goal = await db.scalar(
        select(Goal).where(Goal.id == gid, Goal.user_id == current_user.id)
    )
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    days = await build_grid(goal, db, date.today())
    return {
        "goal_id": str(goal.id),
        "start_date": _d(goal.start_date),
        "duration_days": goal.duration_days,
        "days": days,
    }
