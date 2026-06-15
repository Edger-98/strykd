"""Web push notifications via OneSignal.

Best-effort, like email: failures are logged and swallowed so a push problem
never breaks a cron run or a task completion. Users are targeted by their Strykd
user id, which the frontend registers as the OneSignal external user id
(`OneSignal.login(userId)`), so the backend never has to store device tokens.
"""
import logging

import httpx

from config import settings

logger = logging.getLogger("strykd.push")

_API_URL = "https://onesignal.com/api/v1/notifications"


def push_configured() -> bool:
    return bool(settings.onesignal_app_id and settings.onesignal_rest_api_key)


async def send_push(user_ids, title: str, message: str, url: str | None = None) -> bool:
    """Send a push to one or more Strykd users (by external user id).

    Returns True if the request was dispatched, False if skipped/failed.
    """
    ids = [str(u) for u in (user_ids if isinstance(user_ids, (list, tuple, set)) else [user_ids])]
    if not ids:
        return False
    if not push_configured():
        logger.warning("OneSignal not configured — skipping push (%s)", title)
        return False

    payload = {
        "app_id": settings.onesignal_app_id,
        "include_external_user_ids": ids,
        "channel_for_external_user_ids": "push",
        "headings": {"en": title},
        "contents": {"en": message},
    }
    if url:
        payload["url"] = url

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                _API_URL,
                json=payload,
                headers={"Authorization": f"Basic {settings.onesignal_rest_api_key}"},
            )
        if resp.status_code >= 400:
            logger.error("OneSignal push failed (%s): %s", resp.status_code, resp.text)
            return False
        return True
    except Exception as exc:  # never let push failures bubble up
        logger.error("Failed to send push (%s): %s", title, exc)
        return False
