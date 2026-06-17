from datetime import date, datetime, timedelta, timezone
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
from services.email import (
    send_deadline_email, send_inactivity_nudge_email, send_streak_reminder_email,
    send_weekly_reflection_email,
)
from services.llm import generate_nightly, generate_weekly_reflection
from services.push import send_push

router = APIRouter(prefix="/cron", tags=["cron"])

DASH_URL = f"{settings.frontend_url}/dashboard"


def _email_pref(user: User, key: str) -> bool:
    """Whether a user wants a given marketing email type (master switch + per-type)."""
    return bool(user.email_reminders) and (user.email_preferences or {}).get(key, True)


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
        # Sprint goals stop at end_date; lifestyle goals (no end_date) run forever.
        if goal.end_date is not None and tomorrow > goal.end_date:
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

        for task in (content.get("tasks") or [])[:6]:
            if isinstance(task, dict):
                text, dur = task.get("content", ""), task.get("duration")
            else:
                text, dur = str(task), None
            if not str(text).strip():
                continue
            db.add(DailyTask(
                goal_id=goal.id, user_id=goal.user_id, task_date=tomorrow,
                content=str(text), voice_style="direct",
                duration_minutes=int(dur) if isinstance(dur, (int, float)) else None,
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

    # Goal-deadline emails: 3 days before end_date, once per goal.
    deadline_emails = 0
    dl_res = await db.execute(
        select(Goal).where(Goal.status == "active", Goal.deadline_email_sent.is_(False))
    )
    for goal in dl_res.scalars().all():
        if (goal.end_date - today).days == 3:
            user = await db.scalar(select(User).where(User.id == goal.user_id))
            if user and _email_pref(user, "goal_deadline"):
                day = min(max((today - goal.start_date).days + 1, 1), goal.duration_days)
                await send_deadline_email(user.email, user.name, goal.description, day, goal.duration_days, user.id)
            goal.deadline_email_sent = True
            deadline_emails += 1
    await db.commit()

    return {"goals_processed": processed, "errors": errors, "deadline_emails": deadline_emails}


@router.post("/streak-reminders")
async def streak_reminders(
    x_cron_secret: str = Header(..., alias="X-Cron-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """Hourly job: email users who haven't checked in by 8pm in their timezone.

    Deduped via last_reminder_sent (one reminder per local day)."""
    if x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Trial-ending warning emails removed: Strykd is free, there is no trial to end.

    # Inactivity nudge: no dashboard open in 6h during active hours (8am-10pm local),
    # at most one nudge per 6h, only for users who actually have an active goal.
    now_utc = datetime.now(timezone.utc)
    nudges = 0
    nud_res = await db.execute(select(User).where(User.email_reminders.is_(True)))
    for u in nud_res.scalars().all():
        try:
            tz = ZoneInfo(u.timezone or "UTC")
        except (ZoneInfoNotFoundError, ValueError):
            tz = ZoneInfo("UTC")
        if not (8 <= now_utc.astimezone(tz).hour < 22):
            continue
        has_goal = await db.scalar(
            select(func.count()).select_from(Goal).where(Goal.user_id == u.id, Goal.status == "active")
        ) or 0
        if not has_goal:
            continue
        inactive = u.last_active_at is None or (now_utc - u.last_active_at) >= timedelta(hours=6)
        recently_nudged = u.last_nudge_sent is not None and (now_utc - u.last_nudge_sent) < timedelta(hours=6)
        if not inactive or recently_nudged:
            continue
        await send_inactivity_nudge_email(u.email, u.name, u.id)
        u.last_nudge_sent = now_utc
        nudges += 1
    await db.commit()

    # Anyone who wants either channel is in scope; we pick push vs email per user.
    users_res = await db.execute(
        select(User).where((User.email_reminders.is_(True)) | (User.push_enabled.is_(True)))
    )
    users = users_res.scalars().all()

    sent = 0          # 8pm check-in reminders (push or email)
    streak_pushes = 0  # 9pm streak-at-risk pushes
    weekly = 0
    for user in users:
        try:
            tz = ZoneInfo(user.timezone or "UTC")
        except (ZoneInfoNotFoundError, ValueError):
            tz = ZoneInfo("UTC")
        now_local = datetime.now(tz)
        local_today = now_local.date()

        # Weekly reflection: Sundays at 9am local, once per week.
        if (now_local.weekday() == 6 and now_local.hour == 9
                and user.last_weekly_reflection != local_today):
            if await _send_weekly_reflection(db, user, local_today):
                user.last_weekly_reflection = local_today
                weekly += 1

        # Evening nudges only fire after 8pm local.
        if now_local.hour < 20:
            continue

        # Has the user completed any task scheduled for today, and do they have any?
        done_today = await db.scalar(
            select(func.count()).select_from(DailyTask).where(
                DailyTask.user_id == user.id,
                DailyTask.task_date == local_today,
                DailyTask.completed.is_(True),
            )
        ) or 0
        has_tasks = await db.scalar(
            select(func.count()).select_from(DailyTask).where(
                DailyTask.user_id == user.id,
                DailyTask.task_date == local_today,
            )
        ) or 0
        # Nothing to nudge about: no tasks today, or they've already done one.
        if has_tasks == 0 or done_today > 0:
            continue

        # 8pm daily check-in reminder (once per local day). Push if enabled,
        # otherwise fall back to the streak email.
        if user.last_reminder_sent != local_today:
            delivered = False
            if user.push_enabled:
                delivered = await send_push(
                    user.id, "Time to check in",
                    "You haven't completed any tasks today. Knock one out to keep your streak alive.",
                    DASH_URL,
                )
            if not delivered and _email_pref(user, "streak_reminders"):
                await send_streak_reminder_email(user.email, user.name, user.streak_days, user.id)
                delivered = True
            if delivered:
                user.last_reminder_sent = local_today
                sent += 1

        # 9pm streak-at-risk push (push channel only; email already went at 8pm).
        if (now_local.hour >= 21 and user.push_enabled and user.streak_days > 0
                and user.last_streak_push_sent != local_today):
            if await send_push(
                user.id, "Your streak is at risk",
                f"Don't lose your {user.streak_days}-day streak — check off one task before midnight.",
                DASH_URL,
            ):
                user.last_streak_push_sent = local_today
                streak_pushes += 1

    await db.commit()
    return {"reminders_sent": sent, "streak_at_risk_pushes": streak_pushes,
            "inactivity_nudges": nudges, "weekly_reflections": weekly}


async def _send_weekly_reflection(db: AsyncSession, user: User, local_today: date) -> bool:
    """Deliver the Sunday weekly reflection. Push if the user has push enabled,
    otherwise the full reflection email (gated by their email prefs). Returns
    False if there's no active goal or no eligible channel."""
    week_start = local_today - timedelta(days=6)
    goals = (await db.execute(
        select(Goal).where(Goal.user_id == user.id, Goal.status == "active")
    )).scalars().all()
    if not goals:
        return False

    earliest = min(g.start_date for g in goals)
    week_number = max((local_today - earliest).days // 7 + 1, 1)

    # Push channel: a short nudge to open the dashboard (no email gating needed).
    if user.push_enabled:
        return await send_push(
            user.id, "Your week in review",
            f"Week {week_number} is done — see what you built and your focus for next week.",
            DASH_URL,
        )

    if not _email_pref(user, "weekly_reflection"):
        return False

    total = await db.scalar(
        select(func.count()).select_from(DailyTask).where(
            DailyTask.user_id == user.id,
            DailyTask.task_date >= week_start, DailyTask.task_date <= local_today,
        )
    ) or 0
    completed = await db.scalar(
        select(func.count()).select_from(DailyTask).where(
            DailyTask.user_id == user.id,
            DailyTask.task_date >= week_start, DailyTask.task_date <= local_today,
            DailyTask.completed.is_(True),
        )
    ) or 0

    content = await generate_weekly_reflection(
        [g.description for g in goals], week_number, completed, total, user.streak_days,
    )
    await send_weekly_reflection_email(
        user.email, user.name, week_number, completed, total, user.streak_days, content, user.id,
    )
    return True
