"""Organization / workspace management API."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.db.session import db_session
from app.db import models as M

router = APIRouter(prefix="/orgs", tags=["orgs"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class OrgOut(BaseModel):
    id: str
    name: str
    slug: str
    role: str
    member_count: int
    sso_domain: Optional[str]
    created_at: str


class CreateOrgIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=24, pattern=r"^[a-z0-9\-]+$")


class UpdateOrgIn(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    sso_domain: Optional[str] = Field(None, max_length=253)
    sso_provider: Optional[str] = Field(None, max_length=50)


class MemberOut(BaseModel):
    user_id: str
    email: str
    role: str
    joined_at: str


class InviteIn(BaseModel):
    email: str = Field(..., max_length=320)
    role: str = Field("member", pattern=r"^(admin|member)$")


class SSOLookupOut(BaseModel):
    configured: bool
    provider: Optional[str]
    org_name: Optional[str]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_member_role(db, org_id: str, user_id: str) -> str | None:
    m = db.query(M.OrgMemberORM).filter_by(org_id=org_id, user_id=user_id).first()
    return m.role if m else None


def _org_out(db, org: M.OrganizationORM, user_id: str) -> OrgOut:
    count = db.query(M.OrgMemberORM).filter_by(org_id=org.id).count()
    role = _get_member_role(db, org.id, user_id) or "member"
    return OrgOut(
        id=org.id, name=org.name, slug=org.slug,
        role=role, member_count=count,
        sso_domain=org.sso_domain,
        created_at=org.created_at,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[OrgOut])
def list_orgs(user: M.UserORM = Depends(get_current_user)):
    with db_session() as db:
        memberships = db.query(M.OrgMemberORM).filter_by(user_id=user.id).all()
        result = []
        for m in memberships:
            org = db.query(M.OrganizationORM).filter_by(id=m.org_id).first()
            if org:
                result.append(_org_out(db, org, user.id))
        return result


@router.post("", response_model=OrgOut, status_code=201)
def create_org(body: CreateOrgIn, user: M.UserORM = Depends(get_current_user)):
    with db_session() as db:
        if db.query(M.OrganizationORM).filter_by(slug=body.slug).first():
            raise HTTPException(400, "Workspace URL already taken")
        now = datetime.now(timezone.utc).isoformat()
        org = M.OrganizationORM(
            id=str(uuid.uuid4()),
            name=body.name,
            slug=body.slug,
            owner_id=user.id,
            created_at=now,
        )
        db.add(org)
        db.flush()
        db.add(M.OrgMemberORM(
            id=str(uuid.uuid4()),
            org_id=org.id,
            user_id=user.id,
            role="owner",
            created_at=now,
        ))
        return OrgOut(
            id=org.id, name=org.name, slug=org.slug,
            role="owner", member_count=1,
            sso_domain=None,
            created_at=org.created_at,
        )


@router.get("/{org_id}", response_model=OrgOut)
def get_org(org_id: str, user: M.UserORM = Depends(get_current_user)):
    with db_session() as db:
        org = db.query(M.OrganizationORM).filter_by(id=org_id).first()
        if not org:
            raise HTTPException(404, "Organization not found")
        if not _get_member_role(db, org.id, user.id):
            raise HTTPException(403, "Not a member of this organization")
        return _org_out(db, org, user.id)


@router.patch("/{org_id}", response_model=OrgOut)
def update_org(org_id: str, body: UpdateOrgIn, user: M.UserORM = Depends(get_current_user)):
    with db_session() as db:
        org = db.query(M.OrganizationORM).filter_by(id=org_id).first()
        if not org:
            raise HTTPException(404, "Organization not found")
        role = _get_member_role(db, org.id, user.id)
        if role not in ("owner", "admin"):
            raise HTTPException(403, "Only owners and admins can update organization settings")
        if body.name is not None:
            org.name = body.name
        if body.sso_domain is not None:
            org.sso_domain = body.sso_domain or None
        if body.sso_provider is not None:
            org.sso_provider = body.sso_provider or None
        return _org_out(db, org, user.id)


@router.get("/{org_id}/members", response_model=list[MemberOut])
def list_members(org_id: str, user: M.UserORM = Depends(get_current_user)):
    with db_session() as db:
        if not _get_member_role(db, org_id, user.id):
            raise HTTPException(403, "Not a member of this organization")
        members = db.query(M.OrgMemberORM).filter_by(org_id=org_id).all()
        result = []
        for m in members:
            u = db.query(M.UserORM).filter_by(id=m.user_id).first()
            if u:
                result.append(MemberOut(user_id=u.id, email=u.email, role=m.role, joined_at=m.created_at))
        return result


@router.post("/{org_id}/members", response_model=MemberOut, status_code=201)
def invite_member(org_id: str, body: InviteIn, user: M.UserORM = Depends(get_current_user)):
    with db_session() as db:
        role = _get_member_role(db, org_id, user.id)
        if role not in ("owner", "admin"):
            raise HTTPException(403, "Only owners and admins can invite members")
        target = db.query(M.UserORM).filter_by(email=body.email).first()
        if not target:
            raise HTTPException(404, "No Datrix account found for that email")
        if _get_member_role(db, org_id, target.id):
            raise HTTPException(400, "User is already a member")
        now = datetime.now(timezone.utc).isoformat()
        m = M.OrgMemberORM(
            id=str(uuid.uuid4()),
            org_id=org_id,
            user_id=target.id,
            role=body.role,
            created_at=now,
        )
        db.add(m)
        return MemberOut(user_id=target.id, email=target.email, role=body.role, joined_at=now)


@router.delete("/{org_id}/members/{target_user_id}", status_code=204)
def remove_member(org_id: str, target_user_id: str, user: M.UserORM = Depends(get_current_user)):
    with db_session() as db:
        my_role = _get_member_role(db, org_id, user.id)
        if my_role not in ("owner", "admin"):
            raise HTTPException(403, "Only owners and admins can remove members")
        m = db.query(M.OrgMemberORM).filter_by(org_id=org_id, user_id=target_user_id).first()
        if not m:
            raise HTTPException(404, "Member not found")
        if m.role == "owner":
            raise HTTPException(400, "Cannot remove the organization owner")
        db.delete(m)


# ── SSO domain lookup (used by the SSO sign-in screen) ───────────────────────

@router.get("/sso/lookup", response_model=SSOLookupOut)
def sso_lookup(domain: str, user: M.UserORM = Depends(get_current_user)):
    with db_session() as db:
        org = db.query(M.OrganizationORM).filter_by(sso_domain=domain).first()
        if not org or not org.sso_provider:
            return SSOLookupOut(configured=False, provider=None, org_name=None)
        return SSOLookupOut(configured=True, provider=org.sso_provider, org_name=org.name)
