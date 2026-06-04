from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db

router = APIRouter(prefix="/replan", tags=["ai"])


class ReplanRequest(BaseModel):
    user_id: str
    change_request: str
    current_tasks: list[str]


class ReplanConfirmRequest(BaseModel):
    user_id: str
    updated_tasks: list[str]


@router.post("")
async def replan(body: ReplanRequest, db: AsyncSession = Depends(get_db)):
    # TODO: build prompt, call Anthropic streaming API, yield SSE chunks
    async def _stream():
        yield "data: {\"token\": \"placeholder\"}\n\n"

    return StreamingResponse(_stream(), media_type="text/event-stream")


@router.post("/confirm")
async def replan_confirm(body: ReplanConfirmRequest, db: AsyncSession = Depends(get_db)):
    # TODO: write confirmed tasks to DB, bust Redis cache
    raise HTTPException(status_code=501, detail="Not implemented yet")
