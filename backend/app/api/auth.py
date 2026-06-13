"""Authentication routes: register, login, refresh, logout."""
import hashlib
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
    created_at: str


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
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        db.add(user)
        db.flush()  # get the ID before creating token

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
        ))

    return TokenOut(access_token=access, refresh_token=raw_refresh)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn):
    with db_session() as db:
        user = db.query(M.UserORM).filter_by(email=body.email).first()
        if not user or not verify_password(body.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials")

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
        ))

    return TokenOut(access_token=access, refresh_token=raw_refresh)


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
        if rt.expires_at < datetime.now(timezone.utc).isoformat():
            raise HTTPException(status_code=401, detail="Refresh token expired")

        user = db.query(M.UserORM).filter_by(id=rt.user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        # Rotate: revoke old, issue new
        rt.revoked = True
        access = create_access_token(user.id, user.email)
        raw_refresh, new_hash = create_refresh_token(user.id)

        expires_at = (
            datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        ).isoformat()

        db.add(M.RefreshTokenORM(
            id=str(uuid.uuid4()),
            user_id=user.id,
            token_hash=new_hash,
            expires_at=expires_at,
            revoked=False,
        ))

    return TokenOut(access_token=access, refresh_token=raw_refresh)


@router.post("/logout", status_code=204)
def logout(body: RefreshIn):
    token_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()
    with db_session() as db:
        rt = db.query(M.RefreshTokenORM).filter_by(token_hash=token_hash).first()
        if rt:
            rt.revoked = True


@router.get("/me", response_model=UserOut)
def me(user: M.UserORM = Depends(get_current_user)):
    return UserOut(id=user.id, email=user.email, created_at=user.created_at)
