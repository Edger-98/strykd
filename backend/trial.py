"""App-side access logic.

TRIAL / PAYMENT GATING — REMOVED (Strykd is now free for everyone, no expiration).

History: Strykd previously ran an app-side free trial (TRIAL_DAYS of full access,
then a hard lock until the user subscribed for $9/month). All of that enforcement
was intentionally torn out here. What changed and why:

  - `require_active_access` used to raise HTTP 402 once `trial_status(...).locked`
    was true. It now returns the user unconditionally, so every endpoint that
    depends on it (AI features, dashboard writes, brainstorm, replan, etc.) is
    open to all authenticated users. No 402 is ever raised.
  - `trial_status` used to compute a 1-indexed `day`, `days_left`, an `ending_soon`
    flag (last 2 days) and a `locked` flag (past the trial). It now returns a
    static, never-locked, never-ending shape. The dict keys are preserved only so
    callers and the /dashboard payload don't break; the frontend no longer renders
    a trial badge, "ends soon" banner, or the day-46 lock screen from them.

What deliberately REMAINS (so paid plans can be switched back on later without a
rewrite):
  - The Stripe/billing routes and services (checkout, portal, webhooks, refund).
  - The `User.trial_start_date` and `User.trial_ending_sent` columns (now dormant;
    onboarding still stamps `trial_start_date` but nothing reads it for gating).
  - `TRIAL_DAYS` below, kept for any lingering import; it no longer enforces anything.

To re-enable trials: restore the original `trial_status` math and make
`require_active_access` raise 402 when `locked`, then re-add the frontend badge/
lock UI. See git history around the "free for everyone" commit for the prior code.
"""
from fastapi import Depends

from deps import get_current_user
from models.user import User

# Dormant. Kept only so stray imports resolve; trials are no longer enforced.
TRIAL_DAYS = 45


def trial_status(user: User) -> dict:
    """Always-free state. No trial countdown, no lock — kept only for API shape.

    Returns the same keys the old trial logic did so existing callers (and the
    /dashboard JSON) keep working, but every value reflects unlimited free access:
    not subscribed, not locked, not ending soon, and no day/days_left counters.
    """
    return {
        "subscription_active": False,  # billing is dormant; never report "subscribed"
        "locked": False,               # never gate access — Strykd is free
        "ending_soon": False,          # no trial, so nothing is ever "ending soon"
        "day": None,                   # trial day counter retired
        "days_left": None,             # no countdown to show
        "trial_start_date": None,
    }


async def require_active_access(current_user: User = Depends(get_current_user)) -> User:
    """No-op access gate.

    Formerly raised HTTP 402 once the free trial expired. Now that Strykd is free,
    it simply returns the authenticated user so nothing is paywalled. Endpoints
    still depend on it (rather than dropping it) so re-enabling gating later is a
    one-line change here instead of edits across every route.
    """
    return current_user
