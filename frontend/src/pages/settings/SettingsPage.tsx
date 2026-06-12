import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings, HardDrive, Brain, BarChart3, Sparkles, GitBranch,
  Download, AlertTriangle, Info, Check, ChevronRight, RotateCcw,
  Trash2, Database, Server, RefreshCw, Keyboard,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { AppSettings, StorageStats } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────

function fmtBytes(n: number) {
  if (n === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(n) / Math.log(1024))
  return `${(n / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function pct(part: number, total: number) {
  if (total === 0) return 0
  return Math.min(100, Math.round((part / total) * 100))
}

// ── Storage Bar ───────────────────────────────────────────────────────

function StorageBar({ label, bytes, total, color }: { label: string; bytes: number; total: number; color: string }) {
  const p = pct(bytes, total)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-tertiary">{fmtBytes(bytes)} ({p}%)</span>
      </div>
      <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${p}%` }} />
      </div>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────

function Section({ id, icon, title, description, children }: {
  id: string; icon: React.ReactNode; title: string; description: string; children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="text-brand">{icon}</div>
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      </div>
      <p className="text-sm text-text-tertiary mb-5 ml-7">{description}</p>
      <div className="space-y-4 ml-7">{children}</div>
    </section>
  )
}

// ── Form primitives ───────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0 flex-1 max-w-sm">
        <label className="block text-sm font-medium text-text-primary">{label}</label>
        {hint && <p className="text-xs text-text-tertiary mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0 w-56">{children}</div>
    </div>
  )
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}

function NumberInput({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <input
      type="number"
      className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
      value={value}
      min={min}
      max={max}
      onChange={e => {
        const n = parseInt(e.target.value, 10)
        if (!isNaN(n)) onChange(n)
      }}
    />
  )
}

function SelectInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function NullableNumberInput({ value, onChange, min, max, placeholder }: {
  value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; placeholder?: string
}) {
  return (
    <input
      type="number"
      className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand"
      value={value ?? ''}
      placeholder={placeholder ?? 'None'}
      min={min}
      max={max}
      onChange={e => {
        const v = e.target.value
        onChange(v === '' ? null : parseFloat(v))
      }}
    />
  )
}

// ── Save bar ──────────────────────────────────────────────────────────

function SaveBar({ dirty, onSave, onDiscard, saving, error }: {
  dirty: boolean; onSave: () => void; onDiscard: () => void; saving: boolean; error?: string
}) {
  if (!dirty && !error) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-surface-primary border border-border rounded-xl shadow-2xl px-5 py-3">
      {error ? (
        <span className="text-sm text-danger flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" />{error}
        </span>
      ) : (
        <span className="text-sm text-text-secondary">You have unsaved changes</span>
      )}
      <Button variant="outline" size="sm" onClick={onDiscard} disabled={saving}>Discard</Button>
      <Button size="sm" onClick={onSave} disabled={saving}>
        {saving ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : 'Save changes'}
      </Button>
    </div>
  )
}

// ── Keyboard shortcuts reference ──────────────────────────────────────

const SHORTCUTS = [
  { context: 'Active Learning', key: '↑ / ↓', action: 'Navigate rows in annotation table' },
  { context: 'Active Learning', key: '1–9', action: 'Assign class label to focused row' },
  { context: 'Active Learning', key: 'Enter', action: 'Submit batch and train next round' },
  { context: 'Global', key: 'Esc', action: 'Close modal / drawer' },
]

// ── Danger action button ──────────────────────────────────────────────

function DangerAction({
  title, description, buttonLabel, onConfirm, confirmMessage, result
}: {
  title: string; description: string; buttonLabel: string
  onConfirm: () => void; confirmMessage: string; result?: string
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="text-xs text-text-tertiary mt-0.5">{description}</p>
        {result && <p className="text-xs text-success mt-1">{result}</p>}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="flex-shrink-0 border-danger/40 text-danger hover:bg-danger/10"
        onClick={() => { if (window.confirm(confirmMessage)) onConfirm() }}
      >
        {buttonLabel}
      </Button>
    </div>
  )
}

// ── Stat card ────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-secondary border border-border rounded-lg px-4 py-3 text-center">
      <div className="text-xl font-bold text-text-primary">{value}</div>
      <div className="text-xs text-text-tertiary mt-0.5">{label}</div>
    </div>
  )
}

// ── Section nav ───────────────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: 'general',     icon: <Settings className="w-4 h-4" />,    label: 'General' },
  { id: 'storage',     icon: <HardDrive className="w-4 h-4" />,   label: 'Storage' },
  { id: 'al',          icon: <Brain className="w-4 h-4" />,        label: 'Active Learning' },
  { id: 'benchmark',   icon: <BarChart3 className="w-4 h-4" />,   label: 'Benchmark' },
  { id: 'synthetic',   icon: <Sparkles className="w-4 h-4" />,    label: 'Synthetic Data' },
  { id: 'pipeline',    icon: <GitBranch className="w-4 h-4" />,   label: 'Pipelines & Export' },
  { id: 'shortcuts',   icon: <Keyboard className="w-4 h-4" />,    label: 'Keyboard Shortcuts' },
  { id: 'about',       icon: <Info className="w-4 h-4" />,         label: 'About' },
  { id: 'danger',      icon: <AlertTriangle className="w-4 h-4" />, label: 'Danger Zone' },
]

// ── Main page ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: api.settings.get,
    staleTime: 30_000,
  })

  // Local draft state
  const [draft, setDraft] = useState<AppSettings | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [activeSection, setActiveSection] = useState('general')
  const [dangerResults, setDangerResults] = useState<Record<string, string>>({})

  useEffect(() => {
    if (data?.settings && !dirty) {
      setDraft(data.settings)
    }
  }, [data?.settings, dirty])

  const set = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev)
    setDirty(true)
    setSaveError('')
  }, [])

  const saveMut = useMutation({
    mutationFn: () => api.settings.update(draft!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setDirty(false)
      setSaveError('')
    },
    onError: (e) => setSaveError((e as Error).message),
  })

  const resetMut = useMutation({
    mutationFn: api.settings.reset,
    onSuccess: (res) => {
      setDraft(res.settings)
      qc.invalidateQueries({ queryKey: ['settings'] })
      setDirty(false)
    },
  })

  const clearUploadsMut = useMutation({
    mutationFn: api.settings.clearUploads,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['datasets'] })
      setDangerResults(p => ({
        ...p,
        uploads: `Deleted ${res.deleted_files} files (${fmtBytes(res.freed_bytes)} freed). ${res.datasets_affected} datasets affected.`
      }))
    },
  })

  const clearDbMut = useMutation({
    mutationFn: api.settings.clearDatabase,
    onSuccess: (res) => {
      setDangerResults(p => ({ ...p, db: res.message }))
    },
  })

  const stats: StorageStats | undefined = data?.stats

  if (isLoading || !draft) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-text-tertiary">
        Loading settings…
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left nav */}
      <nav className="w-48 flex-shrink-0 border-r border-border overflow-y-auto py-4 px-2 space-y-0.5">
        {NAV_SECTIONS.map(s => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={e => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }); setActiveSection(s.id) }}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              activeSection === s.id
                ? 'bg-brand/5 text-brand font-medium'
                : s.id === 'danger'
                ? 'text-danger/70 hover:text-danger hover:bg-danger/5'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
            )}
          >
            {s.icon}
            {s.label}
          </a>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 space-y-12 pb-24">

        {/* ── General ── */}
        <Section id="general" icon={<Settings className="w-5 h-5" />} title="General" description="Application-wide display preferences">
          <Field label="App name" hint="Shown in the browser tab and header">
            <TextInput value={draft.app_name} onChange={v => set('app_name', v)} placeholder="Datrix" />
          </Field>
          <Field label="Date format" hint="Used when displaying timestamps across the app">
            <SelectInput value={draft.date_format} onChange={v => set('date_format', v)} options={[
              { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD  (2025-06-12)' },
              { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY  (06/12/2025)' },
              { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY  (12/06/2025)' },
              { value: 'MMM D, YYYY', label: 'Jun 12, 2025' },
            ]} />
          </Field>
          <Field label="Table page size" hint="Default number of rows shown per page in data tables">
            <NumberInput value={draft.table_page_size} onChange={v => set('table_page_size', v)} min={10} max={500} />
          </Field>
        </Section>

        {/* ── Storage ── */}
        <Section id="storage" icon={<HardDrive className="w-5 h-5" />} title="Storage" description="File storage configuration and disk usage">

          {stats && (
            <div className="bg-surface-secondary border border-border rounded-xl p-5 space-y-4 mb-2">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-text-primary">Disk usage</h3>
                <span className="text-xs text-text-tertiary">{fmtBytes(stats.disk_free_bytes)} free of {fmtBytes(stats.disk_total_bytes)}</span>
              </div>
              {/* Overall disk bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-text-tertiary">
                  <span>Used by system</span>
                  <span>{fmtBytes(stats.disk_used_bytes)} ({pct(stats.disk_used_bytes, stats.disk_total_bytes)}%)</span>
                </div>
                <div className="h-3 bg-surface-tertiary rounded-full overflow-hidden flex gap-px">
                  <div className="bg-blue-500/60 h-full" style={{ width: `${pct(stats.uploads_bytes, stats.disk_total_bytes)}%` }} />
                  <div className="bg-purple-500/60 h-full" style={{ width: `${pct(stats.models_bytes, stats.disk_total_bytes)}%` }} />
                  <div className="bg-orange-500/60 h-full" style={{ width: `${pct(stats.db_bytes, stats.disk_total_bytes)}%` }} />
                </div>
                <div className="flex gap-4 text-xs text-text-tertiary">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500/60" />Uploads</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500/60" />Models</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500/60" />Database</span>
                </div>
              </div>
              <StorageBar label="Uploaded files" bytes={stats.uploads_bytes} total={stats.disk_total_bytes} color="bg-blue-500/70" />
              <StorageBar label="Trained models" bytes={stats.models_bytes} total={stats.disk_total_bytes} color="bg-purple-500/70" />
              <StorageBar label="Database (db.json)" bytes={stats.db_bytes} total={stats.disk_total_bytes} color="bg-orange-500/70" />
              <div className="pt-1">
                <div className="grid grid-cols-4 gap-3">
                  <StatCard label="Datasets" value={stats.dataset_count} />
                  <StatCard label="Pipelines" value={stats.pipeline_count} />
                  <StatCard label="AL Sessions" value={stats.al_session_count} />
                  <StatCard label="Upload files" value={stats.upload_file_count} />
                </div>
              </div>
            </div>
          )}

          <Field label="Max upload size" hint="Maximum file size allowed per upload in megabytes">
            <div className="flex items-center gap-2">
              <NumberInput value={draft.max_upload_mb} onChange={v => set('max_upload_mb', v)} min={1} max={102400} />
              <span className="text-sm text-text-tertiary flex-shrink-0">MB</span>
            </div>
          </Field>
          <Field label="Allowed extensions" hint="Comma-separated list of allowed file extensions">
            <TextInput
              value={draft.allowed_extensions.join(', ')}
              onChange={v => set('allowed_extensions', v.split(',').map(e => e.trim()).filter(Boolean))}
              placeholder=".csv, .json, .parquet"
            />
          </Field>
        </Section>

        {/* ── Active Learning ── */}
        <Section id="al" icon={<Brain className="w-5 h-5" />} title="Active Learning" description="Default values pre-filled when creating a new AL session">
          <Field label="Batch size" hint="Rows shown per annotation round">
            <NumberInput value={draft.al_default_batch_size} onChange={v => set('al_default_batch_size', v)} min={1} max={500} />
          </Field>
          <Field label="Model type" hint="Default ML model for the annotation loop">
            <SelectInput value={draft.al_default_model_type} onChange={v => set('al_default_model_type', v)} options={[
              { value: 'random_forest', label: 'Random Forest' },
              { value: 'logistic_regression', label: 'Logistic Regression' },
              { value: 'xgboost', label: 'XGBoost' },
              { value: 'svm', label: 'SVM' },
              { value: 'mlp', label: 'MLP' },
            ]} />
          </Field>
          <Field label="Sampling strategy" hint="How unlabeled rows are selected for the next batch">
            <SelectInput value={draft.al_default_sampling_strategy} onChange={v => set('al_default_sampling_strategy', v)} options={[
              { value: 'entropy', label: 'Entropy sampling' },
              { value: 'least_confidence', label: 'Least confidence' },
              { value: 'margin', label: 'Margin sampling' },
              { value: 'coreset', label: 'Core-set (greedy)' },
              { value: 'committee', label: 'Query by committee' },
            ]} />
          </Field>
          <Field label="Max rounds" hint="Session ends after this many training rounds">
            <NumberInput value={draft.al_default_max_rounds} onChange={v => set('al_default_max_rounds', v)} min={1} max={100} />
          </Field>
          <Field label="Target accuracy" hint="Session auto-completes when this threshold is reached (leave empty to disable)">
            <NullableNumberInput
              value={draft.al_default_target_accuracy}
              onChange={v => set('al_default_target_accuracy', v)}
              min={0.01} max={1}
              placeholder="e.g. 0.95 (optional)"
            />
          </Field>
        </Section>

        {/* ── Benchmark ── */}
        <Section id="benchmark" icon={<BarChart3 className="w-5 h-5" />} title="Benchmark" description="Default values pre-filled when creating a benchmark job">
          <Field label="Evaluation protocol" hint="Default cross-validation or holdout strategy">
            <SelectInput value={draft.benchmark_default_eval_protocol} onChange={v => set('benchmark_default_eval_protocol', v)} options={[
              { value: 'kfold_5', label: '5-Fold Cross Validation' },
              { value: 'kfold_10', label: '10-Fold Cross Validation' },
              { value: 'holdout_80', label: '80/20 Holdout' },
              { value: 'holdout_90', label: '90/10 Holdout' },
            ]} />
          </Field>
          <Field label="Model preset" hint="Hyperparameter configuration for candidate models">
            <SelectInput value={draft.benchmark_default_preset} onChange={v => set('benchmark_default_preset', v)} options={[
              { value: 'default', label: 'Default (sklearn defaults)' },
              { value: 'tuned', label: 'Tuned (hand-picked params)' },
              { value: 'grid_search', label: 'Grid Search (slower, best)' },
            ]} />
          </Field>
          <Field label="Default task type" hint="Classification or regression">
            <SelectInput value={draft.benchmark_default_task_type} onChange={v => set('benchmark_default_task_type', v)} options={[
              { value: 'classification', label: 'Classification' },
              { value: 'regression', label: 'Regression' },
            ]} />
          </Field>
        </Section>

        {/* ── Synthetic Data ── */}
        <Section id="synthetic" icon={<Sparkles className="w-5 h-5" />} title="Synthetic Data" description="Default values for new synthetic generation jobs">
          <Field label="Generation method" hint="Algorithm used to synthesize rows">
            <SelectInput value={draft.synthetic_default_method} onChange={v => set('synthetic_default_method', v)} options={[
              { value: 'statistical', label: 'Statistical (fast, column-wise)' },
              { value: 'ctgan', label: 'CTGAN (deep, conditional)' },
              { value: 'tvae', label: 'TVAE (variational autoencoder)' },
            ]} />
          </Field>
          <Field label="Row count" hint="Default number of synthetic rows to generate">
            <NumberInput value={draft.synthetic_default_row_count} onChange={v => set('synthetic_default_row_count', v)} min={10} max={1_000_000} />
          </Field>
        </Section>

        {/* ── Pipelines & Export ── */}
        <Section id="pipeline" icon={<GitBranch className="w-5 h-5" />} title="Pipelines & Export" description="Default output formats for pipeline runs and data exports">
          <Field label="Pipeline output format" hint="File format written when a pipeline run completes">
            <SelectInput value={draft.pipeline_default_output_format} onChange={v => set('pipeline_default_output_format', v)} options={[
              { value: 'csv', label: 'CSV' },
              { value: 'parquet', label: 'Parquet' },
              { value: 'json', label: 'JSON (line-delimited)' },
            ]} />
          </Field>
          <Field label="Export format" hint="Default format used when downloading datasets">
            <SelectInput value={draft.export_default_format} onChange={v => set('export_default_format', v)} options={[
              { value: 'csv', label: 'CSV' },
              { value: 'parquet', label: 'Parquet' },
              { value: 'json', label: 'JSON' },
            ]} />
          </Field>
        </Section>

        {/* ── Keyboard Shortcuts ── */}
        <Section id="shortcuts" icon={<Keyboard className="w-5 h-5" />} title="Keyboard Shortcuts" description="All keyboard shortcuts available in the application">
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-secondary border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-tertiary">Context</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-tertiary">Shortcut</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-tertiary">Action</th>
                </tr>
              </thead>
              <tbody>
                {SHORTCUTS.map((s, i) => (
                  <tr key={i} className={cn('border-b border-border last:border-0', i % 2 === 0 ? 'bg-surface-primary' : 'bg-surface-secondary')}>
                    <td className="px-4 py-2.5 text-text-tertiary text-xs">{s.context}</td>
                    <td className="px-4 py-2.5">
                      <kbd className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-surface-tertiary border border-border rounded text-xs font-mono text-text-primary">{s.key}</kbd>
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary text-xs">{s.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── About ── */}
        <Section id="about" icon={<Info className="w-5 h-5" />} title="About" description="Version information and technology stack">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Application', value: draft.app_name },
              { label: 'Version', value: '0.2.0' },
              { label: 'Frontend', value: 'React 18 + TypeScript + Vite' },
              { label: 'Backend', value: 'FastAPI + Python 3.11' },
              { label: 'Data processing', value: 'Polars' },
              { label: 'ML framework', value: 'scikit-learn + XGBoost' },
              { label: 'Styling', value: 'Tailwind CSS v4' },
              { label: 'State management', value: 'TanStack Query' },
            ].map(item => (
              <div key={item.label} className="bg-surface-secondary border border-border rounded-lg px-4 py-3">
                <div className="text-xs text-text-tertiary mb-0.5">{item.label}</div>
                <div className="text-sm font-medium text-text-primary">{item.value}</div>
              </div>
            ))}
          </div>
          <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 flex items-start gap-3">
            <Server className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-text-primary">Running locally</p>
              <p className="text-xs text-text-tertiary mt-0.5">
                Datrix runs entirely on your machine. All data stays local — no cloud sync, no telemetry.
              </p>
            </div>
          </div>
        </Section>

        {/* ── Danger Zone ── */}
        <Section id="danger" icon={<AlertTriangle className="w-5 h-5 text-danger" />} title="Danger Zone" description="Irreversible actions. These cannot be undone.">
          <div className="border border-danger/30 rounded-xl px-5 bg-danger/5">
            <DangerAction
              title="Reset settings to defaults"
              description="Restore all settings on this page to their original factory values."
              buttonLabel="Reset settings"
              confirmMessage="Reset all settings to defaults? This will overwrite your current configuration."
              onConfirm={() => resetMut.mutate()}
              result={resetMut.isSuccess ? 'Settings reset to defaults.' : undefined}
            />
            <DangerAction
              title="Clear all uploaded files"
              description="Delete every file in the uploads directory. Datasets that reference these files will be marked as errored."
              buttonLabel="Clear uploads"
              confirmMessage="Delete ALL uploaded files? Datasets without files will be marked as errored. This cannot be undone."
              onConfirm={() => clearUploadsMut.mutate()}
              result={dangerResults['uploads']}
            />
            <DangerAction
              title="Clear database"
              description="Delete db.json entirely. All datasets, pipelines, sessions, jobs, and marketplace data will be gone. Server must be restarted."
              buttonLabel="Clear database"
              confirmMessage={'⚠️ This will permanently delete ALL data — datasets, pipelines, AL sessions, benchmark jobs, marketplace listings, and settings.\n\nType DELETE to confirm.'}
              onConfirm={() => clearDbMut.mutate()}
              result={dangerResults['db']}
            />
          </div>
        </Section>
      </div>

      {/* Floating save bar */}
      <SaveBar
        dirty={dirty}
        onSave={() => saveMut.mutate()}
        onDiscard={() => {
          setDraft(data!.settings)
          setDirty(false)
          setSaveError('')
        }}
        saving={saveMut.isPending}
        error={saveError}
      />
    </div>
  )
}
