import math
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.goal import Goal
from models.signal_wall import SignalWall
from models.task import DailyTask
from models.theme import Theme
from models.user import User
from services.llm import generate_projected_outcome
from trial import require_active_access

router = APIRouter(tags=["journey"])


def _d(d) -> str | None:
    return d.isoformat() if d else None


@router.get("/journey")
async def journey(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active_access),
):
    goal = await db.scalar(
        select(Goal).where(Goal.user_id == current_user.id, Goal.status == "active")
    )
    theme = await db.scalar(select(Theme).where(Theme.user_id == current_user.id))
    if not goal or not theme:
        raise HTTPException(status_code=404, detail="No active journey found")

    # Generate + cache the projected outcome on first visit
    if not theme.projected_outcome:
        try:
            theme.projected_outcome = await generate_projected_outcome(
                goal_description=goal.description,
                duration_days=goal.duration_days,
                hours_per_day=goal.hours_per_day,
                life_area=goal.life_area,
            )
            await db.commit()
        except Exception:
            # Non-fatal: leave null, frontend falls back to the mission statement
            await db.rollback()

    # All tasks for the goal, grouped by date
    tasks_res = await db.execute(
        select(DailyTask).where(DailyTask.goal_id == goal.id).order_by(DailyTask.id)
    )
    tasks_by_date: dict[date, list[DailyTask]] = {}
    for t in tasks_res.scalars().all():
        tasks_by_date.setdefault(t.task_date, []).append(t)

    # All signal wall entries, keyed by date
    sw_res = await db.execute(select(SignalWall).where(SignalWall.user_id == current_user.id))
    signal_by_date = {sw.entry_date: sw for sw in sw_res.scalars().all()}

    today = date.today()
    start = goal.start_date
    total_days = goal.duration_days
    num_weeks = math.ceil(total_days / 7)

    today_day_number = (today - start).days + 1  # 1-indexed; may be <1 or >total
    if today_day_number < 1:
        current_week_index = -1
    elif today_day_number > total_days:
        current_week_index = num_weeks  # whole plan is in the past
    else:
        current_week_index = (today_day_number - 1) // 7

    total_tasks = 0
    total_completed = 0
    weeks = []

    for w in range(num_weeks):
        start_day = w * 7 + 1
        end_day = min((w + 1) * 7, total_days)
        days = []
        wk_total = 0
        wk_completed = 0

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
            days.append({
                "day_number": day_number,
                "date": _d(d),
                "is_today": d == today,
                "is_past": d < today,
                "is_future": d > today,
                "completed": t_total > 0 and t_done == t_total,
                "tasks_total": t_total,
                "tasks_completed": t_done,
                "tasks": [
                    {"content": t.content, "voice_style": t.voice_style, "completed": t.completed}
                    for t in day_tasks
                ],
                "signal": {
                    "ai_summary": sw.ai_summary,
                    "tasks_completed": sw.tasks_completed,
                    "tasks_total": sw.tasks_total,
                } if sw else None,
            })

        if w < current_week_index:
            status = "completed"
        elif w == current_week_index:
            status = "current"
        else:
            status = "future"

        titles = theme.chapter_titles or []
        weeks.append({
            "index": w,
            "title": titles[w] if w < len(titles) else f"Week {w + 1}",
            "status": status,
            "start_day": start_day,
            "end_day": end_day,
            "tasks_total": wk_total,
            "tasks_completed": wk_completed,
            "days": days,
        })

    pct = round((total_completed / total_tasks) * 100) if total_tasks else 0
    day_display = min(max(today_day_number, 1), total_days)

    return {
        "user": {"name": current_user.name, "slug": current_user.slug,
                 "streak_days": current_user.streak_days, "page_public": current_user.page_public},
        "goal": {
            "id": str(goal.id), "description": goal.description, "duration_days": goal.duration_days,
            "hours_per_day": goal.hours_per_day, "life_area": goal.life_area,
            "start_date": _d(goal.start_date), "end_date": _d(goal.end_date),
        },
        "theme": {
            "color_palette": theme.color_palette, "mission_statement": theme.mission_statement,
            "chapter_titles": theme.chapter_titles or [],
        },
        "projected_outcome": theme.projected_outcome,
        "progress": {
            "day": day_display, "total_days": total_days, "pct": pct,
            "tasks_completed": total_completed, "tasks_total": total_tasks,
            "current_week": current_week_index,
        },
        "weeks": weeks,
    }
