import json
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from deps import get_current_user
from models.goal import Goal
from models.task import DailyTask
from models.theme import Theme
from models.user import User
from services.cache import bust_public_page
from services.llm import stream_replan

router = APIRouter(prefix="/replan", tags=["ai"])


class ReplanRequest(BaseModel):
    change_request: str


class ReplanConfirmTask(BaseModel):
    content: str
    voice_style: str = "direct"


class ReplanConfirmRequest(BaseModel):
    goal_id: str
    task_date: str  # ISO "YYYY-MM-DD"
    tasks: list[ReplanConfirmTask]


@router.post("")
async def replan(
    body: ReplanRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()

    goals_res = await db.execute(
        select(Goal).where(Goal.user_id == current_user.id, Goal.status == "active")
    )
    goals = goals_res.scalars().all()
    if not goals:
        raise HTTPException(status_code=404, detail="No active goals found")

    current_tasks: list[str] = []
    for goal in goals:
        res = await db.execute(
            select(DailyTask)
            .where(DailyTask.goal_id == goal.id, DailyTask.task_date >= today)
            .order_by(DailyTask.task_date)
            .limit(30)
        )
        for t in res.scalars().all():
            current_tasks.append(f"[{t.task_date}] {t.content}")

    async def event_stream():
        try:
            async for token in stream_replan(current_tasks, body.change_request):
                if token:
                    # JSON-encode so any special chars are safe in SSE
                    yield f"data: {json.dumps(token)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps(f'[ERROR] {exc}')}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/confirm")
async def replan_confirm(
    body: ReplanConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        goal_id = uuid.UUID(body.goal_id)
        task_date = date.fromisoformat(body.task_date)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    goal = await db.scalar(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == current_user.id)
    )
    if not goal:
        raise HTTPException(status_code=403, detail="Goal not found or not yours")

    # Delete existing tasks for this goal+date
    old_res = await db.execute(
        select(DailyTask).where(
            DailyTask.goal_id == goal_id,
            DailyTask.task_date == task_date,
        )
    )
    for old_task in old_res.scalars().all():
        await db.delete(old_task)

    # Create replacement tasks
    for task in body.tasks:
        if task.content.strip():
            db.add(DailyTask(
                goal_id=goal_id,
                task_date=task_date,
                content=task.content.strip(),
                voice_style=task.voice_style,
            ))

    await db.commit()
    await bust_public_page(current_user.slug)

    return {"message": "Tasks updated", "count": len(body.tasks)}
