import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class SharedList(Base):
    __tablename__ = "shared_lists"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    unique_code: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    itinerary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SharedListTask(Base):
    __tablename__ = "shared_list_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    list_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shared_lists.id"), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_by: Mapped[str | None] = mapped_column(String, nullable=True)
    assigned_to: Mapped[str | None] = mapped_column(String, nullable=True)
    added_by_session: Mapped[str | None] = mapped_column(String, nullable=True)  # guest session that created it
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
