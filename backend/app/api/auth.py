"""Authentication routes: register, login, refresh, logout, password reset, email verify."""
import hashlib
import secrets
import threading
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.core.auth import (
    create_access_token, create_refresh_token,
    get_current_user, hash_password, verify_password, _decode_token,
)
from app.core.config import settings
from app.db.session import db_session
from app.db import models as M
from app.services import email as mail_svc

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterIn(BaseModel):
    email: EmailStr = Field(..., max_length=320)
    password: str = Field(..., min_length=8, max_length=128)

class LoginIn(BaseModel):
    email: EmailStr = Field(..., max_length=320)
    password: str = Field(..., max_length=128)

class RefreshIn(BaseModel):
    refresh_token: str = Field(..., max_length=2000)

class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: str
    email: str
    email_verified: bool
    created_at: str

class ForgotPasswordIn(BaseModel):
    email: EmailStr = Field(..., max_length=320)

class ResetPasswordIn(BaseModel):
    token: str = Field(..., min_length=8)
    password: str = Field(..., min_length=8, max_length=128)

class VerifyEmailIn(BaseModel):
    token: str = Field(..., min_length=8)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _make_token() -> tuple[str, str]:
    """Return (raw_token, sha256_hash)."""
    raw = secrets.token_hex(32)
    return raw, hashlib.sha256(raw.encode()).hexdigest()

def _issue_tokens(db, user: M.UserORM) -> TokenOut:
    access = create_access_token(user.id, user.email)
    raw_refresh, token_hash = create_refresh_token(user.id)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()
    db.add(M.RefreshTokenORM(
        id=str(uuid.uuid4()), user_id=user.id,
        token_hash=token_hash, expires_at=expires_at, revoked=False,
    ))
    return TokenOut(access_token=access, refresh_token=raw_refresh)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn):
    with db_session() as db:
        if db.query(M.UserORM).filter_by(email=body.email).first():
            raise HTTPException(status_code=400, detail="Email already registered")

        user = M.UserORM(
            id=str(uuid.uuid4()),
            email=body.email,
            hashed_password=hash_password(body.password),
            email_verified=False,
            created_at=_now(),
        )
        db.add(user)
        db.flush()

        tokens = _issue_tokens(db, user)

        # Send verification email in background so register isn't slowed
        raw_token, tok_hash = _make_token()
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        db.add(M.EmailVerificationTokenORM(
            id=str(uuid.uuid4()), user_id=user.id,
            token_hash=tok_hash, expires_at=expires_at, used=False,
        ))

    threading.Thread(
        target=mail_svc.send_verification, args=(body.email, raw_token), daemon=True
    ).start()

    return tokens


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn):
    with db_session() as db:
        user = db.query(M.UserORM).filter_by(email=body.email).first()
        if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return _issue_tokens(db, user)


@router.post("/refresh", response_model=TokenOut)
def refresh(body: RefreshIn):
    payload = _decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    token_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()

    with db_session() as db:
        rt = db.query(M.RefreshTokenORM).filter_by(token_hash=token_hash).first()
        if not rt or rt.revoked:
            raise HTTPException(status_code=401, detail="Refresh token invalid or revoked")
        if rt.expires_at < _now():
            raise HTTPException(status_code=401, detail="Refresh token expired")

        user = db.query(M.UserORM).filter_by(id=rt.user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        rt.revoked = True
        return _issue_tokens(db, user)


@router.post("/logout", status_code=204)
def logout(body: RefreshIn):
    token_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()
    with db_session() as db:
        rt = db.query(M.RefreshTokenORM).filter_by(token_hash=token_hash).first()
        if rt:
            rt.revoked = True


@router.get("/me", response_model=UserOut)
def me(user: M.UserORM = Depends(get_current_user)):
    return UserOut(id=user.id, email=user.email,
                   email_verified=bool(user.email_verified), created_at=user.created_at)


@router.post("/forgot-password", status_code=204)
def forgot_password(body: ForgotPasswordIn):
    """Always 204 — never reveal whether the email exists."""
    with db_session() as db:
        user = db.query(M.UserORM).filter_by(email=body.email).first()
        if not user or not user.hashed_password:
            return  # OAuth-only user or unknown — silent

        # Invalidate any existing reset tokens
        db.query(M.PasswordResetTokenORM).filter_by(user_id=user.id, used=False).update({"used": True})

        raw_token, tok_hash = _make_token()
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        db.add(M.PasswordResetTokenORM(
            id=str(uuid.uuid4()), user_id=user.id,
            token_hash=tok_hash, expires_at=expires_at, used=False,
        ))
        email = user.email

    threading.Thread(
        target=mail_svc.send_password_reset, args=(email, raw_token), daemon=True
    ).start()


@router.post("/reset-password", status_code=204)
def reset_password(body: ResetPasswordIn):
    tok_hash = hashlib.sha256(body.token.encode()).hexdigest()
    with db_session() as db:
        record = db.query(M.PasswordResetTokenORM).filter_by(token_hash=tok_hash, used=False).first()
        if not record:
            raise HTTPException(status_code=400, detail="Invalid or expired reset link")
        if record.expires_at < _now():
            raise HTTPException(status_code=400, detail="Reset link has expired")

        user = db.query(M.UserORM).filter_by(id=record.user_id).first()
        if not user:
            raise HTTPException(status_code=400, detail="User not found")

        user.hashed_password = hash_password(body.password)
        record.used = True

        # Revoke all refresh tokens (security: log out all sessions)
        db.query(M.RefreshTokenORM).filter_by(user_id=user.id).update({"revoked": True})


@router.post("/verify-email", status_code=204)
def verify_email(body: VerifyEmailIn):
    tok_hash = hashlib.sha256(body.token.encode()).hexdigest()
    with db_session() as db:
        record = db.query(M.EmailVerificationTokenORM).filter_by(token_hash=tok_hash, used=False).first()
        if not record:
            raise HTTPException(status_code=400, detail="Invalid or expired verification link")
        if record.expires_at < _now():
            raise HTTPException(status_code=400, detail="Verification link has expired")

        user = db.query(M.UserORM).filter_by(id=record.user_id).first()
        if user:
            user.email_verified = True
        record.used = True


@router.post("/resend-verification", status_code=204)
def resend_verification(user: M.UserORM = Depends(get_current_user)):
    if user.email_verified:
        return

    with db_session() as db:
        db.query(M.EmailVerificationTokenORM).filter_by(user_id=user.id, used=False).update({"used": True})
        raw_token, tok_hash = _make_token()
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        db.add(M.EmailVerificationTokenORM(
            id=str(uuid.uuid4()), user_id=user.id,
            token_hash=tok_hash, expires_at=expires_at, used=False,
        ))
        email = user.email

    threading.Thread(
        target=mail_svc.send_verification, args=(email, raw_token), daemon=True
    ).start()
