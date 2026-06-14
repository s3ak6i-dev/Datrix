"""User profile API — onboarding data and personal settings."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import get_current_user, hash_password
from app.db.session import db_session
from app.db import models as M

router = APIRouter(prefix="/profile", tags=["profile"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ProfileOut(BaseModel):
    user_id: str
    full_name: Optional[str]
    role: Optional[str]
    company: Optional[str]
    use_cases: list[str]
    avatar_url: Optional[str]
    color: Optional[str]
    onboarding_completed: bool


class OnboardingIn(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    role: str = Field(..., min_length=1, max_length=80)
    company: Optional[str] = Field(None, max_length=120)
    use_cases: list[str] = Field(default_factory=list)


class UpdateProfileIn(BaseModel):
    full_name: Optional[str] = Field(None, max_length=120)
    role: Optional[str] = Field(None, max_length=80)
    company: Optional[str] = Field(None, max_length=120)
    use_cases: Optional[list[str]] = None
    avatar_url: Optional[str] = Field(None, max_length=500)
    color: Optional[str] = Field(None, max_length=7)  # hex color


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_create_profile(db, user_id: str) -> M.UserProfileORM:
    profile = db.query(M.UserProfileORM).filter_by(user_id=user_id).first()
    if not profile:
        now = _now()
        profile = M.UserProfileORM(
            user_id=user_id,
            use_cases=[],
            onboarding_completed=False,
            created_at=now,
            updated_at=now,
        )
        db.add(profile)
        db.flush()
    return profile


def _out(p: M.UserProfileORM) -> ProfileOut:
    return ProfileOut(
        user_id=p.user_id,
        full_name=p.full_name,
        role=p.role,
        company=p.company,
        use_cases=p.use_cases or [],
        avatar_url=p.avatar_url,
        color=getattr(p, "color", None),
        onboarding_completed=bool(p.onboarding_completed),
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=ProfileOut)
def get_profile(user: M.UserORM = Depends(get_current_user)):
    with db_session() as db:
        profile = _get_or_create_profile(db, user.id)
        return _out(profile)


@router.put("/me", response_model=ProfileOut)
def update_profile(body: UpdateProfileIn, user: M.UserORM = Depends(get_current_user)):
    with db_session() as db:
        profile = _get_or_create_profile(db, user.id)
        if body.full_name is not None:
            profile.full_name = body.full_name
        if body.role is not None:
            profile.role = body.role
        if body.company is not None:
            profile.company = body.company
        if body.use_cases is not None:
            profile.use_cases = body.use_cases
        if body.avatar_url is not None:
            profile.avatar_url = body.avatar_url
        if body.color is not None:
            profile.color = body.color
        profile.updated_at = _now()
        return _out(profile)


@router.post("/me/complete-onboarding", response_model=ProfileOut)
def complete_onboarding(body: OnboardingIn, user: M.UserORM = Depends(get_current_user)):
    with db_session() as db:
        profile = _get_or_create_profile(db, user.id)
        profile.full_name = body.full_name
        profile.role = body.role
        profile.company = body.company
        profile.use_cases = body.use_cases
        profile.onboarding_completed = True
        profile.updated_at = _now()
        return _out(profile)


class ChangePasswordIn(BaseModel):
    password: str = Field(..., min_length=8, max_length=128)


@router.post("/me/change-password", status_code=204)
def change_password(body: ChangePasswordIn, user: M.UserORM = Depends(get_current_user)):
    with db_session() as db:
        u = db.query(M.UserORM).filter_by(id=user.id).first()
        if not u:
            raise HTTPException(status_code=404, detail="User not found")
        u.hashed_password = hash_password(body.password)
