import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from deps import get_current_user
from models.goal import Goal
from models.signal_wall import SignalWall
from models.task import DailyTask
from models.theme import Theme
from models.user import User
from services.cache import bust_public_page, get_public_page, set_public_page

router = APIRouter(tags=["dashboard"])


def _d(d) -> str | None:
    return d.isoformat() if d else None


async def _build_public_data(slug: str, db: AsyncSession) -> dict:
    user = await db.scalar(select(User).where(User.slug == slug))
    if not user:
        return None

    theme = await db.scalar(select(Theme).where(Theme.user_id == user.id))

    goals_res = await db.execute(
        select(Goal).where(Goal.user_id == user.id, Goal.status == "active")
    )
    goals = goals_res.scalars().all()

    today = date.today()
    today_tasks = []
    for goal in goals:
        res = await db.execute(
            select(DailyTask).where(
                DailyTask.goal_id == goal.id,
                DailyTask.task_date == today,
            ).order_by(DailyTask.id)
        )
        today_tasks.extend(res.scalars().all())

    sw_res = await db.execute(
        select(SignalWall)
        .where(SignalWall.user_id == user.id)
        .order_by(SignalWall.entry_date.desc())
        .limit(7)
    )
    wall = sw_res.scalars().all()

    return {
        "user": {
            "name": user.name,
            "slug": user.slug,
            "streak_days": user.streak_days,
            "page_public": user.page_public,
        },
        "theme": {
            "color_palette": theme.color_palette,
            "typography_variant": theme.typography_variant,
            "layout_variant": theme.layout_variant,
            "mission_statement": theme.mission_statement,
            "chapter_titles": theme.chapter_titles or [],
            "daily_headline": theme.daily_headline or "",
        } if theme else None,
        "goals": [
            {
                "id": str(g.id),
                "description": g.description,
                "duration_days": g.duration_days,
                "start_date": _d(g.start_date),
                "end_date": _d(g.end_date),
                "status": g.status,
            }
            for g in goals
        ],
        "today_tasks": [
            {
                "id": str(t.id),
                "content": t.content,
                "voice_style": t.voice_style,
                "completed": t.completed,
                "task_date": _d(t.task_date),
            }
            for t in today_tasks
        ],
        "signal_wall": [
            {
                "entry_date": _d(sw.entry_date),
                "ai_summary": sw.ai_summary,
                "tasks_completed": sw.tasks_completed,
                "tasks_total": sw.tasks_total,
            }
            for sw in wall
        ],
    }


@router.get("/public/{slug}")
async def public_page(slug: str, db: AsyncSession = Depends(get_db)):
    cached = await get_public_page(slug)
    if cached:
        return cached

    data = await _build_public_data(slug, db)
    if not data:
        raise HTTPException(status_code=404, detail="Page not found")

    # Respect the public/private toggle — private pages 404 to anonymous visitors
    if not data["user"].get("page_public", True):
        raise HTTPException(status_code=404, detail="Page not found")

    await set_public_page(slug, data, ttl=600)
    return data


@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = await _build_public_data(current_user.slug, db)
    if not data:
        raise HTTPException(status_code=404, detail="User data not found")

    # Augment private fields not exposed on public page
    data["user"]["id"] = str(current_user.id)
    data["user"]["email"] = current_user.email
    data["user"]["subscription_active"] = current_user.subscription_active

    # Include completed_at for private dashboard
    today = date.today()
    goals_res = await db.execute(
        select(Goal).where(Goal.user_id == current_user.id, Goal.status == "active")
    )
    goals = goals_res.scalars().all()

    detailed_tasks = []
    for goal in goals:
        res = await db.execute(
            select(DailyTask).where(
                DailyTask.goal_id == goal.id,
                DailyTask.task_date == today,
            ).order_by(DailyTask.id)
        )
        for t in res.scalars().all():
            detailed_tasks.append({
                "id": str(t.id),
                "goal_id": str(t.goal_id),
                "content": t.content,
                "voice_style": t.voice_style,
                "completed": t.completed,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                "task_date": _d(t.task_date),
            })

    data["today_tasks"] = detailed_tasks
    return data


@router.patch("/tasks/{task_id}/complete")
async def complete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        tid = uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid task ID")

    task = await db.scalar(select(DailyTask).where(DailyTask.id == tid))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    goal = await db.scalar(
        select(Goal).where(Goal.id == task.goal_id, Goal.user_id == current_user.id)
    )
    if not goal:
        raise HTTPException(status_code=403, detail="Not your task")

    if task.completed:
        return {"message": "Already completed", "streak_days": current_user.streak_days}

    task.completed = True
    task.completed_at = datetime.now(timezone.utc)

    today = date.today()
    if current_user.last_checkin != today:
        current_user.streak_days += 1
        current_user.last_checkin = today

    await db.commit()
    await bust_public_page(current_user.slug)

    return {
        "task_id": task_id,
        "message": "Task completed",
        "streak_days": current_user.streak_days,
    }
