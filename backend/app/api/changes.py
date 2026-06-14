"""Change request API — workspace approval workflows."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.db.session import db_session
from app.db import models as M

router = APIRouter(prefix="/changes", tags=["changes"])

IMPACT_LEVELS = {"low", "medium", "high", "critical"}
REVIEWER_CAN_APPROVE = {"low", "medium"}
ROLLBACK_STATUSES = {"approved", "auto_approved"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_member_role(db, org_id: str, user_id: str) -> str | None:
    m = db.query(M.OrgMemberORM).filter_by(org_id=org_id, user_id=user_id).first()
    return m.role if m else None


# ── Schemas ───────────────────────────────────────────────────────────────────

class ChangeRequestOut(BaseModel):
    id: str
    org_id: str
    user_id: str
    user_name: Optional[str]
    user_color: Optional[str]
    title: str
    description: Optional[str]
    action_type: str
    impact: str
    status: str
    reviewer_id: Optional[str]
    reviewer_name: Optional[str]
    reviewer_comment: Optional[str]
    rollback_comment: Optional[str]
    auto_approve_at: Optional[str]
    resubmit_count: int
    created_at: str
    reviewed_at: Optional[str]


class CreateCRIn(BaseModel):
    org_id: str
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    action_type: str = Field("custom", max_length=50)
    impact: str = Field(...)


class ReviewCRIn(BaseModel):
    action: str = Field(..., pattern=r"^(approve|reject|resubmit|rollback)$")
    comment: Optional[str] = Field(None, max_length=1000)
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    impact: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _cr_out(db, cr: M.ChangeRequestORM) -> ChangeRequestOut:
    profile = db.query(M.UserProfileORM).filter_by(user_id=cr.user_id).first()
    user = db.query(M.UserORM).filter_by(id=cr.user_id).first()
    name = (profile.full_name if profile and profile.full_name else None) or (user.email if user else None)
    color = profile.color if profile else None

    reviewer_name: Optional[str] = None
    if cr.reviewer_id:
        rp = db.query(M.UserProfileORM).filter_by(user_id=cr.reviewer_id).first()
        ru = db.query(M.UserORM).filter_by(id=cr.reviewer_id).first()
        reviewer_name = (rp.full_name if rp and rp.full_name else None) or (ru.email if ru else None)

    return ChangeRequestOut(
        id=cr.id,
        org_id=cr.org_id,
        user_id=cr.user_id,
        user_name=name,
        user_color=color,
        title=cr.title,
        description=cr.description,
        action_type=cr.action_type or "custom",
        impact=cr.impact,
        status=cr.status or "pending",
        reviewer_id=cr.reviewer_id,
        reviewer_name=reviewer_name,
        reviewer_comment=cr.reviewer_comment,
        rollback_comment=getattr(cr, "rollback_comment", None),
        auto_approve_at=cr.auto_approve_at,
        resubmit_count=cr.resubmit_count or 0,
        created_at=cr.created_at,
        reviewed_at=cr.reviewed_at,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ChangeRequestOut])
def list_changes(
    org_id: str,
    status: Optional[str] = None,
    user: M.UserORM = Depends(get_current_user),
):
    with db_session() as db:
        role = _get_member_role(db, org_id, user.id)
        if not role:
            raise HTTPException(403, "Not a member of this organization")

        q = db.query(M.ChangeRequestORM).filter(M.ChangeRequestORM.org_id == org_id)
        if role == "member":
            q = q.filter(M.ChangeRequestORM.user_id == user.id)
        if status:
            q = q.filter(M.ChangeRequestORM.status == status)

        crs = q.order_by(M.ChangeRequestORM.created_at.desc()).all()
        return [_cr_out(db, cr) for cr in crs]


@router.post("", response_model=ChangeRequestOut, status_code=201)
def create_change(body: CreateCRIn, user: M.UserORM = Depends(get_current_user)):
    if body.impact not in IMPACT_LEVELS:
        raise HTTPException(400, f"Impact must be one of: {', '.join(sorted(IMPACT_LEVELS))}")

    with db_session() as db:
        role = _get_member_role(db, body.org_id, user.id)
        if not role:
            raise HTTPException(403, "Not a member of this organization")

        now = _now()
        auto_at = None
        if body.impact == "low":
            auto_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

        cr = M.ChangeRequestORM(
            id=str(uuid.uuid4()),
            org_id=body.org_id,
            user_id=user.id,
            title=body.title,
            description=body.description,
            action_type=body.action_type,
            impact=body.impact,
            status="pending",
            auto_approve_at=auto_at,
            resubmit_count=0,
            created_at=now,
        )
        db.add(cr)
        db.flush()
        return _cr_out(db, cr)


@router.get("/{cr_id}", response_model=ChangeRequestOut)
def get_change(cr_id: str, user: M.UserORM = Depends(get_current_user)):
    with db_session() as db:
        cr = db.query(M.ChangeRequestORM).filter_by(id=cr_id).first()
        if not cr:
            raise HTTPException(404, "Change request not found")
        role = _get_member_role(db, cr.org_id, user.id)
        if not role:
            raise HTTPException(403, "Not a member of this organization")
        if role == "member" and cr.user_id != user.id:
            raise HTTPException(403, "Access denied")
        return _cr_out(db, cr)


@router.patch("/{cr_id}", response_model=ChangeRequestOut)
def review_change(cr_id: str, body: ReviewCRIn, user: M.UserORM = Depends(get_current_user)):
    with db_session() as db:
        cr = db.query(M.ChangeRequestORM).filter_by(id=cr_id).first()
        if not cr:
            raise HTTPException(404, "Change request not found")
        role = _get_member_role(db, cr.org_id, user.id)
        if not role:
            raise HTTPException(403, "Not a member of this organization")

        now = _now()

        if body.action in ("approve", "reject"):
            if role == "member":
                raise HTTPException(403, "Only owners and reviewers can approve or reject changes")
            if role == "reviewer" and cr.impact not in REVIEWER_CAN_APPROVE:
                raise HTTPException(403, "Reviewers can only approve Low and Medium impact changes")
            if cr.status != "pending":
                raise HTTPException(400, f"Cannot {body.action} a '{cr.status}' change request")

            cr.status = "approved" if body.action == "approve" else "rejected"
            cr.reviewer_id = user.id
            cr.reviewer_comment = body.comment
            cr.reviewed_at = now

        elif body.action == "rollback":
            if role == "member":
                raise HTTPException(403, "Only owners and reviewers can roll back changes")
            if cr.status not in ROLLBACK_STATUSES:
                raise HTTPException(400, f"Can only roll back approved changes (current status: '{cr.status}')")
            # Reviewers may only roll back approvals they made themselves
            if role == "reviewer" and cr.reviewer_id != user.id:
                raise HTTPException(403, "Reviewers can only roll back approvals they made")

            cr.status = "rolled_back"
            cr.rollback_comment = body.comment
            cr.reviewed_at = now

        elif body.action == "resubmit":
            if cr.user_id != user.id:
                raise HTTPException(403, "Only the original creator can resubmit")
            if cr.status not in ("rejected", "rolled_back"):
                raise HTTPException(400, "Can only resubmit rejected or rolled-back change requests")

            cr.status = "pending"
            cr.reviewer_id = None
            cr.reviewer_comment = None
            cr.rollback_comment = None
            cr.reviewed_at = None
            cr.resubmit_count = (cr.resubmit_count or 0) + 1
            if body.title:
                cr.title = body.title
            if body.description is not None:
                cr.description = body.description
            if body.impact and body.impact in IMPACT_LEVELS:
                cr.impact = body.impact
                cr.auto_approve_at = (
                    (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
                    if body.impact == "low" else None
                )

        return _cr_out(db, cr)


@router.delete("/{cr_id}", status_code=204)
def delete_change(cr_id: str, user: M.UserORM = Depends(get_current_user)):
    """Creator can delete their own pending/rejected request."""
    with db_session() as db:
        cr = db.query(M.ChangeRequestORM).filter_by(id=cr_id).first()
        if not cr:
            raise HTTPException(404, "Change request not found")
        role = _get_member_role(db, cr.org_id, user.id)
        if not role:
            raise HTTPException(403, "Not a member of this organization")
        if cr.user_id != user.id and role not in ("owner",):
            raise HTTPException(403, "Access denied")
        if cr.status == "approved":
            raise HTTPException(400, "Cannot delete an approved change request")
        db.delete(cr)
