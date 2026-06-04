"""Transactional email via Resend.

The Resend SDK is synchronous, so sends are dispatched in a worker thread to
avoid blocking the event loop. Every send is best-effort: failures are logged
and swallowed so email problems never break registration or webhook handling.
"""
import asyncio
import logging

import resend

from config import settings

logger = logging.getLogger("strykd.email")

resend.api_key = settings.resend_api_key


def _send(to: str, subject: str, html: str) -> None:
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set — skipping email to %s (%s)", to, subject)
        return
    try:
        resend.Emails.send({
            "from": settings.resend_from,
            "to": [to],
            "subject": subject,
            "html": html,
        })
    except Exception as exc:  # never let email failures bubble up
        logger.error("Failed to send email to %s (%s): %s", to, subject, exc)


async def _send_async(to: str, subject: str, html: str) -> None:
    await asyncio.to_thread(_send, to, subject, html)


def _shell(body: str) -> str:
    return (
        '<div style="background:#000;color:#fff;font-family:-apple-system,'
        'BlinkMacSystemFont,Segoe UI,sans-serif;padding:40px 24px;">'
        '<div style="max-width:480px;margin:0 auto;">'
        '<p style="letter-spacing:.18em;font-weight:800;font-size:14px;color:#A1A1A1;">STRYKD</p>'
        f'{body}'
        '<p style="color:#5C5C5C;font-size:12px;margin-top:40px;">'
        'Strykd — AI accountability that ships.</p>'
        '</div></div>'
    )


async def send_welcome_email(to: str, name: str) -> None:
    first = (name or "there").split(" ")[0]
    body = (
        f'<h1 style="font-size:28px;font-weight:800;margin:16px 0;">Welcome, {first}.</h1>'
        '<p style="color:#A1A1A1;font-size:16px;line-height:1.6;">'
        "You just made a commitment to yourself. Next, describe your goal and we'll "
        "build your personalized daily plan, your visual identity, and a live page on "
        "your own subdomain.</p>"
        '<p style="color:#A1A1A1;font-size:16px;line-height:1.6;margin-top:16px;">'
        "Show up. Check off. Don't break the streak.</p>"
    )
    await _send_async(to, "Welcome to Strykd", _shell(body))


async def send_trial_ending_email(to: str, name: str) -> None:
    first = (name or "there").split(" ")[0]
    body = (
        f'<h1 style="font-size:28px;font-weight:800;margin:16px 0;">'
        f'Your free week is almost up, {first}.</h1>'
        '<p style="color:#A1A1A1;font-size:16px;line-height:1.6;">'
        "In 3 days your free trial ends and your $9/month subscription begins. "
        "No action needed if you want to keep your momentum going.</p>"
        '<p style="color:#A1A1A1;font-size:16px;line-height:1.6;margin-top:16px;">'
        "Want to pause? You can cancel anytime from your billing settings before "
        "the trial ends and you won't be charged.</p>"
    )
    await _send_async(to, "Your Strykd trial ends in 3 days", _shell(body))
