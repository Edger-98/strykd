import json

import redis.asyncio as aioredis

from config import settings

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def get_public_page(slug: str) -> dict | None:
    r = await get_redis()
    data = await r.get(f"public:{slug}")
    return json.loads(data) if data else None


async def set_public_page(slug: str, data: dict, ttl: int = 600) -> None:
    r = await get_redis()
    await r.set(f"public:{slug}", json.dumps(data), ex=ttl)


async def bust_public_page(slug: str) -> None:
    r = await get_redis()
    await r.delete(f"public:{slug}")
