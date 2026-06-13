"""
Email service — sends via SMTP when configured, otherwise logs to console.

Set SMTP_HOST in .env to enable real sending.  Without it, every email is
printed to stdout so the reset / verification tokens are still accessible
during local development.
"""
from __future__ import annotations

import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

log = logging.getLogger("datrix.email")


def _send(to: str, subject: str, html: str, plain: str) -> bool:
    if not settings.SMTP_HOST:
        log.info(
            "\n━━ [DEV EMAIL] ━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "To:      %s\nSubject: %s\n\n%s\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            to, subject, plain,
        )
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{settings.FROM_NAME} <{settings.FROM_EMAIL}>"
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(plain, "plain"))
        msg.attach(MIMEText(html, "html"))

        ctx = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as s:
            s.ehlo()
            if settings.SMTP_TLS:
                s.starttls(context=ctx)
                s.ehlo()
            if settings.SMTP_USER:
                s.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            s.sendmail(settings.FROM_EMAIL, to, msg.as_string())
        return True
    except Exception as exc:
        log.error("Email send failed to %s: %s", to, exc)
        return False


def _btn(url: str, label: str) -> str:
    return (
        f'<p style="text-align:center;margin:28px 0">'
        f'<a href="{url}" style="background:#63b3ff;color:#050810;font-weight:600;'
        f'padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px">'
        f'{label}</a></p>'
    )


def _wrap(body: str) -> str:
    return f"""<!DOCTYPE html><html><body style="margin:0;padding:0;background:#050810;font-family:system-ui,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
<tr><td align="center"><table width="560" style="background:#0d1220;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:40px 36px">
<tr><td>
<p style="font-size:22px;font-weight:700;color:#f0f4ff;margin:0 0 24px">Datrix</p>
{body}
<p style="font-size:12px;color:#3d4d6a;margin-top:40px">
If you didn't request this, you can safely ignore this email.
</p>
</td></tr></table></td></tr></table>
</body></html>"""


def send_password_reset(to: str, token: str) -> bool:
    url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    html = _wrap(
        f'<p style="color:#f0f4ff;font-size:16px;margin:0 0 12px">Reset your password</p>'
        f'<p style="color:#7a8aaa;font-size:14px;margin:0 0 8px">'
        f'Someone requested a password reset for your Datrix account. '
        f'This link expires in 1 hour.</p>'
        + _btn(url, "Reset Password")
        + f'<p style="color:#3d4d6a;font-size:12px">Or copy this link:<br>'
        f'<span style="color:#63b3ff">{url}</span></p>'
    )
    plain = f"Reset your Datrix password (expires in 1 hour):\n{url}"
    return _send(to, "Reset your Datrix password", html, plain)


def send_verification(to: str, token: str) -> bool:
    url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    html = _wrap(
        f'<p style="color:#f0f4ff;font-size:16px;margin:0 0 12px">Verify your email</p>'
        f'<p style="color:#7a8aaa;font-size:14px;margin:0 0 8px">'
        f'Welcome to Datrix! Click below to verify your email address. '
        f'This link expires in 24 hours.</p>'
        + _btn(url, "Verify Email")
        + f'<p style="color:#3d4d6a;font-size:12px">Or copy this link:<br>'
        f'<span style="color:#63b3ff">{url}</span></p>'
    )
    plain = f"Verify your Datrix email address (expires in 24 hours):\n{url}"
    return _send(to, "Verify your Datrix email", html, plain)
