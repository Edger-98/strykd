from datetime import date, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.goal import Goal
from models.signal_wall import SignalWall
from models.task import DailyTask
from models.user import User
from services.cache import bust_public_page
from services.llm import generate_nightly

router = APIRouter(prefix="/cron", tags=["cron"])


@router.post("/nightly")
async def nightly(
    x_cron_secret: str = Header(..., alias="X-Cron-Secret"),
    db: AsyncSession = Depends(get_db),
):
    if x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=403, detail="Forbidden")

    today = date.today()
    tomorrow = today + timedelta(days=1)

    # Every active goal of every user gets next-day tasks + a signal wall entry.
    goals_res = await db.execute(select(Goal).where(Goal.status == "active"))
    goals = goals_res.scalars().all()

    processed = 0
    errors = 0
    touched_users: set = set()

    for goal in goals:
        # Skip goals whose plan window has already ended
        if tomorrow > goal.end_date:
            continue
        # Don't double-generate if tomorrow already has tasks
        existing = await db.scalar(
            select(DailyTask).where(DailyTask.goal_id == goal.id, DailyTask.task_date == tomorrow)
        )
        if existing:
            continue

        today_res = await db.execute(
            select(DailyTask).where(DailyTask.goal_id == goal.id, DailyTask.task_date == today)
        )
        today_tasks = today_res.scalars().all()
        completed = [t.content for t in today_tasks if t.completed]

        try:
            content = await generate_nightly(goal.description, completed)
        except Exception:
            errors += 1
            continue

        for task_str in (content.get("tasks") or [])[:5]:
            db.add(DailyTask(
                goal_id=goal.id, user_id=goal.user_id, task_date=tomorrow,
                content=str(task_str), voice_style="direct",
            ))

        db.add(SignalWall(
            user_id=goal.user_id, goal_id=goal.id, entry_date=today,
            ai_summary=content.get("signal_wall_entry", ""),
            tasks_completed=len(completed), tasks_total=len(today_tasks),
        ))
        processed += 1
        touched_users.add(goal.user_id)

    await db.commit()

    # Bust public caches for affected users
    for uid in touched_users:
        user = await db.scalar(select(User).where(User.id == uid))
        if user:
            await bust_public_page(user.slug)

    return {"goals_processed": processed, "errors": errors}
