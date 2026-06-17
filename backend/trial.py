"""App-side access logic.

Strykd is free for everyone with no expiration. Nothing is gated behind payment.
The billing/Stripe code remains in place (so subscriptions can be re-enabled
later) but no feature checks against it. `trial_status` always reports a never
ending, never locked state, and `require_active_access` never blocks.
"""
from fastapi import Depends

from deps import get_current_user
from models.user import User

# Kept for any code/imports that still reference it; trials are no longer enforced.
TRIAL_DAYS = 45


def trial_status(user: User) -> dict:
    """Always-free state. No trial countdown, no lock — kept for API shape."""
    return {
        "subscription_active": False,
        "locked": False,
        "ending_soon": False,
        "day": None,
        "days_left": None,
        "trial_start_date": None,
    }


async def require_active_access(current_user: User = Depends(get_current_user)) -> User:
    """No-op gate: every authenticated user has full access (Strykd is free)."""
    return current_user
