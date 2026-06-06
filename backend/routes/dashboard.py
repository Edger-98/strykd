import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from deps import get_current_user
from models.encouragement import Encouragement
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
        "sort_order": t.sort_order,
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
        ).order_by(DailyTask.sort_order, DailyTask.id)
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
        "page_public": goal.page_public,
        "streak_days": goal.streak_days,
        "chapter_titles": goal.chapter_titles or [],
        "progress": {"day": day, "total_days": goal.duration_days, "pct": pct,
                     "tasks_completed": done, "tasks_total": total},
        "today_tasks": [_task_dict(t, detailed) for t in today_tasks],
    }


async def _build_payload(user: User, db: AsyncSession, detailed: bool, include_paused: bool = False) -> dict:
    theme = await db.scalar(select(Theme).where(Theme.user_id == user.id))
    today = date.today()

    statuses = ["active", "paused"] if include_paused else ["active"]
    conds = [Goal.user_id == user.id, Goal.status.in_(statuses)]
    if not detailed:
        # Public page: only goals the user has marked public
        conds.append(Goal.page_public.is_(True))
    goals_res = await db.execute(
        select(Goal).where(*conds).order_by(Goal.start_date)
    )
    goals = goals_res.scalars().all()
    goal_sections = [await _goal_section(g, db, today, detailed) for g in goals]

    sw_res = await db.execute(
        select(SignalWall).where(SignalWall.user_id == user.id)
        .order_by(SignalWall.entry_date.desc()).limit(7)
    )
    wall = sw_res.scalars().all()

    enc_res = await db.execute(
        select(Encouragement).where(Encouragement.user_id == user.id)
        .order_by(Encouragement.created_at.desc()).limit(10)
    )
    encouragements = enc_res.scalars().all()

    return {
        "user": {
            "name": user.name, "slug": user.slug,
            "streak_days": user.streak_days, "page_public": user.page_public,
            "avatar_url": user.avatar_url, "bio": user.bio or "",
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
        "encouragements": [
            {
                "visitor_name": e.visitor_name, "message": e.message,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in encouragements
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


class EncourageRequest(BaseModel):
    visitor_name: str
    message: str


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/public/{slug}/encourage", status_code=201)
async def encourage(slug: str, body: EncourageRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.slug == slug))
    if not user or not user.page_public:
        raise HTTPException(status_code=404, detail="Page not found")

    name = (body.visitor_name or "").strip()[:40] or "Someone"
    message = (body.message or "").strip()
    if not message:
        raise HTTPException(status_code=422, detail="Message required")
    if len(message) > 140:
        raise HTTPException(status_code=422, detail="Message must be 140 characters or fewer")

    ip = _client_ip(request)
    # Rate limit: 1 per IP per hour for this page
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = await db.scalar(
        select(func.count()).select_from(Encouragement).where(
            Encouragement.user_id == user.id,
            Encouragement.ip == ip,
            Encouragement.created_at >= one_hour_ago,
        )
    ) or 0
    if recent > 0:
        raise HTTPException(status_code=429, detail="You can leave one message per hour. Check back soon.")

    enc = Encouragement(user_id=user.id, visitor_name=name, message=message, ip=ip)
    db.add(enc)
    await db.commit()
    await db.refresh(enc)
    await bust_public_page(slug)
    return {
        "visitor_name": enc.visitor_name, "message": enc.message,
        "created_at": enc.created_at.isoformat() if enc.created_at else None,
    }


@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = await _build_payload(current_user, db, detailed=True, include_paused=True)

    data["user"]["id"] = str(current_user.id)
    data["user"]["email"] = current_user.email
    data["user"]["avatar_url"] = current_user.avatar_url
    data["user"]["timezone"] = current_user.timezone
    data["user"]["subscription_active"] = current_user.subscription_active
    data["trial"] = trial_status(current_user)

    # Manual "quick tasks" for today (no goal)
    today = date.today()
    qt_res = await db.execute(
        select(DailyTask).where(
            DailyTask.user_id == current_user.id,
            DailyTask.is_quick.is_(True),
            DailyTask.task_date == today,
        ).order_by(DailyTask.sort_order, DailyTask.id)
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


class TaskUpdate(BaseModel):
    content: str | None = None
    completed: bool | None = None


async def _owned_task(task_id: str, current_user: User, db: AsyncSession) -> DailyTask:
    try:
        tid = uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid task ID")
    task = await db.scalar(select(DailyTask).where(DailyTask.id == tid))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.user_id and task.user_id == current_user.id:
        return task
    if task.goal_id:
        goal = await db.scalar(
            select(Goal).where(Goal.id == task.goal_id, Goal.user_id == current_user.id)
        )
        if goal:
            return task
    raise HTTPException(status_code=403, detail="Not your task")


@router.patch("/tasks/{task_id}")
async def update_task(
    task_id: str,
    body: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active_access),
):
    """Edit task text and/or toggle completion (supports unchecking)."""
    task = await _owned_task(task_id, current_user, db)

    if body.content is not None:
        content = body.content.strip()
        if not content:
            raise HTTPException(status_code=422, detail="Task content required")
        task.content = content

    if body.completed is not None and body.completed != task.completed:
        today = date.today()
        if body.completed:
            task.completed = True
            task.completed_at = datetime.now(timezone.utc)
            if task.goal_id:
                goal = await db.scalar(select(Goal).where(Goal.id == task.goal_id))
                if goal and goal.last_checkin != today:
                    goal.streak_days += 1
                    goal.last_checkin = today
            else:
                if current_user.last_checkin != today:
                    current_user.streak_days += 1
                    current_user.last_checkin = today
        else:
            # Unchecking: reverse a same-day streak increment if this was the
            # task that earned it and no other task today remains completed.
            task.completed = False
            task.completed_at = None
            if task.goal_id:
                goal = await db.scalar(select(Goal).where(Goal.id == task.goal_id))
                if goal and goal.last_checkin == today:
                    remaining = await db.scalar(
                        select(func.count()).select_from(DailyTask).where(
                            DailyTask.goal_id == task.goal_id,
                            DailyTask.task_date == today,
                            DailyTask.completed.is_(True),
                        )
                    ) or 0
                    if remaining == 0 and goal.streak_days > 0:
                        goal.streak_days -= 1
                        goal.last_checkin = None
            else:
                if current_user.last_checkin == today:
                    remaining = await db.scalar(
                        select(func.count()).select_from(DailyTask).where(
                            DailyTask.user_id == current_user.id,
                            DailyTask.is_quick.is_(True),
                            DailyTask.task_date == today,
                            DailyTask.completed.is_(True),
                        )
                    ) or 0
                    if remaining == 0 and current_user.streak_days > 0:
                        current_user.streak_days -= 1
                        current_user.last_checkin = None

    await db.commit()
    await db.refresh(task)
    await bust_public_page(current_user.slug)
    return _task_dict(task, detailed=True)


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active_access),
):
    """Delete a task. For AI tasks this only removes today's instance."""
    task = await _owned_task(task_id, current_user, db)
    await db.delete(task)
    await db.commit()
    await bust_public_page(current_user.slug)
    return


class ReorderRequest(BaseModel):
    task_ids: list[str]


@router.post("/tasks/reorder")
async def reorder_tasks(
    body: ReorderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active_access),
):
    """Persist a new ordering for a set of tasks (within a single day/goal)."""
    for idx, tid in enumerate(body.task_ids):
        task = await _owned_task(tid, current_user, db)
        task.sort_order = idx
    await db.commit()
    await bust_public_page(current_user.slug)
    return {"message": "Reordered", "count": len(body.task_ids)}
