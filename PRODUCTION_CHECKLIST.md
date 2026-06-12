# Datrix — Production Readiness Checklist

> Work through this top-to-bottom. Items are ordered by criticality — earlier phases block later ones.
> Check off each item as it's done. Estimated effort is per item, not cumulative.

---

## Phase 1 — Critical Blockers
> Nothing should be deployed until every item in this phase is complete.

### 1.1 Authentication & Authorization
- [ ] Add `python-jose` + `passlib[bcrypt]` to backend dependencies
- [ ] Create `User` model in store (id, email, hashed_password, created_at)
- [ ] `POST /auth/register` — create user, hash password with bcrypt
- [ ] `POST /auth/login` — verify password, return signed JWT (access + refresh tokens)
- [ ] `POST /auth/refresh` — exchange refresh token for new access token
- [ ] `POST /auth/logout` — invalidate refresh token (blocklist in db)
- [ ] FastAPI `get_current_user` dependency — validate Bearer token on every protected route
- [ ] Apply auth dependency to all routers (`datasets`, `pipelines`, `synthetic`, `al`, `benchmark`, `compliance`, `marketplace`, `settings`)
- [ ] Public routes (health check, auth endpoints) explicitly excluded from auth
- [ ] Frontend: `LoginPage.tsx` — email/password form, calls `/auth/login`, stores tokens in `localStorage`
- [ ] Frontend: `AuthContext` / store — holds current user, exposes `login()`, `logout()`, `refreshToken()`
- [ ] Frontend: `ProtectedRoute` wrapper — redirects to `/login` if no valid token
- [ ] Frontend: axios/fetch interceptor — attaches `Authorization: Bearer <token>` to every API request, auto-refreshes on 401
- [ ] Frontend: logout button in Sidebar, clears tokens, redirects to `/login`
- [ ] Wrap all routes in `App.tsx` with `ProtectedRoute`

**Effort:** 4–5 days

---

### 1.2 Real Database (replace db.json)
- [ ] Add `sqlalchemy`, `alembic`, `aiosqlite` (or `psycopg2` for Postgres) to dependencies
- [ ] Create `backend/app/db/` directory — `engine.py`, `session.py`, `base.py`
- [ ] Define SQLAlchemy ORM models for every entity:
  - [ ] `Dataset`, `QualityScan`, `QualityIssue`, `CleaningRecord`
  - [ ] `Pipeline`, `PipelineRun`
  - [ ] `SyntheticJob`, `TrainedModel`
  - [ ] `ALSession`, `ALBatch`
  - [ ] `BenchmarkJob`
  - [ ] `MarketplaceAsset`, `MarketplaceReview`, `MarketplaceInstall`
  - [ ] `ComplianceScan`, `CompliancePolicy`, `PolicyViolation`, `AuditEvent`, `AnonymizationJob`, `ComplianceReport`
  - [ ] `AppSettings`
  - [ ] `User`, `RefreshToken`
- [ ] Set up Alembic for migrations (`alembic init`, first migration from models)
- [ ] Replace `store.py` flat-file methods with SQLAlchemy session calls (keep same method signatures so API layer doesn't change)
- [ ] Remove `threading.Lock` (DB handles concurrency)
- [ ] Remove `_persist()` / `_load_db()` / `db.json` logic entirely
- [ ] Verify all background threads use their own DB sessions (not shared)
- [ ] Write `alembic upgrade head` into startup sequence
- [ ] Test: run all existing API routes against real DB

**Effort:** 4–6 days  
**Note:** SQLite is fine for a single-server deploy. Use PostgreSQL if you need multi-worker or multi-instance scale.

---

### 1.3 Environment Configuration
- [ ] Add `pydantic-settings` to backend dependencies
- [ ] Create `backend/app/core/config.py` — `Settings(BaseSettings)` class with:
  - `DATABASE_URL` (default: `sqlite:///./data/datrix.db`)
  - `SECRET_KEY` (required, no default — fail on startup if missing)
  - `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 30)
  - `REFRESH_TOKEN_EXPIRE_DAYS` (default: 7)
  - `ALLOWED_ORIGINS` (comma-separated string, default: `http://localhost:5173`)
  - `UPLOAD_DIR` (default: `./data/uploads`)
  - `MAX_UPLOAD_MB` (default: 200)
  - `ENVIRONMENT` (`development` | `production`)
- [ ] Create `backend/.env.example` with all keys and documentation comments
- [ ] Create `backend/.env` (git-ignored) for local dev
- [ ] Replace all hardcoded `localhost:5173` CORS origins in `main.py` with `settings.ALLOWED_ORIGINS`
- [ ] Replace all hardcoded `DATA_DIR` path references with `settings.UPLOAD_DIR`
- [ ] Frontend: create `frontend/.env` and `frontend/.env.production` with `VITE_API_URL`
- [ ] Frontend: replace all `/api` hardcoded base URLs in `api.ts` with `import.meta.env.VITE_API_URL`
- [ ] Add `backend/.env` and `frontend/.env` to `.gitignore`

**Effort:** 1 day

---

### 1.4 File Storage
- [ ] Abstract file storage behind a `StorageBackend` interface with `save(file, path)`, `read(path)`, `delete(path)`, `exists(path)` methods
- [ ] Implement `LocalStorageBackend` — current behaviour, reads/writes from `UPLOAD_DIR`
- [ ] Implement `S3StorageBackend` — uses `boto3`, reads `AWS_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` from settings
- [ ] Switch active backend via `settings.STORAGE_BACKEND = "local" | "s3"`
- [ ] Update all file read/write calls in `datasets.py`, `anonymizer.py`, `report_generator.py`, `synthetic/*.py` to use the abstraction
- [ ] If staying local: ensure `UPLOAD_DIR` is on a persistent volume (not inside the container layer)

**Effort:** 1–2 days

---

### 1.5 HTTPS & TLS
- [ ] Decide on deployment target (VM, VPS, cloud)
- [ ] Set up Nginx as reverse proxy:
  - Serve built frontend static files from `/`
  - Proxy `/api/*` → `http://127.0.0.1:8000`
  - Proxy WebSocket upgrades if needed
- [ ] Install Certbot, obtain Let's Encrypt certificate for your domain
- [ ] Configure Nginx to redirect all HTTP → HTTPS
- [ ] Set `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options` headers in Nginx
- [ ] Add domain to `ALLOWED_ORIGINS` in backend settings

**Effort:** half a day (assumes domain already exists)

---

## Phase 2 — Stability & Quality

### 2.1 Error Boundaries (Frontend)
- [ ] Create `frontend/src/components/ErrorBoundary.tsx` — class component, catches render errors, shows a "Something went wrong" fallback with a reload button
- [ ] Wrap each top-level page route in `App.tsx` with `<ErrorBoundary>`
- [ ] Add a smaller inline `<ErrorBoundary>` around the Sidebar so a crash there doesn't wipe the whole layout

**Effort:** 2 hours

---

### 2.2 API Rate Limiting
- [ ] Add `slowapi` to backend dependencies
- [ ] Configure `Limiter` with Redis or in-memory storage
- [ ] Apply limits to expensive endpoints:
  - `POST /datasets/upload` — 10/minute per IP
  - `POST /synthetic/jobs` — 5/minute per user
  - `POST /al/sessions` — 5/minute per user
  - `POST /benchmark/jobs` — 5/minute per user
  - `POST /compliance/scans` — 20/minute per user
- [ ] Return `429 Too Many Requests` with `Retry-After` header
- [ ] Global fallback limit: 200 requests/minute per IP

**Effort:** 2–3 hours

---

### 2.3 Background Thread Error Handling
- [ ] Wrap every background thread target function in a `try/except Exception`
- [ ] On exception: update job status to `"failed"`, write `error_message` to DB, log the full traceback
- [ ] Add a watchdog: jobs stuck in `"running"` for > 30 minutes get marked `"failed"` on startup
- [ ] Ensure each thread creates and closes its own DB session (no cross-thread session sharing)

**Effort:** 1 day

---

### 2.4 File Upload Validation
- [ ] Validate uploaded file is valid UTF-8 CSV before accepting (stream first 4KB, attempt parse)
- [ ] Reject files where Polars schema inference fails with a clear 400 error and message
- [ ] Enforce `MAX_UPLOAD_MB` on the backend (not just the frontend setting)
- [ ] Sanitize uploaded filenames (strip path traversal characters, force `.csv` extension)
- [ ] Add `Content-Type: text/csv` or `multipart/form-data` validation

**Effort:** 2–3 hours

---

### 2.5 Structured Logging
- [ ] Configure Python `logging` with a structured JSON formatter (use `python-json-logger`)
- [ ] Log every API request: method, path, status code, duration, user ID
- [ ] Log every background job start/complete/fail with job ID and duration
- [ ] Write logs to stdout (for container/systemd capture) and optionally to a rotating file
- [ ] Add Sentry SDK (`sentry-sdk[fastapi]`) for exception tracking — reads `SENTRY_DSN` from settings, silently disabled if not set
- [ ] Frontend: add Sentry React SDK, capture unhandled errors and route changes

**Effort:** 1 day

---

### 2.6 API Input Hardening
- [ ] Audit every `POST`/`PATCH` route for missing Pydantic validation (currently some accept raw `dict` or `list`)
- [ ] Add `max_length` constraints to all string fields (names, descriptions)
- [ ] Validate `column_configs` in anonymization endpoint are valid column names that exist in the dataset
- [ ] Validate pipeline step configs against known step types before accepting
- [ ] Return consistent error shape `{ "detail": "...", "field": "..." }` everywhere

**Effort:** 1 day

---

## Phase 3 — Infrastructure

### 3.1 Docker & Docker Compose
- [ ] Create `backend/Dockerfile`:
  ```
  FROM python:3.11-slim
  WORKDIR /app
  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  COPY . .
  CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
  ```
- [ ] Create `frontend/Dockerfile`:
  ```
  FROM node:20-alpine AS build
  WORKDIR /app
  COPY package*.json .
  RUN npm ci
  COPY . .
  RUN npm run build

  FROM nginx:alpine
  COPY --from=build /app/dist /usr/share/nginx/html
  COPY nginx.conf /etc/nginx/conf.d/default.conf
  ```
- [ ] Create `docker-compose.yml` with services: `backend`, `frontend`, `nginx` (or `caddy`), `db` (Postgres, optional)
- [ ] Add `docker-compose.override.yml` for local dev (mount source, enable --reload)
- [ ] Add `.dockerignore` for both services
- [ ] Create `nginx.conf` template with upstream proxy, static file serving, gzip, and security headers
- [ ] Test full stack builds and runs with `docker compose up --build`

**Effort:** 1–2 days

---

### 3.2 Production Process Management
- [ ] Add `gunicorn` to backend dependencies
- [ ] Configure gunicorn worker count: `(2 × CPU_cores) + 1`
- [ ] Set `--timeout 120` for long ML training requests
- [ ] Set `--max-requests 1000 --max-requests-jitter 50` to recycle workers and prevent memory leaks from ML jobs
- [ ] Add `PYTHONUNBUFFERED=1` to container env so logs stream immediately

**Effort:** 2 hours

---

### 3.3 Backups
- [ ] Write `scripts/backup.sh` — dumps DB + tarballs `UPLOAD_DIR` to a timestamped archive
- [ ] Set up a cron job (or systemd timer) to run backup daily
- [ ] Copy backup archives to a second location (S3, Backblaze, rsync to separate host)
- [ ] Test restore procedure: drop DB, restore from backup, verify data intact
- [ ] Document restore steps in `RUNBOOK.md`

**Effort:** half a day

---

### 3.4 Health & Monitoring
- [ ] Enhance `/health` endpoint to return DB connectivity, disk usage, and active job counts
- [ ] Add `/metrics` endpoint (Prometheus format) with: request count/latency, active jobs, DB pool usage, disk usage
- [ ] Set up uptime monitoring (UptimeRobot free tier or Better Uptime) on `/health`
- [ ] Set up alerting: notify on health check failure, disk > 85%, error rate spike

**Effort:** half a day for basic; 1 day if adding Prometheus + Grafana

---

## Phase 4 — Pre-launch Polish

### 4.1 Frontend Production Build
- [ ] Run `npm run build` — fix any TypeScript errors that only appear in strict mode
- [ ] Check bundle size with `npm run build -- --analyze` (vite-bundle-visualizer)
- [ ] Ensure all API calls use `VITE_API_URL` env var (no hardcoded localhost)
- [ ] Add `<meta>` tags (description, og:title, og:image) to `index.html`
- [ ] Add a `favicon.svg` if not already present

**Effort:** half a day

---

### 4.2 Security Headers & Hardening
- [ ] Set `Content-Security-Policy` header in Nginx (restrict script/style sources)
- [ ] Set `X-Frame-Options: DENY`
- [ ] Set `X-Content-Type-Options: nosniff`
- [ ] Set `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] Rotate the `SECRET_KEY` before go-live; document rotation procedure
- [ ] Ensure no secrets in git history (`git log --all -S "SECRET"` audit)
- [ ] Add `SECURITY.md` with responsible disclosure contact

**Effort:** 2–3 hours

---

### 4.3 Database Seeding & Migrations in Production
- [ ] `alembic upgrade head` runs automatically on container start (before uvicorn)
- [ ] Marketplace seeder (`initialize_seeds`) and default compliance policies (`ensure_default_policies`) run only if DB is empty (add idempotency guard)
- [ ] Document how to run a manual migration: `docker compose exec backend alembic upgrade head`

**Effort:** 2 hours

---

### 4.4 CI/CD Pipeline
- [ ] Create `.github/workflows/ci.yml`:
  - On every PR: lint (ruff), type-check (pyright/mypy), run any tests
  - On merge to main: build Docker images, push to registry (GHCR or DockerHub)
- [ ] Create `.github/workflows/deploy.yml`:
  - On tag push (`v*.*.*`): SSH to server, pull new images, `docker compose up -d`, run migrations
- [ ] Add `pytest` with at least smoke tests for critical API routes
- [ ] Add frontend `tsc --noEmit` to CI

**Effort:** 1–2 days

---

## Summary

| Phase | Items | Estimated Effort | Status |
|---|---|---|---|
| **1 — Critical Blockers** | Auth, DB, Env Config, File Storage, HTTPS | ~2 weeks | ⬜ Not started |
| **2 — Stability** | Error boundaries, rate limiting, thread safety, logging, validation | ~4 days | ⬜ Not started |
| **3 — Infrastructure** | Docker, gunicorn, backups, monitoring | ~3 days | ⬜ Not started |
| **4 — Pre-launch** | Build, security headers, CI/CD | ~2 days | ⬜ Not started |
| **Total** | | **~3 weeks** | |

---

## Starting Order (recommended critical path)

```
1.3 Env Config  →  1.2 Real Database  →  1.1 Auth  →  1.4 File Storage
       ↓
2.3 Thread Safety  →  2.5 Logging  →  2.1 Error Boundaries
       ↓
3.1 Docker  →  3.2 Gunicorn  →  1.5 HTTPS
       ↓
2.2 Rate Limiting  →  2.6 Input Hardening  →  4.2 Security Headers
       ↓
3.3 Backups  →  3.4 Monitoring  →  4.4 CI/CD
```

Env config first because every other item reads from it.
Database second because auth needs it and it unblocks thread safety.
Auth third because it gates everything user-facing.
Docker before HTTPS because HTTPS assumes a running containerised stack.
