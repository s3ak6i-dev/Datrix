# Datrix — UI/UX Design & Flow Specification

**Version 1.0 · Design & Product · 2025**

| Document Type | UI/UX Flow Specification |
|---|---|
| Status | Draft — Design Review |
| Audience | Product, Design, Engineering |
| Tools | Figma + this document |

---

## Table of Contents

1. [Design System](#1-design-system)
2. [Information Architecture](#2-information-architecture)
3. [Onboarding Flow](#3-onboarding-flow)
4. [Dataset Detail Flow](#4-dataset-detail-flow)
5. [Cleaning Flow](#5-cleaning-flow)
6. [Pipeline Builder Flow](#6-pipeline-builder-flow)
7. [Synthetic Data Flow](#7-synthetic-data-flow)
8. [Compliance Autopilot Flow](#8-compliance-autopilot-flow)
9. [Active Learning Flow](#9-active-learning-flow)
10. [Error States & Empty States](#10-error-states--empty-states)
11. [Responsive Design & Accessibility](#11-responsive-design--accessibility)
12. [Design Handoff Standards](#12-design-handoff-standards)

---

## 1. Design System

### 1.1 Design Principles

| Principle | What It Means |
|---|---|
| **Precision over decoration** | Data tools must be dense and accurate. Visual noise reduces trust. Show exactly what matters, nothing more. |
| **Proactive, not reactive** | The platform surfaces insights before users go looking. Good design anticipates the next question. |
| **Complexity on demand** | Simple surface for simple tasks. Full power available on demand. Never hide capability; never force it on casual users. |
| **Confidence through transparency** | Every automated action is explained. Every recommendation is evidenced. Users never wonder what the platform did or why. |

---

### 1.2 Colour System

| Token | Hex | Usage |
|---|---|---|
| Brand Blue | `#1A56DB` | Primary actions, links, active states, brand moments |
| Surface Primary | `#FFFFFF` | Cards, modals, main content areas |
| Surface Secondary | `#F9FAFB` | Page backgrounds, inactive areas |
| Surface Tertiary | `#F3F4F6` | Hover states, zebra rows, subtle containers |
| Border Default | `#E5E7EB` | All borders, dividers, separators |
| Text Primary | `#111827` | Headings, primary content, high-importance labels |
| Text Secondary | `#6B7280` | Supporting content, descriptions, metadata |
| Text Tertiary | `#9CA3AF` | Placeholders, hints, disabled states |
| Success Green | `#059669` | Good quality scores, passing controls, resolved issues |
| Warning Amber | `#D97706` | Medium-severity issues, warnings, approaching limits |
| Danger Red | `#DC2626` | Critical issues, errors, failing controls, destructive actions |
| Code/Mono BG | `#1E1E2E` | Code blocks, monospaced data, terminal-style displays |

---

### 1.3 Typography

| Style | Font | Weight | Size | Tracking | Usage |
|---|---|---|---|---|---|
| Display | Inter | 600 | 32–48px | -0.03em | Hero headlines, quality score numbers, major stat displays |
| Heading 1 | Inter | 600 | 28px | -0.02em | Page titles, section headings |
| Heading 2 | Inter | 500 | 22px | -0.01em | Subsection headings, card titles |
| Heading 3 | Inter | 500 | 17px | 0 | Panel headings, table section labels |
| Body | Inter | 400 | 15px | 0 | All general body text, descriptions |
| Body Small | Inter | 400 | 13px | 0 | Secondary descriptions, metadata, captions |
| Label | Inter | 500 | 12px | 0.05em | Form labels, column headers, filter chips |
| Mono Data | IBM Plex Mono | 400 | 13px | 0 | Quality scores inline, code, file paths, IDs |
| Mono Display | IBM Plex Mono | 500 | 20–28px | 0 | Large quality score display, key metrics |

---

### 1.4 Spacing System

All spacing uses an 8px base unit.

| Value | Token | Common Usage |
|---|---|---|
| 4px | xs | Inline icon-to-text gap, badge internal padding |
| 8px | sm | Form element internal padding, tight list item gap |
| 12px | md | Card internal gap between elements |
| 16px | lg | Standard padding inside cards, between form rows |
| 24px | xl | Gap between cards in a grid, section content padding |
| 32px | 2xl | Section inner padding, major vertical rhythm |
| 48px | 3xl | Between major page sections |
| 64px | 4xl | Page-level vertical whitespace |

---

### 1.5 Component Library

Key components:

- **Quality Score Badge:** circular display, colour-coded by score range (0–59 red, 60–79 amber, 80–100 green)
- **Issue Card:** severity icon + column name + description + impact pill + fix button
- **Pipeline Node:** colour-coded by type (source blue, transform purple, output teal), status indicator
- **Dataset Card:** name, quality score badge, row count, last scanned timestamp, action menu
- **Stat Cell:** large mono number, muted label below, optional trend indicator
- **Progress Bar:** thin 4px bar, animated fill, colour-coded by status
- **Code Block:** dark background, monospace, line numbers, copy button
- **Step Indicator:** horizontal numbered steps, active/complete/pending states

---

## 2. Information Architecture

### 2.1 Navigation Structure

Datrix uses a two-level navigation: a persistent left sidebar for primary navigation and a contextual top bar for secondary actions.

```
┌─────────────────────────────────────────────────────────┐
│  DATRIX [org: Acme AI ▾]              [?] [⚙] [JS ▾]  │  ← Top bar
├──────────┬──────────────────────────────────────────────┤
│ ⬡ Datasets│                                              │
│ ◈ Pipelines│         Main content area                  │
│ ◎ Synthetic│                                             │
│ ⊛ Active L│                                              │
│ ⊕ Benchmark│                                             │
│ ⊗ Compliance│                                            │
│ ─────────  │                                             │
│ ↗ Marketplace│                                           │
│ ─────────  │                                             │
│ ⚙ Settings │                                             │
│ ? Docs     │                                             │
└──────────┴──────────────────────────────────────────────┘
```

### 2.2 Primary Navigation Items

| Item | What It Contains |
|---|---|
| Datasets | All datasets, upload, quality scores overview, version history |
| Pipelines | All pipelines, create new, execution history, template library |
| Synthetic | Gap analysis, generation jobs, validation results, blend manager |
| Active Learning | Model registry, uncertainty monitor, annotation queue, retraining history |
| Benchmark | Your position, industry benchmarks, trend reports, certification |
| Compliance | Compliance dashboard, regulation status, audit trail, evidence repository |
| Marketplace | Browse datasets, your listings, purchases, annotation services |
| Settings | Connectors, team, billing, API keys, integrations, notifications |

---

## 3. Onboarding Flow

### 3.1 Flow Overview

Target: first quality scan result delivered within 5 minutes of account creation.

| Step | Action | Notes |
|---|---|---|
| 1 | Sign up | Email + password, or Google / GitHub OAuth |
| 2 | Organisation setup | Name, industry vertical, team size — 3 fields |
| 3 | Connect first data source | Upload file or connect database — auto format detection |
| 4 | First quality scan | Automatic — no user action. Progress shown real-time. |
| 5 | See first score | Quality score + top 3 issues + one-click fixes |

---

### 3.2 Sign Up Screen

```
                    DATRIX
         AI Data Infrastructure Platform

  ┌────────────────────────────────────────┐
  │  Work email address                    │
  └────────────────────────────────────────┘
  ┌────────────────────────────────────────┐
  │  Password                              │
  └────────────────────────────────────────┘
  ┌────────────────────────────────────────┐
  │         Create account →               │
  └────────────────────────────────────────┘

  ──────── or continue with ────────
  [ G Google ]          [ ⌥ GitHub ]

  Already have an account? Sign in
```

| Behaviour | Specification |
|---|---|
| Email validation | Inline, on blur — check format before submit |
| Password strength | Visual indicator: weak / fair / strong |
| Work email | Non-work email domains flagged with soft warning (not blocked) |
| Error states | Field-level errors in red below field; never modal |
| Submit behaviour | Button shows spinner; disabled after first click to prevent double-submit |

---

### 3.3 Data Source Connection Screen

```
  Connect your first data source
  ─────────────────────────────────────────────────────

  ┌──────────────────┐  ┌──────────────────┐
  │  ↑ Upload a file  │  │  🗄 Connect a DB  │
  │  CSV, JSON,       │  │  Postgres, MySQL  │
  │  Parquet, Excel   │  │  BigQuery, more   │
  └──────────────────┘  └──────────────────┘

  ┌──────────────────┐  ┌──────────────────┐
  │  🔗 REST API      │  │  ≡ Stream        │
  │  Any REST API     │  │  Kafka, Kinesis   │
  │  with OAuth/key   │  │  Pub/Sub          │
  └──────────────────┘  └──────────────────┘

  ──── or drag and drop a file anywhere on this page ────
```

---

### 3.4 First Quality Scan Result

```
  training_data.csv scanned  ✓  1,240,000 rows  ·  23 columns
  ─────────────────────────────────────────────────────────────

         74                  Your score is in the
        ────            43rd percentile for ML datasets
        /100

  Completeness  89  ████████████████████░░░░  Good
  Consistency   61  ████████████░░░░░░░░░░░░  Needs work
  Accuracy      78  ████████████████░░░░░░░░  Fair
  Distribution  68  █████████████░░░░░░░░░░░  Fair
  Label quality 74  ██████████████░░░░░░░░░░  Fair

  Top issues to fix:                    Est. accuracy gain
  ✗ [CRITICAL] 8.3% null labels   →    +9.2%
  ✗ [WARNING]  1:480 class imbal  →    +4.1%
  ✗ [WARNING]  2,841 near-dupes   →    +1.8%

  [ Fix all auto-fixable  →  +12.4% est. gain ]  [ Review issues ]
```

---

## 4. Dataset Detail Flow

### 4.1 Dataset List View

```
  Datasets                              [ + New dataset ]
  ─────────────────────────────────────────────────────────
  [ Search datasets... ]  [ Domain ▾ ]  [ Quality ▾ ]  [ Sort: Recent ▾ ]

  ┌───────────────────────────────────────────────────────┐
  │  training_data_v3.parquet                             │
  │  1.2M rows · 23 cols · Uploaded 2 days ago           │
  │  Quality: [74] ████████░░  Last scan: 2h ago  [ ··· ]│
  ├───────────────────────────────────────────────────────┤
  │  customer_churn_labeled.csv                           │
  │  892K rows · 18 cols · Uploaded 5 days ago           │
  │  Quality: [88] ████████████  Last scan: 1d ago [ ···]│
  ├───────────────────────────────────────────────────────┤
  │  financial_txns_raw.jsonl                             │
  │  4.1M rows · 31 cols · Uploaded 8 days ago           │
  │  Quality: [51] ██████░░░░  Last scan: 3d ago  [ ···] │
  └───────────────────────────────────────────────────────┘
  Showing 3 of 14 datasets  [ Load more ]
```

---

### 4.2 Dataset Detail — Overview Tab

```
  ← Datasets  /  training_data_v3.parquet          [ Scan now ] [ ··· ]
  ─────────────────────────────────────────────────────────────────────
  [ Overview ]  [ Columns ]  [ Issues ]  [ Cleaning ]  [ History ]

  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │   74    │  │ 1,240,000│  │    23    │  │  4.2 GB  │  │  2h ago  │
  │ Quality │  │   Rows   │  │  Columns │  │   Size   │  │Last scan │
  └─────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘

  Quality breakdown                    Top issues
  ─────────────────────────────         ──────────────────────────────
  Completeness  89  ██████████░  Good   ! 8.3% null values in label
  Consistency   61  ██████░░░░░  Warn   ! Class imbalance 1:480
  Accuracy      78  ████████░░░  Fair   ! 2,841 near-duplicate rows
  Distribution  68  ███████░░░░  Fair   ! 6 inconsistent date formats
  Label quality 74  ███████░░░░  Fair

  Estimated gain from fixing all:  +18 points  +12.4% model accuracy
  [ Fix all auto-fixable (8 issues) ]
```

---

### 4.3 Dataset Detail — Columns Tab

```
  [ Overview ]  [ Columns ]  [ Issues ]  [ Cleaning ]  [ History ]

  [ Search columns... ]  [ Type: All ▾ ]  [ Sort: Quality ▾ ]

  Column              Type      Nulls    Unique    Quality   Issues
  ──────────────────────────────────────────────────────────────────
  label               string    8.3%     5         [42] !!   2 critical
  customer_id         string    0%       1,240,000 [99] ✓    —
  transaction_date    datetime  0.2%     892       [71] !    1 warning
  amount              float     1.1%     —         [78] !    1 warning
  merchant_category   string    4.2%     48        [65] !    2 warnings
  account_age_days    integer   0%       —         [91] ✓    —

  Showing 6 of 23 columns  [ Load all ]
  [ Click any column for full statistical profile → ]
```

---

### 4.4 Column Detail Panel (Slide-out)

```
  label                                            [×]
  string · 5 unique values · 8.3% null
  Quality score: 42 / 100
  ──────────────────────────────────────────────
  Distribution
  negative   ████████████████████  45.2%
  positive   ████████████░░░░░░░░  36.5%
  null       ████░░░░░░░░░░░░░░░░   8.3%  ← problem
  neutral    ███░░░░░░░░░░░░░░░░░░   7.1%
  unknown    █░░░░░░░░░░░░░░░░░░░░   2.9%
  ──────────────────────────────────────────────
  Issues in this column
  !! 8.3% null values — est. accuracy impact: +9.2%
     Fix: Impute using ML predictor (confidence 0.81)
     [ Preview fix ]  [ Apply fix ]  [ Skip ]
  !  Label noise detected — 4.2% likely mislabeled
     Fix: Review 521 flagged examples
     [ Open review queue ]
  ──────────────────────────────────────────────
  Statistics
  Most common: negative (45.2%)  Least: unknown (2.9%)
  Imbalance ratio (pos/neg): 1:1.24  Entropy: 1.93 bits
```

---

## 5. Cleaning Flow

### 5.1 Cleaning Wizard

```
  Cleaning: training_data_v3.parquet
  ─────────────────────────────────────────────────────
  Progress: 0 / 8 issues resolved  ·  Est. gain: 0 / +18.4 pts
  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0%

  Issue 1 of 8  [CRITICAL]  Estimated impact: +9.2% accuracy
  ──────────────────────────────────────────────────────
  Column: label
  Problem: 103,120 rows (8.3%) have null values in the label
           column. Nulls in label columns severely degrade
           model training. Missingness type: MAR — nulls
           correlate with transaction_amount < $50.

  How to fix:
  ◉ ML imputation    Predict label using all other features
                     Confidence: 0.81 · Preview: 52% neg,
                     38% pos, 10% neutral
  ○ Drop null rows   Remove 103,120 rows from dataset
                     New row count: 1,136,880
  ○ Create category  Add 'unknown' as a valid label class
  ○ Skip this issue

  [ Preview changes ]  [ Apply fix → ]         [ ← Back ]
```

---

### 5.2 Fix Preview Modal

```
  Preview: ML imputation — label column
  ─────────────────────────────────────────────────────
  Before                    After
  ─────────────────────────────────────────────────────
  Null count: 103,120       Null count: 0
  negative: 45.2%           negative: 48.1%  (+2.9%)
  positive: 36.5%           positive: 38.2%  (+1.7%)
  null: 8.3%                null: 0%         (-8.3%)
  neutral: 7.1%             neutral: 8.9%    (+1.8%)
  unknown: 2.9%             unknown: 4.8%    (+1.9%)

  103,120 values will be changed.
  Every change is fully reversible at any time.
  Confidence distribution: 0.95+ for 61%, 0.80-0.95 for 28%,
  < 0.80 for 11% — low confidence values flagged in output.

  [ ← Back to options ]  [ Confirm and apply ]
```

---

## 6. Pipeline Builder Flow

### 6.1 New Pipeline — NLP Entry

```
  New Pipeline
  ─────────────────────────────────────────────────────
  Tell us what you're building:
  ┌───────────────────────────────────────────────────┐
  │  I want to train a fraud detection model on      │
  │  credit card transaction data. Output should      │
  │  work with XGBoost. The data is very imbalanced.  │
  └───────────────────────────────────────────────────┘
  [ Build pipeline → ]

  ─── or start from a template ───

  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
  │ Binary classif. │ │ NLP sentiment   │ │ Time-series     │
  │ Tabular · 847   │ │ Text · 612 uses │ │ Forecasting     │
  │ uses            │ │                 │ │ 234 uses        │
  └─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

### 6.2 Pipeline Canvas — Visual Builder

```
  Fraud Detection Pipeline v1                    [ Run ] [ Save ] [ ··· ]
  ─────────────────────────────────────────────────────────────────────
  [ + Add node ]  [ Templates ]  [ Validate ]  [ Dry run (1K rows) ]

  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
  │ SOURCE   │ → │  CLEAN   │ → │  ENCODE  │ → │  SPLIT   │
  │ txns.csv │   │ Null imp.│   │ One-hot  │   │70/15/15  │
  │ 4.1M rows│   │ Dedup    │   │ Scaling  │   │Stratified│
  │ [●]ready │   │ [●]ready │   │ [●]ready │   │ [●]ready │
  └──────────┘   └──────────┘   └──────────┘   └──────────┘
                                                      │
                                                 ┌──────────┐
                                                 │  OUTPUT  │
                                                 │ XGBoost  │
                                                 │ DMatrix  │
                                                 │ [●]ready │
                                                 └──────────┘

  ⚠ Linter: No validation split detected. Recommend adding.
  ✓ 5 nodes · 4 edges · No errors
  Data shape: 4,100,000 rows → 4,100,000 rows (3 splits)
```

**Node types and colours:**

| Type | Colour | Examples |
|---|---|---|
| Source | Blue | File upload, database, API, stream |
| Transform | Purple | Filter, join, aggregate, clean, encode |
| Enrich | Teal | Synthetic inject, external merge |
| Split | Orange | Train/val/test splitter, stratified sampler |
| Output | Green | Export, push to training platform, save version |

**Linter rules (non-blocking warnings):**

- Encoding before splitting — data leakage risk
- No validation split detected
- Class imbalance with no resampling step
- Text column not tokenised before NLP output

---

### 6.3 Pipeline Execution Progress

```
  Fraud Detection Pipeline — Run #14         [ Cancel ]
  Started 2m 14s ago  ·  Dataset: txns.csv  ·  4,100,000 rows
  ─────────────────────────────────────────────────────────────

  ✓ Source          0:00  4,100,000 rows loaded
  ✓ Clean           1:12  4,082,341 rows (17,659 removed)
  ⟳ Encode          ████████████░░░░░░  65%  Processing...
  ○ Split           Waiting
  ○ Output          Waiting

  ─────────────────────────────────────────────────────────────
  Overall progress:  ████████████░░░░░░░░  58%
  Estimated time remaining: 1m 42s
  Processing rate: 142,000 rows/sec

  ✓ Checkpoint saved after each step — safe to close this window
```

---

## 7. Synthetic Data Flow

### 7.1 Gap Analysis Screen

```
  Synthetic Data Engine
  ─────────────────────────────────────────────────────
  Dataset: training_data_v3.parquet  [ Change ]

  ┌─────────────────────────────────────────────────────┐
  │  Gap Analysis  ·  Completed 4 minutes ago          │
  │  ─────────────────────────────────────────────────  │
  │  !! Class imbalance: fraud class is 0.2% of data   │
  │     Recommendation: Generate 50,000 fraud examples  │
  │     Estimated accuracy gain: +18.4%                 │
  │     [ Generate 50K fraud examples → ]               │
  │  ─────────────────────────────────────────────────  │
  │  !  Edge case coverage: 23% of known fraud patterns │
  │     not represented.                                 │
  │     [ Generate edge case examples → ]               │
  │  ─────────────────────────────────────────────────  │
  │  ✓  Temporal coverage: last 3 months well covered   │
  └─────────────────────────────────────────────────────┘
```

---

### 7.2 Generation Configuration

```
  Generate Synthetic Data — training_data_v3.parquet
  ─────────────────────────────────────────────────────
  What to generate:
  ◉ Fill class imbalance (recommended)
  ○ Fill feature space gaps
  ○ Generate edge cases
  ○ Custom — specify conditions

  Volume: [50,000 ▾] rows  ·  Target class: [fraud ▾]

  Quality settings:
  Generation method:    CTGAN (recommended for this dataset size)
  Min privacy score:    [80 ▾] / 100
  Validate output:      ✓ Run TSTR evaluation automatically

  Estimated time: 8–12 minutes  ·  Compute cost: ~$0.40

  [ Preview 20 samples ]  [ Start generation → ]
```

---

### 7.3 Generation Results

```
  Generation Complete ✓  50,000 fraud examples
  Duration: 9m 32s  ·  Method: CTGAN
  ─────────────────────────────────────────────────────
  Quality Validation
  ─────────────────────────────────────────────────────
  Statistical fidelity   [94/100]  ✓  Excellent
  ML utility (TSTR)      [88/100]  ✓  TSTR: -2.1% vs baseline
  Privacy score          [91/100]  ✓  Low re-identification risk
  Bias score             [83/100]  ✓  No introduced bias detected

  Distribution comparison (fraud class):
  amount:      Real ███████  Synthetic ███████  ✓ Match
  time_of_day: Real █████    Synthetic ████████  ! Slight drift

  ─────────────────────────────────────────────────────
  Blend into training dataset?
  ◉ Append synthetic fraud examples only  (recommended)
  ○ Replace all data with synthetic
  ○ Export separately

  [ Blend into dataset → ]  [ Export only ]  [ Discard ]
```

---

## 8. Compliance Autopilot Flow

### 8.1 Compliance Dashboard

```
  Compliance Autopilot                     [ Generate audit report ]
  ─────────────────────────────────────────────────────────────────

  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │  GDPR    │ │ EU AI Act│ │  HIPAA   │ │  SOC 2   │
  │  94/100  │ │  78/100  │ │  N/A     │ │  89/100  │
  │  2 open  │ │  6 open  │ │          │ │  3 open  │
  │ [View →] │ │ [View →] │ │[Enable →]│ │ [View →] │
  └──────────┘ └──────────┘ └──────────┘ └──────────┘

  Open Findings  (11 total)
  ─────────────────────────────────────────────────────
  !! EU AI Act  High risk  Technical documentation incomplete  47 days
  !! EU AI Act  High risk  Post-market monitoring plan missing  47 days
  !  GDPR       Medium     Consent records not linked to 3 datasets  —
  !  SOC 2      Medium     Access review overdue for 4 users  14 days

  Audit readiness: GDPR 91%  EU AI Act 74%  SOC 2 87%
  [ Request EU AI Act audit prep session → ]
```

---

### 8.2 Regulation Detail — GDPR

```
  ← Compliance  /  GDPR
  ─────────────────────────────────────────────────────
  Overall: 94/100  ·  2 open findings  ·  Audit readiness: 91%

  Article  Requirement                       Status    Evidence
  ──────────────────────────────────────────────────────────────
  Art. 5   Lawfulness / purpose limitation   ✓ Pass    [View]
  Art. 13  Transparency / privacy notice     ✓ Pass    [View]
  Art. 17  Right to erasure                  ✓ Pass    [View]
  Art. 22  Automated decision-making         ! Review  [View]
  Art. 25  Privacy by design                 ✓ Pass    [View]
  Art. 30  Records of processing (ROPA)      ✓ Pass    [View]
  Art. 32  Security of processing            ✓ Pass    [View]
  Art. 33  Breach notification               ✓ Pass    [View]
  Art. 35  DPIA                              ! Review  [View]

  [ Download GDPR compliance report (PDF) ]
  [ Share with auditor → ]
```

---

## 9. Active Learning Flow

### 9.1 Model Registration

```
  Register Model for Active Learning
  ─────────────────────────────────────────────────────
  Model name:     [ Fraud Detector v2                 ]
  Framework:      ◉ PyTorch  ○ TensorFlow  ○ sklearn  ○ Other
  Task type:      [ Binary classification ▾           ]
  Unlabeled pool: [ Connect data source ▾             ]

  Integration method:
  ◉ Python SDK (recommended)
     from datrix import UncertaintyWrapper
     model = UncertaintyWrapper(your_model)

  ○ REST API — send predictions, receive uncertainty scores
  ○ HuggingFace native integration

  Labeling budget:  $[ 500 ] total  ·  $[ 2.50 ] per label
  Retraining trigger:  [ 200 ] new labels

  [ Register model → ]
```

---

### 9.2 Uncertainty Monitor

```
  Active Learning — Fraud Detector v2
  ─────────────────────────────────────────────────────────
  Iteration 7 of ongoing  ·  Labels collected: 1,340 of 2,000 budget

  Model accuracy (held-out test):
  Baseline     ████████████████████░░░░░░░░░░  68.2%
  After iter 7 ████████████████████████░░░░░░  82.1%  +13.9%

  Uncertainty distribution (live):
  High (>0.8)    ████░░░░░░░░  12%  → 340 examples selected
  Medium (0.5–0.8) ████████░░  28%
  Low (<0.5)     ████████████  60%  → Model confident

  Next batch: 340 examples ready for annotation
  Est. accuracy gain from labeling: +4.2%
  Budget used: $335 of $500  ·  Remaining: $165 (66 labels)

  [ Start annotating 340 examples → ]
```

---

### 9.3 Annotation Interface

```
  Annotation Queue — Fraud Detector v2
  Task 47 of 340  ·  Budget: $94 of $500  ·  Est. gain: +2.1% so far
  ─────────────────────────────────────────────────────────────────

  Model uncertainty: 0.89 (very uncertain)
  Selected because: decision boundary example

  Transaction data:
  ──────────────────────────────────────────────
  Amount:          $1,247.00
  Merchant:        Online retail (MCC 5999)
  Time:            02:34 AM
  Account age:     12 days
  Location match:  No (card used 2,400km from home)
  ──────────────────────────────────────────────

  Model prediction: fraud (51%) / not fraud (49%)

  Your label:
  [ Fraud ]  [ Not fraud ]  [ Unsure — skip ]

  Keyboard: F = Fraud · N = Not fraud · S = Skip · ← = Previous
```

---

## 10. Error States & Empty States

### 10.1 Error State Principles

- Every error must say what happened, why it happened, and exactly what to do next
- Never show raw error codes or stack traces to end users
- Errors appear inline at the point of failure — not as modal interruptions
- System errors include a support reference code
- Destructive actions require a two-step confirmation — never a simple OK/Cancel

---

### 10.2 Key Error States

| Error | Message | Location |
|---|---|---|
| Upload failed — file too large | File exceeds 10GB limit. Compress or split the file, then upload again. [Learn how →] | Inline below upload zone |
| Quality scan timed out | Scan exceeded 30 minutes. Your dataset is very large — we'll retry automatically. [Check status →] | Banner, dismissible |
| Pipeline validation error | 3 issues found in your pipeline. Click the highlighted nodes to fix them before running. | Node highlighted red; panel shows issues |
| Connector auth failed | Connection to Postgres failed: authentication error. Check your credentials. [Go to Settings →] | Inline in connector setup |
| Synthetic generation — privacy gate | Generated data did not pass privacy threshold (score: 62, minimum: 80). Adjust settings and try again. | Full-page error with options |
| Compliance control failed | Access review overdue for 4 users. Reviews must be completed before SOC 2 audit. [Start review →] | Compliance dashboard banner |

---

### 10.3 Empty States

| Screen | Empty State |
|---|---|
| No datasets yet | Upload your first dataset to see quality insights. [Upload dataset →] or [Connect a database →] |
| No issues found | Your dataset scored 94/100. No significant issues detected. [Download report] [Set up monitoring] |
| Annotation queue empty | No examples selected for labeling. Your model is confident on all current unlabeled data. [Adjust uncertainty threshold →] |
| No compliance findings | All 89 controls are passing. You're audit-ready. [Download evidence package →] |
| Benchmark — no data yet | Contribute your quality data to unlock industry benchmarks. [Learn how →] |

---

## 11. Responsive Design & Accessibility

### 11.1 Breakpoints

| Breakpoint | Width | Capability |
|---|---|---|
| Mobile | < 768px | Read-only quality scores, basic dataset info, alert notifications. No pipeline builder. |
| Tablet | 768–1279px | Full quality and cleaning flows. Pipeline builder in simplified view. Compliance dashboard. |
| Desktop | 1280–1919px | Full platform. Primary target. All features fully functional. |
| Large desktop | 1920px+ | Extended sidebar, two-column layouts, no horizontal scroll. |

---

### 11.2 Accessibility Requirements

- WCAG 2.1 AA compliance required for all customer-facing screens
- Keyboard navigation: all interactive elements reachable and operable by keyboard alone
- Focus indicators: visible focus rings on all interactive elements (minimum 3px contrast ratio)
- Screen readers: all charts include data tables as accessible alternatives
- Colour: no information conveyed by colour alone — always paired with icon or text
- Motion: all animations respect `prefers-reduced-motion` media query
- Text: minimum 4.5:1 contrast ratio for all body text; 3:1 for large text
- Error messages: always associated with the specific field via `aria-describedby`

---

### 11.3 Performance Targets

| Metric | Target | Context |
|---|---|---|
| First Contentful Paint | < 1.5 seconds | Lighthouse on 4G connection |
| Largest Contentful Paint | < 2.5 seconds | Core Web Vital — Good threshold |
| Cumulative Layout Shift | < 0.1 | Core Web Vital — Good threshold |
| Time to Interactive | < 3.5 seconds | Full dashboard functional |
| Bundle size | < 350KB gzipped | Initial JS bundle |
| Dashboard re-render | < 100ms | On filter/sort change |

---

## 12. Design Handoff Standards

### 12.1 Figma File Structure

- **Page 1 — Design System:** colours, typography, spacing, all components
- **Page 2 — User Flows:** complete flow diagrams for every major journey
- **Page 3 — Onboarding:** all onboarding screens, all states
- **Page 4 — Datasets:** list, detail, columns, issues, cleaning wizard
- **Page 5 — Pipeline Builder:** canvas, node configs, execution, templates
- **Page 6 — Synthetic Data:** gap analysis, generation, results, blend
- **Page 7 — Active Learning:** registration, uncertainty monitor, annotation queue
- **Page 8 — Compliance:** dashboard, regulation detail, audit trail, report
- **Page 9 — Error & Empty States:** all error and empty state screens
- **Page 10 — Responsive:** mobile and tablet variants of all key screens

---

### 12.2 Handoff Checklist — Per Screen

- All interactive states defined: default, hover, focus, active, disabled, loading, error
- All text strings specified — no lorem ipsum in final handoff
- Spacing and layout annotated using spacing tokens (not raw pixel values)
- Component variants linked to design system components
- Responsive behaviour annotated for each breakpoint
- Micro-interactions described in notes: trigger, animation, timing
- Accessibility notes: tab order, ARIA labels, keyboard shortcuts
- Edge cases annotated: long text truncation, empty states, error states

---

### 12.3 Animation Guidelines

| Element | Animation | Trigger |
|---|---|---|
| Page transitions | Fade in, 150ms, ease-out | Navigating between main sections |
| Panel slide-out | Slide from right, 200ms, ease-in-out | Column detail, node config panels |
| Score count-up | Count from 0 to score, 800ms, ease-out | First quality score display |
| Progress bar fill | Width transition, 400ms, ease-in-out | All progress bars on page load |
| Toast notification | Slide up + fade in, 250ms | Success/error notifications |
| Modal | Fade in + scale from 0.95, 150ms | All modal dialogs |
| Loading skeleton | Shimmer pulse, 1.5s loop | All loading states |
| Hover on cards | Border colour transition, 100ms | All interactive cards |