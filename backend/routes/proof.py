import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.goal import Goal
from models.task import DailyTask
from models.user import User
from services import s3
from services.cache import bust_public_page
from services.llm import verify_proof
from trial import require_active_access

router = APIRouter(tags=["proof"])

MAX_PROOF_BYTES = 50 * 1024 * 1024  # 50MB

# content_type -> file extension
_ALLOWED = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "video/mp4": "mp4",
}


def _kind(content_type: str) -> str:
    return "video" if (content_type or "").startswith("video") else "image"


async def _read_and_validate(file: UploadFile) -> tuple[bytes, str, str]:
    """Return (bytes, content_type, ext) or raise a 4xx HTTPException."""
    ct = (file.content_type or "").lower()
    if ct not in _ALLOWED:
        raise HTTPException(status_code=415, detail="Upload a JPG, PNG, or MP4 file.")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=422, detail="Empty file.")
    if len(data) > MAX_PROOF_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 50MB).")
    return data, ct, _ALLOWED[ct]


async def _owned_task(task_id: str, user: User, db: AsyncSession) -> DailyTask:
    try:
        tid = uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid task ID")
    task = await db.scalar(select(DailyTask).where(DailyTask.id == tid))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.user_id and task.user_id == user.id:
        return task
    if task.goal_id:
        goal = await db.scalar(select(Goal).where(Goal.id == task.goal_id, Goal.user_id == user.id))
        if goal:
            return task
    raise HTTPException(status_code=403, detail="Not your task")


@router.post("/tasks/{task_id}/proof")
async def upload_task_proof(
    task_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active_access),
):
    """Attach a visual proof (image or video) to a single task."""
    if not s3.is_configured():
        raise HTTPException(status_code=503, detail="Proof uploads are not available yet.")

    task = await _owned_task(task_id, current_user, db)
    data, content_type, ext = await _read_and_validate(file)

    key = f"proofs/{current_user.id}/{task.task_date.isoformat()}/{task.id}.{ext}"
    try:
        url = await s3.upload_proof(key, data, content_type)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    task.proof_url = url
    await db.commit()
    await bust_public_page(current_user.slug)
    return {"task_id": str(task.id), "proof_url": url}


@router.post("/goals/{goal_id}/daily-proof")
async def upload_daily_proof(
    goal_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active_access),
):
    """Upload one proof for the whole day. Claude vision reviews it against the
    day's tasks; on a confident verification the tasks are auto-completed."""
    if not s3.is_configured():
        raise HTTPException(status_code=503, detail="Proof uploads are not available yet.")

    try:
        gid = uuid.UUID(goal_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid goal ID")
    goal = await db.scalar(select(Goal).where(Goal.id == gid, Goal.user_id == current_user.id))
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    today = date.today()
    res = await db.execute(
        select(DailyTask).where(DailyTask.goal_id == goal.id, DailyTask.task_date == today)
        .order_by(DailyTask.sort_order, DailyTask.id)
    )
    today_tasks = res.scalars().all()
    if not today_tasks:
        raise HTTPException(status_code=404, detail="No tasks scheduled for today on this goal.")

    data, content_type, ext = await _read_and_validate(file)
    key = f"proofs/{current_user.id}/{today.isoformat()}/{goal.id}-daily.{ext}"
    try:
        url = await s3.upload_proof(key, data, content_type)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    task_description = "; ".join(t.content for t in today_tasks)

    if _kind(content_type) == "image":
        try:
            review = await verify_proof(task_description, data, content_type)
        except Exception as exc:
            review = {"verified": False, "confidence": "low",
                      "comment": f"Could not analyze the image automatically ({exc})."}
    else:
        # The vision API cannot ingest video; store it but do not auto-verify.
        review = {"verified": False, "confidence": "low",
                  "comment": "Video proof received. Automatic verification supports images only."}

    auto_complete = bool(review.get("verified")) and review.get("confidence") in ("high", "medium")
    completed_ids: list[str] = []

    if auto_complete:
        for t in today_tasks:
            if not t.completed:
                t.completed = True
                t.completed_at = datetime.now(timezone.utc)
                completed_ids.append(str(t.id))
        if completed_ids and goal.last_checkin != today:
            goal.streak_days += 1
            goal.last_checkin = today

    # Attach the proof + review to every task for today on this goal
    for t in today_tasks:
        t.proof_url = url
        t.proof_review = review

    await db.commit()
    await bust_public_page(current_user.slug)

    return {
        "goal_id": str(goal.id),
        "proof_url": url,
        "review": review,
        "auto_completed": auto_complete,
        "completed_task_ids": completed_ids,
        "streak_days": goal.streak_days,
    }
