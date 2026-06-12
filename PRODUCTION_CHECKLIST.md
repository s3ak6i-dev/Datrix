# Datrix — Production Readiness Checklist

> Work through this top-to-bottom. Items are ordered by criticality — earlier phases block later ones.
> ✅ = Done | 🔄 = In progress | ⬜ = Not started

---

## Phase 1 — Critical Blockers

### 1.1 Authentication & Authorization
- ✅ Add `python-jose[cryptography]` + `passlib[bcrypt]` + `pydantic[email]` to backend dependencies
- ✅ Create `User` model (id, email, hashed_password, created_at) as SQLAlchemy ORM
- ✅ Create `RefreshToken` model (id, user_id, token_hash, expires_at, revoked)
- ✅ `POST /auth/register` — create user, hash password with bcrypt, return access + refresh JWT
- ✅ `POST /auth/login` — verify password, return signed JWT pair
- ✅ `POST /auth/refresh` — verify refresh token, rotate (revoke old, issue new), return new pair
- ✅ `POST /auth/logout` — revoke refresh token in DB
- ✅ `GET /auth/me` — return current user info
- ✅ FastAPI `get_current_user` dependency (`app/core/auth.py`) — validates Bearer token
- ✅ Applied `Depends(get_current_user)` to ALL routers in `main.py` (datasets, pipelines, synthetic, al, benchmark, marketplace, settings, compliance)
- ✅ Public routes (`/health`, `/auth/*`) explicitly excluded from auth
- ✅ Frontend: `AuthContext.tsx` — holds user state, exposes `login()`, `logout()`, `register()`, `accessToken()`
- ✅ Frontend: `LoginPage.tsx` — email/password form with login/register toggle
- ✅ Frontend: `ProtectedRoute.tsx` — redirects to `/login` if no valid token
- ✅ Frontend: `api.ts` — injects `Authorization: Bearer <token>` on every request, auto-refreshes on 401
- ✅ Frontend: logout button in Sidebar with user email display, clears tokens + redirects to `/login`
- ✅ App.tsx wrapped with `AuthProvider`, all routes inside `ProtectedRoute`

**Effort:** 4–5 days | **Status: COMPLETE**

---

### 1.2 Real Database (replace db.json)
- ✅ Added `sqlalchemy==2.0.41`, `alembic==1.16.1`, `psycopg2-binary==2.9.10` to dependencies
- ✅ Created `backend/app/db/` directory — `base.py`, `engine.py`, `session.py`, `models.py`
- ✅ `engine.py` — creates SQLAlchemy engine from `settings.DATABASE_URL`, `create_tables()` for idempotent table creation
- ✅ `session.py` — `SessionLocal` factory, `get_db()` FastAPI dependency, `db_session()` context manager for background threads
- ✅ Defined SQLAlchemy ORM models for ALL entities:
  - ✅ `DatasetORM`, `QualityScanORM`, `ColumnProfileSetORM`, `CleaningRecordORM`
  - ✅ `PipelineORM`, `PipelineRunORM`
  - ✅ `SyntheticJobORM`, `TrainedModelORM`
  - ✅ `ALSessionORM`
  - ✅ `BenchmarkJobORM`
  - ✅ `MarketplaceAssetORM`, `MarketplaceReviewORM`, `MarketplaceInstallORM`
  - ✅ `ComplianceScanORM`, `CompliancePolicyORM`, `PolicyViolationORM`, `AuditEventORM`, `AnonymizationJobORM`, `ComplianceReportORM`
  - ✅ `AppSettingsORM`
  - ✅ `UserORM`, `RefreshTokenORM`
- ✅ **22 tables created on Neon Postgres** (verified with `inspect(engine).get_table_names()`)
- ✅ Rewrote `store.py` — kept all dataclass types + method signatures, replaced flat-file implementation with SQLAlchemy `db_session()` calls
- ✅ Removed `threading.Lock`, `_persist()`, `_load_db()`, `db.json` entirely
- ✅ Each store method creates and closes its own DB session (background-thread safe)
- ✅ `create_tables()` called automatically on app startup via lifespan hook in `main.py`
- ✅ Alembic initialized: `alembic init`, `env.py` configured with our `Base` + `settings.DATABASE_URL`
- ✅ Initial migration generated and applied to Neon Postgres (`8f40da1443e7_initial_schema`)
- ✅ `_run_migrations()` in `main.py` lifespan — runs `alembic upgrade head` on every startup (fallback to `create_all` if alembic.ini not found)
- ⬜ Test: run all existing API routes against real DB

**Effort:** 4–6 days | **Status: ~90% complete (Alembic migrations remaining)**

---

### 1.3 Environment Configuration
- ✅ Added `pydantic-settings==2.9.1` to dependencies
- ✅ Rewrote `backend/app/core/config.py` — `Settings(BaseSettings)` class with:
  - `DATABASE_URL` (Neon Postgres connection string)
  - `SECRET_KEY` (random 32-byte hex, generated with `secrets.token_hex(32)`)
  - `ALGORITHM` (HS256)
  - `ACCESS_TOKEN_EXPIRE_MINUTES` (30)
  - `REFRESH_TOKEN_EXPIRE_DAYS` (7)
  - `ALLOWED_ORIGINS` (comma-separated, default: localhost:5173)
  - `UPLOAD_DIR`, `MAX_UPLOAD_MB`, `ENVIRONMENT`, `SENTRY_DSN`
- ✅ Created `backend/.env` with Neon DATABASE_URL + SECRET_KEY (gitignored)
- ✅ Created `backend/.env.example` with all keys documented
- ✅ Updated `main.py` CORS to use `settings.allowed_origins_list`
- ✅ Added backwards-compatible module-level constants (`DATA_DIR`, `UPLOADS_DIR`, `ALLOWED_EXTENSIONS`, `MAX_UPLOAD_BYTES`) so existing service files don't need changes
- ✅ Created `frontend/.env` with `VITE_API_URL`, `VITE_STACK_PROJECT_ID` placeholders
- ✅ Updated `frontend/src/lib/api.ts` — `BASE` now reads `import.meta.env.VITE_API_URL`
- ✅ `backend/.env` and `frontend/.env` confirmed in `.gitignore`

**Effort:** 1 day | **Status: COMPLETE**

---

### 1.4 File Storage
- ⬜ Abstract file storage behind a `StorageBackend` interface
- ⬜ Implement `LocalStorageBackend`
- ⬜ Implement `S3StorageBackend`
- ⬜ Switch via `settings.STORAGE_BACKEND`

**Effort:** 1–2 days | **Status: Not started**

---

### 1.5 HTTPS & TLS
- ✅ `nginx/nginx.conf` — production config with TLS termination, HTTP→HTTPS redirect, HSTS, CSP, X-Frame-Options, OCSP stapling, modern cipher suite
- ✅ `docker-compose.production.yml` — separate nginx + certbot services, cert volumes, auto-renewal loop
- ✅ `scripts/setup-ssl.sh` — one-shot Certbot issuance script (requires domain + port 80 open)
- ✅ CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy headers in nginx
- ⬜ Run on a live server with a real domain (deployment step, not a code step)

**Effort:** half a day | **Status: COMPLETE (config done; cert issuance is a deploy-time step)**

---

## Phase 2 — Stability & Quality

### 2.1 Error Boundaries (Frontend)
- ✅ Created `frontend/src/components/ErrorBoundary.tsx` — class component, catches render errors, shows fallback with "Try again" button
- ✅ Wrapped `<Layout />` in App.tsx with `<ErrorBoundary>`
- ⬜ Add inline `<ErrorBoundary>` around Sidebar separately

**Effort:** 2 hours | **Status: ~80% complete**

---

### 2.2 API Rate Limiting
- ✅ Added `slowapi==0.1.9` to dependencies
- ✅ Created `app/core/limiter.py` — shared `Limiter` instance (200/minute global default)
- ✅ Registered limiter on `app.state` in `main.py` with 429 exception handler
- ✅ `POST /datasets/upload` — `10/minute` per IP
- ✅ `POST /synthetic/jobs` — `5/minute` per IP
- ✅ `POST /al/sessions` — `5/minute` per IP
- ✅ `POST /benchmark/jobs` — `5/minute` per IP
- ✅ `POST /compliance/scans/{dataset_id}` — `20/minute` per IP

**Effort:** 2–3 hours | **Status: COMPLETE**

---

### 2.3 Background Thread Error Handling
- ✅ Identified all 11 background thread launch sites across 6 files
- ✅ All thread targets have `try/except Exception` → `status="failed"` + `error_message`:
  - `datasets.py` — `_ingest_and_scan`, `_run_scan` already had it
  - `pipelines.py` — `_execute_run` already had it
  - `benchmark_executor.py` — `run_benchmark` + `_run_candidate` already had it
  - `synthetic_executor.py` — `execute_synthetic_job` already had it
  - `active_learning_executor.py` — `train_and_get_next_batch` already had it (resets to "annotating")
  - `compliance.py` — fixed `trigger_scan._run`, `scan_all_datasets._run_all`, `create_anonymize_job._run`; fixed double-thread bug in `create_report`
- ✅ Added `_reset_stale_jobs()` startup watchdog in `main.py` — marks jobs stuck in "running" > 30 min as "failed"
- ✅ Added `store.list_all_pipeline_runs()` method to support watchdog
- ✅ All threads use `db_session()` context managers (verified across all executor files)

**Effort:** 1 day | **Status: COMPLETE**

---

### 2.4 File Upload Validation
- ✅ Sanitize filenames — `_safe_filename()` strips path components + replaces non-`[\w\-. ]` chars
- ✅ Enforce `MAX_UPLOAD_MB` server-side — 413 response if exceeded
- ✅ Validate UTF-8 encoding for CSV uploads — 400 response with clear message

**Effort:** 2–3 hours | **Status: COMPLETE**

---

### 2.5 Structured Logging
- ✅ Added `python-json-logger==3.3.0` + `sentry-sdk[fastapi]==2.29.1` to dependencies
- ✅ Sentry initialized in `main.py` lifespan if `SENTRY_DSN` is set
- ✅ `app/core/logging_setup.py` — JSON formatter active in non-development environments, plain text in dev
- ✅ `configure_logging()` called at module import in `main.py`
- ✅ HTTP request logging middleware — logs `METHOD path status Xms` for every request

**Effort:** 1 day | **Status: COMPLETE**

---

### 2.6 API Input Hardening
- ⬜ Audit all POST/PATCH routes for missing Pydantic validation
- ⬜ `max_length` on string fields
- ⬜ Validate column_configs in anonymization

**Effort:** 1 day | **Status: Not started**

---

## Phase 3 — Infrastructure

### 3.1 Docker & Docker Compose
- ✅ `backend/Dockerfile` — python:3.12-slim, gunicorn + uvicorn workers
- ✅ `frontend/Dockerfile` — multi-stage: node:20-alpine build → nginx:alpine serve
- ✅ `docker-compose.yml` — backend + frontend with volume for data persistence
- ✅ `frontend/nginx.conf` — SPA fallback, API proxy to backend, security headers, asset caching
- ✅ `backend/.dockerignore` + `frontend/.dockerignore`

**Effort:** 1–2 days | **Status: COMPLETE**

---

### 3.2 Production Process Management
- ✅ Added `gunicorn==23.0.0` to dependencies
- ✅ Gunicorn configured in `backend/Dockerfile` CMD: 3 workers, UvicornWorker, `--timeout 120`, `--max-requests 1000`, jitter 100

**Effort:** 2 hours | **Status: COMPLETE**

---

### 3.3 Backups
- ⬜ `scripts/backup.sh`
- ⬜ Cron / systemd timer
- ⬜ Off-site copy (S3/Backblaze)

**Effort:** half a day | **Status: Not started**

---

### 3.4 Health & Monitoring
- ✅ `/health` endpoint returns `status`, `version`, `environment`
- ⬜ Enhance `/health` with DB connectivity + disk + active job counts
- ⬜ `/metrics` endpoint (Prometheus format)

**Effort:** half a day | **Status: ~10% complete**

---

## Phase 4 — Pre-launch Polish

### 4.1 Frontend Production Build
- ⬜ `npm run build` — fix any strict-mode TS errors
- ⬜ Bundle size analysis
- ✅ All API calls use `VITE_API_URL` env var

**Effort:** half a day | **Status: ~10% complete**

---

### 4.2 Security Headers & Hardening
- ⬜ `Content-Security-Policy` in Nginx
- ⬜ `X-Frame-Options: DENY`
- ⬜ `X-Content-Type-Options: nosniff`
- ⬜ `Referrer-Policy`
- ⬜ SECRET_KEY rotation procedure documented

**Effort:** 2–3 hours | **Status: Not started**

---

### 4.3 Database Seeding & Migrations in Production
- ✅ `create_tables()` (idempotent) runs on every app startup
- ✅ `initialize_seeds()` and `ensure_default_policies()` called in lifespan
- ⬜ Add idempotency guard to seeder (skip if DB already populated)
- ⬜ Alembic `upgrade head` in startup sequence (when Alembic is added)

**Effort:** 2 hours | **Status: ~50% complete**

---

### 4.4 CI/CD Pipeline
- ✅ `.github/workflows/ci.yml` — ruff lint + pyright (backend), `tsc --noEmit` + `npm run build` (frontend) on every push/PR
- ✅ `.github/workflows/deploy.yml` — builds + pushes Docker images to GHCR on version tags (`v*`)
- ⬜ `pytest` smoke tests for critical API routes

**Effort:** 1–2 days | **Status: ~80% complete (pytest smoke tests remaining)**

---

## Summary

| Phase | Items | Status |
|---|---|---|
| **1.1 Auth** | JWT backend + frontend full stack | ✅ Complete |
| **1.2 Database** | SQLAlchemy + Neon Postgres + Alembic migrations | ✅ Complete |
| **1.3 Env Config** | pydantic-settings, .env, VITE_API_URL | ✅ Complete |
| **1.4 File Storage** | Storage abstraction + S3 | ⬜ Not started |
| **1.5 HTTPS** | Nginx TLS + Certbot auto-renew + all security headers | ✅ Complete (cert = deploy step) |
| **2.1 Error Boundaries** | React ErrorBoundary | ✅ ~80% (inline Sidebar boundary remaining) |
| **2.2 Rate Limiting** | slowapi, per-route limits | ✅ Complete |
| **2.3 Thread Safety** | try/except + startup watchdog | ✅ Complete |
| **2.4 Upload Validation** | UTF-8 check, size limit, filename sanitization | ✅ Complete |
| **2.5 Structured Logging** | JSON formatter, request middleware, Sentry | ✅ Complete |
| **2.6 Input Hardening** | Pydantic max_length, column validation | ⬜ Not started |
| **3.1 Docker** | Dockerfiles, compose, nginx | ✅ Complete |
| **3.2 Gunicorn** | Worker config in Dockerfile | ✅ Complete |
| **3.3–3.4 Infra** | Backups, Prometheus metrics | ⬜ Not started |
| **4.1 Frontend Build** | tsc + bundle analysis | ⬜ Partial |
| **4.2 Security Headers** | CSP, X-Frame-Options (in nginx.conf) | ✅ Partial (in nginx) |
| **4.3 DB Seeding** | Idempotency guard | ⬜ Partial |
| **4.4 CI/CD** | GitHub Actions (CI + deploy on tag) | ✅ ~80% (pytest remaining) |

---

## Remaining critical path

```
2.6 Input hardening  →  1.4 File Storage  →  1.5 HTTPS (on target server)
        ↓
4.4 pytest smoke tests  →  1.2 Alembic migrations  →  ship
```
