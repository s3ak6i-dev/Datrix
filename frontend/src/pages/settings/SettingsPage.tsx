import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings, HardDrive, Brain, BarChart3, Sparkles, GitBranch,
  AlertTriangle, Info, Server, RefreshCw, Keyboard,
} from 'lucide-react'
import { api } from '@/lib/api'
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>{fmtBytes(bytes)} ({p}%)</span>
      </div>
      <div style={{ height: 6, background: 'var(--bg-inset)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 'var(--radius-pill)', background: color, width: `${p}%`, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────

function Section({ id, icon, title, description, children }: {
  id: string; icon: React.ReactNode; title: string; description: string; children: React.ReactNode
}) {
  return (
    <section id={id} style={{ scrollMarginTop: 16, fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--accent)' }}>{icon}</span>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20, marginLeft: 28 }}>{description}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginLeft: 28 }}>{children}</div>
    </section>
  )
}

// ── Form primitives ───────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, fontFamily: 'var(--font-sans)' }}>
      <div style={{ minWidth: 0, flex: 1, maxWidth: 384 }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</label>
        {hint && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{hint}</p>}
      </div>
      <div style={{ flexShrink: 0, width: 224 }}>{children}</div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-inset)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-btn)', padding: '8px 12px', color: 'var(--text-primary)',
  fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      style={inputStyle}
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
      style={inputStyle}
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
      style={inputStyle}
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
      style={inputStyle}
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
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 40, display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      padding: '12px 20px', fontFamily: 'var(--font-sans)',
    }}>
      {error ? (
        <span style={{ fontSize: 14, color: 'var(--bad)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle style={{ width: 16, height: 16 }} />{error}
        </span>
      ) : (
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>You have unsaved changes</span>
      )}
      <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>Discard</Button>
      <Button size="sm" onClick={onSave} disabled={saving}>
        {saving ? <><RefreshCw style={{ width: 14, height: 14, marginRight: 6 }} className="animate-spin" />Saving…</> : 'Save changes'}
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
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</p>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{description}</p>
        {result && <p style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}>{result}</p>}
      </div>
      <Button
        variant="ghost"
        size="sm"
        style={{ flexShrink: 0, borderColor: 'var(--bad)', color: 'var(--bad)' }}
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
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '12px 16px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ── Section nav ───────────────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: 'general',     icon: <Settings style={{ width: 16, height: 16 }} />,      label: 'General' },
  { id: 'storage',     icon: <HardDrive style={{ width: 16, height: 16 }} />,     label: 'Storage' },
  { id: 'al',          icon: <Brain style={{ width: 16, height: 16 }} />,          label: 'Active Learning' },
  { id: 'benchmark',   icon: <BarChart3 style={{ width: 16, height: 16 }} />,     label: 'Benchmark' },
  { id: 'synthetic',   icon: <Sparkles style={{ width: 16, height: 16 }} />,      label: 'Synthetic Data' },
  { id: 'pipeline',    icon: <GitBranch style={{ width: 16, height: 16 }} />,     label: 'Pipelines & Export' },
  { id: 'shortcuts',   icon: <Keyboard style={{ width: 16, height: 16 }} />,      label: 'Keyboard Shortcuts' },
  { id: 'about',       icon: <Info style={{ width: 16, height: 16 }} />,           label: 'About' },
  { id: 'danger',      icon: <AlertTriangle style={{ width: 16, height: 16 }} />, label: 'Danger Zone' },
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 14, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
        Loading settings…
      </div>
    )
  }

  const navLinkStyle = (id: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
    borderRadius: 'var(--radius-md)', fontSize: 14, textDecoration: 'none',
    fontFamily: 'var(--font-sans)', cursor: 'pointer', border: 'none',
    background: activeSection === id ? 'var(--blue-tint)' : 'transparent',
    color: activeSection === id
      ? 'var(--accent)'
      : id === 'danger'
      ? 'var(--bad)'
      : 'var(--text-secondary)',
    fontWeight: activeSection === id ? 500 : 400,
    width: '100%', textAlign: 'left',
    transition: 'background 0.15s, color 0.15s',
  })

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      {/* Left nav */}
      <div style={{ width: 192, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_SECTIONS.map(s => (
          <button
            key={s.id}
            style={navLinkStyle(s.id)}
            onClick={e => {
              e.preventDefault()
              document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })
              setActiveSection(s.id)
            }}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 32, paddingBottom: 96, display: 'flex', flexDirection: 'column', gap: 48 }}>

        {/* ── General ── */}
        <Section id="general" icon={<Settings style={{ width: 20, height: 20 }} />} title="General" description="Application-wide display preferences">
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
          <Field label="Platform tour" hint="Walk through all 7 modules with the interactive guide">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('datrix:open-tour'))}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 'var(--radius-btn)',
                background: 'var(--accent)', color: 'var(--text-on-accent)',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                fontFamily: 'var(--font-sans)',
              }}
            >
              Relaunch tour
            </button>
          </Field>
        </Section>

        {/* ── Storage ── */}
        <Section id="storage" icon={<HardDrive style={{ width: 20, height: 20 }} />} title="Storage" description="File storage configuration and disk usage">

          {stats && (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)', padding: 20,
              display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Disk usage</h3>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fmtBytes(stats.disk_free_bytes)} free of {fmtBytes(stats.disk_total_bytes)}</span>
              </div>
              {/* Overall disk bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  <span>Used by system</span>
                  <span>{fmtBytes(stats.disk_used_bytes)} ({pct(stats.disk_used_bytes, stats.disk_total_bytes)}%)</span>
                </div>
                <div style={{ height: 12, background: 'var(--bg-inset)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', display: 'flex', gap: 1 }}>
                  <div style={{ background: 'rgba(59,130,246,0.6)', height: '100%', width: `${pct(stats.uploads_bytes, stats.disk_total_bytes)}%` }} />
                  <div style={{ background: 'rgba(168,85,247,0.6)', height: '100%', width: `${pct(stats.models_bytes, stats.disk_total_bytes)}%` }} />
                  <div style={{ background: 'rgba(249,115,22,0.6)', height: '100%', width: `${pct(stats.db_bytes, stats.disk_total_bytes)}%` }} />
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(59,130,246,0.6)', display: 'inline-block' }} />Uploads</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(168,85,247,0.6)', display: 'inline-block' }} />Models</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(249,115,22,0.6)', display: 'inline-block' }} />Database</span>
                </div>
              </div>
              <StorageBar label="Uploaded files" bytes={stats.uploads_bytes} total={stats.disk_total_bytes} color="rgba(59,130,246,0.7)" />
              <StorageBar label="Trained models" bytes={stats.models_bytes} total={stats.disk_total_bytes} color="rgba(168,85,247,0.7)" />
              <StorageBar label="Database (db.json)" bytes={stats.db_bytes} total={stats.disk_total_bytes} color="rgba(249,115,22,0.7)" />
              <div style={{ paddingTop: 4 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                  <StatCard label="Datasets" value={stats.dataset_count} />
                  <StatCard label="Pipelines" value={stats.pipeline_count} />
                  <StatCard label="AL Sessions" value={stats.al_session_count} />
                  <StatCard label="Upload files" value={stats.upload_file_count} />
                </div>
              </div>
            </div>
          )}

          <Field label="Max upload size" hint="Maximum file size allowed per upload in megabytes">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <NumberInput value={draft.max_upload_mb} onChange={v => set('max_upload_mb', v)} min={1} max={102400} />
              <span style={{ fontSize: 14, color: 'var(--text-tertiary)', flexShrink: 0 }}>MB</span>
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
        <Section id="al" icon={<Brain style={{ width: 20, height: 20 }} />} title="Active Learning" description="Default values pre-filled when creating a new AL session">
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
        <Section id="benchmark" icon={<BarChart3 style={{ width: 20, height: 20 }} />} title="Benchmark" description="Default values pre-filled when creating a benchmark job">
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
        <Section id="synthetic" icon={<Sparkles style={{ width: 20, height: 20 }} />} title="Synthetic Data" description="Default values for new synthetic generation jobs">
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
        <Section id="pipeline" icon={<GitBranch style={{ width: 20, height: 20 }} />} title="Pipelines & Export" description="Default output formats for pipeline runs and data exports">
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
        <Section id="shortcuts" icon={<Keyboard style={{ width: 20, height: 20 }} />} title="Keyboard Shortcuts" description="All keyboard shortcuts available in the application">
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
            <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>Context</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>Shortcut</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {SHORTCUTS.map((s, i) => (
                  <tr key={i} style={{ borderBottom: i < SHORTCUTS.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'var(--bg)' : 'var(--bg-card)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text-tertiary)', fontSize: 12 }}>{s.context}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <kbd style={{
                        display: 'inline-flex', alignItems: 'center', gap: 2,
                        padding: '2px 8px', background: 'var(--bg-inset)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-btn)', fontSize: 12,
                        fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
                      }}>{s.key}</kbd>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontSize: 12 }}>{s.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── About ── */}
        <Section id="about" icon={<Info style={{ width: 20, height: 20 }} />} title="About" description="Version information and technology stack">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
              <div key={item.label} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: '12px 16px',
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div style={{
            background: 'var(--blue-tint)', border: '1px solid var(--border-accent)',
            borderRadius: 'var(--radius-card)', padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <Server style={{ width: 16, height: 16, color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Running locally</p>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                Datrix runs entirely on your machine. All data stays local — no cloud sync, no telemetry.
              </p>
            </div>
          </div>
        </Section>

        {/* ── Danger Zone ── */}
        <Section id="danger" icon={<AlertTriangle style={{ width: 20, height: 20, color: 'var(--bad)' }} />} title="Danger Zone" description="Irreversible actions. These cannot be undone.">
          <div style={{ border: '1px solid var(--bad)', borderRadius: 'var(--radius-card)', padding: '0 20px', background: 'var(--bad-dim)' }}>
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
