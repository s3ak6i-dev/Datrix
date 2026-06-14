<div align="center">

<img src="frontend/src/assets/hero.png" alt="Datrix" width="120" />

# Datrix

**The intelligence layer beneath every AI system.**

A self-hosted, local-first AI data infrastructure platform — a single workspace to prepare, transform, generate, label, benchmark, and govern datasets without writing boilerplate or stitching together a dozen separate tools.

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Polars](https://img.shields.io/badge/Polars-1.41-CD792C?style=flat&logo=polars&logoColor=white)](https://pola.rs)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?style=flat&logo=postgresql&logoColor=white)](https://neon.tech)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![CI](https://img.shields.io/github/actions/workflow/status/s3ak6i-dev/Datrix/ci.yml?branch=main&label=CI&style=flat)](https://github.com/s3ak6i-dev/Datrix/actions)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat)](LICENSE)

</div>

---

## Table of Contents

- [What is Datrix?](#what-is-datrix)
- [Modules](#modules)
- [Auth & Identity](#auth--identity)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Object Storage](#object-storage)
- [Backups](#backups)
- [Database & Migrations](#database--migrations)
- [API Reference](#api-reference)
- [CI / CD](#ci--cd)
- [Security](#security)
- [Design System](#design-system)
- [Roadmap](#roadmap)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## What is Datrix?

Datrix is a **local-first data workspace**. You upload raw files and it handles everything from automatic quality scanning through to model training, compliance reporting, and a team marketplace — all through a browser UI backed by a Python API running entirely on your machine.

**No data leaves your network.** No SaaS account. No per-seat pricing. No vendor lock-in.

### Who is it for?

| Role | What Datrix gives you |
|---|---|
| **Data scientists** | Upload → scan → clean → benchmark, all in one UI with no code |
| **ML engineers** | Reusable pipeline sequences, active learning, trained model exports |
| **Data engineers** | Lineage DAG, PII scanner, compliance reports, audit log |
| **Teams** | Shared Marketplace + Workspaces for collaborative data projects |

---

## Modules

### 🏠 Home Dashboard

The default landing page after login. Shows a personalized greeting, real-time workspace stats, quick-action cards tailored to your use cases, and the three most recent datasets and pipelines — all with live data.

- **Onboarding wizard** — 3-step full-screen wizard on first login (name → role → use cases) that personalises the dashboard
- **Getting started checklist** — disappears automatically once you've uploaded a dataset and created a pipeline
- **Quick actions** — dynamically chosen from your selected use cases (falls back to clean / pipeline / synthetic)
- **Recent activity** — last 3 datasets and pipelines with status badges and relative timestamps, clickable to their detail pages

---

### 📦 Datasets

Upload CSV / JSON / JSONL / Parquet / Excel and get instant quality intelligence. Every dataset is profiled on upload and scored across five weighted dimensions.

**Upload & Ingestion**
- Drag-and-drop or button upload with a live XHR progress bar (real byte tracking, not simulated)
- Supported formats: CSV, JSON, JSONL, Parquet, XLS, XLSX — max size configurable
- Automatic schema detection: `Int64`, `Float64`, `Utf8`, `Boolean`, `Date` column types via Polars
- Status lifecycle with 2-second auto-polling: `pending → ingesting → scanning → ready → error`

**Quality Scoring**
- Five-dimension weighted score (0–100):

  | Dimension | Weight | What it measures |
  |---|---|---|
  | Completeness | 25% | Null rates across all columns |
  | Consistency | 25% | Type mismatches, format violations |
  | Accuracy | 25% | Outliers, impossible values |
  | Distribution | 15% | Skew, kurtosis, class imbalance |
  | Label Quality | 10% | Target column validity and balance |

- Every issue ranked by severity: `critical` → `warning` → `info`
- Scan history stored with timestamp and score delta — track improvement over time

**Column Explorer**
- Per-column: inferred type, null rate bar, unique count, sample values
- Distribution charts: histogram for numerics, bar chart for categoricals
- Full descriptive stats: min, max, mean, std, p25, p50, p75

**Cleaning Wizard**
- 7 fix types: `fill_nulls`, `drop_duplicates`, `clip_outliers`, `cast_type`
- **Preview before applying** — see a before/after sample on affected rows, nothing written until confirmed
- **Per-fix rollback** — every fix snapshots the prior file state; roll back any individual fix independently

---

### 🔀 Pipelines

Build reusable transformation sequences visually. Run them on any compatible dataset. Outputs are downloadable files.

10 step types: `filter`, `select`, `drop`, `rename`, `fill_nulls`, `deduplicate`, `normalize`, `encode_categorical`, `sort`, `lowercase`

- All steps chain as Polars `LazyFrame` operations — nothing materializes until the final `.collect()`
- **Dry-run**: execute in memory, return a 20-row preview, write nothing to disk
- **Full run**: execute and write output as CSV / Parquet / JSON

---

### ✨ Synthetic Data

Generate statistically faithful artificial datasets that mirror your originals without containing any real records.

| Method | Algorithm | Speed | Best for |
|---|---|---|---|
| `statistical` | Per-column distribution fitting | < 5s | Quick augmentation |
| `ctgan` | Conditional Tabular GAN | 5–15 min | Complex correlations |
| `tvae` | Tabular Variational Autoencoder | 5–15 min | Avoiding GAN mode collapse |

---

### 🧠 Active Learning

Train models with as few human labels as possible. The model directs you to the most informative unlabeled examples each round.

6 sampling strategies: `random`, `least_confidence`, `margin`, `entropy`, `coreset`, `committee`

---

### 📊 Benchmark

Side-by-side ML model comparison under identical conditions. Every candidate trains on exactly the same data split with the same evaluation protocol.

4 evaluation protocols · 3 hyperparameter presets · parallel execution · ranked leaderboard · confusion matrices · feature importances

---

### 🛡️ Compliance Autopilot

Automatic data governance — PII detection, lineage tracking, policy enforcement, anonymization, audit logging, and regulatory reports.

- **PII Scanner**: 2-pass detection (50+ column-name signals + 11 regex patterns), 6 risk levels
- **Data Lineage DAG**: auto-built from table relationships, interactive pan/zoom
- **Policy Engine**: 8 built-in policies + custom policy creation
- **Anonymization Wizard**: 7 methods per column
- **Audit Log**: append-only, CSV export, 10,000 event cap
- **Regulatory Reports**: GDPR Article 30, CCPA, HIPAA, General Summary (HTML + JSON)

---

### 🛒 Marketplace

Shared catalogue of datasets, pipelines, ML models, and benchmark configs — entirely local. 15 sample assets seeded on first startup.

- Full-text search, category filter, sort by downloads / rating / newest
- One-click deep copy install — deleting source never affects your installed copy
- 1–5 star ratings + reviews

---

### 👥 Workspaces

Collaborate with teammates on shared datasets and pipelines with a full role-based approval system.

**Membership**
- Create workspaces with a unique slug; invite members by **email** or a shareable **invite link** (7-day expiry, one-click disable)
- Joining via link presents a color-picker so the new member picks their identity color before they land
- Three roles: **Owner** · **Reviewer** · **Member**

**Member identity**
- Every member picks a color from a 12-color palette (stored on their profile)
- Color appears on change-request cards, the home activity feed, and the notification bell — so you can tell at a glance who submitted what

---

### ✅ Change Requests & Approval Workflows

A lightweight governance layer that prevents unreviewed changes from reaching shared data.

**Submitting**
- Any workspace member can open a change request from the `/changes` page
- Fields: title, description, action type (dataset upload, delete, pipeline run, config change, or custom), and **impact level** (Low / Medium / High / Critical)
- Low-impact requests **auto-approve after 24 hours** if no reviewer acts first

**Review — Kanban board (owners + reviewers)**
- Owners and reviewers see a **4-column Kanban** (one per impact level) for all pending requests
- Members see a flat list of their own submissions
- A red badge on the **Changes** sidebar link shows the current pending count for reviewers and owners

**Role permissions**

| Action | Owner | Reviewer | Member |
|---|---|---|---|
| Submit request | ✅ | ✅ | ✅ |
| Approve / reject Low + Medium | ✅ | ✅ | — |
| Approve / reject High + Critical | ✅ | — | — |
| Roll back any approval | ✅ | Own approvals only | — |
| Resubmit rejected / rolled-back | ✅ | ✅ | Own only |

**Approval & rejection comments**
- Both approve and reject actions include an **optional comment** field
- The comment is shown on the card and included in the submitter's notification

**Rollback**
- Approved and auto-approved CRs can be rolled back with a reason
- The submitter is notified immediately and can edit and resubmit
- Status trail: `pending → approved → rolled_back → pending` (full history preserved)

**Notifications**
- Clicking a workspace notification jumps directly to the specific card (`/changes?org=X&cr=Y`) and highlights it with a pulse animation
- Notification bell has two sections: **Workspace** (CR events) and **Jobs** (async background jobs)

---

### 💳 Billing

Current plan overview with real usage stats vs. plan limits. Free / Pro / Enterprise comparison. Payment integration coming soon.

---

### ⚙️ Settings

Global defaults for every module, live storage stats, and a danger zone.

---

## Auth & Identity

Datrix ships a complete authentication and identity system:

| Feature | Details |
|---|---|
| **Email / password** | Register + login with bcrypt-hashed passwords |
| **Google OAuth** | Sign in with Google (full OAuth 2.0 authorization code flow) |
| **GitHub OAuth** | Sign in with GitHub |
| **JWT tokens** | Access token (30 min) + refresh token (7 days) with rotation on use |
| **Email verification** | Verification email sent on register; resend available from profile |
| **Password reset** | Forgot password → email link → set new password (1-hour expiring tokens) |
| **Per-user data isolation** | Every dataset, pipeline, and job is scoped to the owning user |
| **Profile page** | Edit name, role, company, use cases, avatar URL; change password |
| **Onboarding wizard** | 3-step wizard on first login — name, role, use cases |
| **Notifications** | In-app bell with two sections — **Workspace** (change request events with member color dots) and **Jobs** (async job completion/failure). Polls every 15s; state persisted to `localStorage` so seen CRs don't re-notify on refresh. Clicking a workspace notification navigates to the exact CR card. |
| **Mobile responsive** | Sidebar collapses to a hamburger menu on screens ≤ 768px |

### Email (dev mode vs production)

Without SMTP configured, all emails (verification links, password reset links) are printed to the **backend terminal** — useful for local development. Set `SMTP_HOST` in `.env` to switch to real sending.

Recommended provider: [Resend](https://resend.com) (3,000 emails/month free).

```bash
# Resend SMTP settings
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASSWORD=re_xxxxxxxxxxxx
FROM_EMAIL=noreply@yourdomain.com
```

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend framework** | React | 18 |
| **Language** | TypeScript | 5 |
| **Build tool** | Vite | 6 |
| **Styling** | CSS custom properties (dark/light token system) | — |
| **State / data fetching** | TanStack Query | 5 |
| **Routing** | React Router | 6 |
| **Icons** | Lucide React | latest |
| **Backend framework** | FastAPI | 0.136 |
| **Python runtime** | CPython | 3.12+ |
| **ASGI server** | Uvicorn (dev) / Gunicorn+Uvicorn workers (prod) | — |
| **Auth** | python-jose (JWT) + bcrypt | — |
| **OAuth** | Google + GitHub OAuth 2.0 (httpx) | — |
| **Email** | smtplib (SMTP) — Resend / Gmail / any provider | — |
| **Data processing** | Polars | 1.41 |
| **Dataframes (ML)** | Pandas + NumPy + SciPy | — |
| **ML models** | scikit-learn + XGBoost | — |
| **Synthetic generation** | CTGAN + SDV (TVAE) | — |
| **ORM** | SQLAlchemy | 2.0 |
| **Migrations** | Alembic | 1.16 |
| **Database** | PostgreSQL (Neon Serverless Postgres) | — |
| **Rate limiting** | slowapi | 0.1.9 |
| **Structured logging** | python-json-logger | 3.3 |
| **Error tracking** | Sentry SDK | 2.29 |
| **Reverse proxy** | Nginx | alpine |
| **Containerization** | Docker + Docker Compose | — |
| **CI/CD** | GitHub Actions | — |

---

## Architecture

### Request flow (production)

```
Browser
  │
  ▼
Nginx (80/443)  ← multi-stage Docker image: Vite build → nginx:alpine
  ├── /api/*  ──► FastAPI (Gunicorn + Uvicorn workers)
  │                  ├── Auth middleware (JWT verification)
  │                  ├── Rate limiter (slowapi — 200 req/min default)
  │                  ├── API routers (one per module)
  │                  ├── Service layer (business logic)
  │                  │     ├── Background threads (ML jobs)
  │                  │     ├── Email service (SMTP / dev-mode logging)
  │                  │     └── Polars / scikit-learn / CTGAN
  │                  ├── SQLAlchemy ORM ──► PostgreSQL (Neon)
  │                  └── StorageBackend ──► Local disk  (STORAGE_BACKEND=local)
  │                                    └── Cloudflare R2 / AWS S3 (STORAGE_BACKEND=s3)
  │
  └── /*      ──► Static SPA (React, pre-built by Vite, baked into nginx image)
                    └── TanStack Query (polls async job endpoints)
```

### Auth flow

```
Register / Login ──► JWT access token (30 min) + refresh token (7 days, DB-stored)
                          │
OAuth (Google/GitHub) ──► same JWT pair → /auth/callback?access_token=...
                          │
Access token expires ──► AuthContext auto-refreshes via /auth/refresh (silent)
                          │
Password reset ──► POST /auth/forgot-password → email token → POST /auth/reset-password
Email verify   ──► POST register → email token → POST /auth/verify-email
```

---

## Project Structure

```
Datrix/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py             # /auth — register, login, refresh, logout,
│   │   │   │                       #         forgot-password, reset-password, verify-email
│   │   │   ├── oauth.py            # /auth/oauth — Google + GitHub OAuth 2.0
│   │   │   ├── profile.py          # /profile/me — onboarding, update, change-password
│   │   │   ├── orgs.py             # /orgs — workspaces, members, invite links
│   │   │   ├── changes.py          # /changes — CR CRUD, approve, reject, rollback, resubmit
│   │   │   ├── join.py             # /join/{token} — public invite-link register (no auth)
│   │   │   ├── billing.py          # /billing/plan — usage vs. limits
│   │   │   ├── datasets.py         # /datasets
│   │   │   ├── pipelines.py        # /pipelines
│   │   │   ├── synthetic.py        # /synthetic
│   │   │   ├── active_learning.py  # /active-learning
│   │   │   ├── benchmark.py        # /benchmark
│   │   │   ├── compliance.py       # /compliance
│   │   │   ├── marketplace.py      # /marketplace
│   │   │   └── settings.py         # /settings
│   │   ├── core/
│   │   │   ├── auth.py             # JWT creation/verification, bcrypt hashing
│   │   │   ├── config.py           # pydantic-settings — reads .env
│   │   │   ├── limiter.py          # slowapi rate limiter instance
│   │   │   └── logging_setup.py    # JSON structured logging
│   │   ├── db/
│   │   │   ├── models.py           # 28 SQLAlchemy ORM table definitions
│   │   │   └── engine.py           # Engine + session factory
│   │   ├── models/
│   │   │   └── store.py            # Data-access layer (user-scoped queries)
│   │   └── services/
│   │       ├── email.py            # SMTP email sender (dev-mode terminal logging)
│   │       ├── storage.py          # StorageBackend ABC — Local + S3/R2
│   │       ├── ingestion.py
│   │       ├── quality.py
│   │       ├── cleaning.py
│   │       ├── pipeline_executor.py
│   │       ├── synthetic_executor.py
│   │       ├── active_learning_executor.py
│   │       ├── benchmark_executor.py
│   │       ├── pii_scanner.py
│   │       ├── lineage_tracker.py
│   │       ├── compliance_checker.py
│   │       ├── anonymizer.py
│   │       ├── report_generator.py
│   │       ├── audit_logger.py
│   │       └── marketplace_seeder.py
│   ├── alembic/versions/           # Migration scripts (auto-run at startup)
│   ├── data/                       # Runtime data (gitignored)
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx          # App shell — sidebar, nav, notification bell,
│   │   │   │                       #             mobile hamburger, theme, sign-out
│   │   │   ├── Layout.css          # Shell styles + mobile responsive breakpoints
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── TourGuide.tsx
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx     # JWT storage + login/register/OAuth/logout
│   │   │   └── NotificationContext.tsx  # Job polling + in-app notification queue
│   │   ├── pages/
│   │   │   ├── home/
│   │   │   │   ├── HomePage.tsx    # Dashboard + OnboardingWizard (gated by profile)
│   │   │   │   └── HomePage.css
│   │   │   ├── auth/
│   │   │   │   ├── AuthPage.tsx         # Login / register / forgot / SSO
│   │   │   │   ├── OAuthCallback.tsx    # /auth/callback — token exchange
│   │   │   │   ├── ForgotPasswordPage.tsx
│   │   │   │   ├── ResetPasswordPage.tsx
│   │   │   │   └── VerifyEmailPage.tsx
│   │   │   ├── profile/
│   │   │   │   ├── ProfilePage.tsx # Edit name, role, avatar, use cases, password
│   │   │   │   └── ProfilePage.css
│   │   │   ├── orgs/
│   │   │   │   ├── OrgsPage.tsx    # Workspace list, create, members, invite link
│   │   │   │   └── OrgsPage.css
│   │   │   ├── changes/
│   │   │   │   ├── ChangesBoard.tsx # CR Kanban (owner/reviewer) + list (member),
│   │   │   │   │                    # submit/approve/reject/rollback/resubmit modals
│   │   │   │   └── ChangesBoard.css
│   │   │   ├── join/
│   │   │   │   ├── JoinPage.tsx    # Public invite-link landing (color picker + register)
│   │   │   │   └── JoinPage.css
│   │   │   ├── billing/
│   │   │   │   ├── BillingPage.tsx # Plan comparison + real usage bars
│   │   │   │   └── BillingPage.css
│   │   │   ├── datasets/
│   │   │   ├── pipelines/
│   │   │   ├── synthetic/
│   │   │   ├── active-learning/
│   │   │   ├── benchmark/
│   │   │   ├── compliance/
│   │   │   ├── marketplace/
│   │   │   ├── settings/
│   │   │   └── docs/
│   │   ├── index.css               # Design tokens, animations
│   │   └── App.tsx                 # All route definitions
│   └── package.json
│
├── nginx/
├── scripts/
├── docker-compose.yml
├── docker-compose.production.yml
└── .github/workflows/
```

---

## Getting Started

### Requirements

| | Minimum | Recommended |
|---|---|---|
| Python | 3.10 | 3.12+ |
| Node.js | 18 | 20 |
| RAM | 4 GB | 8 GB (CTGAN/TVAE training needs headroom) |
| Disk | 2 GB free | 5 GB+ |
| PostgreSQL | Any instance | [Neon](https://neon.tech) free tier |

### Local Dev (2 terminals)

**1. Clone**

```bash
git clone https://github.com/s3ak6i-dev/Datrix.git
cd Datrix
```

**2. Backend**

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # then edit .env
```

```bash
python run.py          # runs migrations, then starts on :8000
python run.py --reload # with hot-reload
```

**3. Frontend**

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev            # http://localhost:5173
```

Open **http://localhost:5173**, register an account, and the onboarding wizard launches automatically. After completing it you land on the `/home` dashboard.

On first startup the backend:
1. Runs Alembic migrations (idempotent)
2. Seeds the Marketplace with 15 sample assets
3. Seeds 8 default Compliance policies

---

### Docker (single command)

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:80 |
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |

---

### Production with HTTPS

```bash
export DOMAIN=yourdomain.com
export EMAIL=you@email.com
bash scripts/setup-ssl.sh
DOMAIN=yourdomain.com docker compose -f docker-compose.production.yml up -d --build
```

---

## Environment Variables

Create `backend/.env` from `.env.example`.

```bash
# ── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require   # * required

# ── Auth ─────────────────────────────────────────────────────────────────────
SECRET_KEY=your-64-char-hex-string          # * Generate: python -c "import secrets; print(secrets.token_hex(32))"
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# ── App ───────────────────────────────────────────────────────────────────────
ENVIRONMENT=production
ALLOWED_ORIGINS=https://yourdomain.com
APP_URL=https://yourdomain.com              # Backend public URL (for OAuth redirect URIs)
FRONTEND_URL=https://yourdomain.com         # Frontend public URL (for email links)

# ── OAuth (optional — leave blank to disable social login) ───────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# ── Email / SMTP (optional — leave blank to log emails to terminal in dev) ───
SMTP_HOST=                                  # e.g. smtp.resend.com or smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_TLS=true
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=Datrix

# ── Storage ───────────────────────────────────────────────────────────────────
STORAGE_BACKEND=local                       # local | s3
UPLOAD_DIR=./data/uploads
MAX_UPLOAD_MB=10240

# ── Object Storage (when STORAGE_BACKEND=s3) ─────────────────────────────────
AWS_S3_BUCKET=datrix-uploads
AWS_REGION=auto
AWS_S3_PREFIX=uploads/
AWS_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# ── Observability (optional) ─────────────────────────────────────────────────
SENTRY_DSN=
```

Frontend (`frontend/.env`):

```bash
VITE_API_URL=http://localhost:8000
```

---

## Object Storage

By default Datrix writes uploaded files to `data/uploads/` on the local filesystem. Switch to `STORAGE_BACKEND=s3` for any S3-compatible provider (Cloudflare R2, AWS S3, Backblaze B2, MinIO) — no application code changes required.

### Cloudflare R2 quick-start

1. Create a bucket `datrix-uploads` in the [Cloudflare dashboard](https://dash.cloudflare.com)
2. **R2 → Manage R2 API Tokens → Create token** — Object Read & Write
3. Copy the Access Key ID and Secret Access Key
4. Add to `backend/.env`:

```bash
STORAGE_BACKEND=s3
AWS_S3_BUCKET=datrix-uploads
AWS_REGION=auto
AWS_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
```

---

## Backups

```bash
bash scripts/backup.sh                 # saves to ./backups/
KEEP_DAYS=30 bash scripts/backup.sh   # retain 30 days
```

Cron example (daily at 2 AM):

```bash
0 2 * * * cd /opt/datrix && bash scripts/backup.sh >> /var/log/datrix-backup.log 2>&1
```

---

## Database & Migrations

30 SQLAlchemy ORM tables. Migrations run automatically at startup (3 attempts with 5-second backoff, falls back to `create_all`).

```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
alembic downgrade -1
alembic current
```

**Neon note**: Use the unpooled connection string for Alembic, pooled for the application runtime.

---

## API Reference

Interactive docs available while the backend is running:

| Format | URL |
|---|---|
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| OpenAPI JSON | http://localhost:8000/openapi.json |

**Endpoint summary:**

| Router | Prefix | Key endpoints |
|---|---|---|
| Auth | `/auth` | `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `POST /forgot-password`, `POST /reset-password`, `POST /verify-email`, `POST /resend-verification` |
| OAuth | `/auth/oauth` | `GET /google`, `GET /google/callback`, `GET /github`, `GET /github/callback` |
| Profile | `/profile` | `GET /me`, `PUT /me`, `POST /me/complete-onboarding`, `POST /me/change-password` |
| Organizations | `/orgs` | CRUD, `GET /{id}/members`, `POST /{id}/members`, `DELETE /{id}/members/{uid}`, `GET /{id}/invite-link`, `POST /{id}/invite-link`, `DELETE /{id}/invite-link`, `GET /sso/lookup` |
| Change Requests | `/changes` | `GET ?org_id&status`, `POST`, `GET /{id}`, `PATCH /{id}` (approve/reject/rollback/resubmit), `DELETE /{id}` |
| Join (public) | `/join` | `GET /{token}` (org info), `POST /{token}` (register + join, issues full token pair) |
| Billing | `/billing` | `GET /plan` |
| Datasets | `/datasets` | CRUD, `POST /upload`, `POST /{id}/scan`, `POST /{id}/fixes`, `GET /{id}/columns` |
| Pipelines | `/pipelines` | CRUD, `POST /{id}/steps`, `POST /{id}/run`, `POST /{id}/dry-run` |
| Synthetic | `/synthetic` | `POST /jobs`, `GET /jobs`, `GET /jobs/{id}` |
| Active Learning | `/active-learning` | `POST /sessions`, `POST /sessions/{id}/label`, `GET /sessions/{id}/batch` |
| Benchmark | `/benchmark` | `POST /jobs`, `GET /jobs/{id}/results` |
| Compliance | `/compliance` | `GET /pii-scan`, `GET /lineage`, `GET /policies`, `POST /reports` |
| Marketplace | `/marketplace` | `GET /assets`, `POST /assets/{id}/install`, `POST /publish`, `POST /assets/{id}/review` |
| Settings | `/settings` | `GET /`, `PATCH /`, `GET /storage-stats` |

All write endpoints (except `/auth/*` and `/auth/oauth/*`) require `Authorization: Bearer <access_token>`.

---

## CI / CD

### CI — runs on every push and PR to `main`/`develop`

| Job | Steps |
|---|---|
| **Backend** | Python 3.12 → `pip install` → Ruff lint → Pyright type-check |
| **Frontend** | Node 20 → `npm ci` → `tsc --noEmit` → `npm run build` |

### Deploy — runs on version tags (`v*`)

```bash
git tag v1.2.0
git push origin v1.2.0
```

Images pushed to GHCR: `ghcr.io/s3ak6i-dev/datrix-backend:v1.2.0` and `datrix-frontend:v1.2.0`.

---

## Security

| Control | Implementation |
|---|---|
| **Authentication** | JWT access tokens (30 min) + refresh tokens (7 days) with rotation on use |
| **OAuth** | HMAC-SHA256 signed state parameter for CSRF protection on every OAuth flow |
| **Password storage** | bcrypt cost factor 12 — no plaintext ever stored |
| **Password reset** | Single-use tokens, SHA-256 hashed in DB, 1-hour expiry, revokes all sessions on use |
| **Email verification** | Single-use tokens, 24-hour expiry |
| **Per-user isolation** | Every dataset, pipeline, and job filtered by `user_id` — users can only see their own data |
| **Rate limiting** | slowapi — 200 req/min per IP; auth endpoints have stricter limits |
| **CORS** | Configurable `ALLOWED_ORIGINS` — defaults to localhost only |
| **HTTP headers** | Nginx: HSTS, X-Frame-Options, X-Content-Type-Options, CSP, Permissions-Policy |
| **TLS** | TLSv1.2/1.3 only, ECDHE ciphers, HSTS preload |
| **Input validation** | Pydantic v2 `Field` constraints on every request model; file type + size enforced on upload |
| **SQL injection** | SQLAlchemy ORM with parameterized queries — no raw SQL |

### Before going public

1. Generate a real `SECRET_KEY`: `python -c "import secrets; print(secrets.token_hex(32))"`
2. Set `ENVIRONMENT=production`
3. Set `ALLOWED_ORIGINS` to your exact domain
4. Set `APP_URL` and `FRONTEND_URL` to your public domain
5. Never commit `.env` — it is gitignored

---

## Design System

Two themes (dark/light), toggled from the sidebar footer, persisted to `localStorage`, applied before first paint — no flash.

### Token map

```
Surface     bg < bg-2 < bg-3 < bg-card < bg-inset
Text        text-primary > text-secondary > text-tertiary
Accent      --accent (blue) — used sparingly, one per action
Status      --green (success), --warn (warning), --bad (error)
Tints       --blue-tint, --green-dim, --warn-dim, --bad-dim
```

### Typography

| Use | Font | Weight |
|---|---|---|
| Headlines | Inter | 300 |
| UI text | Inter | 400 / 500 |
| Labels, numbers, code | IBM Plex Mono | 400 / 500 |

---

## Roadmap

| Phase | Key work | Status |
|---|---|---|
| **Auth** | JWT, bcrypt, register/login/refresh/logout, ProtectedRoute | ✅ Complete |
| **OAuth** | Google + GitHub OAuth 2.0 with CSRF state protection | ✅ Complete |
| **Email** | Password reset + email verification (SMTP / dev-mode logging) | ✅ Complete |
| **Per-user isolation** | `user_id` scoping on all resource tables | ✅ Complete |
| **Onboarding** | 3-step wizard (name → role → use cases) + `user_profiles` table | ✅ Complete |
| **Home dashboard** | Personalized greeting, stats, quick actions, recent activity | ✅ Complete |
| **Profile page** | Edit name/role/company/avatar/use-cases, change password | ✅ Complete |
| **Workspaces** | Organizations, member invites, owner/reviewer/member roles | ✅ Complete |
| **Invite links** | Shareable `/join/{token}` URLs (7-day expiry, disableable) with color picker on join | ✅ Complete |
| **Member identity** | Per-member color — shown on CR cards, notification bell, home activity feed | ✅ Complete |
| **Change Requests** | Submit → Kanban review → approve (with comment) / reject (with comment) / auto-approve (24h for Low) | ✅ Complete |
| **CR Rollback** | Owners/reviewers can roll back approved CRs with a reason; submitter can resubmit | ✅ Complete |
| **Workspace notifications** | CR events (new request, approved, rejected, rolled back) with member color dots and direct-link-to-card | ✅ Complete |
| **Billing** | Plan comparison + real usage stats (payment integration pending) | ✅ Complete |
| **Notifications** | In-app bell, job polling, toast on completion/failure | ✅ Complete |
| **Mobile responsive** | Hamburger sidebar, responsive grid layouts | ✅ Complete |
| **Database** | SQLAlchemy 2.0 ORM, 28 tables on Neon Postgres, Alembic | ✅ Complete |
| **Object Storage** | `StorageBackend` ABC — Local + S3/R2 | ✅ Complete |
| **Docker** | Multi-stage nginx image, healthcheck, `setup-ssl.sh` | ✅ Complete |
| **Backups** | Docker volume backup script with auto-pruning | ✅ Complete |
| **CI/CD** | GitHub Actions (lint + typecheck + build + Docker publish) | ✅ Complete |
| **Core modules** | Datasets, Pipelines, Synthetic, Active Learning, Benchmark, Compliance, Marketplace | ✅ Complete |
| **Metrics** | Prometheus `/metrics` + Grafana dashboard | ⬜ Pending |
| **Payment** | Stripe integration for Pro/Enterprise plans | ⬜ Pending |

---

## Troubleshooting

**Backend won't start — `could not connect to server`**
> Your `DATABASE_URL` in `backend/.env` is wrong or the Neon instance is paused. Check the URL and wake the instance from the Neon dashboard.

**`ProactorEventLoop` / `asyncio` error on Windows**
> Always start the backend with `python run.py`, never with bare `uvicorn`.

**CTGAN / TVAE job is very slow**
> Expected — these train a neural network. Expect 5–15 minutes on large datasets. Use `statistical` for quick tests.

**`401 Unauthorized` on all API calls**
> Access token expired. `AuthContext` handles silent refresh automatically. Check `REFRESH_TOKEN_EXPIRE_DAYS` is set.

**OAuth redirect fails / "invalid_state" error**
> The `APP_URL` in `.env` must exactly match the redirect URI registered in Google/GitHub. For local dev: `APP_URL=http://localhost:8000`.

**Emails not arriving**
> In dev mode (no `SMTP_HOST` set), emails print to the backend terminal — check there for the link. For production set `SMTP_HOST` and check spam.

**Tour keeps relaunching**
> The tour auto-shows until `datrix-tour-done` is written to `localStorage`. Clears in private/incognito windows — by design.

**`CORS policy` error**
> `ALLOWED_ORIGINS` must include the exact frontend origin: `http://localhost:5173` for dev, `https://yourdomain.com` for prod.

**Alembic migration fails on first start**
> If the database is brand new, startup falls back to `create_all` automatically. Check `DATABASE_URL` points to a reachable Postgres instance with `CREATE TABLE` privileges.

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Ensure CI passes locally:
   ```bash
   # Backend
   cd backend && ruff check app/ && pyright app/

   # Frontend
   cd frontend && npx tsc --noEmit && npm run build
   ```
4. Open a pull request against `main`

Before submitting:
- [ ] `npm run build` passes (zero TypeScript errors)
- [ ] Backend starts cleanly with `python run.py`
- [ ] No secrets, `.env` files, or large binaries in the diff

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with FastAPI · React · Polars · scikit-learn · PostgreSQL

</div>
