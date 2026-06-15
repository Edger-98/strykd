from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import settings

# Lightweight, idempotent column additions for already-provisioned databases.
# create_all() only creates missing tables — it never alters existing ones — so
# new columns on the long-lived `users` table are backfilled here on startup.
_MIGRATIONS = (
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_preferences JSONB "
    "DEFAULT '{\"welcome\": true, \"streak_reminders\": true, \"trial_ending\": true, "
    "\"weekly_reflection\": true, \"goal_deadline\": true}'::jsonb",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT false",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_streak_push_sent DATE",
)

# asyncpg requires postgresql+asyncpg:// scheme
_async_url = settings.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(_async_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for stmt in _MIGRATIONS:
            await conn.execute(text(stmt))
