import secrets
import string
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from deps import get_current_user
from models.shared_list import SharedList, SharedListTask
from models.user import User
from services.llm import generate_itinerary

router = APIRouter(tags=["shared"])

_ALPHABET = string.ascii_lowercase + string.digits
MAX_TASKS = 200


def _gen_code() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(8))


def _list_dict(lst: SharedList, task_count: int | None = None, done_count: int | None = None) -> dict:
    out = {
        "name": lst.name,
        "description": lst.description or "",
        "unique_code": lst.unique_code,
        "itinerary": lst.itinerary,
        "created_at": lst.created_at.isoformat() if lst.created_at else None,
        "share_url": f"{settings.frontend_url}/shared/{lst.unique_code}",
    }
    if task_count is not None:
        out["task_count"] = task_count
        out["done_count"] = done_count
    return out


def _task_dict(t: SharedListTask) -> dict:
    return {
        "id": str(t.id),
        "content": t.content,
        "completed": t.completed,
        "completed_by": t.completed_by,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


# ── Owner (authenticated) ──────────────────────────────────────────────────
class ListCreate(BaseModel):
    name: str
    description: str | None = None


@router.post("/shared-lists", status_code=201)
async def create_list(body: ListCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="A name is required")
    code = _gen_code()
    for _ in range(5):
        if not await db.scalar(select(SharedList).where(SharedList.unique_code == code)):
            break
        code = _gen_code()
    lst = SharedList(user_id=current_user.id, name=name[:120],
                     description=(body.description or "").strip()[:500] or None, unique_code=code)
    db.add(lst)
    await db.commit()
    await db.refresh(lst)
    return _list_dict(lst, task_count=0, done_count=0)


@router.get("/shared-lists")
async def my_lists(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(SharedList).where(SharedList.user_id == current_user.id).order_by(SharedList.created_at.desc()))
    lists = res.scalars().all()
    out = []
    for lst in lists:
        total = await db.scalar(select(func.count()).select_from(SharedListTask).where(SharedListTask.list_id == lst.id)) or 0
        done = await db.scalar(select(func.count()).select_from(SharedListTask).where(SharedListTask.list_id == lst.id, SharedListTask.completed.is_(True))) or 0
        out.append(_list_dict(lst, task_count=total, done_count=done))
    return {"lists": out}


async def _owned_list(code: str, user: User, db: AsyncSession) -> SharedList:
    lst = await db.scalar(select(SharedList).where(SharedList.unique_code == code))
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    if lst.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your list")
    return lst


@router.delete("/shared-lists/{code}", status_code=204)
async def delete_list(code: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    lst = await _owned_list(code, current_user, db)
    await db.execute(delete(SharedListTask).where(SharedListTask.list_id == lst.id))
    await db.delete(lst)
    await db.commit()
    return


@router.post("/shared-lists/{code}/itinerary")
async def make_itinerary(code: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    lst = await _owned_list(code, current_user, db)
    res = await db.execute(select(SharedListTask).where(SharedListTask.list_id == lst.id).order_by(SharedListTask.created_at))
    tasks = [t.content for t in res.scalars().all()]
    try:
        itinerary = await generate_itinerary(lst.name, tasks)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Itinerary generation failed: {exc}")
    lst.itinerary = itinerary
    await db.commit()
    return {"itinerary": itinerary}


# ── Public (no account) ────────────────────────────────────────────────────
class GuestTask(BaseModel):
    content: str
    guest_name: str | None = None


class GuestToggle(BaseModel):
    completed: bool
    guest_name: str | None = None


async def _list_by_code(code: str, db: AsyncSession) -> SharedList:
    lst = await db.scalar(select(SharedList).where(SharedList.unique_code == code))
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    return lst


@router.get("/shared/{code}")
async def view_shared(code: str, db: AsyncSession = Depends(get_db)):
    lst = await _list_by_code(code, db)
    res = await db.execute(select(SharedListTask).where(SharedListTask.list_id == lst.id).order_by(SharedListTask.created_at))
    data = _list_dict(lst)
    data["tasks"] = [_task_dict(t) for t in res.scalars().all()]
    return data


@router.post("/shared/{code}/tasks", status_code=201)
async def add_shared_task(code: str, body: GuestTask, db: AsyncSession = Depends(get_db)):
    lst = await _list_by_code(code, db)
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(status_code=422, detail="Task content required")
    count = await db.scalar(select(func.count()).select_from(SharedListTask).where(SharedListTask.list_id == lst.id)) or 0
    if count >= MAX_TASKS:
        raise HTTPException(status_code=429, detail="This list is full")
    t = SharedListTask(list_id=lst.id, content=content[:300])
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return _task_dict(t)


@router.patch("/shared/{code}/tasks/{task_id}")
async def toggle_shared_task(code: str, task_id: str, body: GuestToggle, db: AsyncSession = Depends(get_db)):
    lst = await _list_by_code(code, db)
    try:
        tid = uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid task id")
    t = await db.scalar(select(SharedListTask).where(SharedListTask.id == tid, SharedListTask.list_id == lst.id))
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    t.completed = body.completed
    t.completed_by = ((body.guest_name or "").strip()[:40] or "A guest") if body.completed else None
    await db.commit()
    await db.refresh(t)
    return _task_dict(t)
