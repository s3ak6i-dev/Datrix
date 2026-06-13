<div align="center">

# Datrix

**The intelligence layer beneath every AI system.**

A self-hosted, full-stack AI data infrastructure platform — built for data scientists and ML engineers who want a single workspace to prepare, transform, generate, label, benchmark, and govern datasets without writing boilerplate or stitching together a dozen separate tools.

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat)](LICENSE)

</div>

---

## What is Datrix?

Datrix is a local-first data workspace. You upload raw files and it handles everything from automatic quality scanning through to model training, compliance reporting, and a team marketplace — all through a browser UI backed by a Python API.

Everything runs on your machine. No data leaves your network unless you push it yourself.

---

## Features

### Datasets
Upload CSV / JSON / JSONL / Parquet / Excel and get instant quality intelligence. Every dataset is automatically profiled on upload — column types, null rates, row counts — and then scanned across five quality dimensions.

- **Upload** — drag-and-drop upload with live progress bar (XHR-based, real byte tracking)
- **Quality Scans** — five-dimension weighted scoring: Completeness 25%, Consistency 25%, Accuracy 25%, Distribution 15%, Label Quality 10%; overall score 0–100
- **Status lifecycle** — `pending → ingesting → scanning → ready → error`; UI auto-polls every 2 s
- **Column Explorer** — per-column type, null rate bar, unique count, distribution chart, and full descriptive stats (min/max/mean/std/p25/p50/p75)
- **Cleaning Wizard** — 7 automated fix types (fill mean/median/mode/constant, deduplicate, clip outliers, cast type) with before/after preview and per-fix rollback
- **Scan History** — every scan stored with timestamp, score, and delta from previous scan

### Pipelines
Build reusable data transformation sequences. Run them on any dataset. Outputs are downloadable files.

- **10 step types** — filter, select/drop columns, rename, fill nulls, deduplicate, lowercase, normalize, encode categorical, sort
- **Dry-run mode** — executes all steps in memory, returns a 20-row preview, writes nothing to disk
- **Atomicity** — Polars LazyFrame execution: if any step fails, the original file is untouched
- **Per-step statistics** — rows in / rows out / columns in / columns out for every step in every run
- **Export formats** — CSV, Parquet, JSON

### Synthetic Data
Generate statistically faithful artificial datasets that mirror your originals without containing any real records.

| Method | Algorithm | Speed | Fidelity |
|---|---|---|---|
| `statistical` | Per-column distribution fitting | Very fast | Good for marginals |
| `ctgan` | Conditional Tabular GAN | 5–15 min on large sets | Excellent |
| `tvae` | Tabular Variational Autoencoder | 5–15 min on large sets | Excellent |

- **Column overrides** — control null rate, distribution, min/max clipping, and class weights per column
- **Validation** — run a Quality Scan on the output and compare all 5 dimension scores to the source
- **Output** lands as a new Dataset, ready for Pipelines, Active Learning, and Benchmark

### Active Learning
Train models with as few human labels as possible. The model tells you which rows to label next.

- **6 sampling strategies** — Random, Least Confidence, Margin, Entropy, Coreset, Committee
- **5 model types** — Logistic Regression, Random Forest, XGBoost, SVM, MLP
- **Learning curve** — accuracy vs. labeled count, updated after every round of labeling
- **Exports** — trained `.pkl` scikit-learn pipeline, labeled CSV, or predict the full unlabeled pool

### Benchmark
Side-by-side ML model comparison under identical conditions — rigorous, no cherry-picking.

- **4 evaluation protocols** — kfold_5, kfold_10, holdout_80, holdout_90
- **3 presets** — Default, Tuned, Grid Search
- **Candidates run in parallel** — all models train simultaneously in separate background threads
- **Results** — ranked leaderboard (crown for winner), confusion matrices, feature importances, learning curves
- **Synthetic validation** — train one candidate on real data and one on synthetic; a gap under 5% confirms excellent fidelity

### Compliance Autopilot
Automatic data governance — PII detection, lineage tracking, policy enforcement, anonymization, audit log, and regulatory reports.

- **PII Scanner** — two-pass: column name keywords (50+ signals) + value regex (11 patterns); 6 risk levels
- **Data Lineage DAG** — auto-built pan/zoom graph showing every dataset → pipeline → job → marketplace flow
- **Policy Engine** — 8 built-in policies + custom policy creation; automated violation detection and tracking
- **Anonymization wizard** — 7 methods (keep, suppress, redact, mask, hash, generalize, pseudonymize); always produces a new Dataset, source untouched
- **Audit Log** — append-only, every platform action recorded; CSV export; 10,000-event cap
- **Reports** — GDPR Article 30, CCPA Inventory, HIPAA Data Inventory, General Summary; self-contained HTML + JSON

### Marketplace
Shared catalogue of datasets, pipelines, models, and benchmark configs. Entirely local — nothing is sent to any external service.

- **4 asset types** — Dataset, Pipeline, ML Model (from Active Learning), Benchmark Config
- **Compact 2-column card grid** — type badge, title with ✓ for official assets, 1-line description, download count
- **Full-text search** + filter by type, category, and sort order
- **Deep-copy install** — installed assets become full workspace records; deleting the source has no effect
- **3-step publish wizard** — select source → fill metadata → review and publish
- **Reviews & star ratings** — 1–5 stars + optional text comment; average updates instantly
- **Install History** — every install tracked with timestamp and direct link to the workspace record

### Platform Tour
An interactive 9-step wizard that walks through every module the first time you open the app.

- **Auto-launches** once for new users (localStorage gate); can be dismissed at any time
- **Relaunch** from the sidebar footer ("Platform tour" button) or **Settings → General → Relaunch tour**
- **Left panel** — vertical stepper with timeline connectors; circles show pending / active / done states
- **Right panel** — module icon + tagline, how-it-works 2×2 grid, key capabilities 2-column grid, note callouts
- **Final step** — clickable module cards that navigate directly to any section and close the tour
- **Keyboard navigation** — `→` / `←` to step, `Escape` to dismiss

### Settings
Global defaults for every module, live storage stats with usage bars, and a danger zone for reset operations.

- Theme toggle persisted to `localStorage`, applied before first paint (no flash)
- **Relaunch tour** button in General section

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS v4 |
| **State / data fetching** | TanStack Query v5 (with polling for async jobs) |
| **Routing** | React Router v6 |
| **Backend** | FastAPI, Python 3.12+ |
| **Auth** | JWT (python-jose + bcrypt); access 30 min + refresh 7 days with rotation |
| **Data processing** | Polars (fast CSV parsing, pipeline execution) |
| **ML** | scikit-learn, XGBoost, CTGAN, SDV |
| **Database** | PostgreSQL (Neon Postgres) via SQLAlchemy 2.0 ORM; 22 tables |
| **File storage** | Local filesystem (`backend/data/`) |
| **Infrastructure** | Docker + Docker Compose + Nginx |
| **Design system** | Custom CSS token system — dark/light themes, Inter + IBM Plex Mono |

---

## Project Structure

```
Datrix/
├── backend/
│   ├── app/
│   │   ├── api/               # FastAPI routers (one per module)
│   │   │   ├── datasets.py
│   │   │   ├── pipelines.py
│   │   │   ├── synthetic.py
│   │   │   ├── active_learning.py
│   │   │   ├── benchmark.py
│   │   │   ├── compliance.py
│   │   │   ├── marketplace.py
│   │   │   └── settings.py
│   │   ├── core/
│   │   │   ├── auth.py        # JWT creation, verification, bcrypt hashing
│   │   │   └── config.py      # pydantic-settings, reads .env
│   │   ├── db/
│   │   │   └── engine.py      # SQLAlchemy engine + session factory
│   │   ├── models/
│   │   │   └── store.py       # SQLAlchemy ORM models (22 tables)
│   │   ├── services/          # Business logic, ML executors, background jobs
│   │   │   ├── ingestion.py
│   │   │   ├── quality.py
│   │   │   ├── cleaning.py
│   │   │   ├── pipeline_executor.py
│   │   │   ├── synthetic_executor.py
│   │   │   ├── active_learning_executor.py
│   │   │   ├── benchmark_executor.py
│   │   │   ├── pii_scanner.py
│   │   │   ├── lineage_tracker.py
│   │   │   ├── compliance_checker.py
│   │   │   ├── anonymizer.py
│   │   │   ├── report_generator.py
│   │   │   ├── audit_logger.py
│   │   │   └── marketplace_seeder.py
│   │   └── main.py            # App factory, router registration, startup hooks
│   ├── alembic/               # Database migration scripts
│   ├── data/                  # Runtime data (gitignored except .gitkeep)
│   │   ├── uploads/
│   │   ├── models/
│   │   ├── pipeline_outputs/
│   │   ├── synthetic_outputs/
│   │   └── compliance_reports/
│   ├── run.py                 # Entry point — runs migrations then starts uvicorn
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/            # Button, Badge, ScoreBar, Skeleton, etc.
│   │   │   ├── Layout.tsx     # App shell — sidebar, nav, theme, tour wiring
│   │   │   ├── Layout.css     # App shell styles
│   │   │   └── TourGuide.tsx  # 9-step interactive platform tour wizard
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx   # Marketing landing page (unauthenticated)
│   │   │   ├── auth/
│   │   │   │   ├── AuthPage.tsx  # Login / register page
│   │   │   │   └── AuthPage.css
│   │   │   ├── datasets/
│   │   │   ├── pipelines/
│   │   │   ├── synthetic/
│   │   │   ├── active-learning/
│   │   │   ├── benchmark/
│   │   │   ├── compliance/
│   │   │   ├── marketplace/
│   │   │   ├── settings/
│   │   │   └── docs/
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx   # JWT token management + auth state
│   │   ├── lib/
│   │   │   ├── api.ts         # All API calls, typed
│   │   │   └── utils.ts       # formatBytes, formatNumber, formatRelativeTime
│   │   ├── types/
│   │   │   └── index.ts       # TypeScript types matching backend models
│   │   ├── index.css          # Design system — tokens, themes, animations
│   │   └── App.tsx            # Routes + ProtectedRoute
│   ├── index.html             # Pre-paint theme script (no flash on load)
│   └── package.json
│
├── DesignSpec.md              # Full design system specification
├── PRD.md                     # Product requirements document
├── TechSpec.md                # Technical specification
├── UIUX.md                    # UX patterns and component guidelines
└── PRODUCTION_CHECKLIST.md    # Phased roadmap to production
```

---

## Getting Started

### Requirements

| | Minimum | Recommended |
|---|---|---|
| Python | 3.10 | 3.12+ |
| Node.js | 18 | 20 |
| RAM | 4 GB | 8 GB (CTGAN/TVAE needs headroom) |
| Disk | 2 GB free | 5 GB+ |

### Prerequisites

- Python 3.12+
- Node 20+
- A [Neon](https://neon.tech) Postgres database (or any PostgreSQL instance)

### Installation

**1. Clone the repo**

```bash
git clone https://github.com/s3ak6i-dev/Datrix.git
cd Datrix
```

**2. Backend**

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt

# Copy env template and fill in your values
cp .env.example .env
# Edit .env: set DATABASE_URL (Postgres connection string) and SECRET_KEY
```

Generate a secure `SECRET_KEY`:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

**3. Frontend**

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
```

### Running (local dev)

Open two terminals:

```bash
# Terminal 1 — Backend API (http://localhost:8000)
# run.py runs Alembic migrations first, then starts uvicorn
cd backend
python run.py
```

```bash
# Terminal 2 — Frontend dev server (http://localhost:5173)
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser, then register an account.

On first startup the backend automatically:
- Runs Alembic migrations (idempotent — safe to run every time)
- Seeds the Marketplace with ~15 sample datasets, pipelines, and models
- Seeds 8 default compliance policies

### Docker (full stack)

```bash
# Ensure backend/.env exists with DATABASE_URL and SECRET_KEY
docker compose up --build
```

- Frontend: `http://localhost:80`
- Backend API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

### API Documentation

FastAPI's interactive docs are available while the backend is running:

- **Swagger UI** — http://localhost:8000/docs
- **ReDoc** — http://localhost:8000/redoc

---

## Design System

Datrix ships with a complete token-driven design system in `frontend/src/index.css` and `DesignSpec.md`.

- **Dark theme** (default) and **light theme** — toggle in the sidebar, persisted to `localStorage`, applied before first paint (no flash)
- **Single accent** — one luminous blue (`#63b3ff` dark / `#2f6fe4` light), used sparingly
- **Token-driven** — all colors, surfaces, borders, and text reference CSS custom properties; no hardcoded hex in components
- **Typography** — Inter (display + UI, weight 300 for headlines) + IBM Plex Mono (labels, numbers, code)
- **Motion** — eased transitions (`cubic-bezier(.2,.7,.2,1)`), gated behind `prefers-reduced-motion`
- **Backdrop grid** — subtle line-grid `body::before`, 3% opacity dark / 5% light

---

## Roadmap to Production

See [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md) for the full phased breakdown. Summary:

| Phase | Key work | Status |
|---|---|---|
| **1.1 Auth** | JWT backend + frontend (register, login, refresh, logout, ProtectedRoute) | ✅ Complete |
| **1.2 Database** | SQLAlchemy 2.0 ORM, 22 tables on Neon Postgres, Alembic migrations | ✅ Complete |
| **1.3 Env Config** | pydantic-settings, `.env`, `VITE_API_URL` | ✅ Complete |
| **2.1–2.5 Stability** | Error boundaries, rate limiting, thread safety, upload validation, JSON logging | ✅ Complete |
| **3.1 Docker** | Backend + frontend Dockerfiles, docker-compose, Nginx config | ✅ Complete |
| **4.4 CI/CD** | GitHub Actions (lint + type-check + build on PR; Docker publish on tag) | ✅ Complete |
| **1.4 File Storage** | S3/local abstraction | ⬜ Pending |
| **1.5 HTTPS** | Nginx TLS + Let's Encrypt | ⬜ Deployment-dependent |
| **3.2–3.4 Infra** | Gunicorn worker config, backups, Prometheus metrics | ⬜ Pending |

---

## Architecture Notes

### Database
All persistent data lives in PostgreSQL via SQLAlchemy 2.0. 22 ORM-mapped tables, created idempotently on startup via Alembic. Every API route uses its own scoped `db_session()` context manager (autocommit on success, rollback on error).

### Long-running jobs
All ML jobs (synthetic generation, AL training, benchmark runs, PII scans, anonymization) run in Python daemon threads and return a job ID immediately. The frontend polls status endpoints at 1–3 second intervals via TanStack Query `refetchInterval`.

### Lineage
The data lineage graph is derived entirely from existing table relationships — no extra instrumentation. If a pipeline ran on a dataset, an edge exists. It updates in real time.

### Cross-component communication
The platform tour is triggered across components without prop drilling via a custom DOM event (`datrix:open-tour`). The sidebar and Settings dispatch the event; Layout listens and owns the tour state.

---

## Contributing

This project is currently in active development. If you want to contribute:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit with clear messages
4. Open a pull request against `main`

Before submitting: make sure `npm run build` passes (TypeScript strict mode) and the backend starts cleanly with `python run.py`.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
<sub>Built with FastAPI · React · Polars · scikit-learn · Tailwind CSS</sub>
</div>
