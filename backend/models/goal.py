import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String, default="active")  # active, completed, paused
    page_public: Mapped[bool] = mapped_column(Boolean, default=True)  # show this goal on the public page

    # Rich onboarding context (also fed to the LLM at generation time)
    life_area: Mapped[str | None] = mapped_column(String, nullable=True)  # career/fitness/business/creative/personal-growth
    why_now: Mapped[str | None] = mapped_column(Text, nullable=True)
    past_blockers: Mapped[str | None] = mapped_column(Text, nullable=True)
    hours_per_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    daily_rhythm: Mapped[str | None] = mapped_column(String, nullable=True)  # morning | evening

    # Per-goal streak (each goal tracks its own daily check-in streak)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    last_checkin: Mapped[date | None] = mapped_column(Date, nullable=True)
    deadline_email_sent: Mapped[bool] = mapped_column(Boolean, default=False)  # 3-days-before email dedupe

    # Per-goal narrative (each goal has its own chapter timeline + projected outcome)
    chapter_titles: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    projected_outcome: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="goals")
    tasks: Mapped[list["DailyTask"]] = relationship("DailyTask", back_populates="goal", cascade="all, delete-orphan")
