import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Theme(Base):
    __tablename__ = "themes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    color_palette: Mapped[str] = mapped_column(String, nullable=False)
    typography_variant: Mapped[str] = mapped_column(String, nullable=False)
    layout_variant: Mapped[str] = mapped_column(String, nullable=False)
    mission_statement: Mapped[str] = mapped_column(Text, nullable=False)
    daily_headline: Mapped[str | None] = mapped_column(Text, nullable=True)
    chapter_titles: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="theme")
