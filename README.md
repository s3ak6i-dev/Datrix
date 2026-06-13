<div align="center">

<img src="frontend/src/assets/hero.png" alt="Datrix" width="120" />

# Datrix

**The intelligence layer beneath every AI system.**

A self-hosted, local-first AI data infrastructure platform — a single workspace to prepare, transform, generate, label, benchmark, and govern datasets without writing boilerplate or stitching together a dozen separate tools.

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
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
  - [Datasets](#-datasets)
  - [Pipelines](#-pipelines)
  - [Synthetic Data](#-synthetic-data)
  - [Active Learning](#-active-learning)
  - [Benchmark](#-benchmark)
  - [Compliance Autopilot](#-compliance-autopilot)
  - [Marketplace](#-marketplace)
  - [Platform Tour](#-platform-tour)
  - [Settings](#-settings)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Local Dev (2 terminals)](#local-dev-2-terminals)
  - [Docker (single command)](#docker-single-command)
  - [Production with HTTPS](#production-with-https)
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
| **Teams** | Shared Marketplace for datasets, pipelines, models, and benchmark configs |

---

## Modules

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
- 7 fix types:

  | Fix | Options |
  |---|---|
  | `fill_nulls` | mean, median, mode, constant |
  | `drop_duplicates` | column subset, keep first/last |
  | `clip_outliers` | ±3σ clipping |
  | `cast_type` | force column to target dtype |

- **Preview before applying** — see a before/after sample on affected rows, nothing written until confirmed
- **Per-fix rollback** — every fix snapshots the prior file state; roll back any individual fix independently at any time

---

### 🔀 Pipelines

Build reusable transformation sequences visually. Run them on any compatible dataset. Outputs are downloadable files.

**10 step types:**

| Step | What it does |
|---|---|
| `filter` | Keep rows matching a condition (`==`, `!=`, `>`, `<`, `>=`, `<=`, `contains`, `not_null`) |
| `select` | Keep only a named set of columns |
| `drop` | Remove a named set of columns |
| `rename` | Rename a single column |
| `fill_nulls` | Fill nulls with mean / median / mode / constant |
| `deduplicate` | Remove exact duplicate rows; configurable column subset and keep-first/last |
| `normalize` | Scale numerics to `[0,1]` (minmax) or unit normal (z-score) |
| `encode_categorical` | One-hot or label-encode a categorical column |
| `sort` | Sort rows by one or more columns, ascending or descending |
| `lowercase` | Lowercase all string values in a column |

**Execution model**
- All steps chain as Polars `LazyFrame` operations — nothing materializes until the final `.collect()`
- **Atomicity**: if any step fails, the original dataset file is completely untouched
- **Dry-run**: execute the full chain in memory, return a 20-row preview, write nothing to disk
- **Full run**: execute and write output in your chosen format (CSV / Parquet / JSON)
- Per-step stats logged for every run: rows-in, rows-out, columns-in, columns-out

---

### ✨ Synthetic Data

Generate statistically faithful artificial datasets that mirror your originals without containing any real records.

**Generation methods:**

| Method | Algorithm | Speed | Fidelity | Best for |
|---|---|---|---|---|
| `statistical` | Per-column distribution fitting | < 5 s | Marginals only | Quick augmentation, prototyping |
| `ctgan` | Conditional Tabular GAN | 5–15 min | Excellent | Mixed types, complex correlations |
| `tvae` | Tabular Variational Autoencoder | 5–15 min | Excellent | Avoiding GAN mode collapse |

**Configuration**
- Target row count: any positive integer
- **Column overrides** per column: force `null_rate` (0–1), distribution type, min/max clipping for numerics, `class_weights` JSON for categoricals

**Output**
- Generated data materializes as a new Dataset record — immediately available in Pipelines, Active Learning, and Benchmark
- Run a Quality Scan on the output and compare all 5 dimension scores to the source; a ≥95% score match confirms excellent fidelity
- Key validation workflow: train a Benchmark candidate on real data and one on synthetic; a metric gap < 5% = production-grade synthetic data

---

### 🧠 Active Learning

Train classification and regression models with as few human labels as possible. The model directs you to the most informative unlabeled examples each round.

**Sampling strategies:**

| Strategy | Algorithm | Best for |
|---|---|---|
| `random` | Uniform random | Baseline — always run this first |
| `least_confidence` | Max class probability minimization | Binary classification |
| `margin` | Top-2 class probability gap | Multi-class classification |
| `entropy` | Prediction entropy across all classes | Many label classes |
| `coreset` | Greedy k-center in feature space | Maximum feature coverage |
| `committee` | Disagreement across committee of models | Most robust; slowest per round |

**Workflow**
1. Create session: choose dataset, target column, task type, model type, batch size, strategy
2. Label the seed batch (click a class, or type a numeric value; skip uncertain rows)
3. Model retrains from scratch on all accumulated labeled rows → queues the next uncertain batch
4. Repeat until accuracy target is reached or max rounds hit
5. Learning curve chart updates after each round — a steep rise that flattens = efficient labeling

**Exports**
- Trained `.pkl` scikit-learn pipeline (preprocessing + model) — drop-in for production inference
- Labeled rows as CSV
- Run the model on the full unlabeled pool and save predictions as a new Dataset column

---

### 📊 Benchmark

Side-by-side ML model comparison under identical conditions. No cherry-picking — every candidate trains on exactly the same data split with the same evaluation protocol.

**Evaluation protocols:**

| Protocol | Description | Best for |
|---|---|---|
| `kfold_5` | 5-fold cross-validation | Smaller datasets (< 10K rows) |
| `kfold_10` | 10-fold cross-validation | More reliable CV estimate |
| `holdout_80` | 80/20 train/test split | Faster; larger datasets |
| `holdout_90` | 90/10 train/test split | More training data; higher metric variance |

**Hyperparameter presets:**

| Preset | Description |
|---|---|
| `default` | Scikit-learn defaults; fastest; use for first-pass comparison |
| `tuned` | Sensible hand-tuned params per model type; best speed/quality balance |
| `grid_search` | Exhaustive parameter grid; slowest; use when you need the best numbers |

**Results**
- Ranked leaderboard sorted by primary metric (accuracy for classification, RMSE for regression) — winner gets a crown
- Per-candidate: full metric suite (classification: accuracy, precision, recall, F1, ROC-AUC; regression: RMSE, MAE, R²)
- Confusion matrix per classification candidate — spot systematic class-level failures
- Feature importances ranked bar chart — informs your next feature engineering pass
- All candidates run in parallel in separate background threads — no waiting in a queue

---

### 🛡️ Compliance Autopilot

Automatic data governance — PII detection, lineage tracking, policy enforcement, anonymization, audit logging, and regulatory reports — fully automatic, no configuration required to start.

**PII Scanner**
- Two-pass detection: 50+ column-name keyword signals → regex pattern matching on up to 500 sampled values per column
- 11 regex patterns: email, phone, SSN, credit card, IP address, passport, NI number, IBAN, DoB, postcode, NHS number
- 6 risk levels: `critical` → `high` → `medium` → `low` → `clean` → `unscanned`
- Live risk gauge: 0–100 score (A–F grade), weighted: PII Exposure 40% + Policy Failures 30% + Scan Coverage 20% + Data Freshness 10%

**Data Lineage DAG**
- Auto-built from existing table relationships — no extra instrumentation
- Nodes: datasets, pipelines, pipeline runs, synthetic jobs, AL sessions, benchmark jobs, marketplace assets
- Interactive: pan, zoom, filter by node type, click to navigate to the source record
- Updates in real time as you work

**Policy Engine**
- 8 built-in policies:
  1. PII scan required before use
  2. No PII columns in training datasets
  3. Minimum quality score threshold
  4. Maximum data retention days
  5. Minimum row count for training
  6. Accuracy floor for deployed models
  7. No unresolved critical violations
  8. Audit log export recency
- Custom policy creation with JSON parameter config
- Automated violation detection — every policy re-evaluated when workspace state changes

**Anonymization Wizard**
- 7 methods per column: `keep`, `suppress` (drop column), `redact` (fixed string), `mask` (partial reveal), `hash` (SHA-256), `generalize` (range bucketing), `pseudonymize` (consistent fake ID)
- Always produces a new Dataset — source is never modified

**Audit Log**
- Append-only — every platform action across all 7 modules logged automatically
- Filter by module category, search by entity name, paginated display
- CSV export up to 10,000 events
- **Cap**: oldest events evicted at 10,000 — export regularly for compliance records

**Regulatory Reports**
- Formats: GDPR Article 30 Record of Processing, CCPA Data Inventory, HIPAA Data Inventory, General Data Summary
- Output: self-contained HTML + JSON — safe to email to auditors or attach to compliance filings
- Generated synchronously in 2–5 seconds

---

### 🛒 Marketplace

Shared catalogue of datasets, pipelines, ML models, and benchmark configs — entirely local, nothing is sent to any external service. 15 sample assets are seeded on first startup.

**Asset types:**

| Type | Source | Installs as |
|---|---|---|
| Dataset | Datasets module | New Dataset record |
| Pipeline | Pipelines module | New Pipeline record |
| ML Model | Completed AL session | New Model record |
| Benchmark Config | Completed Benchmark job | New Benchmark record |

**Browse & Discover**
- 2-column compact card grid: type badge, title (✓ checkmark for official/seeded assets), 1-line description, download count
- Full-text search across title, description, and tags
- Filter: asset type, domain category (9 options)
- Sort: newest, most downloaded, highest rated, trending

**Install**
- One-click **deep copy** — the asset becomes a full workspace record
- Deleting the source after install has zero effect on your installed copy

**Publish**
- 3-step wizard: select source asset → fill title, description, tags, category, license, version, author → review and publish
- My Listings: edit metadata or permanently delete any of your published assets
- Publishing creates a pointer — **always delete your listing before deleting the source asset**

**Social**
- 1–5 star ratings + optional text reviews; average updates instantly
- Install History tab: every install timestamped with a direct link to the workspace record

---

### 🧭 Platform Tour

An interactive 9-step wizard that walks through every module the first time you open the app.

- **Auto-launches once** for new users (`localStorage` gate: `datrix-tour-done`)
- **Relaunch** from sidebar footer ("Platform tour" button) or **Settings → General → Relaunch tour**
- **Left panel** — vertical stepper with timeline connectors; circles show `pending / active / done` states
- **Right panel** — module icon + tagline, how-it-works 2×2 grid, key capabilities 2-column grid, callout notes
- **Final step** — clickable module cards that navigate directly to any section and close the tour
- **Keyboard**: `→` next, `←` back, `Escape` dismiss; click backdrop to close

---

### ⚙️ Settings

Global defaults for every module, live storage stats, and a danger zone.

- App name, date format, table page size
- Storage limits: max upload size, output retention, model storage cap
- Module defaults: default eval protocol, default AL batch size, default synthetic method
- Live disk usage bar (uploads / models / database) with free-space readout
- **Relaunch tour** button
- Danger zone: reset marketplace seeds, clear compliance data, wipe all models

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend framework** | React | 18 |
| **Language** | TypeScript | 5 |
| **Build tool** | Vite | 6 |
| **Styling** | Tailwind CSS v4 + CSS custom properties | 4 |
| **State / data fetching** | TanStack Query | 5 |
| **Routing** | React Router | 6 |
| **Icons** | Lucide React | latest |
| **Backend framework** | FastAPI | 0.136 |
| **Python runtime** | CPython | 3.12+ |
| **ASGI server** | Uvicorn (dev) / Gunicorn+Uvicorn workers (prod) | — |
| **Auth** | python-jose (JWT) + passlib/bcrypt | — |
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
  │                  │     └── Polars / scikit-learn / CTGAN
  │                  ├── SQLAlchemy ORM ──► PostgreSQL (Neon)
  │                  └── StorageBackend ──► Local disk  (STORAGE_BACKEND=local)
  │                                    └── Cloudflare R2 / AWS S3 (STORAGE_BACKEND=s3)
  │
  └── /*      ──► Static SPA (React, pre-built by Vite, baked into nginx image)
                    └── TanStack Query (polls async job endpoints)
```

### Long-running jobs

All ML operations (synthetic generation, AL training, benchmark runs, PII scans, anonymization) run in **Python daemon threads** and return a job ID immediately. The frontend polls status endpoints at 1–3 second intervals via TanStack Query `refetchInterval`. Every background thread wraps its body in `try/except` so a job failure sets `status = "error"` rather than crashing the server.

### Database

22 SQLAlchemy ORM tables in PostgreSQL. Every API route uses its own scoped `db_session()` context manager — autocommit on success, rollback on error. Alembic handles schema migrations; they run automatically at startup (3 attempts with 5-second backoff, falls back to `create_all` if Alembic is unavailable).

### Cross-component communication

The platform tour is triggered across components without prop drilling via a custom DOM event (`datrix:open-tour`). Settings and the sidebar dispatch the event; Layout owns the tour state and listens.

### Theme system

Two themes (dark/light). Token map defined in `index.html` as an inline `<script>` that runs before first paint — zero flash on load. Tokens applied as inline `style.setProperty()` calls on `document.documentElement` so they always win over Tailwind cascade ordering. Persisted to `localStorage`.

---

## Project Structure

```
Datrix/
├── backend/
│   ├── app/
│   │   ├── api/                    # FastAPI routers — one file per module
│   │   │   ├── auth.py             # /auth — register, login, refresh, logout
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
│   │   │   └── logging_setup.py    # JSON structured logging configuration
│   │   ├── db/
│   │   │   └── engine.py           # SQLAlchemy engine + session factory
│   │   ├── models/
│   │   │   └── store.py            # 22 SQLAlchemy ORM table definitions
│   │   ├── services/               # Business logic + background ML executors
│   │   │   ├── ingestion.py        # File parsing, schema detection
│   │   │   ├── quality.py          # 5-dimension quality scoring
│   │   │   ├── cleaning.py         # Fix application + rollback snapshots
│   │   │   ├── pipeline_executor.py
│   │   │   ├── synthetic_executor.py
│   │   │   ├── active_learning_executor.py
│   │   │   ├── benchmark_executor.py
│   │   │   ├── pii_scanner.py      # 2-pass PII detection
│   │   │   ├── lineage_tracker.py  # DAG construction from table relationships
│   │   │   ├── compliance_checker.py
│   │   │   ├── anonymizer.py       # 7 anonymization methods
│   │   │   ├── report_generator.py # GDPR/CCPA/HIPAA HTML+JSON reports
│   │   │   ├── audit_logger.py     # Append-only event log
│   │   │   └── marketplace_seeder.py  # 15 sample assets on first startup
│   │   └── main.py                 # App factory, middleware, startup hooks
│   ├── services/               # Business logic + background ML executors
│   │   ├── storage.py              # StorageBackend ABC — LocalStorageBackend + S3StorageBackend
│   │   └── ...
│   ├── alembic/                    # Migration scripts
│   │   └── env.py                  # Async-compatible Alembic env
│   ├── data/                       # Runtime data (gitignored)
│   │   ├── uploads/                # Uploaded source files
│   │   ├── models/                 # Trained .pkl model files
│   │   ├── pipeline_outputs/       # Pipeline run outputs
│   │   ├── synthetic_outputs/      # Synthetic generation outputs
│   │   └── compliance_reports/     # Generated HTML/JSON reports
│   ├── Dockerfile
│   ├── run.py                      # Entry point: set event loop policy → start uvicorn
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                 # Shared primitives
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── QualityBadge.tsx
│   │   │   │   ├── ScoreBar.tsx
│   │   │   │   ├── Skeleton.tsx
│   │   │   │   ├── IssueCard.tsx
│   │   │   │   └── StatCell.tsx
│   │   │   ├── Layout.tsx          # App shell — sidebar, nav, theme, tour wiring
│   │   │   ├── Layout.css          # App shell styles
│   │   │   └── TourGuide.tsx       # 9-step interactive platform tour wizard
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx     # Marketing page (unauthenticated)
│   │   │   ├── LandingPage.css
│   │   │   ├── auth/
│   │   │   │   ├── AuthPage.tsx    # Login / register
│   │   │   │   └── AuthPage.css
│   │   │   ├── datasets/
│   │   │   │   ├── DatasetList.tsx
│   │   │   │   ├── DatasetDetail.tsx
│   │   │   │   ├── ColumnExplorer.tsx
│   │   │   │   ├── CleaningWizard.tsx
│   │   │   │   ├── DatasetChangesPanel.tsx
│   │   │   │   └── ScanHistory.tsx
│   │   │   ├── pipelines/
│   │   │   │   ├── PipelineList.tsx
│   │   │   │   └── PipelineEditor.tsx
│   │   │   ├── synthetic/
│   │   │   │   └── SyntheticPage.tsx
│   │   │   ├── active-learning/
│   │   │   │   └── ActiveLearningPage.tsx
│   │   │   ├── benchmark/
│   │   │   │   └── BenchmarkPage.tsx
│   │   │   ├── compliance/
│   │   │   │   └── CompliancePage.tsx
│   │   │   ├── marketplace/
│   │   │   │   └── MarketplacePage.tsx
│   │   │   ├── settings/
│   │   │   │   └── SettingsPage.tsx
│   │   │   └── docs/
│   │   │       └── DocsPage.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx     # JWT token storage + auth state + auto-refresh
│   │   ├── lib/
│   │   │   ├── api.ts              # All typed API calls — one function per endpoint
│   │   │   └── utils.ts            # formatBytes, formatNumber, formatRelativeTime
│   │   ├── types/
│   │   │   └── index.ts            # TypeScript interfaces matching backend models
│   │   ├── index.css               # Design tokens, Tailwind config, animations
│   │   └── App.tsx                 # Route definitions + ProtectedRoute wrapper
│   ├── index.html                  # Pre-paint theme script (no flash)
│   ├── Dockerfile
│   └── package.json
│
├── nginx/
│   ├── Dockerfile                  # Multi-stage: node build → nginx:alpine (production only)
│   └── nginx.conf                  # HTTP→HTTPS redirect + TLS + gzip + SPA + API proxy
├── scripts/
│   ├── setup-ssl.sh                # One-time Let's Encrypt certificate issuance
│   └── backup.sh                   # Docker volume backup with dated archives + auto-pruning
├── docker-compose.yml              # Local Docker stack (HTTP, VITE_API_URL=direct)
├── docker-compose.production.yml   # Production stack (HTTPS + Certbot, nginx multi-stage build)
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Lint + type-check + build on push/PR
│       └── deploy.yml              # Docker build + push to GHCR on version tag
├── DesignSpec.md
├── PRD.md
├── TechSpec.md
├── UIUX.md
└── PRODUCTION_CHECKLIST.md
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
cp .env.example .env   # then edit .env (see Environment Variables below)
```

```bash
# Start the API — runs Alembic migrations first, then starts uvicorn on :8000
python run.py
```

Add `--reload` for hot-reload during development:

```bash
python run.py --reload
```

**3. Frontend**

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev        # http://localhost:5173
```

Open **http://localhost:5173**, register an account, and the platform tour will launch automatically.

On first startup the backend:
1. Runs Alembic migrations (idempotent — safe every time)
2. Seeds the Marketplace with 15 sample datasets, pipelines, and models
3. Seeds 8 default Compliance policies

---

### Docker (single command)

```bash
# Ensure backend/.env exists — see Environment Variables
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:80 |
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |

To run detached:

```bash
docker compose up --build -d
docker compose logs -f   # follow logs
docker compose down      # stop
```

---

### Production with HTTPS

The production stack uses Certbot for automatic Let's Encrypt TLS certificates with auto-renewal. The frontend is compiled into the nginx image at build time — no separate frontend container in production.

**1. Provision a VPS** (Ubuntu 22.04 recommended) and point your domain's DNS A record at its public IP.

**2. Install Docker**

```bash
curl -fsSL https://get.docker.com | sh
```

**3. Clone and configure**

```bash
git clone https://github.com/s3ak6i-dev/Datrix.git
cd Datrix
cp backend/.env.example backend/.env
# Edit backend/.env — set DATABASE_URL, SECRET_KEY, and ALLOWED_ORIGINS
```

**4. Issue the TLS certificate** (one-time setup)

`scripts/setup-ssl.sh` handles the `YOUR_DOMAIN` substitution in `nginx/nginx.conf`, spins up a temporary nginx for the ACME HTTP challenge, runs Certbot, then cleans up:

```bash
export DOMAIN=yourdomain.com
export EMAIL=you@email.com
bash scripts/setup-ssl.sh
```

**5. Start the production stack**

```bash
# DOMAIN is used as a build arg to bake VITE_API_URL into the React JS bundle
DOMAIN=yourdomain.com docker compose -f docker-compose.production.yml up -d --build
```

The `--build` flag compiles the frontend on first run (or after any code change). On subsequent restarts without code changes you can omit it.

Certbot renews certificates automatically every 12 hours (checks; only renews when within 30 days of expiry).

**6. Ongoing deploys**

```bash
git pull
DOMAIN=yourdomain.com docker compose -f docker-compose.production.yml up -d --build
```

---

## Environment Variables

Create `backend/.env` from `.env.example`. All values with a `*` are required.

```bash
# ── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require   # * Postgres connection string

# ── Auth ─────────────────────────────────────────────────────────────────────
SECRET_KEY=your-64-char-hex-string          # * Generate: python -c "import secrets; print(secrets.token_hex(32))"
ALGORITHM=HS256                             # JWT signing algorithm (default: HS256)
ACCESS_TOKEN_EXPIRE_MINUTES=30              # Access token TTL (default: 30)
REFRESH_TOKEN_EXPIRE_DAYS=7                 # Refresh token TTL (default: 7)

# ── App ───────────────────────────────────────────────────────────────────────
ENVIRONMENT=production                      # development | production
ALLOWED_ORIGINS=https://yourdomain.com      # Comma-separated CORS origins

# ── Storage ───────────────────────────────────────────────────────────────────
UPLOAD_DIR=./data/uploads                   # Where uploaded files are stored
MAX_UPLOAD_MB=10240                         # Max upload size in MB (default: 10 GB)

# ── Object Storage ───────────────────────────────────────────────────────────
STORAGE_BACKEND=local               # local | s3  (default: local — zero setup)
# When STORAGE_BACKEND=s3, fill in the block below.
# Works with Cloudflare R2, AWS S3, Backblaze B2, MinIO, or any S3-compatible API.
AWS_S3_BUCKET=datrix-uploads        # Bucket name
AWS_REGION=auto                     # "auto" for Cloudflare R2; us-east-1 for AWS
AWS_S3_PREFIX=uploads/              # Key prefix inside the bucket
AWS_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com  # Blank = real AWS S3
AWS_ACCESS_KEY_ID=xxx               # R2/S3 access key ID
AWS_SECRET_ACCESS_KEY=xxx           # R2/S3 secret access key

# ── Observability (optional) ─────────────────────────────────────────────────
SENTRY_DSN=https://xxx@sentry.io/yyy        # Sentry error tracking (optional)
```

Frontend environment (`frontend/.env`):

```bash
VITE_API_URL=http://localhost:8000          # Backend API base URL (no trailing slash)
```

---

## Object Storage

By default Datrix writes uploaded files to `data/uploads/` on the local filesystem (`STORAGE_BACKEND=local`). Switching to `STORAGE_BACKEND=s3` routes all file I/O through a `StorageBackend` abstraction that supports any S3-compatible provider — no application code changes required.

### Supported providers

| Provider | `AWS_ENDPOINT_URL` | `AWS_REGION` | Notes |
|---|---|---|---|
| **Cloudflare R2** | `https://<account-id>.r2.cloudflarestorage.com` | `auto` | Zero egress fees; 10 GB free tier |
| **AWS S3** | *(leave blank)* | e.g. `us-east-1` | Standard AWS credentials |
| **Backblaze B2** | `https://s3.<region>.backblazeb2.com` | e.g. `us-west-004` | Cheap storage |
| **MinIO (self-hosted)** | `http://localhost:9000` | any string | Good for local testing |

### Cloudflare R2 quick-start

1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com) and navigate to **R2 Object Storage**
2. Create a bucket named `datrix-uploads`
3. Go to **R2 → Manage R2 API Tokens → Create token** — select **Object Read & Write** permissions
4. Copy the **Access Key ID** and **Secret Access Key** (shown once — save them now)
5. Add to `backend/.env`:

```bash
STORAGE_BACKEND=s3
AWS_S3_BUCKET=datrix-uploads
AWS_REGION=auto
AWS_S3_PREFIX=uploads/
AWS_ENDPOINT_URL=https://<your-account-id>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=<from step 4>
AWS_SECRET_ACCESS_KEY=<from step 4>
```

### How it works

`backend/app/services/storage.py` exports a `get_storage()` singleton that returns either `LocalStorageBackend` or `S3StorageBackend` depending on `STORAGE_BACKEND`. All file paths stored in the database are storage keys:

- **Local** → absolute path string: `/app/data/uploads/report.csv`
- **S3** → URI string: `s3://datrix-uploads/uploads/report_a1b2c3d4.csv`

When ML services need to read a file (Polars, pandas), they call `storage.local_path(key)` which is transparent for local storage and downloads to a temp file for S3.

---

## Backups

`scripts/backup.sh` creates a dated `.tar.gz` of the `backend_data` Docker volume and automatically prunes archives older than 7 days.

```bash
# Basic usage (saves to ./backups/)
bash scripts/backup.sh

# Custom output directory
bash scripts/backup.sh /mnt/backups

# Retain 30 days instead of 7
KEEP_DAYS=30 bash scripts/backup.sh
```

**Cron example** — daily at 2 AM, logged:

```bash
0 2 * * * cd /opt/datrix && bash scripts/backup.sh >> /var/log/datrix-backup.log 2>&1
```

**Restore** a backup:

```bash
docker run --rm \
  -v datrix_backend_data:/data \
  -v $(pwd)/backups:/backup:ro \
  alpine tar xzf /backup/datrix_volume_20240101_020000.tar.gz -C /data
```

> The script auto-detects the Docker Compose project name from `$COMPOSE_PROJECT` (default: `datrix`). If your stack is named differently, set `COMPOSE_PROJECT=myproject bash scripts/backup.sh`.

---

## Database & Migrations

Datrix uses **SQLAlchemy 2.0** with **Alembic** for schema migrations against PostgreSQL.

Migrations run automatically every time the backend starts (`python run.py`). They are idempotent — safe to run on every deploy. The startup sequence:

1. Try `alembic upgrade head` (up to 3 attempts with 5-second backoff)
2. If Alembic fails (e.g., brand-new database with no alembic table), fall back to `Base.metadata.create_all()`

**Manual migration commands:**

```bash
cd backend

# Create a new migration after changing a model
alembic revision --autogenerate -m "add user_preferences table"

# Apply all pending migrations
alembic upgrade head

# Roll back one migration
alembic downgrade -1

# Check current migration state
alembic current
```

**Neon Postgres note**: Use the **unpooled** connection string for Alembic (`@ep-xxx.neon.tech`), and the **pooled** string for the application runtime (`@ep-xxx-pooler.neon.tech`). The Alembic env in `backend/alembic/env.py` handles this automatically by swapping the URL.

---

## API Reference

Interactive docs are available while the backend is running:

| Format | URL |
|---|---|
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| OpenAPI JSON | http://localhost:8000/openapi.json |

**Endpoint summary:**

| Router | Prefix | Key endpoints |
|---|---|---|
| Auth | `/auth` | `POST /register`, `POST /login`, `POST /refresh`, `POST /logout` |
| Datasets | `/datasets` | CRUD, `POST /upload`, `POST /{id}/scan`, `POST /{id}/fixes`, `GET /{id}/columns` |
| Pipelines | `/pipelines` | CRUD, `POST /{id}/steps`, `POST /{id}/run`, `POST /{id}/dry-run` |
| Synthetic | `/synthetic` | `POST /jobs`, `GET /jobs/{id}`, `GET /jobs` |
| Active Learning | `/active-learning` | `POST /sessions`, `POST /sessions/{id}/label`, `GET /sessions/{id}/batch` |
| Benchmark | `/benchmark` | `POST /jobs`, `GET /jobs/{id}/results` |
| Compliance | `/compliance` | `GET /pii-scan`, `GET /lineage`, `GET /policies`, `POST /reports` |
| Marketplace | `/marketplace` | `GET /assets`, `POST /assets/{id}/install`, `POST /publish`, `POST /assets/{id}/review` |
| Settings | `/settings` | `GET /`, `PATCH /`, `GET /storage-stats` |

All write endpoints require a valid `Authorization: Bearer <access_token>` header.

---

## CI / CD

### CI — runs on every push and pull request to `main`/`develop`

| Job | Steps |
|---|---|
| **Backend** | Checkout → Python 3.12 → `pip install` → Ruff lint → Pyright type-check |
| **Frontend** | Checkout → Node 20 → `npm ci` → `tsc --noEmit` → `npm run build` |

### Deploy — runs on version tags (`v*`)

Builds Docker images and pushes them to GitHub Container Registry (GHCR):

```bash
# Tag a release
git tag v1.2.0
git push origin v1.2.0
```

Images pushed:
- `ghcr.io/<owner>/datrix-backend:v1.2.0`
- `ghcr.io/<owner>/datrix-frontend:v1.2.0`

Pull and deploy on your server:

```bash
docker pull ghcr.io/s3ak6i-dev/datrix-backend:v1.2.0
docker pull ghcr.io/s3ak6i-dev/datrix-frontend:v1.2.0
docker compose -f docker-compose.production.yml up -d
```

---

## Security

### What is in place

| Control | Implementation |
|---|---|
| **Authentication** | JWT access tokens (30 min) + refresh tokens (7 days) with rotation on use |
| **Password storage** | bcrypt with cost factor 12 — no plaintext ever stored |
| **Rate limiting** | slowapi — 200 requests/minute per IP by default; auth endpoints have stricter limits |
| **CORS** | Configurable `ALLOWED_ORIGINS` — defaults to localhost only |
| **HTTP headers** | Nginx sets HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP, Permissions-Policy |
| **TLS** | TLSv1.2/1.3 only, ECDHE ciphers, HSTS preload (`max-age=63072000`) |
| **Input validation** | Pydantic v2 `Field` constraints (`min_length`, `max_length`, `ge`, `le`) on every request model; file type and size enforced on upload |
| **SQL injection** | SQLAlchemy ORM with parameterized queries throughout — no raw SQL |
| **Error tracking** | Sentry SDK — optional; configure `SENTRY_DSN` in `.env` |

### What to do before going public

1. **Generate a real `SECRET_KEY`** — never use the default:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
2. **Set `ENVIRONMENT=production`** — enables stricter error handling and disables debug output
3. **Set `ALLOWED_ORIGINS`** to your exact domain — blocks all other origins
4. **Never commit `.env`** — it is in `.gitignore`; verify with `git status` before every push
5. **Set up HTTPS** — see [Production with HTTPS](#production-with-https)

---

## Design System

Datrix ships a complete token-driven design system. Full specification in `DesignSpec.md` and `UIUX.md`.

### Themes

Two fully-specified themes: **dark** (default) and **light**. Toggled from the sidebar footer, persisted to `localStorage`, applied before first paint via an inline `<script>` in `index.html` — no flash, ever.

### Token map

```
Surface     bg < bg-2 < bg-3 < bg-card < bg-inset
Text        text-primary > text-secondary > text-tertiary
Accent      --accent (blue) — used sparingly, one per action
Status      --green (success), --warn (warning), --bad (error)
Tints       --blue-tint, --green-dim, --warn-dim, --bad-dim
```

All components reference CSS custom properties exclusively — no hardcoded hex anywhere in the component tree.

### Typography

| Use | Font | Weight |
|---|---|---|
| Headlines | Inter | 300 |
| UI text | Inter | 400 / 500 |
| Labels, numbers, code | IBM Plex Mono | 400 / 500 |

### Component primitives

`Button`, `Badge`, `QualityBadge`, `ScoreBar`, `Skeleton`, `IssueCard`, `StatCell` — all in `frontend/src/components/ui/`.

---

## Roadmap

| Phase | Key work | Status |
|---|---|---|
| **1.1 Auth** | JWT backend + frontend (register, login, refresh, logout, ProtectedRoute) | ✅ Complete |
| **1.2 Database** | SQLAlchemy 2.0 ORM, 22 tables on Neon Postgres, Alembic migrations | ✅ Complete |
| **1.3 Env Config** | pydantic-settings, `.env`, `VITE_API_URL` | ✅ Complete |
| **1.4 File Storage** | `StorageBackend` ABC — `LocalStorageBackend` + `S3StorageBackend`; Cloudflare R2 live | ✅ Complete |
| **2.1–2.5 Stability** | Error boundaries, rate limiting, thread safety, upload validation, JSON logging | ✅ Complete |
| **2.6 API Hardening** | Pydantic `Field` constraints on all request models; `ColumnConfig` typed anonymization | ✅ Complete |
| **3.1 Docker** | Multi-stage nginx image (frontend baked in); backend healthcheck; `setup-ssl.sh` | ✅ Complete |
| **3.3 Backups** | `scripts/backup.sh` — Docker volume backup with dated archives + auto-pruning | ✅ Complete |
| **4.4 CI/CD** | GitHub Actions (lint + type-check + build on PR; Docker publish on tag) | ✅ Complete |
| **1.5 HTTPS** | Nginx TLS config complete — requires `setup-ssl.sh` run at deploy time | 🔧 Deploy-time |
| **3.2 Gunicorn** | Gunicorn configured with 3 workers + 120s timeout; tuning by CPU count pending | ✅ Complete |
| **3.4 Metrics** | Prometheus `/metrics` endpoint + Grafana dashboard | ⬜ Pending |

---

## Troubleshooting

**Backend won't start — `could not connect to server`**
> Your `DATABASE_URL` in `backend/.env` is wrong or the Neon instance is paused (free tier auto-pauses). Check the URL and wake the instance from the Neon dashboard.

**`ProactorEventLoop` / `asyncio` error on Windows**
> This is handled automatically by `backend/run.py` which sets `WindowsSelectorEventLoopPolicy` before uvicorn starts. Always start the backend with `python run.py`, never with bare `uvicorn` directly.

**CTGAN / TVAE job hangs or is very slow**
> Expected — these methods train a neural network. On datasets > 50K rows expect 5–15 minutes. The UI polls every 2 seconds and shows a live progress indicator. For quick tests use the `statistical` method instead.

**`401 Unauthorized` on all API calls after a while**
> The access token has expired (30 min TTL). `AuthContext` handles silent refresh automatically via the refresh token. If you're seeing this consistently, check that `REFRESH_TOKEN_EXPIRE_DAYS` is set and that the frontend `VITE_API_URL` is correct.

**Tour keeps relaunching on every page reload**
> The tour auto-shows until you complete or skip it, which writes `datrix-tour-done` to `localStorage`. If you're in a private/incognito window that key clears on close. This is by design.

**`npm run build` fails with type errors**
> Run `npx tsc --noEmit` to see the full error list. All components must pass strict TypeScript — fix the errors before pushing (CI will catch them too).

**Alembic migration fails on first start**
> If you see `"alembic_version" does not exist`, the database is brand new. The startup code falls back to `create_all` automatically. If it still fails, check that `DATABASE_URL` points to a reachable Postgres instance and that the user has `CREATE TABLE` privileges.

**`CORS policy` error in the browser**
> Your `ALLOWED_ORIGINS` in `backend/.env` must include the exact origin the frontend is running on (e.g., `http://localhost:5173`). For production set it to `https://yourdomain.com`. When running via Docker compose the frontend is on port 80 — the `docker-compose.yml` overrides `ALLOWED_ORIGINS` automatically for this case.

**Backend container stuck in `starting` / healthcheck always failing**
> `curl` is required for the `HEALTHCHECK` instruction in `backend/Dockerfile`. It is installed as part of the `apt-get` step. If you have an older cached layer, rebuild with `docker compose build --no-cache backend`.

**`VITE_API_URL` in the compiled JS is always `http://localhost:8000` regardless of docker-compose args**
> The `ARG VITE_API_URL` declaration in `frontend/Dockerfile` must appear before the `RUN npm run build` step. If you pulled an older version of the repo, rebuild with `docker compose build --no-cache frontend`.

**Production nginx serves a blank page / no static files**
> Earlier versions used a shared `frontend_static` Docker volume that was never populated. The current `nginx/Dockerfile` bakes the frontend into the nginx image directly via a multi-stage build — rebuild with `docker compose -f docker-compose.production.yml build --no-cache nginx`.

**`scripts/setup-ssl.sh` fails with "DOMAIN env var is required"**
> Export the variable before running: `export DOMAIN=yourdomain.com && export EMAIL=you@email.com && bash scripts/setup-ssl.sh`.

**`scripts/backup.sh` fails with "volume not found"**
> The Docker Compose project name prefixes volume names. Default is `datrix` (giving `datrix_backend_data`). If you started the stack from a differently-named directory, override: `COMPOSE_PROJECT=myname bash scripts/backup.sh`.

---

## Contributing

Contributions are welcome.

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes — keep commits atomic and messages clear
4. Ensure CI passes locally:
   ```bash
   # Backend
   cd backend && ruff check app/ && pyright app/

   # Frontend
   cd frontend && npx tsc --noEmit && npm run build
   ```
5. Open a pull request against `main` with a clear description of what and why

Before submitting, please check:
- [ ] `npm run build` passes (TypeScript strict mode, zero errors)
- [ ] Backend starts cleanly with `python run.py`
- [ ] No secrets, `.env` files, or large binary files in the diff
- [ ] New features have corresponding entries in `DesignSpec.md` / `UIUX.md` if they touch the UI

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with FastAPI · React · Polars · scikit-learn · Tailwind CSS · PostgreSQL

</div>
