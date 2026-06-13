"""OAuth 2.0 routes: Google and GitHub (authorization code flow)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urlencode

import httpx
from fastapi import APIRouter, Query
from fastapi.responses import RedirectResponse

from app.core.auth import create_access_token, create_refresh_token
from app.core.config import settings
from app.db.session import db_session
from app.db import models as M

router = APIRouter(prefix="/auth/oauth", tags=["oauth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_EMAILS_URL = "https://api.github.com/user/emails"


# ── CSRF state helpers ────────────────────────────────────────────────────────

def _make_state() -> str:
    data = {"n": secrets.token_urlsafe(16), "t": int(time.time())}
    payload = json.dumps(data, separators=(",", ":"))
    sig = hmac.new(settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}|{sig}".encode()).decode()


def _verify_state(state: str, max_age: int = 600) -> bool:
    try:
        decoded = base64.urlsafe_b64decode(state.encode()).decode()
        payload, sig = decoded.rsplit("|", 1)
        expected = hmac.new(settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return False
        data = json.loads(payload)
        return int(time.time()) - data["t"] <= max_age
    except Exception:
        return False


# ── Shared helpers ────────────────────────────────────────────────────────────

def _frontend_error(code: str) -> RedirectResponse:
    return RedirectResponse(
        f"{settings.FRONTEND_URL}/login?error={quote(code)}",
        status_code=302,
    )


def _frontend_success(access: str, refresh: str) -> RedirectResponse:
    return RedirectResponse(
        f"{settings.FRONTEND_URL}/auth/callback?access_token={quote(access)}&refresh_token={quote(refresh)}",
        status_code=302,
    )


def _upsert_oauth_user(
    provider: str,
    provider_uid: str,
    email: str,
    name: str | None,
    avatar: str | None,
) -> tuple[str, str]:
    """Find or create a user from an OAuth identity. Returns (access_token, refresh_token)."""
    with db_session() as db:
        acct = (
            db.query(M.OAuthAccountORM)
            .filter_by(provider=provider, provider_user_id=provider_uid)
            .first()
        )
        if acct:
            user = db.query(M.UserORM).filter_by(id=acct.user_id).first()
        else:
            user = db.query(M.UserORM).filter_by(email=email).first()
            if not user:
                user = M.UserORM(
                    id=str(uuid.uuid4()),
                    email=email,
                    hashed_password=None,
                    full_name=name,
                    avatar_url=avatar,
                    created_at=datetime.now(timezone.utc).isoformat(),
                )
                db.add(user)
                db.flush()
            else:
                if not user.full_name and name:
                    user.full_name = name
                if not user.avatar_url and avatar:
                    user.avatar_url = avatar

            db.add(M.OAuthAccountORM(
                id=str(uuid.uuid4()),
                user_id=user.id,
                provider=provider,
                provider_user_id=provider_uid,
                email=email,
                created_at=datetime.now(timezone.utc).isoformat(),
            ))
            db.flush()

        access = create_access_token(user.id, user.email)
        raw_refresh, token_hash = create_refresh_token(user.id)
        expires_at = (
            datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        ).isoformat()
        db.add(M.RefreshTokenORM(
            id=str(uuid.uuid4()),
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            revoked=False,
            created_at=datetime.now(timezone.utc).isoformat(),
        ))
        return access, raw_refresh


# ── Google ────────────────────────────────────────────────────────────────────

@router.get("/google")
def google_login():
    if not settings.GOOGLE_CLIENT_ID:
        return _frontend_error("google_not_configured")
    params = urlencode({
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": f"{settings.APP_URL}/auth/oauth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "state": _make_state(),
        "access_type": "offline",
        "prompt": "select_account",
    })
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{params}", status_code=302)


@router.get("/google/callback")
def google_callback(code: str = Query(...), state: str = Query(...)):
    if not _verify_state(state):
        return _frontend_error("invalid_state")
    try:
        with httpx.Client(timeout=15) as client:
            token_res = client.post(GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": f"{settings.APP_URL}/auth/oauth/google/callback",
                "grant_type": "authorization_code",
            })
            token_res.raise_for_status()
            g_access = token_res.json()["access_token"]

            info_res = client.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {g_access}"})
            info_res.raise_for_status()
            info = info_res.json()
    except Exception:
        return _frontend_error("google_exchange_failed")

    email = info.get("email")
    if not email:
        return _frontend_error("no_email")

    access, refresh = _upsert_oauth_user(
        provider="google",
        provider_uid=info["sub"],
        email=email,
        name=info.get("name"),
        avatar=info.get("picture"),
    )
    return _frontend_success(access, refresh)


# ── GitHub ────────────────────────────────────────────────────────────────────

@router.get("/github")
def github_login():
    if not settings.GITHUB_CLIENT_ID:
        return _frontend_error("github_not_configured")
    params = urlencode({
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": f"{settings.APP_URL}/auth/oauth/github/callback",
        "scope": "read:user user:email",
        "state": _make_state(),
    })
    return RedirectResponse(f"{GITHUB_AUTH_URL}?{params}", status_code=302)


@router.get("/github/callback")
def github_callback(code: str = Query(...), state: str = Query(...)):
    if not _verify_state(state):
        return _frontend_error("invalid_state")
    try:
        with httpx.Client(timeout=15) as client:
            token_res = client.post(
                GITHUB_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "redirect_uri": f"{settings.APP_URL}/auth/oauth/github/callback",
                },
                headers={"Accept": "application/json"},
            )
            token_res.raise_for_status()
            gh_token = token_res.json().get("access_token")
            if not gh_token:
                return _frontend_error("github_no_token")

            auth_header = {"Authorization": f"Bearer {gh_token}", "Accept": "application/vnd.github+json"}
            user_res = client.get(GITHUB_USER_URL, headers=auth_header)
            user_res.raise_for_status()
            gh_user = user_res.json()

            email: str | None = gh_user.get("email")
            if not email:
                emails_res = client.get(GITHUB_EMAILS_URL, headers=auth_header)
                emails_res.raise_for_status()
                for entry in emails_res.json():
                    if entry.get("primary") and entry.get("verified"):
                        email = entry["email"]
                        break
    except Exception:
        return _frontend_error("github_exchange_failed")

    if not email:
        return _frontend_error("no_email")

    access, refresh = _upsert_oauth_user(
        provider="github",
        provider_uid=str(gh_user["id"]),
        email=email,
        name=gh_user.get("name") or gh_user.get("login"),
        avatar=gh_user.get("avatar_url"),
    )
    return _frontend_success(access, refresh)
