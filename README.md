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

![Datrix Screenshot](frontend/src/assets/hero.png)

</div>

---

## What is Datrix?

Datrix is a local-first data workspace. You upload raw CSV files and it handles everything from automatic quality scanning through to model training, compliance reporting, and a team marketplace — all through a browser UI backed by a Python API.

Everything runs on your machine. No data leaves your network unless you push it yourself.

---

## Features

### Datasets
Upload CSV files and get instant quality intelligence. Every dataset is automatically profiled on upload — column types, null rates, row counts — and then scanned across five quality dimensions.

- **Upload** — drag-and-drop CSV upload with progress bar, XHR-based so progress is real
- **Quality Scans** — five-dimension automated analysis: Completeness, Consistency, Accuracy, Distribution, Label Quality; overall weighted score 0–100
- **Column Explorer** — per-column null rate, cardinality, distribution chart, stats (min/max/mean/std/percentiles)
- **Cleaning Wizard** — 7 automated fix types (fill mean/median/mode/constant, deduplicate, clip outliers, cast type) with preview and per-fix rollback
- **Change History** — every fix recorded, reversible individually

### Pipelines
Build reusable data transformation sequences visually. Run them on any dataset. Outputs are downloadable files.

- **10 step types** — filter, select/drop columns, rename, fill nulls, deduplicate, lowercase, normalize, encode categorical, sort
- **Visual node graph** — drag-and-drop layout, step connections shown as edges
- **Dry-run mode** — executes all steps, returns a 20-row preview, writes nothing
- **Per-step statistics** — rows in / rows out / columns in / columns out for every step in every run
- **Export formats** — CSV, Parquet, JSON

### Synthetic Data
Generate statistically faithful artificial datasets that mirror your originals without containing any real records.

| Method | Algorithm | Speed | Fidelity |
|---|---|---|---|
| `statistical` | Per-column distribution fitting | Very fast | Good for marginals |
| `ctgan` | Conditional Tabular GAN | Slow (minutes) | Excellent |
| `tvae` | Tabular Variational Autoencoder | Slow (minutes) | Excellent |

- **Column overrides** — control null rate, distribution, min/max, and class weights per column
- **Output** lands as a new Dataset, ready for all other features

### Active Learning
Train classification and regression models with as few human labels as possible. The model tells you which rows to label next.

- **6 sampling strategies** — Random, Least Confidence, Margin, Entropy, Coreset, Committee
- **5 model types** — Logistic Regression, Random Forest, XGBoost, SVM, MLP
- **Learning curve** — accuracy vs. labeled count, updated after every round
- **Exports** — trained `.pkl` model, labeled CSV, or run predictions on the full unlabeled pool

### Benchmark
Side-by-side comparison of multiple ML models on the same dataset with a consistent evaluation protocol.

- **4 eval protocols** — 5-fold CV, 10-fold CV, 80/20 holdout, 90/10 holdout
- **3 presets** — Default, Tuned, Grid Search
- **Results** — ranked leaderboard, confusion matrices, learning curves, feature importances
- Supports importing a pre-trained AL model as a candidate

### Compliance Autopilot
Automatic data governance — PII detection, lineage tracking, policy enforcement, anonymization, audit log, and regulatory reports.

- **PII Scanner** — two-pass detection: column name keyword matching (50+ signals) + value regex sampling (11 patterns); risk levels: critical / high / medium / low / clean
- **Data Lineage** — SVG DAG with pan/zoom showing how every dataset flows through pipelines, synthetic jobs, AL sessions, benchmarks, and marketplace
- **Policy Engine** — 8 built-in policies (PII scan required, no PII in training, min quality score, etc.) + custom policy creation; automated violation detection
- **Anonymization** — 3-step wizard; 7 methods: keep, suppress, redact, mask, hash, generalize, pseudonymize; produces new anonymized Dataset
- **Audit Log** — append-only, every action across the platform recorded automatically; CSV export; 10,000-event cap with oldest-first eviction
- **Reports** — GDPR Article 30, CCPA Inventory, HIPAA Data Inventory, General Summary, Custom; outputs self-contained HTML + JSON

### Marketplace
Shared catalogue of datasets, pipelines, models, and benchmark configs. Entirely local — nothing is sent to any external service.

- Browse, search, filter by type/category/sort
- One-click install — deep copies the asset into your workspace
- Publish your own assets in a 3-step wizard
- Star ratings + text reviews

### Settings
Global defaults for every module, live storage stats, and a danger zone for reset operations.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS v4 |
| **State / data fetching** | TanStack Query v5 (with polling for async jobs) |
| **Backend** | FastAPI, Python 3.10+ |
| **Data processing** | Polars (fast CSV parsing, pipeline execution) |
| **ML** | scikit-learn, XGBoost, CTGAN, SDV |
| **Data store** | JSON flat file (`db.json`) with threading lock *(see roadmap)* |
| **File storage** | Local filesystem (`backend/data/`) |
| **Design system** | Custom token system — dark/light themes, Inter + IBM Plex Mono |

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
│   │   ├── models/
│   │   │   └── store.py       # All dataclasses + JSON flat-file store
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
│   │   ├── core/
│   │   │   └── config.py      # Pydantic settings
│   │   └── main.py            # App factory, router registration, startup hooks
│   ├── data/                  # Runtime data (gitignored except .gitkeep)
│   │   ├── uploads/           # Uploaded CSV files
│   │   ├── models/            # Trained ML model .pkl files
│   │   ├── pipeline_outputs/
│   │   ├── synthetic_outputs/
│   │   └── compliance_reports/
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/            # Button, Badge, ScoreBar, Skeleton, etc.
│   │   │   ├── Layout.tsx
│   │   │   └── Sidebar.tsx    # Nav + dark/light theme toggle
│   │   ├── pages/
│   │   │   ├── datasets/
│   │   │   ├── pipelines/
│   │   │   ├── synthetic/
│   │   │   ├── active-learning/
│   │   │   ├── benchmark/
│   │   │   ├── compliance/
│   │   │   ├── marketplace/
│   │   │   ├── settings/
│   │   │   └── docs/
│   │   ├── lib/
│   │   │   ├── api.ts         # All API calls, typed
│   │   │   └── utils.ts       # cn(), formatBytes, formatRelativeTime, etc.
│   │   ├── types/
│   │   │   └── index.ts       # All TypeScript types matching backend models
│   │   ├── index.css          # Design system — tokens, themes, animations
│   │   └── App.tsx            # Routes
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
| Python | 3.10 | 3.11+ |
| Node.js | 18 | 20 |
| RAM | 4 GB | 8 GB (CTGAN/TVAE needs headroom) |
| Disk | 2 GB free | 5 GB+ |

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
```

**3. Frontend**

```bash
cd frontend
npm install
```

### Running

Open two terminals:

```bash
# Terminal 1 — Backend API (http://localhost:8000)
cd backend
uvicorn app.main:app --reload --port 8000
```

```bash
# Terminal 2 — Frontend dev server (http://localhost:5173)
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

On first startup the backend automatically:
- Creates `backend/data/` directory structure
- Seeds `db.json` with empty collections
- Seeds the Marketplace with ~15 sample datasets, pipelines, and models
- Seeds 8 default compliance policies

### API Documentation

FastAPI's interactive docs are available while the backend is running:

- **Swagger UI** — http://localhost:8000/docs
- **ReDoc** — http://localhost:8000/redoc

---

## Design System

Datrix ships with a complete design system in `frontend/src/index.css` and `DesignSpec.md`.

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
| **1 — Critical** | Authentication (JWT), real database (SQLite/Postgres), env config, file storage abstraction, HTTPS | ⬜ In progress |
| **2 — Stability** | Error boundaries, rate limiting, thread error handling, structured logging, input validation | ⬜ Pending |
| **3 — Infrastructure** | Docker + docker-compose, Gunicorn, backups, health monitoring | ⬜ Pending |
| **4 — Pre-launch** | Production build, security headers, CI/CD pipeline | ⬜ Pending |

**The current build is a fully-featured local development version.** It is not suitable for public deployment without completing at minimum Phase 1 (auth + database + env config).

---

## Architecture Notes

### Why a JSON flat file?
`db.json` was chosen deliberately for the prototype phase — zero setup, zero dependencies, immediately inspectable. It's backed by a `threading.Lock` for safety under concurrent background jobs. The replacement with SQLAlchemy + Alembic is the first item on the production checklist.

### Long-running jobs
All ML jobs (synthetic generation, AL training, benchmark runs, PII scans, anonymization) run in Python daemon threads and return a job ID immediately. The frontend polls status endpoints at 1–3 second intervals using TanStack Query's `refetchInterval`.

### Lineage
The data lineage graph is derived entirely from existing store relationships — no extra instrumentation. If a pipeline ran on a dataset, an edge exists. It updates in real time.

---

## Contributing

This project is currently in active development. If you want to contribute:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit with clear messages
4. Open a pull request against `main`

Before submitting: make sure `npm run build` passes (TypeScript strict mode) and the backend starts cleanly.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
<sub>Built with FastAPI · React · Polars · scikit-learn · Tailwind CSS</sub>
</div>
