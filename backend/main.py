from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db
from routes.account import router as account_router
from routes.ai import router as ai_router
from routes.auth import router as auth_router
from routes.billing import router as billing_router
from routes.cron import router as cron_router
from routes.dashboard import router as dashboard_router
from routes.journey import router as journey_router
from routes.onboarding import router as onboarding_router
from routes.proof import router as proof_router
from routes.public import router as public_router
from routes.shared import router as shared_router
from routes.todos import router as todos_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Strykd API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, f"https://*.{settings.base_domain}"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-New-Token"],
)

app.include_router(auth_router)
app.include_router(account_router)
app.include_router(onboarding_router)
app.include_router(dashboard_router)
app.include_router(journey_router)
app.include_router(ai_router)
app.include_router(billing_router)
app.include_router(cron_router)
app.include_router(proof_router)
app.include_router(public_router)
app.include_router(todos_router)
app.include_router(shared_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
