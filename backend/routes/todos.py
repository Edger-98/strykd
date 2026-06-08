import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from deps import get_current_user
from models.task import DailyTask
from models.user import User
from trial import require_active_access

router = APIRouter(prefix="/todos", tags=["todos"])

_PRIORITIES = {"high", "medium", "low"}
_RECURRING = {"daily", "weekly"}


def _todo_dict(t: DailyTask) -> dict:
    return {
        "id": str(t.id),
        "content": t.content,
        "completed": t.completed,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        "task_date": t.task_date.isoformat() if t.task_date else None,
        "due_date": t.due_date.isoformat() if t.due_date else None,
        "priority": t.priority,
        "tags": t.tags or [],
        "recurring": t.recurring,
        "notes": t.notes or "",
        "parent_id": str(t.parent_id) if t.parent_id else None,
        "sort_order": t.sort_order,
    }


def _norm_priority(p):
    return p if p in _PRIORITIES else None


def _norm_recurring(r):
    return r if r in _RECURRING else None


def _parse_date(s):
    if not s:
        return None
    try:
        return date.fromisoformat(s)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date")


class TodoCreate(BaseModel):
    content: str
    due_date: str | None = None
    priority: str | None = None
    tags: list[str] | None = None
    recurring: str | None = None
    notes: str | None = None
    parent_id: str | None = None


class TodoUpdate(BaseModel):
    content: str | None = None
    completed: bool | None = None
    due_date: str | None = None
    priority: str | None = None
    tags: list[str] | None = None
    recurring: str | None = None
    notes: str | None = None


async def _owned(todo_id: str, user: User, db: AsyncSession) -> DailyTask:
    try:
        tid = uuid.UUID(todo_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid id")
    t = await db.scalar(select(DailyTask).where(DailyTask.id == tid))
    if not t or t.user_id != user.id:
        raise HTTPException(status_code=404, detail="Todo not found")
    return t


@router.get("")
async def list_todos(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All of the user's manual todos, plus a contribution grid of completions."""
    res = await db.execute(
        select(DailyTask).where(
            DailyTask.user_id == current_user.id, DailyTask.is_quick.is_(True)
        ).order_by(DailyTask.sort_order, DailyTask.id)
    )
    todos = res.scalars().all()

    # Contribution grid: last 12 weeks, colored by todos completed each day.
    today = date.today()
    done_by_day: dict[date, int] = defaultdict(int)
    due_by_day: dict[date, int] = defaultdict(int)
    for t in todos:
        if t.completed and t.completed_at:
            done_by_day[t.completed_at.astimezone(timezone.utc).date()] += 1
        d = t.due_date or t.task_date
        if d:
            due_by_day[d] += 1

    grid = []
    start = today - timedelta(days=83)
    for i in range(84):
        d = start + timedelta(days=i)
        done = done_by_day.get(d, 0)
        total = max(done, due_by_day.get(d, 0))
        grid.append({
            "date": d.isoformat(), "day_number": i + 1,
            "tasks_total": total, "tasks_completed": done,
            "completed": total > 0 and done >= total,
            "is_today": d == today, "is_past": d < today, "is_future": d > today,
        })

    all_tags = sorted({tag for t in todos for tag in (t.tags or [])})
    return {
        "todos": [_todo_dict(t) for t in todos],
        "tags": all_tags,
        "grid": grid,
        "user": {
            "name": current_user.name, "slug": current_user.slug,
            "avatar_url": current_user.avatar_url, "page_public": current_user.page_public,
        },
    }


@router.post("", status_code=201)
async def create_todo(
    body: TodoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active_access),
):
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="Task content required")
    due = _parse_date(body.due_date)
    parent = None
    if body.parent_id:
        parent = await _owned(body.parent_id, current_user, db)
    todo = DailyTask(
        user_id=current_user.id, goal_id=None, is_quick=True,
        task_date=due or date.today(), content=content, voice_style="direct",
        due_date=due, priority=_norm_priority(body.priority),
        tags=[t.strip() for t in (body.tags or []) if t.strip()] or None,
        recurring=_norm_recurring(body.recurring), notes=(body.notes or "").strip() or None,
        parent_id=parent.id if parent else None,
    )
    db.add(todo)
    await db.commit()
    await db.refresh(todo)
    return _todo_dict(todo)


@router.patch("/{todo_id}")
async def update_todo(
    todo_id: str,
    body: TodoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active_access),
):
    t = await _owned(todo_id, current_user, db)
    spawned = None

    if body.content is not None:
        c = body.content.strip()
        if c:
            t.content = c
    if body.due_date is not None:
        t.due_date = _parse_date(body.due_date)
        if t.due_date:
            t.task_date = t.due_date
    if body.priority is not None:
        t.priority = _norm_priority(body.priority)
    if body.tags is not None:
        t.tags = [x.strip() for x in body.tags if x.strip()] or None
    if body.recurring is not None:
        t.recurring = _norm_recurring(body.recurring)
    if body.notes is not None:
        t.notes = body.notes.strip() or None

    if body.completed is not None and body.completed != t.completed:
        t.completed = body.completed
        t.completed_at = datetime.now(timezone.utc) if body.completed else None
        # Completing a recurring todo schedules the next occurrence.
        if body.completed and t.recurring in _RECURRING and t.parent_id is None:
            step = 1 if t.recurring == "daily" else 7
            base = t.due_date or date.today()
            nxt = base + timedelta(days=step)
            spawned = DailyTask(
                user_id=current_user.id, goal_id=None, is_quick=True,
                task_date=nxt, content=t.content, voice_style="direct",
                due_date=nxt, priority=t.priority, tags=t.tags, recurring=t.recurring,
                notes=t.notes,
            )
            db.add(spawned)

    await db.commit()
    await db.refresh(t)
    out = _todo_dict(t)
    if spawned is not None:
        await db.refresh(spawned)
        out["spawned"] = _todo_dict(spawned)
    return out


@router.delete("/{todo_id}", status_code=204)
async def delete_todo(
    todo_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active_access),
):
    t = await _owned(todo_id, current_user, db)
    # delete subtasks first
    subs = await db.execute(select(DailyTask).where(DailyTask.parent_id == t.id))
    for s in subs.scalars().all():
        await db.delete(s)
    await db.delete(t)
    await db.commit()
    return
