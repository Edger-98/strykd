from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db

router = APIRouter(prefix="/cron", tags=["cron"])


@router.post("/nightly")
async def nightly(
    x_cron_secret: str = Header(..., alias="X-Cron-Secret"),
    db: AsyncSession = Depends(get_db),
):
    if x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=403, detail="Forbidden")
    # TODO: iterate active users, call LLM, write next-day tasks + signal wall entries
    raise HTTPException(status_code=501, detail="Not implemented yet")
