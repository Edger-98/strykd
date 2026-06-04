from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db

router = APIRouter(prefix="/billing", tags=["billing"])


class CheckoutRequest(BaseModel):
    user_id: str


@router.post("/checkout")
async def create_checkout(body: CheckoutRequest, db: AsyncSession = Depends(get_db)):
    # TODO: create Stripe checkout session, return session URL
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    # TODO: verify Stripe signature, handle subscription events
    raise HTTPException(status_code=501, detail="Not implemented yet")
