import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

# Per-type marketing email preferences. `email_reminders` is the master switch
# (flipped off by the one-click unsubscribe link); these gate individual types.
DEFAULT_EMAIL_PREFERENCES = {
    "welcome": True,
    "streak_reminders": True,
    "trial_ending": True,
    "weekly_reflection": True,
    "goal_deadline": True,
}


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    last_checkin: Mapped[date | None] = mapped_column(Date, nullable=True)
    subscription_active: Mapped[bool] = mapped_column(Boolean, default=False)  # DORMANT: billing kept but not gated; Strykd is free
    page_public: Mapped[bool] = mapped_column(Boolean, default=True)  # public/private page toggle
    # DORMANT trial fields. Strykd is free with no expiration, so nothing reads these
    # for gating anymore (see trial.py). Onboarding still stamps trial_start_date and
    # the columns are retained so paid trials can be re-enabled later without a migration.
    trial_start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # dormant (was: app-side trial start)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # base64 data URL or external URL
    bio: Mapped[str | None] = mapped_column(String, nullable=True)  # max 160 chars, shown on public page
    email_reminders: Mapped[bool] = mapped_column(Boolean, default=True)  # master email opt-out (one-click unsubscribe)
    email_preferences: Mapped[dict] = mapped_column(JSONB, default=lambda: dict(DEFAULT_EMAIL_PREFERENCES))  # per-type toggles
    push_enabled: Mapped[bool] = mapped_column(Boolean, default=False)  # OneSignal web push opt-in
    timezone: Mapped[str] = mapped_column(String, default="UTC")
    last_reminder_sent: Mapped[date | None] = mapped_column(Date, nullable=True)  # streak reminder dedupe
    last_streak_push_sent: Mapped[date | None] = mapped_column(Date, nullable=True)  # 9pm streak-at-risk push dedupe
    trial_ending_sent: Mapped[bool] = mapped_column(Boolean, default=False)  # DORMANT: trial-ending emails removed (Strykd is free)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # last dashboard open
    last_nudge_sent: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # inactivity nudge dedupe
    last_weekly_reflection: Mapped[date | None] = mapped_column(Date, nullable=True)  # Sunday reflection email dedupe
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    goals: Mapped[list["Goal"]] = relationship("Goal", back_populates="user", cascade="all, delete-orphan")
    theme: Mapped["Theme | None"] = relationship("Theme", back_populates="user", uselist=False, cascade="all, delete-orphan")
    signal_wall: Mapped[list["SignalWall"]] = relationship("SignalWall", back_populates="user", cascade="all, delete-orphan")
    billing: Mapped["Billing | None"] = relationship("Billing", back_populates="user", uselist=False, cascade="all, delete-orphan")
