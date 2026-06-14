import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check, ChevronRight,
  Zap, Database, GitBranch, Sparkles, Brain, BarChart3, ShieldCheck, ShoppingBag,
  Upload, Download, Search, Wrench, Play, Eye, FileText, Star, Package,
  Filter, Target, Lock, Shield, AlertTriangle, Settings, Network, List, Layers,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface FlowItem { label: string; detail: string }
interface CapItem { icon: React.ElementType; title: string; desc: string; route?: string }
interface StepDef {
  id: string
  label: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  tagline: string
  flow: FlowItem[]
  caps: CapItem[]
  note?: string
  route?: string
}

// ── Step definitions ────────────────────────────────────────────────────────

const STEPS: StepDef[] = [
  {
    id: 'welcome',
    label: 'Welcome',
    icon: Zap,
    iconBg: 'rgba(99,179,255,0.12)',
    iconColor: 'var(--accent)',
    tagline: 'Local-first AI data infrastructure — 7 modules, one platform, your machine',
    flow: [
      { label: 'Upload data', detail: 'Drag in a CSV, JSON, or Parquet file to get started immediately' },
      { label: 'Scan & clean', detail: 'Automatic 5-dimension quality scoring with guided issue fixes' },
      { label: 'Build pipelines', detail: 'Reusable transformation sequences that run on any compatible dataset' },
      { label: 'Train, govern & share', detail: 'Active Learning, Benchmark, Compliance autopilot, and Marketplace' },
    ],
    caps: [
      { icon: Shield, title: 'Fully local', desc: 'No data ever leaves your machine. Everything runs on your own hardware with no cloud dependency whatsoever.' },
      { icon: Layers, title: '7 integrated modules', desc: 'Datasets, Pipelines, Synthetic Data, Active Learning, Benchmark, Compliance Autopilot, and Marketplace.' },
      { icon: Zap, title: 'FastAPI + React', desc: 'Python backend on :8000, Vite frontend on :5173. Two terminals to start — everything else is automatic.' },
      { icon: Package, title: 'Auto-seeded on first start', desc: '15 sample Marketplace assets and 8 default Compliance policies are ready the moment you open the app.' },
      { icon: Database, title: 'Flat-file metadata store', desc: 'All metadata lives in db.json — no database setup, no migrations, no configuration required.' },
      { icon: Settings, title: 'Fully configurable', desc: 'Module defaults, storage limits, output formats, max upload size — all adjustable in Settings.' },
    ],
  },
  {
    id: 'datasets',
    label: 'Datasets',
    icon: Database,
    iconBg: 'rgba(96,165,250,0.12)',
    iconColor: '#60a5fa',
    tagline: 'Upload, score, explore, and clean your data in minutes',
    flow: [
      { label: 'Upload file', detail: 'Drag-drop CSV / JSON / JSONL / Parquet / Excel — XHR upload with a live progress bar tracking bytes sent' },
      { label: 'Auto-ingest', detail: 'Polars parses the schema, detects column types (Int64, Float64, Utf8, Boolean, Date), and counts rows immediately' },
      { label: 'Quality scan', detail: '5-dimension weighted scoring: completeness 25%, consistency 25%, accuracy 25%, distribution 15%, label quality 10%' },
      { label: 'Fix issues', detail: 'Guided cleaning wizard — preview every single change before it writes to disk, roll back any fix individually' },
    ],
    caps: [
      { icon: Upload, title: 'Supported formats', desc: 'CSV, JSON, JSONL, Parquet, XLS, XLSX. Max file size is configurable under Settings → Storage → Max upload size.' },
      { icon: Zap, title: 'Status lifecycle', desc: 'pending → ingesting → scanning → ready → error. The UI auto-polls every 2 seconds and updates the card in place.' },
      { icon: BarChart3, title: '5-dimension quality score', desc: 'Each dimension produces a 0–100 score and a ranked list of issues with severity levels: critical, warning, and info.' },
      { icon: Search, title: 'Column Explorer', desc: 'Type, null rate bar, unique count, distribution chart (bar/histogram), and full descriptive stats (min/max/mean/std/p25/p50/p75).' },
      { icon: Wrench, title: '7 cleaning fix types', desc: 'fill_nulls (mean/median/mode/constant), drop_duplicates, clip_outliers (±3σ), cast_type. Select multiple, apply at once.' },
      { icon: Eye, title: 'Preview before applying', desc: 'The Preview button shows a before/after sample of the affected rows before any change touches disk. No surprises.' },
      { icon: Check, title: 'Rollback any fix', desc: 'Every fix snapshots the prior CSV state. Roll back individual fixes independently at any time from the Changes tab.' },
      { icon: List, title: 'Scan history', desc: 'Every scan is stored with its timestamp, score, and score delta from the previous scan — track quality improvement over time.' },
    ],
    note: 'Fixes modify the underlying file on disk and are reversible via the rollback mechanism. Rolling back an early fix restores state from that specific snapshot — not all subsequent fixes applied after it.',
    route: '/datasets',
  },
  {
    id: 'pipelines',
    label: 'Pipelines',
    icon: GitBranch,
    iconBg: 'rgba(192,132,252,0.12)',
    iconColor: '#c084fc',
    tagline: 'Build once, run on any dataset — reusable ordered transformation sequences',
    flow: [
      { label: 'Create pipeline', detail: 'Give it a name and optionally attach a source dataset — leave it unattached for schema-agnostic reuse across datasets' },
      { label: 'Add steps', detail: 'Choose from 10 step types; each opens a configuration panel on the right where you set column targets and parameters' },
      { label: 'Dry-run first', detail: 'Dry-run executes all steps in memory and returns the first 20 rows of the result — nothing is written to disk' },
      { label: 'Full run', detail: 'Polars executes all steps atomically and writes the output file; per-step row and column counts are stored in run history' },
    ],
    caps: [
      { icon: Filter, title: 'filter', desc: 'Keep only rows matching a condition. Operators: ==, !=, >, <, >=, <=, contains, not_null. One condition per step.' },
      { icon: Layers, title: 'select / drop / rename', desc: 'Keep a set of columns, remove a set of columns, or rename a single column. Works on any schema.' },
      { icon: Wrench, title: 'fill_nulls', desc: '4 strategies per step: mean, median, mode, or a constant value you specify. Each step targets one column.' },
      { icon: Target, title: 'deduplicate', desc: 'Remove exact duplicate rows. Configure a column subset to compare on and whether to keep the first or last occurrence.' },
      { icon: Zap, title: 'normalize', desc: 'Scale a numeric column to [0, 1] via minmax or to a unit normal distribution via z-score. Prevents feature dominance in ML.' },
      { icon: BarChart3, title: 'encode_categorical', desc: 'One-hot encode (adds N binary columns) or label-encode (replaces with integer) a categorical column for ML-ready output.' },
      { icon: Play, title: 'Dry-run vs. full run', desc: 'Dry-run returns a 20-row preview with nothing written. Full run writes the output file in your chosen format (CSV/Parquet/JSON).' },
      { icon: List, title: 'Run history & per-step stats', desc: 'Every run logs rows-in, rows-out, columns-in, and columns-out for each step — so you can see exactly where data is filtered.' },
    ],
    note: 'All steps run as Polars LazyFrame operations chained together — nothing is written to disk until the complete pipeline succeeds. If any single step fails, your original dataset is left completely untouched.',
    route: '/pipelines',
  },
  {
    id: 'synthetic',
    label: 'Synthetic Data',
    icon: Sparkles,
    iconBg: 'rgba(52,211,153,0.12)',
    iconColor: 'var(--green)',
    tagline: 'Generate statistically faithful artificial data without exposing any real records',
    flow: [
      { label: 'Select source dataset', detail: 'Pick any existing dataset as the statistical blueprint for the generation job' },
      { label: 'Configure the job', detail: 'Set row count, choose a generation method, and optionally apply per-column overrides' },
      { label: 'Generate', detail: 'The backend trains a generative model on your data, then samples from it to produce the requested row count' },
      { label: 'Validate & use', detail: 'Scan the output, compare all 5 quality dimension scores to the source, then use it in pipelines or Benchmark' },
    ],
    caps: [
      { icon: Zap, title: 'statistical method', desc: 'Per-column distribution fitting: normal, log-normal, uniform, beta, or categorical frequency. Finishes in seconds. Poor correlations.' },
      { icon: Sparkles, title: 'CTGAN method', desc: 'Conditional Tabular GAN. Excellent fidelity for complex cross-column correlations and mixed column types. 5–15 min on large datasets.' },
      { icon: Brain, title: 'TVAE method', desc: 'Tabular Variational Autoencoder. Avoids the mode collapse issues of GAN. Similar training time and fidelity to CTGAN.' },
      { icon: Wrench, title: 'Column overrides', desc: 'Per-column: force null_rate (0–1), distribution type, min/max clipping for numerics, or class_weights JSON for categoricals.' },
      { icon: BarChart3, title: 'Quality validation', desc: 'Run a Quality Scan on the generated output and compare all 5 dimension scores to the source. Distribution should match or improve.' },
      { icon: Database, title: 'Output as new Dataset', desc: 'Generated data appears as a new Dataset record — immediately available in Pipelines, Active Learning, and Benchmark.' },
    ],
    note: 'CTGAN and TVAE require significant CPU and RAM. On datasets over 50,000 rows expect 5–15 minutes of training. The UI polls job status every 2 seconds with a live progress indicator throughout.',
    route: '/synthetic',
  },
  {
    id: 'al',
    label: 'Active Learning',
    icon: Brain,
    iconBg: 'rgba(244,114,182,0.12)',
    iconColor: '#f472b6',
    tagline: 'Achieve high accuracy with far fewer labels — focus effort on examples the model is uncertain about',
    flow: [
      { label: 'Create session', detail: 'Choose dataset, target column, task type (classification or regression), model type, batch size, and sampling strategy' },
      { label: 'Label the first batch', detail: 'Click the correct class (or type a numeric value) for each example in the seed set — you can skip uncertain rows' },
      { label: 'Model retrains', detail: 'Backend retrains from scratch on all labeled rows, evaluates full metrics, and immediately queues the next uncertain batch' },
      { label: 'Iterate & export', detail: 'Repeat until your accuracy target is hit or max rounds reached — then export a .pkl model or run predictions' },
    ],
    caps: [
      { icon: Target, title: 'random strategy', desc: 'Random sample from the unlabeled pool. Always run this as a baseline to measure how much uncertainty sampling helps.' },
      { icon: Brain, title: 'least_confidence', desc: 'Picks rows where the max class probability is lowest. Best for binary classification — direct measure of confidence.' },
      { icon: BarChart3, title: 'margin', desc: 'Picks rows where the gap between the top-2 class probabilities is smallest. Best for multi-class classification tasks.' },
      { icon: Sparkles, title: 'entropy', desc: 'Picks rows with the highest prediction entropy across all classes. Best when you have many label classes.' },
      { icon: Network, title: 'coreset', desc: 'Greedy k-center: picks feature vectors most dissimilar to already-labeled rows. Ensures maximum feature space coverage.' },
      { icon: Layers, title: 'committee', desc: 'Trains multiple models with different random seeds and picks rows where they disagree most. Most robust — slowest per round.' },
      { icon: Download, title: 'Export trained model', desc: 'Download a .pkl scikit-learn pipeline (preprocessing steps + trained model) ready for production inference.' },
      { icon: FileText, title: 'Export labels & predictions', desc: 'Download all labeled rows as CSV, or run the model on every unlabeled row and save predictions as a new dataset column.' },
    ],
    note: 'After each submission the model retrains from scratch on the full accumulated labeled set. The learning curve chart shows accuracy (or R²) vs. labeled count — a steep rise that flattens is the sign of highly efficient learning.',
    route: '/active-learning',
  },
  {
    id: 'benchmark',
    label: 'Benchmark',
    icon: BarChart3,
    iconBg: 'rgba(251,191,36,0.12)',
    iconColor: 'var(--warn)',
    tagline: 'Side-by-side model comparison under identical conditions — rigorous, no cherry-picking',
    flow: [
      { label: 'Configure a job', detail: 'Select dataset, target column, task type, evaluation protocol, and add as many model candidates as you want' },
      { label: 'Run all in parallel', detail: 'Every candidate trains simultaneously in separate background threads — no waiting for one before the next starts' },
      { label: 'Read the leaderboard', detail: 'Results ranked by primary metric (accuracy for classification, RMSE for regression) — winner gets a crown icon' },
      { label: 'Drill into any model', detail: 'Expand any candidate for full metrics, confusion matrix, feature importances, and train vs. validation learning curve' },
    ],
    caps: [
      { icon: Layers, title: 'kfold_5 / kfold_10', desc: '5 or 10-fold cross-validation. Metrics averaged across all folds. More reliable for smaller datasets (under ~10,000 rows).' },
      { icon: Play, title: 'holdout_80 / holdout_90', desc: '80/20 or 90/10 train/test split. Faster for large datasets. The 90/10 split has higher metric variance but more training data.' },
      { icon: Target, title: 'default preset', desc: 'Scikit-learn default hyperparameters. Fastest runtime — use this for a quick first comparison across all model types.' },
      { icon: Wrench, title: 'tuned preset', desc: 'Sensible hand-tuned hyperparameters per model type. Best balance of training speed and result quality for most workflows.' },
      { icon: Search, title: 'grid_search preset', desc: 'Exhaustive parameter grid search over a predefined space. Slowest — use this when you need the best possible numbers.' },
      { icon: BarChart3, title: 'Full metric suite per candidate', desc: 'Classification: accuracy, precision, recall, F1, ROC-AUC. Regression: RMSE, MAE, R². All shown side by side.' },
      { icon: Eye, title: 'Confusion matrix', desc: 'Per-candidate confusion matrix for classification tasks — spot systematic class-level failure modes immediately.' },
      { icon: Sparkles, title: 'Feature importances', desc: 'Ranked bar chart of which columns matter most per model. Informs feature engineering for the next iteration.' },
    ],
    note: 'Key validation technique: add one candidate trained on your real dataset and one on your synthetic output. An accuracy gap under 5% confirms the synthetic generation has excellent statistical fidelity.',
    route: '/benchmark',
  },
  {
    id: 'compliance',
    label: 'Compliance Autopilot',
    icon: ShieldCheck,
    iconBg: 'rgba(52,211,153,0.12)',
    iconColor: 'var(--green)',
    tagline: 'PII detection, lineage tracking, policy enforcement, and regulatory reports — fully automatic',
    flow: [
      { label: 'Scan for PII', detail: '2-pass detection: 50+ column name keyword signals, then regex pattern matching on up to 500 sampled values per column' },
      { label: 'Track data lineage', detail: 'An auto-populated DAG shows exactly how your data flows from upload through every pipeline, job, and marketplace install' },
      { label: 'Enforce policies', detail: '8 default rules evaluate automatically against current workspace state — create custom policies with JSON parameters' },
      { label: 'Generate reports', detail: 'GDPR / CCPA / HIPAA compliant HTML + JSON output generated synchronously in 2–5 seconds' },
    ],
    caps: [
      { icon: Search, title: 'PII Scanner', desc: '2-pass: column keywords (50+ signals) + value regex (11 patterns). 6 risk levels: critical, high, medium, low, clean, unscanned.' },
      { icon: Network, title: 'Data Lineage DAG', desc: 'Auto-built: datasets → pipelines → runs → synthetic jobs → AL sessions → benchmark jobs → marketplace assets. Pan, zoom, filter.' },
      { icon: ShieldCheck, title: '8 default policies', desc: 'No PII in training, PII scan required before use, min quality score, max retention days, min row count, accuracy floor, and more.' },
      { icon: Lock, title: 'Anonymization wizard', desc: '7 methods: keep, suppress, redact, mask, hash, generalize, pseudonymize. The source dataset is never modified — always a new output.' },
      { icon: List, title: 'Append-only audit log', desc: 'Every platform action is automatically logged. Filter by module category, search by entity name, export CSV up to 10,000 events.' },
      { icon: FileText, title: 'Regulatory reports', desc: 'GDPR Art. 30, CCPA Inventory, HIPAA Data Inventory, General Summary. Self-contained HTML — safe to email to auditors or stakeholders.' },
      { icon: BarChart3, title: 'Live risk gauge', desc: '0–100 score (A–F grade). Weighted components: PII Exposure 40%, Policy Failures 30%, Scan Coverage 20%, Data Freshness 10%.' },
      { icon: AlertTriangle, title: 'Violation tracking', desc: 'Every policy violation shows the entity name, severity level, and a Resolve button to acknowledge and mark it as addressed.' },
    ],
    note: 'Audit log entries are capped at 10,000 — oldest events are evicted when the cap is reached. Export the audit log CSV regularly if you need a complete uninterrupted historical record for compliance purposes.',
    route: '/compliance',
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    icon: ShoppingBag,
    iconBg: 'rgba(249,115,22,0.12)',
    iconColor: '#f97316',
    tagline: 'Share and discover datasets, pipelines, models, and benchmark configs — all local, nothing external',
    flow: [
      { label: 'Browse & filter', detail: 'Search full-text across title, description, and tags — 15 sample assets are pre-seeded on first startup' },
      { label: 'Inspect before installing', detail: 'Type-specific detail drawer: datasets show first-rows table, pipelines show step list, models show training metrics' },
      { label: 'Install to workspace', detail: 'One click deep-copies the asset into your workspace as a real record — not a reference or pointer' },
      { label: 'Publish your own', detail: '3-step wizard: select a source asset → fill in metadata → review and publish — visible to everyone immediately' },
    ],
    caps: [
      { icon: Database, title: '4 publishable asset types', desc: 'Dataset (from Datasets), Pipeline (from Pipelines), ML Model (from a completed AL session), Benchmark Config (from a job).' },
      { icon: Search, title: 'Full-text search & filters', desc: 'Search title/description/tags. Filter by asset type, domain category (9 options), and sort by newest/popular/rated/trending.' },
      { icon: Eye, title: 'Type-specific previews', desc: 'Datasets: first-rows table with schema. Pipelines: step list. Models: training metrics. All include author, version, and license info.' },
      { icon: Download, title: 'Deep-copy install', desc: 'Installing deep-copies the asset — it becomes a full workspace record. Deleting the source does not affect installed copies.' },
      { icon: Upload, title: '3-step publish wizard', desc: 'Select source → fill title, description, tags, category, license, version, author → review and publish. Shows up immediately in Browse.' },
      { icon: List, title: 'My Listings', desc: 'See all assets you have published. Edit metadata (title, description, tags, version) or permanently delete a listing at any time.' },
      { icon: Star, title: 'Reviews & star ratings', desc: '1–5 star rating with an optional text comment. Average rating updates instantly. Any workspace user can review any asset.' },
      { icon: Package, title: 'Install History tab', desc: 'Every install is tracked with a timestamp, asset type, and a direct link to the resulting workspace record for easy navigation.' },
    ],
    note: 'Publishing creates a marketplace record that points to the source asset in your workspace. If you delete the source asset before deleting the listing, all future installs will fail. Always delete the listing from My Listings first.',
    route: '/marketplace',
  },
  {
    id: 'ready',
    label: "You're Ready",
    icon: Check,
    iconBg: 'rgba(52,211,153,0.12)',
    iconColor: 'var(--green)',
    tagline: "You know every module — here's the recommended workflow to start with right now",
    flow: [
      { label: 'Upload & scan', detail: 'Get your first quality score in under 5 minutes — drag in any CSV and hit Scan' },
      { label: 'Clean the top issues', detail: 'Work through critical and warning severity findings in the guided Cleaning Wizard' },
      { label: 'Build a pipeline', detail: 'Encode your cleaning steps into a reusable pipeline that replays on any future dataset' },
      { label: 'Benchmark & govern', detail: 'Compare models on clean data, scan for PII, publish your best work to the Marketplace' },
    ],
    caps: [
      { icon: Database, title: 'Datasets', desc: 'Upload a file, run a quality scan, explore columns, apply fixes.', route: '/datasets' },
      { icon: GitBranch, title: 'Pipelines', desc: 'Build a reusable cleaning pipeline, dry-run it to verify output, then run it.', route: '/pipelines' },
      { icon: Sparkles, title: 'Synthetic Data', desc: 'Generate balanced examples if your real data has class imbalance.', route: '/synthetic' },
      { icon: Brain, title: 'Active Learning', desc: 'Label just what the model needs most — dramatically fewer labels required.', route: '/active-learning' },
      { icon: BarChart3, title: 'Benchmark', desc: 'Compare multiple model types on your final clean dataset under identical conditions.', route: '/benchmark' },
      { icon: ShieldCheck, title: 'Compliance', desc: 'Scan all datasets for PII, evaluate policies, and generate a compliance report.', route: '/compliance' },
      { icon: ShoppingBag, title: 'Marketplace', desc: 'Browse the 15 sample assets or publish your own datasets and pipelines.', route: '/marketplace' },
      { icon: Settings, title: 'Settings', desc: 'Configure module defaults, storage limits, output formats — and relaunch this tour.', route: '/settings' },
    ],
  },
]

// ── Sub-components ──────────────────────────────────────────────────────────

function CapCard({ cap, isLink, onClick }: { cap: CapItem; isLink: boolean; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false)
  const Icon = cap.icon
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => isLink && setHovered(true)}
      onMouseLeave={() => isLink && setHovered(false)}
      style={{
        padding: '12px 14px',
        background: hovered ? 'var(--bg-3)' : 'var(--bg-card)',
        border: `1px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        cursor: isLink ? 'pointer' : 'default',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <Icon style={{
          width: 14, height: 14, flexShrink: 0,
          color: hovered ? 'var(--accent)' : 'var(--accent)',
          transition: 'color 0.15s',
        }} />
        <span style={{
          fontSize: 13, fontWeight: 500, flex: 1,
          color: hovered ? 'var(--accent)' : 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          transition: 'color 0.15s',
        }}>{cap.title}</span>
        {isLink && (
          <ChevronRight style={{
            width: 13, height: 13, flexShrink: 0,
            color: hovered ? 'var(--accent)' : 'var(--text-tertiary)',
            transition: 'color 0.15s',
          }} />
        )}
      </div>
      <p style={{
        fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.55,
        marginLeft: 22, fontFamily: 'var(--font-sans)',
      }}>{cap.desc}</p>
    </div>
  )
}

function StepContent({ step, isLastStep, onGoTo }: {
  step: StepDef
  isLastStep: boolean
  onGoTo: (route: string) => void
}) {
  const Icon = step.icon
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, flexShrink: 0,
          background: step.iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon style={{ width: 26, height: 26, color: step.iconColor }} />
        </div>
        <div style={{ paddingTop: 2 }}>
          <h2 style={{
            fontSize: 22, fontWeight: 300, letterSpacing: '-0.02em',
            color: 'var(--text-primary)', marginBottom: 5, lineHeight: 1.2,
            fontFamily: 'var(--font-sans)',
          }}>{step.label}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
            {step.tagline}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '-6px 0' }} />

      {/* How it works */}
      <div>
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12,
        }}>How it works</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {step.flow.map((item, i) => (
            <div key={i} style={{
              display: 'flex', gap: 12, padding: '12px 14px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: 'var(--blue-tint)', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                marginTop: 1,
              }}>{i + 1}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 3, lineHeight: 1.3, fontFamily: 'var(--font-sans)' }}>
                  {item.label}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.55, fontFamily: 'var(--font-sans)' }}>
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key capabilities / Module links */}
      <div>
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12,
        }}>{isLastStep ? 'Jump to a module' : 'Key capabilities'}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {step.caps.map((cap, i) => (
            <CapCard
              key={i}
              cap={cap}
              isLink={isLastStep && !!cap.route}
              onClick={isLastStep && cap.route ? () => onGoTo(cap.route!) : undefined}
            />
          ))}
        </div>
      </div>

      {/* Note callout */}
      {step.note && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          background: 'var(--warn-dim)', border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: 'var(--radius-md)', padding: '12px 14px',
        }}>
          <AlertTriangle style={{ width: 14, height: 14, color: 'var(--warn)', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
            {step.note}
          </p>
        </div>
      )}

      {/* Settings callout on last step */}
      {isLastStep && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          background: 'var(--blue-tint)', border: '1px solid var(--border-accent)',
          borderRadius: 'var(--radius-md)', padding: '12px 14px',
        }}>
          <Settings style={{ width: 14, height: 14, color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
            You can relaunch this guide at any time from{' '}
            <strong style={{ color: 'var(--text-primary)' }}>Settings → General → "Relaunch tour"</strong>.
          </p>
        </div>
      )}

      <div style={{ height: 4 }} />
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function TourGuide({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const contentRef = useRef<HTMLDivElement>(null)

  const isLastStep = step === STEPS.length - 1
  const progress = (step / (STEPS.length - 1)) * 100

  // Scroll content panel back to top whenever step changes
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [step])

  const finish = useCallback(() => {
    localStorage.setItem('datrix-tour-done', '1')
    onClose()
  }, [onClose])

  // Keyboard navigation: arrows to step, Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      if (e.key === 'ArrowRight' && step < STEPS.length - 1) setStep(s => s + 1)
      if (e.key === 'ArrowLeft' && step > 0) setStep(s => s - 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [step, finish])

  const handleGoTo = (route: string) => {
    finish()
    navigate(route)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        background: 'rgba(5,8,16,0.75)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={finish}
    >
      <div
        style={{
          width: '100%', maxWidth: 960,
          maxHeight: '90vh',
          background: 'var(--bg)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-card)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top progress bar */}
        <div style={{ height: 3, background: 'var(--border)', flexShrink: 0 }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'var(--accent)',
            transition: 'width 0.35s ease',
          }} />
        </div>

        {/* Body: left step list + right content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* Left step list */}
          <div style={{
            width: 228, flexShrink: 0,
            borderRight: '1px solid var(--border)',
            overflowY: 'auto',
            padding: '22px 14px 22px 16px',
            background: 'var(--bg-2)',
          }}>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--text-tertiary)', marginBottom: 18, paddingLeft: 8,
            }}>Platform guide</p>

            {STEPS.map((s, i) => {
              const isActive = i === step
              const isDone = i < step
              const isLast = i === STEPS.length - 1
              const SIcon = s.icon
              return (
                <div
                  key={s.id}
                  onClick={() => setStep(i)}
                  style={{ display: 'flex', gap: 10, cursor: 'pointer', userSelect: 'none' }}
                >
                  {/* Timeline column */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 26, flexShrink: 0 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isDone ? 'var(--green)' : isActive ? 'var(--accent)' : 'var(--bg-3)',
                      border: isDone || isActive ? 'none' : '1.5px solid var(--border)',
                      color: isDone ? '#fff' : isActive ? 'var(--text-on-accent)' : 'var(--text-tertiary)',
                      fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                      transition: 'background 0.2s, border-color 0.2s',
                    }}>
                      {isDone
                        ? <Check style={{ width: 12, height: 12 }} />
                        : <span>{i + 1}</span>
                      }
                    </div>
                    {!isLast && (
                      <div style={{
                        width: 1.5, flex: 1, minHeight: 10,
                        background: isDone ? 'rgba(52,211,153,0.4)' : 'var(--border)',
                        margin: '3px 0',
                        transition: 'background 0.2s',
                      }} />
                    )}
                  </div>

                  {/* Label column */}
                  <div style={{
                    paddingTop: 3,
                    paddingBottom: isLast ? 0 : 18,
                    minWidth: 0, flex: 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <SIcon style={{
                        width: 12, height: 12, flexShrink: 0,
                        color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                        transition: 'color 0.2s',
                      }} />
                      <p style={{
                        fontSize: 12.5, lineHeight: 1.3,
                        color: isActive ? 'var(--accent)' : isDone ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                        fontWeight: isActive ? 500 : 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontFamily: 'var(--font-sans)',
                        transition: 'color 0.2s',
                      }}>{s.label}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right content panel */}
          <div
            ref={contentRef}
            style={{ flex: 1, overflowY: 'auto', padding: '32px 40px 32px 36px' }}
          >
            <StepContent
              step={STEPS[step]}
              isLastStep={isLastStep}
              onGoTo={handleGoTo}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '13px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
          background: 'var(--bg-2)',
        }}>
          {/* Left: skip + counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={finish}
              style={{
                fontSize: 12.5, color: 'var(--text-tertiary)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', padding: '4px 0',
                transition: 'color 0.15s',
              }}
            >
              Skip tour
            </button>
            <span style={{
              fontSize: 11, color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
            }}>
              {step + 1} / {STEPS.length}
            </span>
          </div>

          {/* Right: back + next/done */}
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  padding: '7px 16px',
                  borderRadius: 'var(--radius-btn)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer', fontSize: 13,
                  fontFamily: 'var(--font-sans)',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
              >
                Back
              </button>
            )}
            {!isLastStep ? (
              <button
                onClick={() => setStep(s => s + 1)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 18px',
                  borderRadius: 'var(--radius-btn)',
                  background: 'var(--accent)',
                  color: 'var(--text-on-accent)',
                  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Next <ChevronRight style={{ width: 15, height: 15 }} />
              </button>
            ) : (
              <button
                onClick={finish}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 20px',
                  borderRadius: 'var(--radius-btn)',
                  background: 'var(--green)',
                  color: '#fff',
                  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <Check style={{ width: 14, height: 14 }} />
                Done — let's go
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
