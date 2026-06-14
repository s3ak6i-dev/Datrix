"""Public invite-link join flow — no auth required."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field

from app.core.auth import hash_password, create_access_token, create_refresh_token
from app.db.session import db_session
from app.db import models as M

router = APIRouter(prefix="/join", tags=["join"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Schemas ───────────────────────────────────────────────────────────────────

class JoinInfoOut(BaseModel):
    org_id: str
    org_name: str
    org_slug: str


class JoinIn(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr = Field(..., max_length=320)
    password: str = Field(..., min_length=8, max_length=128)
    color: str = Field(..., max_length=7)   # hex color picked on join page


class JoinOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    org_name: str
    is_new_user: bool


def _issue_tokens(db, user: M.UserORM) -> tuple[str, str]:
    """Create and persist both access + refresh tokens. Returns (access, refresh)."""
    from datetime import timedelta
    from app.core.config import settings

    access = create_access_token(user.id, user.email)
    raw_refresh, refresh_hash = create_refresh_token(user.id)
    db.add(M.RefreshTokenORM(
        id=str(uuid.uuid4()),
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=(datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)).isoformat(),
        created_at=_now(),
    ))
    return access, raw_refresh


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/{token}", response_model=JoinInfoOut)
def get_invite_info(token: str):
    with db_session() as db:
        link = db.query(M.OrgInviteLinkORM).filter_by(token=token).first()
        if not link or link.disabled:
            raise HTTPException(404, "Invite link not found or has been disabled")
        if link.expires_at < _now():
            raise HTTPException(410, "This invite link has expired")
        org = db.query(M.OrganizationORM).filter_by(id=link.org_id).first()
        if not org:
            raise HTTPException(404, "Organization not found")
        return JoinInfoOut(org_id=org.id, org_name=org.name, org_slug=org.slug)


@router.post("/{token}", response_model=JoinOut)
def join_via_invite(token: str, body: JoinIn):
    with db_session() as db:
        link = db.query(M.OrgInviteLinkORM).filter_by(token=token).first()
        if not link or link.disabled:
            raise HTTPException(404, "Invite link not found or has been disabled")
        if link.expires_at < _now():
            raise HTTPException(410, "This invite link has expired")
        org = db.query(M.OrganizationORM).filter_by(id=link.org_id).first()
        if not org:
            raise HTTPException(404, "Organization not found")

        email = body.email.lower().strip()
        existing = db.query(M.UserORM).filter_by(email=email).first()

        if existing:
            # Already has an account — just add to org if not already a member
            existing_m = db.query(M.OrgMemberORM).filter_by(
                org_id=org.id, user_id=existing.id
            ).first()
            if not existing_m:
                db.add(M.OrgMemberORM(
                    id=str(uuid.uuid4()),
                    org_id=org.id,
                    user_id=existing.id,
                    role="member",
                    created_at=_now(),
                ))
            # Update color if they don't have one yet
            profile = db.query(M.UserProfileORM).filter_by(user_id=existing.id).first()
            if profile and not profile.color:
                profile.color = body.color
            access, refresh = _issue_tokens(db, existing)
            return JoinOut(access_token=access, refresh_token=refresh, org_name=org.name, is_new_user=False)

        # New user — create account, profile, and membership
        now = _now()
        user = M.UserORM(
            id=str(uuid.uuid4()),
            email=email,
            hashed_password=hash_password(body.password),
            full_name=body.full_name,
            email_verified=False,
            created_at=now,
        )
        db.add(user)
        db.flush()

        db.add(M.UserProfileORM(
            user_id=user.id,
            full_name=body.full_name,
            use_cases=[],
            color=body.color,
            onboarding_completed=True,  # invite joiners skip onboarding
            created_at=now,
            updated_at=now,
        ))

        db.add(M.OrgMemberORM(
            id=str(uuid.uuid4()),
            org_id=org.id,
            user_id=user.id,
            role="member",
            created_at=now,
        ))

        access, refresh = _issue_tokens(db, user)
        return JoinOut(access_token=access, refresh_token=refresh, org_name=org.name, is_new_user=True)
