import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class DailyTask(Base):
    __tablename__ = "daily_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # goal_id is null for manual "quick tasks"; user_id always identifies the owner
    goal_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("goals.id"), nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    task_date: Mapped[date] = mapped_column(Date, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    voice_style: Mapped[str] = mapped_column(String, default="direct")  # direct, motivational, reflective
    is_quick: Mapped[bool] = mapped_column(Boolean, default=False)  # manual quick task (no goal)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_daily_tasks_goal_date", "goal_id", "task_date"),
        Index("ix_daily_tasks_user_date", "user_id", "task_date"),
    )

    goal: Mapped["Goal | None"] = relationship("Goal", back_populates="tasks")
