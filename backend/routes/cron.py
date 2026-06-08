from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.goal import Goal
from models.signal_wall import SignalWall
from models.task import DailyTask
from models.user import User
from services.cache import bust_public_page
from services.email import send_streak_reminder_email, send_trial_ending_email
from services.llm import generate_nightly
from trial import trial_status

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

        # Day number of the day we are generating (tomorrow), within this goal's plan
        day_number = (tomorrow - goal.start_date).days + 1

        try:
            content = await generate_nightly(
                goal_description=goal.description,
                completed_tasks=completed,
                day_number=day_number,
                total_days=goal.duration_days,
                life_area=goal.life_area,
                why_now=goal.why_now,
                past_blockers=goal.past_blockers,
                hours_per_day=goal.hours_per_day,
                daily_rhythm=goal.daily_rhythm,
            )
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


@router.post("/streak-reminders")
async def streak_reminders(
    x_cron_secret: str = Header(..., alias="X-Cron-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """Hourly job: email users who haven't checked in by 8pm in their timezone.

    Deduped via last_reminder_sent (one reminder per local day)."""
    if x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Trial-ending email on day 6 (the day before the free week ends), deduped.
    trial_emails = 0
    te_res = await db.execute(
        select(User).where(
            User.subscription_active.is_(False),
            User.trial_ending_sent.is_(False),
            User.trial_start_date.isnot(None),
        )
    )
    for u in te_res.scalars().all():
        ts = trial_status(u)
        if ts.get("day") == 6 and not ts.get("subscription_active"):
            await send_trial_ending_email(u.email, u.name)
            u.trial_ending_sent = True
            trial_emails += 1
    await db.commit()

    users_res = await db.execute(select(User).where(User.email_reminders.is_(True)))
    users = users_res.scalars().all()

    sent = 0
    for user in users:
        try:
            tz = ZoneInfo(user.timezone or "UTC")
        except (ZoneInfoNotFoundError, ValueError):
            tz = ZoneInfo("UTC")
        now_local = datetime.now(tz)
        local_today = now_local.date()

        # Only fire after 8pm local, once per local day
        if now_local.hour < 20:
            continue
        if user.last_reminder_sent == local_today:
            continue

        # Has the user completed any task scheduled for today?
        done_today = await db.scalar(
            select(func.count()).select_from(DailyTask).where(
                DailyTask.user_id == user.id,
                DailyTask.task_date == local_today,
                DailyTask.completed.is_(True),
            )
        ) or 0
        if done_today > 0:
            continue

        # Only nudge users who actually have something to do today
        has_tasks = await db.scalar(
            select(func.count()).select_from(DailyTask).where(
                DailyTask.user_id == user.id,
                DailyTask.task_date == local_today,
            )
        ) or 0
        if has_tasks == 0:
            continue

        await send_streak_reminder_email(user.email, user.name, user.streak_days)
        user.last_reminder_sent = local_today
        sent += 1

    await db.commit()
    return {"reminders_sent": sent, "trial_ending_emails": trial_emails}
