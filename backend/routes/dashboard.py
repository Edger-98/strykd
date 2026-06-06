import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from deps import get_current_user
from models.goal import Goal
from models.signal_wall import SignalWall
from models.task import DailyTask
from models.theme import Theme
from models.user import User
from services.cache import bust_public_page, get_public_page, set_public_page
from trial import require_active_access, trial_status

router = APIRouter(tags=["dashboard"])


def _d(d) -> str | None:
    return d.isoformat() if d else None


def _task_dict(t: DailyTask, detailed: bool = False) -> dict:
    out = {
        "id": str(t.id),
        "content": t.content,
        "voice_style": t.voice_style,
        "completed": t.completed,
        "task_date": _d(t.task_date),
    }
    if detailed:
        out["goal_id"] = str(t.goal_id) if t.goal_id else None
        out["completed_at"] = t.completed_at.isoformat() if t.completed_at else None
    return out


async def _goal_section(goal: Goal, db: AsyncSession, today: date, detailed: bool) -> dict:
    # today's tasks for this goal
    res = await db.execute(
        select(DailyTask).where(
            DailyTask.goal_id == goal.id, DailyTask.task_date == today
        ).order_by(DailyTask.id)
    )
    today_tasks = res.scalars().all()

    # overall completion (for the progress arc)
    total = await db.scalar(select(func.count()).select_from(DailyTask).where(DailyTask.goal_id == goal.id)) or 0
    done = await db.scalar(
        select(func.count()).select_from(DailyTask).where(DailyTask.goal_id == goal.id, DailyTask.completed.is_(True))
    ) or 0
    elapsed = (today - goal.start_date).days
    day = min(max(elapsed + 1, 1), goal.duration_days)
    pct = round(done / total * 100) if total else 0

    return {
        "id": str(goal.id),
        "description": goal.description,
        "life_area": goal.life_area,
        "duration_days": goal.duration_days,
        "start_date": _d(goal.start_date),
        "end_date": _d(goal.end_date),
        "status": goal.status,
        "streak_days": goal.streak_days,
        "chapter_titles": goal.chapter_titles or [],
        "progress": {"day": day, "total_days": goal.duration_days, "pct": pct,
                     "tasks_completed": done, "tasks_total": total},
        "today_tasks": [_task_dict(t, detailed) for t in today_tasks],
    }


async def _build_payload(user: User, db: AsyncSession, detailed: bool) -> dict:
    theme = await db.scalar(select(Theme).where(Theme.user_id == user.id))
    today = date.today()

    goals_res = await db.execute(
        select(Goal).where(Goal.user_id == user.id, Goal.status == "active").order_by(Goal.start_date)
    )
    goals = goals_res.scalars().all()
    goal_sections = [await _goal_section(g, db, today, detailed) for g in goals]

    sw_res = await db.execute(
        select(SignalWall).where(SignalWall.user_id == user.id)
        .order_by(SignalWall.entry_date.desc()).limit(7)
    )
    wall = sw_res.scalars().all()

    return {
        "user": {
            "name": user.name, "slug": user.slug,
            "streak_days": user.streak_days, "page_public": user.page_public,
        },
        "theme": {
            "color_palette": theme.color_palette,
            "typography_variant": theme.typography_variant,
            "layout_variant": theme.layout_variant,
            "mission_statement": theme.mission_statement,
            "daily_headline": theme.daily_headline or "",
        } if theme else None,
        "goals": goal_sections,
        "signal_wall": [
            {
                "entry_date": _d(sw.entry_date), "ai_summary": sw.ai_summary,
                "tasks_completed": sw.tasks_completed, "tasks_total": sw.tasks_total,
                "goal_id": str(sw.goal_id) if sw.goal_id else None,
            }
            for sw in wall
        ],
    }


@router.get("/public/{slug}")
async def public_page(slug: str, db: AsyncSession = Depends(get_db)):
    cached = await get_public_page(slug)
    if cached:
        return cached

    user = await db.scalar(select(User).where(User.slug == slug))
    if not user:
        raise HTTPException(status_code=404, detail="Page not found")
    if not user.page_public:
        raise HTTPException(status_code=404, detail="Page not found")

    data = await _build_payload(user, db, detailed=False)
    await set_public_page(slug, data, ttl=600)
    return data


@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = await _build_payload(current_user, db, detailed=True)

    data["user"]["id"] = str(current_user.id)
    data["user"]["email"] = current_user.email
    data["user"]["subscription_active"] = current_user.subscription_active
    data["trial"] = trial_status(current_user)

    # Manual "quick tasks" for today (no goal)
    today = date.today()
    qt_res = await db.execute(
        select(DailyTask).where(
            DailyTask.user_id == current_user.id,
            DailyTask.is_quick.is_(True),
            DailyTask.task_date == today,
        ).order_by(DailyTask.id)
    )
    data["quick_tasks"] = [_task_dict(t, detailed=True) for t in qt_res.scalars().all()]
    return data


class QuickTaskRequest(BaseModel):
    content: str


@router.post("/tasks/quick")
async def add_quick_task(
    body: QuickTaskRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active_access),
):
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="Task content required")

    task = DailyTask(
        user_id=current_user.id,
        goal_id=None,
        is_quick=True,
        task_date=date.today(),
        content=content,
        voice_style="direct",
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    await bust_public_page(current_user.slug)
    return _task_dict(task, detailed=True)


@router.patch("/tasks/{task_id}/complete")
async def complete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active_access),
):
    try:
        tid = uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid task ID")

    task = await db.scalar(select(DailyTask).where(DailyTask.id == tid))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    goal = None
    if task.goal_id:
        goal = await db.scalar(
            select(Goal).where(Goal.id == task.goal_id, Goal.user_id == current_user.id)
        )
        if not goal:
            raise HTTPException(status_code=403, detail="Not your task")
    elif task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your task")

    today = date.today()

    if task.completed:
        streak = goal.streak_days if goal else current_user.streak_days
        return {"message": "Already completed", "streak_days": streak}

    task.completed = True
    task.completed_at = datetime.now(timezone.utc)

    # Per-goal streak for AI tasks; user (personal) streak for quick tasks.
    if goal:
        if goal.last_checkin != today:
            goal.streak_days += 1
            goal.last_checkin = today
        streak = goal.streak_days
    else:
        if current_user.last_checkin != today:
            current_user.streak_days += 1
            current_user.last_checkin = today
        streak = current_user.streak_days

    await db.commit()
    await bust_public_page(current_user.slug)

    return {
        "task_id": task_id,
        "goal_id": str(task.goal_id) if task.goal_id else None,
        "message": "Task completed",
        "streak_days": streak,
        "user_streak": current_user.streak_days,
    }
