from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    # TODO: extract user from JWT, return goals + today's tasks + streak + theme
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.patch("/tasks/{task_id}/complete")
async def complete_task(task_id: str, db: AsyncSession = Depends(get_db)):
    # TODO: mark task done, update streak, bust Redis cache
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.get("/public/{slug}")
async def public_page(slug: str, db: AsyncSession = Depends(get_db)):
    # TODO: Redis cache lookup → DB query → return public-safe user data
    raise HTTPException(status_code=501, detail="Not implemented yet")
