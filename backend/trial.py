"""App-side free trial logic.

Users get TRIAL_DAYS (3) of full access with no card. Access is gated AFTER
the trial unless they have an active subscription:

  day 1     → full access
  day 2..3  → full access + "ends tomorrow" banner (frontend)
  day 4+    → locked (dashboard + AI features) until subscribed

The public page is never gated.
"""
from datetime import datetime, timezone

from fastapi import Depends, HTTPException

from deps import get_current_user
from models.user import User

TRIAL_DAYS = 3


def trial_status(user: User) -> dict:
    """Compute the trial state for a user. 1-indexed `day`."""
    if user.subscription_active:
        return {"subscription_active": True, "locked": False, "ending_soon": False,
                "day": None, "days_left": None, "trial_start_date": None}

    start = user.trial_start_date
    if start is None:
        # Trial hasn't started yet (not onboarded) — treat as fresh day 1.
        return {"subscription_active": False, "locked": False, "ending_soon": False,
                "day": 1, "days_left": TRIAL_DAYS, "trial_start_date": None}

    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    elapsed_days = (datetime.now(timezone.utc) - start).days  # floor of full 24h periods
    day = elapsed_days + 1
    days_left = max(0, TRIAL_DAYS - elapsed_days)
    locked = day >= TRIAL_DAYS + 1            # day 4+
    ending_soon = (not locked) and day >= TRIAL_DAYS - 1  # day 2 or 3
    return {
        "subscription_active": False, "locked": locked, "ending_soon": ending_soon,
        "day": day, "days_left": days_left, "trial_start_date": start.isoformat(),
    }


async def require_active_access(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that 402s once the free trial has ended (and no subscription).

    Use to gate AI features and dashboard writes. Read-only public data is never
    gated with this.
    """
    if trial_status(current_user)["locked"]:
        raise HTTPException(
            status_code=402,
            detail="Your free trial has ended. Subscribe for $9/month to continue.",
        )
    return current_user
