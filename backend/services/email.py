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


def _button(href: str, label: str) -> str:
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td '
        'style="border-radius:50px;background:#FF2D2D;">'
        f'<a href="{href}" style="display:inline-block;padding:14px 32px;color:#fff;text-decoration:none;'
        f'font-weight:700;font-size:15px;border-radius:50px;">{label}</a></td></tr></table>'
    )


def _shell(body: str) -> str:
    return (
        '<div style="background:#000;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,sans-serif;'
        'padding:32px 16px;margin:0;">'
        '<div style="max-width:480px;margin:0 auto;background:#0A0A0A;border:1px solid #1F1F1F;'
        'border-radius:20px;overflow:hidden;">'
        '<div style="padding:28px 32px 0;text-align:center;">'
        '<span style="letter-spacing:.24em;font-weight:800;font-size:16px;color:#fff;">STRYKD</span>'
        '<div style="height:3px;width:40px;background:#FF2D2D;margin:14px auto 0;border-radius:2px;"></div>'
        '</div>'
        f'<div style="padding:24px 32px 32px;color:#fff;">{body}</div>'
        '<div style="padding:18px 32px;border-top:1px solid #1F1F1F;">'
        '<p style="color:#5C5C5C;font-size:12px;line-height:1.5;margin:0;">'
        'Strykd. AI accountability that ships.</p></div>'
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
        + _button(f"{settings.frontend_url}/onboard", "Build my plan")
    )
    await _send_async(to, "Welcome to Strykd", _shell(body))


async def send_password_reset_email(to: str, name: str, reset_url: str) -> None:
    first = (name or "there").split(" ")[0]
    body = (
        f'<h1 style="font-size:28px;font-weight:800;margin:16px 0;">'
        f'Reset your password, {first}.</h1>'
        '<p style="color:#A1A1A1;font-size:16px;line-height:1.6;">'
        "We received a request to reset your Strykd password. This link is valid "
        "for one hour. If you didn't ask for this, you can safely ignore this email.</p>"
        + _button(reset_url, "Reset password")
        + '<p style="color:#5C5C5C;font-size:13px;line-height:1.6;">'
        f'Or paste this link into your browser:<br>{reset_url}</p>'
    )
    await _send_async(to, "Reset your Strykd password", _shell(body))


async def send_streak_reminder_email(to: str, name: str, streak_days: int) -> None:
    first = (name or "there").split(" ")[0]
    streak_line = (
        f"You're on a {streak_days}-day streak. " if streak_days > 0 else ""
    )
    body = (
        f'<h1 style="font-size:28px;font-weight:800;margin:16px 0;">'
        f'Your streak is at risk, {first}.</h1>'
        '<p style="color:#A1A1A1;font-size:16px;line-height:1.6;">'
        f"{streak_line}Log in and check off at least one task to keep it alive.</p>"
        + _button(f"{settings.frontend_url}/dashboard", "Keep my streak alive")
    )
    await _send_async(to, "Your streak is at risk", _shell(body))


async def send_trial_ending_email(to: str, name: str) -> None:
    first = (name or "there").split(" ")[0]
    body = (
        f'<h1 style="font-size:28px;font-weight:800;margin:16px 0;">'
        f'Your free trial is almost up, {first}.</h1>'
        '<p style="color:#A1A1A1;font-size:16px;line-height:1.6;">'
        "In 5 days your 30-day free trial ends. Keep your plan, your AI coach, and your "
        "streak going for $9/month, or cancel anytime before then and you won't be charged.</p>"
        + _button(f"{settings.frontend_url}/dashboard/settings", "Manage my subscription")
    )
    await _send_async(to, "Your Strykd free trial ends in 5 days", _shell(body))


async def send_inactivity_nudge_email(to: str, name: str) -> None:
    first = (name or "there").split(" ")[0]
    body = (
        f'<h1 style="font-size:28px;font-weight:800;margin:16px 0;">'
        f'Your goals are waiting, {first}.</h1>'
        '<p style="color:#A1A1A1;font-size:16px;line-height:1.6;">'
        "You haven't checked in today. It only takes a minute to keep your momentum going. "
        "Open your dashboard and knock out one task.</p>"
        + _button(f"{settings.frontend_url}/dashboard", "Open my dashboard")
    )
    await _send_async(to, "Your goals are waiting", _shell(body))


async def send_deadline_email(to: str, name: str, goal: str, day: int, total_days: int) -> None:
    first = (name or "there").split(" ")[0]
    body = (
        f'<h1 style="font-size:28px;font-weight:800;margin:16px 0;">'
        f'Your goal ends in 3 days, {first}.</h1>'
        '<p style="color:#A1A1A1;font-size:16px;line-height:1.6;">'
        f'"{goal}" wraps up in 3 days. You\'re on day {day} of {total_days}. '
        "Make these last days count.</p>"
        + _button(f"{settings.frontend_url}/dashboard", "Finish strong")
    )
    await _send_async(to, "Your goal ends in 3 days", _shell(body))


async def send_subscription_confirmation_email(to: str, name: str) -> None:
    first = (name or "there").split(" ")[0]
    body = (
        f'<h1 style="font-size:28px;font-weight:800;margin:16px 0;">'
        f"You're in, {first}.</h1>"
        '<p style="color:#A1A1A1;font-size:16px;line-height:1.6;">'
        "Your Strykd subscription is active. You backed yourself, now keep showing up. "
        "Your plan, your AI coach, and your public page are all live.</p>"
        + _button(f"{settings.frontend_url}/dashboard", "Open my dashboard")
    )
    await _send_async(to, "Your Strykd subscription is active", _shell(body))
