import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
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

    # Rich onboarding context (also fed to the LLM at generation time)
    life_area: Mapped[str | None] = mapped_column(String, nullable=True)  # career/fitness/business/creative/personal-growth
    why_now: Mapped[str | None] = mapped_column(Text, nullable=True)
    past_blockers: Mapped[str | None] = mapped_column(Text, nullable=True)
    hours_per_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    daily_rhythm: Mapped[str | None] = mapped_column(String, nullable=True)  # morning | evening

    user: Mapped["User"] = relationship("User", back_populates="goals")
    tasks: Mapped[list["DailyTask"]] = relationship("DailyTask", back_populates="goal", cascade="all, delete-orphan")
