import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  Database, GitBranch, Sparkles, Brain, BarChart3, ShieldCheck,
  ShoppingBag, Settings, ChevronRight, ChevronDown, Search,
  Terminal, AlertTriangle, CheckCircle, Info, Lightbulb,
  BookOpen, Zap, Code2, User, X,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────

interface Section {
  id: string
  label: string
  icon?: React.ReactNode
  children?: Section[]
}

// ── Nav tree ──────────────────────────────────────────────────────────

const NAV: Section[] = [
  {
    id: 'overview', label: 'Overview', icon: <BookOpen className="w-3.5 h-3.5" />,
    children: [
      { id: 'overview-what', label: 'What is Datrix?' },
      { id: 'overview-architecture', label: 'Architecture' },
      { id: 'overview-concepts', label: 'Core Concepts' },
    ],
  },
  {
    id: 'setup', label: 'Setup & Running', icon: <Terminal className="w-3.5 h-3.5" />,
    children: [
      { id: 'setup-requirements', label: 'Requirements' },
      { id: 'setup-install', label: 'Installation' },
      { id: 'setup-run', label: 'Running the App' },
      { id: 'setup-first-time', label: 'First-time Setup' },
    ],
  },
  {
    id: 'datasets', label: 'Datasets', icon: <Database className="w-3.5 h-3.5" />,
    children: [
      { id: 'datasets-upload', label: 'Uploading Data' },
      { id: 'datasets-scan', label: 'Quality Scans' },
      { id: 'datasets-columns', label: 'Column Explorer' },
      { id: 'datasets-cleaning', label: 'Cleaning Wizard' },
    ],
  },
  {
    id: 'pipelines', label: 'Pipelines', icon: <GitBranch className="w-3.5 h-3.5" />,
    children: [
      { id: 'pipelines-create', label: 'Creating a Pipeline' },
      { id: 'pipelines-steps', label: 'Step Reference' },
      { id: 'pipelines-run', label: 'Running & Dry-run' },
      { id: 'pipelines-export', label: 'Exporting Output' },
    ],
  },
  {
    id: 'synthetic', label: 'Synthetic Data', icon: <Sparkles className="w-3.5 h-3.5" />,
    children: [
      { id: 'synthetic-overview', label: 'How It Works' },
      { id: 'synthetic-methods', label: 'Generation Methods' },
      { id: 'synthetic-overrides', label: 'Column Overrides' },
      { id: 'synthetic-quality', label: 'Assessing Quality' },
    ],
  },
  {
    id: 'al', label: 'Active Learning', icon: <Brain className="w-3.5 h-3.5" />,
    children: [
      { id: 'al-concept', label: 'What is Active Learning?' },
      { id: 'al-session', label: 'Creating a Session' },
      { id: 'al-labeling', label: 'Labeling Batches' },
      { id: 'al-training', label: 'Training & Rounds' },
      { id: 'al-export', label: 'Exporting the Model' },
    ],
  },
  {
    id: 'benchmark', label: 'Benchmark', icon: <BarChart3 className="w-3.5 h-3.5" />,
    children: [
      { id: 'benchmark-overview', label: 'How It Works' },
      { id: 'benchmark-create', label: 'Creating a Job' },
      { id: 'benchmark-candidates', label: 'Candidates & Presets' },
      { id: 'benchmark-results', label: 'Reading Results' },
    ],
  },
  {
    id: 'compliance', label: 'Compliance Autopilot', icon: <ShieldCheck className="w-3.5 h-3.5" />,
    children: [
      { id: 'compliance-overview', label: 'Overview' },
      { id: 'compliance-dashboard', label: 'Dashboard' },
      { id: 'compliance-scanner', label: 'PII Scanner' },
      { id: 'compliance-lineage', label: 'Data Lineage' },
      { id: 'compliance-policies', label: 'Policies' },
      { id: 'compliance-anon', label: 'Anonymization' },
      { id: 'compliance-audit', label: 'Audit Log' },
      { id: 'compliance-reports', label: 'Reports' },
    ],
  },
  {
    id: 'marketplace', label: 'Marketplace', icon: <ShoppingBag className="w-3.5 h-3.5" />,
    children: [
      { id: 'marketplace-browse', label: 'Browsing & Installing' },
      { id: 'marketplace-publish', label: 'Publishing Assets' },
      { id: 'marketplace-reviews', label: 'Reviews & Ratings' },
    ],
  },
  {
    id: 'settings', label: 'Settings', icon: <Settings className="w-3.5 h-3.5" />,
    children: [
      { id: 'settings-general', label: 'General' },
      { id: 'settings-storage', label: 'Storage' },
      { id: 'settings-defaults', label: 'Module Defaults' },
      { id: 'settings-danger', label: 'Danger Zone' },
    ],
  },
]

// ── Callout components ─────────────────────────────────────────────────

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 my-4">
      <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-blue-200/90 leading-relaxed">{children}</div>
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-green-500/8 border border-green-500/20 rounded-xl p-4 my-4">
      <Lightbulb className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-green-200/90 leading-relaxed">{children}</div>
    </div>
  )
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-yellow-500/8 border border-yellow-500/20 rounded-xl p-4 my-4">
      <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-yellow-200/90 leading-relaxed">{children}</div>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <code className="inline-flex items-center px-1.5 py-0.5 rounded bg-surface-tertiary border border-border text-xs font-mono text-text-primary">{children}</code>
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="px-1.5 py-0.5 rounded bg-surface-tertiary border border-border text-xs font-mono text-brand">{children}</code>
}

function CodeBlock({ lang, children }: { lang?: string; children: string }) {
  return (
    <div className="my-4 rounded-xl overflow-hidden border border-border">
      {lang && (
        <div className="bg-surface-tertiary px-4 py-1.5 text-xs font-mono text-text-tertiary border-b border-border">{lang}</div>
      )}
      <pre className="bg-surface-secondary px-4 py-4 text-xs font-mono text-text-primary overflow-x-auto leading-relaxed whitespace-pre">{children}</pre>
    </div>
  )
}

function H1({ id, children }: { id: string; children: React.ReactNode }) {
  return <h1 id={id} className="text-2xl font-bold text-text-primary mt-2 mb-4 scroll-mt-6">{children}</h1>
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="text-lg font-semibold text-text-primary mt-10 mb-3 pb-2 border-b border-border scroll-mt-6">{children}</h2>
}

function H3({ id, children }: { id: string; children: React.ReactNode }) {
  return <h3 id={id} className="text-base font-semibold text-text-primary mt-6 mb-2 scroll-mt-6">{children}</h3>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-text-secondary leading-relaxed mb-3">{children}</p>
}

function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc list-outside ml-5 space-y-1.5 mb-4 text-sm text-text-secondary leading-relaxed">{children}</ul>
}

function OL({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal list-outside ml-5 space-y-1.5 mb-4 text-sm text-text-secondary leading-relaxed">{children}</ol>
}

function LI({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="my-4 border border-border rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface-tertiary border-b border-border">
            {headers.map(h => <th key={h} className="px-4 py-2.5 text-left font-semibold text-text-secondary">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={cn('border-b border-border last:border-0', i % 2 === 0 ? 'bg-surface-primary' : 'bg-surface-secondary')}>
              {row.map((cell, j) => <td key={j} className="px-4 py-2.5 text-text-secondary">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Divider() {
  return <div className="my-8 border-t border-border" />
}

// ── Content ────────────────────────────────────────────────────────────

function DocContent() {
  return (
    <div className="max-w-3xl">

      {/* ── OVERVIEW ── */}
      <H1 id="overview">Overview</H1>

      <H2 id="overview-what">What is Datrix?</H2>
      <P>
        Datrix is a self-hosted AI data infrastructure platform. It gives data scientists, ML engineers, and data teams
        a single place to prepare, transform, generate, label, benchmark, and govern datasets — without writing
        boilerplate code or stitching together a dozen separate tools.
      </P>
      <P>
        Think of it as a local-first data workspace: you upload raw CSV files, and Datrix handles everything from
        automatic quality scanning through to model training, compliance reporting, and a team marketplace — all
        through a browser UI backed by a Python API.
      </P>
      <P>Everything runs on your machine. No data leaves your network unless you push it yourself.</P>

      <H2 id="overview-architecture">Architecture</H2>
      <P>Datrix is a two-process application:</P>
      <Table
        headers={['Layer', 'Technology', 'Default Port', 'Responsibility']}
        rows={[
          ['Frontend', 'React 18 + Vite + Tailwind CSS v4', '5173', 'Browser UI — all pages, charts, wizards'],
          ['Backend', 'FastAPI + Python 3.10+', '8000', 'REST API, data processing, file I/O, ML jobs'],
          ['Data store', 'JSON flat file (db.json)', '—', 'All metadata, jobs, settings, audit events'],
          ['File storage', 'Local filesystem (data/ dir)', '—', 'Uploaded CSVs, generated files, model pickles'],
        ]}
      />
      <P>
        The frontend talks exclusively to the backend via <Code>/api/*</Code> endpoints. Long-running jobs (scans,
        training, anonymization) are started in background Python threads and polled by the UI every 1–3 seconds via
        TanStack Query.
      </P>

      <H2 id="overview-concepts">Core Concepts</H2>
      <Table
        headers={['Concept', 'What it means']}
        rows={[
          ['Dataset', 'An uploaded CSV file. Everything in Datrix is anchored to a dataset.'],
          ['Quality Scan', 'An automated analysis of a dataset\'s completeness, consistency, accuracy, and distribution.'],
          ['Pipeline', 'A saved sequence of transformation steps (filter, fill, encode, etc.) that can be replayed on any dataset.'],
          ['Synthetic Job', 'A request to generate a statistically similar but artificial copy of a dataset using a chosen ML method.'],
          ['AL Session', 'An Active Learning loop: you label small batches of rows, the model learns, and the loop keeps asking you for the most uncertain examples.'],
          ['Benchmark Job', 'A side-by-side comparison of multiple ML models on the same dataset and eval protocol.'],
          ['Compliance Scan', 'A PII detection pass over a dataset\'s column names and sample values.'],
          ['Policy', 'A rule that Datrix evaluates against your data assets and flags as a violation when broken.'],
          ['Audit Event', 'An append-only record of every significant action (scan, train, anonymize, policy change, etc.).'],
          ['Marketplace Asset', 'A dataset, pipeline, model, or benchmark config that has been published to the shared marketplace.'],
        ]}
      />

      <Divider />

      {/* ── SETUP ── */}
      <H1 id="setup">Setup & Running</H1>

      <H2 id="setup-requirements">Requirements</H2>
      <Table
        headers={['Requirement', 'Minimum', 'Notes']}
        rows={[
          ['Python', '3.10', 'pyenv or system install; 3.11+ recommended'],
          ['Node.js', '18', 'npm 9+ included'],
          ['RAM', '4 GB', '8 GB recommended for CTGAN/TVAE synthetic jobs'],
          ['Disk', '2 GB free', 'For uploads, models, generated datasets'],
          ['OS', 'Windows / macOS / Linux', 'All supported'],
        ]}
      />

      <H2 id="setup-install">Installation</H2>
      <P>Clone or download the repository, then install dependencies for each layer:</P>
      <CodeBlock lang="bash">{`# Backend
cd backend
python -m venv .venv
# Windows:
.venv\\Scripts\\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt`}</CodeBlock>

      <P>If <Code>requirements.txt</Code> is missing, install the core packages manually:</P>
      <CodeBlock lang="bash">{`pip install fastapi uvicorn[standard] polars pandas scikit-learn \\
            xgboost ctgan sdv faker psutil`}</CodeBlock>

      <CodeBlock lang="bash">{`# Frontend (separate terminal)
cd frontend
npm install`}</CodeBlock>

      <H2 id="setup-run">Running the App</H2>
      <P>You need two terminals open simultaneously — one for the backend, one for the frontend.</P>
      <CodeBlock lang="bash">{`# Terminal 1 — Backend API
cd backend
uvicorn app.main:app --reload --port 8000`}</CodeBlock>
      <CodeBlock lang="bash">{`# Terminal 2 — Frontend dev server
cd frontend
npm run dev`}</CodeBlock>
      <P>Open <Code>http://localhost:5173</Code> in your browser.</P>
      <Note>
        <strong>--reload</strong> watches Python files and hot-reloads on change. Remove it in production.
        The frontend dev server similarly hot-reloads on file changes via Vite HMR.
      </Note>

      <H2 id="setup-first-time">First-time Setup</H2>
      <P>On first startup the backend automatically:</P>
      <UL>
        <LI>Creates the <Code>backend/data/</Code> directory for file storage</LI>
        <LI>Creates <Code>backend/data/db.json</Code> with empty collections</LI>
        <LI>Seeds the Marketplace with ~15 sample datasets, pipelines, and models</LI>
        <LI>Seeds 8 default compliance policies (PII scan required, no PII in training, etc.)</LI>
      </UL>
      <P>You don't need to run any migrations or create a database. Just start and go.</P>
      <Tip>
        To reset everything to a clean state, go to <strong>Settings → Danger Zone → Clear database</strong>.
        This wipes <Code>db.json</Code> and re-seeds defaults on the next restart.
      </Tip>

      <Divider />

      {/* ── DATASETS ── */}
      <H1 id="datasets">Datasets</H1>
      <P>
        Datasets are the foundational unit in Datrix. Every other feature — pipelines, synthetic generation,
        active learning, benchmarking, compliance — operates on datasets. A dataset is a CSV file you upload,
        plus all the metadata, scans, and derived assets Datrix generates from it.
      </P>

      <H2 id="datasets-upload">Uploading Data</H2>
      <P><strong>Practical steps:</strong></P>
      <OL>
        <LI>Click <strong>Datasets</strong> in the left sidebar.</LI>
        <LI>Drag and drop a CSV file onto the upload zone, or click <strong>Upload CSV</strong> and pick a file.</LI>
        <LI>A progress bar shows upload completion. Once uploaded, the dataset card appears with status <Code>ingesting</Code>.</LI>
        <LI>Within a few seconds the backend parses the file with Polars, detects column types, and transitions the dataset to <Code>ready</Code>.</LI>
        <LI>The dataset card shows row count, column count, and file size.</LI>
      </OL>
      <P><strong>Technical detail:</strong></P>
      <P>
        The frontend sends a multipart <Code>POST /api/datasets/upload</Code> via XHR (not fetch) so it can track
        upload progress. The backend writes the file to <Code>data/uploads/&lt;uuid&gt;.csv</Code>, uses Polars to
        scan schema and row count, then stores the Dataset record in db.json. Column type inference is done by Polars
        — it correctly handles integers, floats, booleans, dates, and strings.
      </P>
      <Note>
        Only CSV files are accepted. Max file size is configured in <strong>Settings → Storage → Max upload size</strong> (default 200 MB).
      </Note>
      <Table
        headers={['Status', 'Meaning']}
        rows={[
          [<Code>pending</Code>, 'File received, processing not started yet'],
          [<Code>ingesting</Code>, 'Backend is parsing the file and extracting schema'],
          [<Code>scanning</Code>, 'Quality scan is running'],
          [<Code>ready</Code>, 'Fully processed and ready to use'],
          [<Code>error</Code>, 'Something went wrong — hover the card for the error message'],
        ]}
      />

      <H2 id="datasets-scan">Quality Scans</H2>
      <P>
        A quality scan is a multi-dimensional automated analysis of your dataset. Click <strong>Scan</strong> on any
        dataset card, or open a dataset and click <strong>Run Scan</strong> in the detail view. Scans run in the
        background and typically complete in 1–10 seconds depending on dataset size.
      </P>
      <P><strong>What gets measured:</strong></P>
      <Table
        headers={['Dimension', 'What it checks', 'Score weight']}
        rows={[
          ['Completeness', 'Null rate per column — how much data is missing', '25%'],
          ['Consistency', 'Type violations, mixed types, format inconsistencies', '25%'],
          ['Accuracy', 'Outliers, impossible values (e.g. age = -5), duplicates', '25%'],
          ['Distribution', 'Class imbalance, skew, low-cardinality numeric columns', '15%'],
          ['Label quality', 'If a labeled column is detected: noise, near-duplicate label conflicts', '10%'],
        ]}
      />
      <P>
        Each dimension gets a 0–100 score. The overall score is a weighted average. Issues are surfaced as
        individual cards with severity (critical / warning / info), affected row count, and affected percentage.
      </P>
      <Tip>
        Click on a specific issue to jump straight to the Cleaning Wizard pre-loaded with that fix.
      </Tip>

      <H2 id="datasets-columns">Column Explorer</H2>
      <P>
        Open a dataset detail page and click the <strong>Columns</strong> tab. Each column has its own panel showing:
      </P>
      <UL>
        <LI><strong>Data type</strong> (inferred by Polars: Int64, Float64, Utf8, Boolean, Date, etc.)</LI>
        <LI><strong>Null rate</strong> — percentage of missing values as a horizontal bar</LI>
        <LI><strong>Unique count</strong> — cardinality of the column</LI>
        <LI><strong>Quality score</strong> — column-level aggregate</LI>
        <LI><strong>Distribution chart</strong> — bar chart of value frequencies (top 10 for strings, bucketed for numerics)</LI>
        <LI><strong>Stats</strong> — min, max, mean, std, p25, p50, p75 for numeric columns</LI>
        <LI><strong>Issues</strong> — any quality issues specific to this column</LI>
      </UL>

      <H2 id="datasets-cleaning">Cleaning Wizard</H2>
      <P>
        The Cleaning Wizard applies automated fixes to your dataset in-place. Open a dataset, go to the
        <strong> Issues</strong> tab, and click <strong>Fix</strong> on any issue (or select multiple and click
        <strong> Fix selected</strong>).
      </P>
      <P><strong>Fix types:</strong></P>
      <Table
        headers={['Fix type', 'What it does', 'When to use']}
        rows={[
          ['fill_nulls_mean', 'Replaces nulls in a numeric column with the column mean', 'Numeric columns with random missing data'],
          ['fill_nulls_median', 'Replaces nulls with median (more robust to outliers)', 'Numeric columns with skew or outliers'],
          ['fill_nulls_mode', 'Replaces nulls with the most frequent value', 'Categorical columns'],
          ['fill_nulls_constant', 'Replaces nulls with a constant you specify', 'Known default values'],
          ['drop_duplicates', 'Removes exact duplicate rows', 'Any duplicate detection issue'],
          ['clip_outliers', 'Clips values outside ±3 standard deviations to the boundary', 'Numeric outlier issues'],
          ['cast_type', 'Attempts to recast a column to the correct type', 'Type inconsistency issues'],
        ]}
      />
      <P>
        Before applying, click <strong>Preview</strong> to see a sample of what will change. Fixes are recorded
        in the dataset's change history and can be rolled back individually from the <strong>Changes</strong> tab.
      </P>
      <Warn>
        Fixes modify the underlying CSV on disk. They are reversible via rollback, but rollback re-reads
        the original snapshot stored at fix time. If you've applied many fixes, rolling back an early one
        will restore the state from before that specific fix — not undo all subsequent ones.
      </Warn>

      <Divider />

      {/* ── PIPELINES ── */}
      <H1 id="pipelines">Pipelines</H1>
      <P>
        A Pipeline is a reusable, ordered sequence of data transformation steps. You build it once
        visually, then run it on any dataset. The output is a new CSV file (or Parquet/JSON) that you
        can download or feed into other Datrix features.
      </P>

      <H2 id="pipelines-create">Creating a Pipeline</H2>
      <OL>
        <LI>Go to <strong>Pipelines</strong> → click <strong>New pipeline</strong>.</LI>
        <LI>Give it a name and (optionally) select a source dataset. The dataset can be changed later.</LI>
        <LI>In the Pipeline Editor, use the <strong>Add step</strong> button (bottom of the step list or the + button in the node graph) to add transformation steps.</LI>
        <LI>Configure each step in the panel that appears on the right.</LI>
        <LI>Steps are connected visually in the node graph — drag nodes to rearrange the layout (layout is cosmetic; execution order follows the list order).</LI>
        <LI>Click <strong>Save</strong> to persist the pipeline. Status changes to <Code>ready</Code>.</LI>
      </OL>
      <Tip>
        You can build a pipeline without any dataset attached — attach one at run time. This makes pipelines reusable across multiple datasets with the same schema.
      </Tip>

      <H2 id="pipelines-steps">Step Reference</H2>
      <Table
        headers={['Step type', 'What it does', 'Key config options']}
        rows={[
          ['filter', 'Keep only rows matching a condition', 'column, operator (==, !=, >, <, >=, <=, contains, not_null), value'],
          ['select_columns', 'Keep only the specified columns', 'columns: list of column names to keep'],
          ['drop_columns', 'Remove specified columns', 'columns: list of column names to drop'],
          ['rename_column', 'Rename a single column', 'old_name, new_name'],
          ['fill_nulls', 'Fill missing values in a column', 'column, strategy: mean / median / mode / constant, value (if constant)'],
          ['deduplicate', 'Remove duplicate rows', 'subset: columns to consider (empty = all columns); keep: first / last'],
          ['lowercase', 'Lowercase all string values in a column', 'column'],
          ['normalize', 'Scale a numeric column to 0–1 or z-score', 'column, method: minmax / zscore'],
          ['encode_categorical', 'One-hot or label-encode a categorical column', 'column, method: onehot / label'],
          ['sort', 'Sort the dataset by one or more columns', 'columns: list, ascending: true/false'],
        ]}
      />
      <P><strong>Technical note:</strong> All steps are executed in order by the backend using Polars LazyFrame operations. Each step transforms the frame in memory; nothing is written to disk until the entire pipeline succeeds. If any step fails, the run is marked <Code>failed</Code> and the original dataset is untouched.</P>

      <H2 id="pipelines-run">Running & Dry-run</H2>
      <P>
        In the Pipeline Editor, click <strong>Run</strong> to open the run dialog. Choose:
      </P>
      <UL>
        <LI><strong>Dry-run</strong> — executes all steps but does not write output. Returns a preview of the first 20 rows of the result. Use this to verify your pipeline before committing.</LI>
        <LI><strong>Full run</strong> — executes all steps and writes the output file. Returns row/column counts before and after each step.</LI>
      </UL>
      <P>
        After a run, the <strong>Runs</strong> tab shows every historical run with per-step statistics:
        rows in / rows out / columns in / columns out for each step, making it easy to see where data is being
        filtered or transformed.
      </P>

      <H2 id="pipelines-export">Exporting Output</H2>
      <P>
        After a successful full run, click <strong>Download</strong> next to any completed run to download the
        output file. Supported output formats: <Code>csv</Code>, <Code>parquet</Code>, <Code>json</Code> —
        configured via the output format selector in the run dialog or in
        <strong> Settings → Pipelines & Export</strong>.
      </P>
      <Note>
        Output files are stored at <Code>data/pipeline_outputs/</Code> on the backend. They are not automatically
        cleaned up. Use <strong>Settings → Storage → Clear uploads</strong> to reclaim disk space (this clears
        uploaded CSVs; pipeline outputs have a separate cleanup path).
      </Note>

      <Divider />

      {/* ── SYNTHETIC ── */}
      <H1 id="synthetic">Synthetic Data</H1>
      <P>
        Synthetic data generation creates statistically faithful artificial datasets that mirror the structure
        and distributions of your original data without containing any real records. Useful for sharing data
        externally, augmenting small datasets, and testing ML pipelines without exposing sensitive values.
      </P>

      <H2 id="synthetic-overview">How It Works</H2>
      <P>
        Go to <strong>Synthetic</strong> → <strong>New job</strong>. Select a source dataset, a generation method,
        the number of rows to generate, and any column overrides. Click <strong>Start</strong>.
      </P>
      <P>
        The backend trains a generative model (or fits a statistical profile) on your dataset, then samples
        from it to produce the requested row count. The output appears as a new Dataset in your Datasets list,
        ready to use in pipelines, active learning, and benchmarking.
      </P>

      <H2 id="synthetic-methods">Generation Methods</H2>
      <Table
        headers={['Method', 'Algorithm', 'Best for', 'Speed', 'Fidelity']}
        rows={[
          ['statistical', 'Per-column distribution fitting (normal, log-normal, uniform, beta, categorical frequency)', 'Quick generation, simple tabular data, no complex correlations', 'Very fast (seconds)', 'Good for marginals, poor for correlations'],
          ['ctgan', 'Conditional Tabular GAN (deep learning)', 'Complex datasets with correlations, mixed types, imbalanced categories', 'Slow (minutes, GPU helps)', 'Excellent'],
          ['tvae', 'Tabular Variational Autoencoder', 'Datasets where mode collapse is a concern with GAN', 'Slow (minutes)', 'Excellent'],
        ]}
      />
      <Warn>
        CTGAN and TVAE require significant memory and CPU. On datasets over 50,000 rows, training can take
        5–15 minutes. The UI polls job status every 2 seconds and shows a live progress indicator.
      </Warn>

      <H2 id="synthetic-overrides">Column Overrides</H2>
      <P>
        In the <strong>Column Overrides</strong> panel, you can fine-tune generation per column:
      </P>
      <Table
        headers={['Override', 'Effect']}
        rows={[
          ['null_rate (0–1)', 'Inject a specific proportion of null values into this column in the output'],
          ['distribution', 'Force a specific distribution (normal, log_normal, uniform, beta) overriding what was inferred'],
          ['min / max', 'Clip generated numeric values to this range'],
          ['class_weights', 'For categorical columns: a JSON map of {value: weight} to control how often each category appears'],
        ]}
      />

      <H2 id="synthetic-quality">Assessing Quality</H2>
      <P>
        After a synthetic job completes, run a Quality Scan on the generated dataset (navigate to Datasets, find
        the synthetic output, hit Scan). Compare its quality report to the source dataset's report.
        Key things to check:
      </P>
      <UL>
        <LI>Distribution dimension score should be similar or better (synthetic data often has better balance)</LI>
        <LI>Completeness score should match your configured null rates</LI>
        <LI>If using CTGAN/TVAE, run a benchmark comparing a model trained on synthetic vs real data — accuracy gap should be &lt;5% for good fidelity</LI>
      </UL>

      <Divider />

      {/* ── ACTIVE LEARNING ── */}
      <H1 id="al">Active Learning</H1>
      <P>
        Active Learning (AL) lets you train a classification or regression model with as few human labels
        as possible. Instead of labeling the entire dataset upfront, Datrix trains on a small seed set,
        then identifies the rows it is most uncertain about and asks you to label only those — achieving
        high accuracy with far fewer labels than random sampling.
      </P>

      <H2 id="al-concept">What is Active Learning?</H2>
      <P>
        Traditional supervised learning: label everything, train once. Active Learning: label a little,
        train, find uncertain examples, label those, train again — and repeat. The model focuses your
        labeling effort on the examples that will teach it the most.
      </P>
      <P>
        Datrix implements pool-based active learning with six sampling strategies:
      </P>
      <Table
        headers={['Strategy', 'How it picks the next batch', 'Best for']}
        rows={[
          ['random', 'Random sample from unlabeled pool', 'Baseline; simplest'],
          ['least_confidence', 'Picks rows where max class probability is lowest', 'Classification tasks'],
          ['margin', 'Picks rows where gap between top-2 class probabilities is smallest', 'Multi-class classification'],
          ['entropy', 'Picks rows with highest prediction entropy across all classes', 'Multi-class with many labels'],
          ['coreset', 'Picks rows whose feature vectors are most different from already-labeled rows (greedy k-center)', 'Diverse coverage of feature space'],
          ['committee', 'Trains multiple models with different random seeds; picks rows where they disagree most', 'Robust uncertainty; slowest per round'],
        ]}
      />

      <H2 id="al-session">Creating a Session</H2>
      <OL>
        <LI>Go to <strong>Active Learning</strong> → <strong>New session</strong>.</LI>
        <LI>Select the source dataset.</LI>
        <LI>Pick the <strong>target column</strong> — the column you want to predict.</LI>
        <LI>Choose <strong>task type</strong>: classification (discrete labels) or regression (continuous values).</LI>
        <LI>Choose a <strong>model type</strong>: Logistic Regression, Random Forest, XGBoost, SVM, or MLP.</LI>
        <LI>Choose a <strong>sampling strategy</strong> (see table above).</LI>
        <LI>Set <strong>batch size</strong> — how many rows to show per labeling round (10–100 is typical).</LI>
        <LI>Enter the <strong>label classes</strong> for classification (e.g. <Code>yes, no</Code> or <Code>cat, dog, bird</Code>). Leave empty for regression.</LI>
        <LI>Optionally: set columns to exclude from training features, set a target accuracy to stop at, set max rounds.</LI>
        <LI>Click <strong>Create</strong>. The backend seeds the first batch immediately.</LI>
      </OL>

      <H2 id="al-labeling">Labeling Batches</H2>
      <P>
        Once the session is created, the Labeling panel shows the current batch of rows. For each row:
      </P>
      <UL>
        <LI>For <strong>classification</strong>: click the correct label button under each row.</LI>
        <LI>For <strong>regression</strong>: type the numeric value in the input field.</LI>
      </UL>
      <P>
        Label all rows in the batch, then click <strong>Submit labels</strong>. The backend records your
        labels, retrains the model, evaluates on the labeled set, and immediately seeds the next batch using
        the uncertainty strategy. The Learning Curve chart updates after each round.
      </P>
      <Tip>
        You don't have to label all rows in a batch to submit. Skip a row if you're genuinely uncertain —
        the model will likely surface it again in a future round if it's important.
      </Tip>

      <H2 id="al-training">Training & Rounds</H2>
      <P>
        After each label submission the backend:
      </P>
      <OL>
        <LI>Merges your new labels with all previous labels.</LI>
        <LI>Re-trains the selected model from scratch on the full labeled set.</LI>
        <LI>Evaluates on the labeled set (accuracy, F1, confusion matrix for classification; RMSE, R² for regression).</LI>
        <LI>Computes feature importances.</LI>
        <LI>Queries the unlabeled pool using the sampling strategy to build the next batch.</LI>
        <LI>Records all metrics in the round history.</LI>
      </OL>
      <P>
        The <strong>Rounds</strong> tab shows a learning curve — accuracy (or R²) vs. number of labeled examples.
        A steep initial rise that flattens means the model is learning efficiently. If the curve is flat from
        round 1, try a more complex model or a different sampling strategy.
      </P>
      <P>
        The session ends when you click <strong>Stop</strong>, when the target accuracy is reached, or when
        max rounds is hit.
      </P>

      <H2 id="al-export">Exporting the Model</H2>
      <P>After stopping a session:</P>
      <UL>
        <LI><strong>Export model</strong> — downloads a <Code>.pkl</Code> scikit-learn pipeline (preprocessing + model).</LI>
        <LI><strong>Export labels</strong> — downloads a CSV of all labeled rows with their assigned labels.</LI>
        <LI><strong>Predict</strong> — runs the trained model on all unlabeled rows and saves predictions back to the dataset as a new column.</LI>
        <LI><strong>Rename model</strong> — give the exported model a human-readable name so it shows up meaningfully in the Marketplace and Benchmark.</LI>
      </UL>

      <Divider />

      {/* ── BENCHMARK ── */}
      <H1 id="benchmark">Benchmark</H1>
      <P>
        The Benchmark module runs a structured side-by-side comparison of multiple ML models on the same
        dataset. Unlike one-off training, it enforces a consistent evaluation protocol and produces a ranked
        leaderboard with detailed per-model breakdowns.
      </P>

      <H2 id="benchmark-overview">How It Works</H2>
      <P>
        You define a Benchmark Job: dataset, target column, evaluation protocol, and a list of candidates
        (each candidate is a model type + preset + optional pre-trained AL model). The backend trains every
        candidate under the same conditions and computes a full suite of metrics for each.
      </P>

      <H2 id="benchmark-create">Creating a Job</H2>
      <OL>
        <LI>Go to <strong>Benchmark</strong> → <strong>New benchmark</strong>.</LI>
        <LI>Select the source dataset and target column.</LI>
        <LI>Pick task type (classification / regression).</LI>
        <LI>Choose an evaluation protocol (see below).</LI>
        <LI>Add candidates — each is a model type + preset combination. You can also import a pre-trained AL session model as a candidate to compare against fresh-trained baselines.</LI>
        <LI>Click <strong>Run benchmark</strong>. All candidates train in parallel threads.</LI>
      </OL>

      <H2 id="benchmark-candidates">Candidates & Presets</H2>
      <Table
        headers={['Eval Protocol', 'What it does']}
        rows={[
          ['kfold_5', '5-fold cross-validation — dataset split into 5 folds, model trained 5 times, metrics averaged'],
          ['kfold_10', '10-fold cross-validation — more robust, slower'],
          ['holdout_80', '80/20 train/test split — fast, good for large datasets'],
          ['holdout_90', '90/10 train/test split — less test data, higher variance in metrics'],
        ]}
      />
      <Table
        headers={['Preset', 'Hyperparameter strategy']}
        rows={[
          ['default', 'Scikit-learn default hyperparameters — fast, good baseline'],
          ['tuned', 'Sensible hand-tuned hyperparameters for each model type'],
          ['grid_search', 'Exhaustive grid search over a predefined parameter grid — slowest, best results'],
        ]}
      />

      <H2 id="benchmark-results">Reading Results</H2>
      <P>Once all candidates complete, the Results tab shows:</P>
      <UL>
        <LI><strong>Leaderboard</strong> — ranked table with primary metric (accuracy for classification, RMSE for regression), training time, and a winner crown icon.</LI>
        <LI><strong>Metric detail</strong> — click any candidate to expand its full metric set: accuracy, precision, recall, F1, ROC-AUC (classification) or RMSE, MAE, R² (regression).</LI>
        <LI><strong>Confusion matrix</strong> — for classification candidates.</LI>
        <LI><strong>Learning curve</strong> — train vs. validation score as training set size grows (detects overfitting).</LI>
        <LI><strong>Feature importances</strong> — ranked bar chart of which columns matter most.</LI>
      </UL>
      <Tip>
        Use the Benchmark to validate that a synthetic dataset trained a model as well as the real one:
        add one candidate using the real dataset and one using the synthetic — compare their metrics.
      </Tip>

      <Divider />

      {/* ── COMPLIANCE ── */}
      <H1 id="compliance">Compliance Autopilot</H1>
      <P>
        Compliance Autopilot is Datrix's data governance layer. It automatically scans for personally
        identifiable information (PII), tracks data lineage, enforces configurable policies, provides
        anonymization tools, maintains a tamper-evident audit log, and generates compliance reports for
        major frameworks (GDPR, CCPA, HIPAA).
      </P>

      <H2 id="compliance-overview">Overview</H2>
      <P>
        Navigate to <strong>Compliance</strong> in the sidebar. A sub-navigation on the left provides
        access to 7 sections. Each section has a colored health dot:
      </P>
      <UL>
        <LI><strong>Green dot</strong> — section is healthy (no violations, no unscanned datasets, etc.)</LI>
        <LI><strong>Yellow dot</strong> — attention needed (e.g. unscanned datasets in Scanner)</LI>
        <LI><strong>Red dot</strong> — active issue (e.g. policy violations in Policies)</LI>
      </UL>

      <H2 id="compliance-dashboard">Dashboard</H2>
      <P>The Dashboard gives a real-time posture summary:</P>
      <UL>
        <LI>
          <strong>Risk Gauge</strong> — a semicircle SVG arc showing the overall risk score (0–100) and
          letter grade (A through F). Score is computed from four weighted components:
          PII Exposure (40%), Policy Failures (30%), Scan Coverage (20%), Data Freshness (10%).
        </LI>
        <LI><strong>KPI cards</strong> — active violations, unscanned datasets, PII columns found, audit events in last 7 days.</LI>
        <LI><strong>Risk breakdown</strong> — per-component bar showing what's driving your score up.</LI>
        <LI><strong>Recent violations feed</strong> — the latest policy violations with entity names and severities.</LI>
        <LI><strong>Dataset coverage grid</strong> — every dataset color-coded by PII risk level.</LI>
      </UL>
      <P><strong>Quick action buttons:</strong></P>
      <UL>
        <LI><strong>Scan all datasets</strong> — triggers a PII scan on every dataset in parallel.</LI>
        <LI><strong>Evaluate all policies</strong> — runs all enabled policies against current data state and refreshes violations.</LI>
        <LI><strong>Generate report</strong> — jumps to the Reports section.</LI>
      </UL>

      <H2 id="compliance-scanner">PII Scanner</H2>
      <P>
        The PII Scanner finds columns that likely contain personal data. It uses a two-pass approach:
      </P>
      <OL>
        <LI>
          <strong>Column name matching</strong> — 50+ keyword signals mapped to PII categories.
          E.g. a column named <Code>email_address</Code> immediately gets <Code>email</Code> category at 0.9 confidence.
          Detected categories include: email, phone, SSN, name, address, DOB, credit card, IP address, passport, NIN, IBAN, geolocation, and more.
        </LI>
        <LI>
          <strong>Value regex sampling</strong> — up to 500 rows are sampled and each non-null value is tested
          against 11 compiled patterns (email, phone, SSN, three credit card formats, IP, IBAN, zip code, date patterns).
          Confidence is boosted based on what fraction of sampled values match.
        </LI>
      </OL>
      <Table
        headers={['Risk level', 'Meaning', 'Action recommended']}
        rows={[
          ['critical', 'Column contains SSNs, credit card numbers, passport numbers, or equivalent high-risk PII', 'Hash or suppress before any use outside your org'],
          ['high', 'Email addresses, phone numbers, full names', 'Mask or pseudonymize before sharing'],
          ['medium', 'Dates of birth, partial addresses, ZIP codes', 'Generalize (e.g. year only, region only)'],
          ['low', 'Generic identifiers, indirect PII signals', 'Review; keep or generalize'],
          ['clean', 'No PII detected', 'No action needed'],
          ['unscanned', 'No scan has been run yet', 'Run a scan'],
        ]}
      />
      <P>
        Click any finding card to expand it and see: masked sample values, detection method, confidence bar,
        and <strong>suggested anonymization method chips</strong> — clicking one opens the Anonymization wizard
        pre-loaded with that dataset.
      </P>

      <H2 id="compliance-lineage">Data Lineage</H2>
      <P>
        The Lineage view shows a directed acyclic graph (DAG) of how data flows through your workspace.
        Nodes represent datasets, pipelines, pipeline runs, synthetic jobs, AL sessions, benchmark jobs,
        and marketplace assets. Edges show how one entity produced another.
      </P>
      <P><strong>Navigation controls:</strong></P>
      <UL>
        <LI><strong>+ / − / % buttons</strong> — zoom in, reset to 100%, zoom out</LI>
        <LI><strong>Fit</strong> — reset pan and zoom to show all nodes</LI>
        <LI><strong>Drag on canvas</strong> (not on a node) — pan</LI>
        <LI><strong>Type filter dropdown</strong> — filter to show only specific node types</LI>
        <LI><strong>Click a node</strong> — opens a detail panel on the right showing all metadata for that entity</LI>
      </UL>
      <P>
        Dataset nodes have a colored dot in the top-right corner indicating their PII risk level (red =
        critical, orange = high, yellow = medium).
      </P>
      <Note>
        Lineage is derived entirely from existing relationships in the store — no extra instrumentation needed.
        If you run a pipeline on a dataset, an edge appears. If you generate synthetic data from a dataset,
        an edge appears. It updates in real time as you use the platform.
      </Note>

      <H2 id="compliance-policies">Policies</H2>
      <P>
        Policies are configurable rules that Datrix evaluates against your data assets. When a policy is
        violated (e.g. a dataset was used in a pipeline without being scanned for PII), a violation is created.
      </P>
      <P><strong>8 default policies (auto-seeded on first start):</strong></P>
      <Table
        headers={['Policy', 'What it checks']}
        rows={[
          ['No PII in training', 'Datasets used in AL sessions must have clean or low PII risk'],
          ['PII scan required', 'Every dataset must have at least one completed PII scan'],
          ['Min quality score', 'Datasets used in training must have quality score ≥ threshold (default 60)'],
          ['Max retention days', 'Datasets must not be older than N days (configurable; disabled by default)'],
          ['Min row count for training', 'AL sessions and benchmarks must have ≥ N labeled/total rows'],
          ['No unscanned in pipeline', 'Pipelines cannot use datasets that haven\'t been PII-scanned'],
          ['Model accuracy floor', 'AL sessions that complete must have final accuracy ≥ threshold'],
          ['Benchmark winner required', 'Benchmark jobs must complete with a clear winner (not a tie)'],
        ]}
      />
      <P><strong>Managing policies:</strong></P>
      <UL>
        <LI><strong>Toggle switch</strong> — enable/disable a policy without deleting it.</LI>
        <LI><strong>Expand arrow</strong> — shows all active violations for that policy with entity names, messages, and a <strong>Resolve</strong> button to manually mark a violation as addressed.</LI>
        <LI><strong>Delete (trash icon)</strong> — permanently removes the policy and its violations.</LI>
        <LI><strong>New policy</strong> button — create a custom policy with a name, type, severity, and JSON parameters (e.g. <Code>{`{"threshold": 0.75}`}</Code> for a min quality score policy).</LI>
        <LI><strong>Evaluate all</strong> — re-runs all enabled policies against current data state. Always do this after uploading new data or completing training jobs.</LI>
      </UL>

      <H2 id="compliance-anon">Anonymization</H2>
      <P>
        The Anonymization wizard transforms a dataset's sensitive columns and produces a new anonymized
        dataset in your Datasets list. The original is never modified.
      </P>
      <P><strong>3-step wizard:</strong></P>
      <OL>
        <LI>
          <strong>Select dataset</strong> — pick the source. If a PII scan exists, a summary is shown.
          If no scan exists, you can still configure columns manually.
        </LI>
        <LI>
          <strong>Configure columns</strong> — a table of every column with a method dropdown.
          Click <strong>Auto-suggest from scan</strong> to pre-fill methods based on scan severity.
          Set the output dataset name.
        </LI>
        <LI>
          <strong>Review & generate</strong> — shows a summary card (total / transformed / suppressed columns),
          then click <strong>Generate</strong> to start the job.
        </LI>
      </OL>
      <Table
        headers={['Method', 'What it produces', 'Use when']}
        rows={[
          ['keep', 'Original value unchanged', 'Column is not sensitive'],
          ['suppress', 'Column is removed entirely from output', 'Column is always sensitive and never needed downstream'],
          ['redact', 'Value replaced with <Code>[REDACTED]</Code>', 'You need to know the column existed but not its value'],
          ['mask', 'Partial masking — e.g. <Code>j***@e***.com</Code> for email, last-4 digits for phone', 'Human-readable anonymization for reporting'],
          ['hash', 'SHA-256 of value, truncated to 16 hex chars', 'Consistent pseudonym that can\'t be reversed; useful for join keys'],
          ['generalize', 'Numeric buckets (e.g. 25 → 20–29) or top-N categories (rare values → "Other")', 'Reduce precision while preserving utility'],
          ['pseudonymize', 'Consistent fake identifier per unique value (e.g. ID-00001)', 'Maintain referential integrity across tables without exposing real IDs'],
        ]}
      />
      <Note>
        Pseudonymization is consistent within a single job — the same source value always maps to the same
        pseudonym. But across separate jobs, the mapping is regenerated. Store the mapping dict if you need
        to re-identify data later.
      </Note>

      <H2 id="compliance-audit">Audit Log</H2>
      <P>
        The Audit Log is an append-only record of every significant action in Datrix. It is automatically
        populated — no configuration needed.
      </P>
      <P><strong>What gets logged:</strong> dataset upload/delete, quality scans, cleaning fixes, pipeline runs,
      synthetic jobs, AL session events (create, label round, complete), benchmark jobs, compliance scans,
      policy evaluations, anonymization jobs, report generation, marketplace installs, and settings changes.
      </P>
      <P><strong>Filtering:</strong></P>
      <UL>
        <LI><strong>Category dropdown</strong> — filter by module: data, pipeline, ml, compliance, marketplace, settings.</LI>
        <LI><strong>Entity name search</strong> — full-text search on entity names.</LI>
        <LI><strong>Load more</strong> — pagination in batches of 50.</LI>
        <LI><strong>Export CSV</strong> — downloads all audit events as a CSV file (up to 10,000 rows).</LI>
      </UL>
      <P>Click any event row to expand its metadata JSON payload for full detail.</P>
      <P>
        <strong>Technical note:</strong> Events are stored in-order in <Code>db.json</Code> as a list and capped
        at 10,000 entries (oldest are evicted when the cap is reached). The export endpoint streams directly
        from the store without loading everything into memory.
      </P>

      <H2 id="compliance-reports">Reports</H2>
      <P>
        Reports produce a point-in-time snapshot of your compliance posture, formatted for a specific
        regulatory framework.
      </P>
      <P><strong>Frameworks:</strong></P>
      <Table
        headers={['Framework', 'Focus']}
        rows={[
          ['GDPR Article 30', 'Records of processing activities — data inventory, PII categories, purposes, retention'],
          ['CCPA Inventory', 'California Consumer Privacy Act — categories of personal info, business purpose, third-party sharing'],
          ['HIPAA Data Inventory', 'Health data — PHI identification, safeguards, risk assessment'],
          ['General Summary', 'Framework-agnostic overview suitable for internal audits or board reporting'],
          ['Custom', 'All sections included; no framework-specific framing'],
        ]}
      />
      <P><strong>Sections you can include in any report:</strong></P>
      <UL>
        <LI><strong>Dataset inventory</strong> — all datasets, sizes, statuses, row counts</LI>
        <LI><strong>PII findings</strong> — all columns with detected PII, risk levels, detection confidence</LI>
        <LI><strong>Policy status</strong> — all policies and their current violation counts</LI>
        <LI><strong>Lineage summary</strong> — node/edge counts and data flow description</LI>
        <LI><strong>Audit excerpt</strong> — the most recent 50 audit events</LI>
        <LI><strong>Recommendations</strong> — auto-generated action items based on current violations and risk score</LI>
      </UL>
      <P>
        Reports are generated synchronously (blocking) — typically takes 2–5 seconds. Output is a
        self-contained HTML file (with inline CSS, suitable for emailing or printing) and a structured
        JSON file for downstream processing.
      </P>
      <Tip>
        Schedule regular report generation after major data ingestion sessions. The HTML report is
        safe to email to stakeholders who don't have access to Datrix — it contains no raw data,
        only metadata and statistics.
      </Tip>

      <Divider />

      {/* ── MARKETPLACE ── */}
      <H1 id="marketplace">Marketplace</H1>
      <P>
        The Marketplace is a shared catalogue of datasets, pipelines, models, and benchmark configs
        that you and your team can publish, discover, and install. It's entirely local — nothing is
        sent to any external service.
      </P>

      <H2 id="marketplace-browse">Browsing & Installing</H2>
      <P>Go to <strong>Marketplace</strong>. The <strong>Browse</strong> tab shows all published assets.</P>
      <UL>
        <LI><strong>Search bar</strong> — full-text search on titles, descriptions, tags.</LI>
        <LI><strong>Type filter</strong> — Dataset / Pipeline / Model / Benchmark Config.</LI>
        <LI><strong>Category filter</strong> — domain-specific categories (ecommerce, finance, healthcare, etc.).</LI>
        <LI><strong>Sort</strong> — Newest, Most popular (installs), Highest rated, Trending.</LI>
      </UL>
      <P>Click any asset card to open the detail drawer:</P>
      <UL>
        <LI>Datasets show a <strong>preview table</strong> of the first rows.</LI>
        <LI>Pipelines show the list of steps.</LI>
        <LI>Models show their training metrics.</LI>
        <LI>All assets show description, tags, license, version, author, download count, and star rating.</LI>
      </UL>
      <P>
        Click <strong>Install</strong> in the drawer. The asset is deep-copied into your workspace:
        datasets become new Dataset records, pipelines become new Pipeline records, models become
        new AL sessions, benchmark configs become new Benchmark jobs ready to run.
      </P>
      <P>The <strong>Featured</strong> tab shows curated picks. <strong>Install History</strong> shows every asset you've previously installed with links to the resulting records.</P>

      <H2 id="marketplace-publish">Publishing Assets</H2>
      <P>Click <strong>Publish asset</strong> in the top-right of the Browse tab. A 3-step wizard:</P>
      <OL>
        <LI><strong>Select source</strong> — pick an existing asset from your workspace (a dataset, pipeline, AL session, or benchmark job) to publish.</LI>
        <LI><strong>Metadata</strong> — fill in title, description, long description, category, tags, author name, license, and version.</LI>
        <LI><strong>Review & publish</strong> — review all details, then click Publish. The asset is immediately visible in Browse.</LI>
      </OL>
      <P>
        Your published assets appear in the <strong>My Listings</strong> tab. From there you can edit
        metadata (title, description, tags, version) or delete the listing.
      </P>
      <Note>
        Publishing does not copy files — it creates a marketplace record pointing to the source asset.
        If you delete the source dataset, the marketplace listing will still exist but installs will fail.
        Delete the listing first via My Listings, then delete the dataset.
      </Note>

      <H2 id="marketplace-reviews">Reviews & Ratings</H2>
      <P>
        At the bottom of any asset detail drawer, the <strong>Reviews</strong> section shows star ratings
        and comments from other users. Click <strong>Write a review</strong> to expand the form:
        enter your name, click a star rating (1–5), and optionally add a comment. Submit to post.
        The asset's average rating updates immediately.
      </P>

      <Divider />

      {/* ── SETTINGS ── */}
      <H1 id="settings">Settings</H1>
      <P>
        The Settings page configures global defaults that apply across all modules. Changes take effect
        immediately — a <strong>Save changes</strong> bar floats up at the bottom whenever you have
        unsaved edits. Changes are stored in <Code>db.json</Code> under the <Code>settings</Code> key.
      </P>

      <H2 id="settings-general">General</H2>
      <Table
        headers={['Setting', 'Effect']}
        rows={[
          ['Application name', 'The name shown in the browser title and header (cosmetic only)'],
          ['Date format', 'How dates are displayed across the app (ISO, US, EU)'],
          ['Table page size', 'Default number of rows shown in paginated tables (10 / 25 / 50 / 100)'],
        ]}
      />

      <H2 id="settings-storage">Storage</H2>
      <P>The Storage section shows a live disk usage visualizer: a stacked color bar showing uploads (blue), models (purple), and database (orange) — with percentages and a disk-free bar below.</P>
      <Table
        headers={['Setting', 'Effect']}
        rows={[
          ['Max upload size (MB)', 'Maximum allowed size for a single uploaded CSV (enforced on the backend)'],
          ['Allowed file extensions', 'Comma-separated list of accepted extensions (default: .csv)'],
        ]}
      />

      <H2 id="settings-defaults">Module Defaults</H2>
      <P>
        These settings pre-fill the corresponding fields when you create new jobs, so you don't have to
        re-enter the same values every time:
      </P>
      <Table
        headers={['Section', 'Settings available']}
        rows={[
          ['Active Learning', 'Default batch size, model type, sampling strategy, max rounds, target accuracy'],
          ['Benchmark', 'Default eval protocol, preset, task type'],
          ['Synthetic Data', 'Default generation method, default row count'],
          ['Pipelines & Export', 'Default pipeline output format (CSV / Parquet / JSON)'],
        ]}
      />

      <H2 id="settings-danger">Danger Zone</H2>
      <Warn>
        All Danger Zone actions are irreversible (or difficult to reverse). Each requires a browser
        <Code>confirm()</Code> dialog to proceed.
      </Warn>
      <Table
        headers={['Action', 'What it does', 'Recovery']}
        rows={[
          ['Reset settings', 'Restores all settings to their factory defaults', 'Re-enter your preferences'],
          ['Clear uploads', 'Deletes all uploaded CSV files from disk and marks datasets as errored', 'Re-upload files'],
          ['Clear database', 'Deletes db.json entirely and recreates it empty with default seeds on next restart', 'Cannot be undone — all history, labels, jobs, scans, and audit events are lost'],
        ]}
      />

      <Divider />

      {/* ── Technical reference ── */}
      <H1 id="technical">Technical Reference</H1>

      <H2 id="technical-api">Backend API</H2>
      <P>
        The FastAPI backend serves an OpenAPI spec at <Code>http://localhost:8000/docs</Code> (Swagger UI)
        and <Code>http://localhost:8000/redoc</Code> (ReDoc). All endpoints are documented with schemas,
        examples, and response types.
      </P>
      <P>Base URL for all endpoints: <Code>http://localhost:8000/api</Code></P>
      <Table
        headers={['Router prefix', 'Module', 'Key endpoints']}
        rows={[
          ['/datasets', 'Datasets', 'POST /upload, GET /:id, DELETE /:id, POST /:id/scan, GET /:id/columns'],
          ['/pipelines', 'Pipelines', 'POST /, PUT /:id, POST /:id/run, GET /:id/runs, GET /runs/:id/download'],
          ['/synthetic', 'Synthetic', 'POST /jobs, GET /jobs/:id, GET /models'],
          ['/al', 'Active Learning', 'POST /sessions, GET /sessions/:id/batch, POST /sessions/:id/labels, POST /sessions/:id/predict'],
          ['/benchmark', 'Benchmark', 'POST /jobs, GET /jobs/:id, GET /jobs/:id/export'],
          ['/compliance', 'Compliance', 'POST /scans/:id, GET /lineage, POST /policies/evaluate, POST /anonymize, GET /audit, POST /reports/generate'],
          ['/marketplace', 'Marketplace', 'GET /assets, POST /assets, POST /assets/:id/install, POST /assets/:id/reviews'],
          ['/settings', 'Settings', 'GET /, PATCH /, POST /reset, DELETE /uploads, DELETE /database'],
        ]}
      />

      <H2 id="technical-datadir">Data Directory Layout</H2>
      <CodeBlock lang="text">{`backend/data/
├── db.json                    ← All metadata (datasets, jobs, policies, etc.)
├── uploads/
│   └── <dataset-id>.csv       ← Uploaded CSV files
├── models/
│   └── <session-id>.pkl       ← Trained ML models (AL sessions)
├── pipeline_outputs/
│   └── <run-id>.csv           ← Pipeline run outputs
├── synthetic_outputs/
│   └── <job-id>.csv           ← Synthetic job outputs
└── compliance_reports/
    ├── <report-id>.json        ← JSON report data
    └── <report-id>.html        ← HTML report file`}</CodeBlock>

      <H2 id="technical-threading">Threading Model</H2>
      <P>
        Long-running operations are executed in Python <Code>daemon threads</Code> so the API responds
        immediately with a job ID. The frontend polls job status endpoints at 1–3 second intervals using
        TanStack Query's <Code>refetchInterval</Code>. The store uses a <Code>threading.Lock</Code> around
        all db.json read-write cycles to prevent corruption under concurrent jobs.
      </P>
      <P>Operations that run in background threads:</P>
      <UL>
        <LI>Quality scans</LI>
        <LI>Synthetic generation (statistical fitting + sampling)</LI>
        <LI>CTGAN / TVAE model training and sampling</LI>
        <LI>AL session training rounds</LI>
        <LI>Benchmark candidate training (one thread per candidate)</LI>
        <LI>PII compliance scans</LI>
        <LI>Anonymization jobs</LI>
      </UL>
      <P>Operations that are synchronous (block until complete):</P>
      <UL>
        <LI>Pipeline dry-runs and full runs (fast due to Polars lazy evaluation)</LI>
        <LI>Compliance report generation (typically 2–5 seconds)</LI>
        <LI>Marketplace installs</LI>
      </UL>

      <div className="pb-16" />
    </div>
  )
}

// ── Nav sidebar ────────────────────────────────────────────────────────

function NavTree({ items, activeId, onSelect }: {
  items: Section[]
  activeId: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(items.map(i => i.id)))

  const toggle = (id: string) =>
    setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="space-y-0.5">
      {items.map(item => {
        const isOpen = open.has(item.id)
        return (
          <div key={item.id}>
            <button
              onClick={() => { if (item.children) toggle(item.id); else onSelect(item.id) }}
              className={cn('w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-left transition-colors',
                activeId === item.id ? 'bg-brand/5 text-brand font-medium' : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
              )}>
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {item.children && (
                isOpen ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
              )}
            </button>
            {item.children && isOpen && (
              <div className="ml-4 mt-0.5 space-y-0.5">
                {item.children.map(child => (
                  <button key={child.id} onClick={() => onSelect(child.id)}
                    className={cn('w-full flex items-center gap-2 px-3 py-1 rounded-lg text-xs text-left transition-colors',
                      activeId === child.id ? 'bg-brand/5 text-brand font-medium' : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary'
                    )}>
                    <span className="w-1 h-1 rounded-full bg-current flex-shrink-0 ml-0.5" />
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeId, setActiveId] = useState('overview-what')
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const scrollTo = (id: string) => {
    setActiveId(id)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Track active section via intersection observer
  useEffect(() => {
    const allIds = NAV.flatMap(s => [s.id, ...(s.children?.map(c => c.id) ?? [])])
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )
    allIds.forEach(id => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  // Keyboard shortcut: / to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !showSearch && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        setShowSearch(true)
        setTimeout(() => searchRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') setShowSearch(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showSearch])

  // Flatten all sections for search
  const allSections = NAV.flatMap(s => [
    { id: s.id, label: s.label, parent: null },
    ...(s.children?.map(c => ({ id: c.id, label: c.label, parent: s.label })) ?? []),
  ])

  const searchResults = search.trim()
    ? allSections.filter(s =>
        s.label.toLowerCase().includes(search.toLowerCase()) ||
        s.parent?.toLowerCase().includes(search.toLowerCase())
      )
    : []

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* Left nav */}
      <aside className="w-56 flex-shrink-0 border-r border-border overflow-y-auto py-4 px-2">
        <div className="px-2 mb-3">
          <button
            onClick={() => { setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 50) }}
            className="w-full flex items-center gap-2 bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors">
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search docs…</span>
            <kbd className="text-[10px] bg-surface-primary border border-border rounded px-1">/</kbd>
          </button>
        </div>
        <NavTree items={NAV} activeId={activeId} onSelect={scrollTo} />
      </aside>

      {/* Main content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="px-10 pt-8">
          <DocContent />
        </div>
      </div>

      {/* Search modal */}
      {showSearch && (
        <div className="absolute inset-0 z-50 flex items-start justify-center pt-24 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowSearch(false)}>
          <div className="bg-surface-primary border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-4 h-4 text-text-tertiary flex-shrink-0" />
              <input
                ref={searchRef}
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
                placeholder="Search documentation…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button onClick={() => setShowSearch(false)} className="text-text-tertiary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            {search.trim() === '' ? (
              <div className="p-4 space-y-1">
                {NAV.map(s => (
                  <button key={s.id} onClick={() => { scrollTo(s.id); setShowSearch(false); setSearch('') }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary text-left transition-colors">
                    {s.icon}
                    {s.label}
                  </button>
                ))}
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-6 text-center text-sm text-text-tertiary">No results for "{search}"</div>
            ) : (
              <div className="p-2 max-h-80 overflow-y-auto">
                {searchResults.map(r => (
                  <button key={r.id} onClick={() => { scrollTo(r.id); setShowSearch(false); setSearch('') }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-surface-secondary transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary">{r.label}</p>
                      {r.parent && <p className="text-xs text-text-tertiary">{r.parent}</p>}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
