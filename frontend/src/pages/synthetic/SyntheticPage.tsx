import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sparkles, ChevronDown, ChevronRight, CheckCircle2, XCircle,
  Loader2, ArrowRight, ExternalLink, RotateCcw,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { formatRelativeTime } from '@/lib/utils'
import type { SyntheticMethod, ColOverride, ColumnProfile, SyntheticJob } from '@/types'

// ── Method definitions ────────────────────────────────────────────────

const METHODS: { id: SyntheticMethod; label: string; tag: string; desc: string; time: string }[] = [
  {
    id: 'statistical',
    label: 'Gaussian Copula',
    tag: 'Statistical',
    desc: 'Fits per-column distributions and preserves correlations. Fast and interpretable.',
    time: 'Seconds',
  },
  {
    id: 'ctgan',
    label: 'CTGAN',
    tag: 'GAN',
    desc: 'Conditional GAN that captures complex non-linear patterns. Higher fidelity on tabular data.',
    time: '~5 min on CPU',
  },
  {
    id: 'tvae',
    label: 'TVAE',
    tag: 'VAE',
    desc: 'Variational autoencoder. Best for sparse columns and mixed data types.',
    time: '~5 min on CPU',
  },
]

const DISTRIBUTIONS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'normal', label: 'Normal' },
  { value: 'log_normal', label: 'Log-normal' },
  { value: 'uniform', label: 'Uniform' },
  { value: 'beta', label: 'Beta' },
]

const NUMERIC_DTYPES = new Set(['integer', 'float'])
const CATEGORICAL_DTYPES = new Set(['string', 'boolean'])

// ── Column overrides table ────────────────────────────────────────────

function ColOverridesTable({
  profiles,
  overrides,
  onChange,
}: {
  profiles: ColumnProfile[]
  overrides: Record<string, ColOverride>
  onChange: (o: Record<string, ColOverride>) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (col: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(col) ? next.delete(col) : next.add(col)
      return next
    })

  const set = (col: string, patch: Partial<ColOverride>) =>
    onChange({ ...overrides, [col]: { ...(overrides[col] ?? {}), ...patch } })

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-inset)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-btn)',
    padding: '6px 10px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    width: '100%',
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
      <div style={{
        padding: '10px 16px',
        background: 'var(--bg-inset)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 400 }}>
          Column overrides
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{profiles.length} columns</p>
      </div>
      <div style={{ maxHeight: '384px', overflowY: 'auto' }}>
        {profiles.map((col) => {
          const isNum = NUMERIC_DTYPES.has(col.dtype)
          const isCat = CATEGORICAL_DTYPES.has(col.dtype)
          const ov = overrides[col.name] ?? {}
          const isExpanded = expanded.has(col.name)
          const hasOverride = Object.keys(ov).some((k) => {
            const v = (ov as Record<string, unknown>)[k]
            return v !== undefined && v !== null && v !== 0 && v !== 'auto'
          })

          return (
            <div key={col.name} style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Row header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 16px',
                  background: 'transparent',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onClick={() => toggle(col.name)}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {isExpanded
                  ? <ChevronDown style={{ width: '14px', height: '14px', color: 'var(--text-tertiary)', flexShrink: 0 }} />
                  : <ChevronRight style={{ width: '14px', height: '14px', color: 'var(--text-tertiary)', flexShrink: 0 }} />
                }
                <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.name}</span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-btn)',
                  background: isNum ? 'var(--blue-tint)' : isCat ? 'var(--green-dim)' : 'var(--bg-3)',
                  color: isNum ? 'var(--accent)' : isCat ? 'var(--green)' : 'var(--text-tertiary)',
                }}>
                  {col.dtype}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', width: '48px', textAlign: 'right' }}>
                  {ov.null_rate != null && ov.null_rate > 0
                    ? <span style={{ color: 'var(--warn)', fontWeight: 500 }}>{(ov.null_rate * 100).toFixed(0)}% null</span>
                    : null
                  }
                </span>
                {hasOverride && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                )}
              </div>

              {/* Expanded controls */}
              {isExpanded && (
                <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-2)' }}>
                  {/* Null rate — universal */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Null rate</label>
                      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        {((ov.null_rate ?? 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range" min={0} max={1} step={0.01}
                      value={ov.null_rate ?? 0}
                      onChange={(e) => set(col.name, { null_rate: parseFloat(e.target.value) })}
                      style={{ width: '100%', accentColor: 'var(--accent)' }}
                    />
                  </div>

                  {/* Numeric controls */}
                  {isNum && (
                    <>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Distribution</label>
                        <select
                          value={ov.distribution ?? 'auto'}
                          onChange={(e) => set(col.name, { distribution: e.target.value })}
                          style={selectStyle}
                        >
                          {DISTRIBUTIONS.map((d) => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Min clamp</label>
                          <input
                            type="number"
                            value={ov.min ?? ''}
                            onChange={(e) => set(col.name, { min: e.target.value ? parseFloat(e.target.value) : undefined })}
                            placeholder={col.stats?.min != null ? String(col.stats.min) : 'none'}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Max clamp</label>
                          <input
                            type="number"
                            value={ov.max ?? ''}
                            onChange={(e) => set(col.name, { max: e.target.value ? parseFloat(e.target.value) : undefined })}
                            placeholder={col.stats?.max != null ? String(col.stats.max) : 'none'}
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Categorical class weights */}
                  {isCat && col.distribution.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Class weights</label>
                        <button
                          onClick={() => {
                            const cats = col.distribution.map((d) => d.label)
                            const eq = Object.fromEntries(cats.map((c) => [c, 1 / cats.length]))
                            set(col.name, { class_weights: eq })
                          }}
                          style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          Equalize
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {col.distribution.slice(0, 10).map(({ label, pct }) => {
                          const w = ov.class_weights?.[label] ?? (pct / 100)
                          return (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', width: '96px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                              <input
                                type="range" min={0} max={1} step={0.01}
                                value={w}
                                onChange={(e) => {
                                  const prev = ov.class_weights ?? Object.fromEntries(
                                    col.distribution.slice(0, 10).map((d) => [d.label, d.pct / 100])
                                  )
                                  set(col.name, { class_weights: { ...prev, [label]: parseFloat(e.target.value) } })
                                }}
                                style={{ flex: 1, accentColor: 'var(--accent)' }}
                              />
                              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', width: '40px', textAlign: 'right' }}>
                                {(w * 100).toFixed(0)}%
                              </span>
                            </div>
                          )
                        })}
                        {col.distribution.length > 10 && (
                          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                            + {col.distribution.length - 10} more categories (use equalize to balance all)
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Job history item ──────────────────────────────────────────────────

function JobHistoryItem({ job, sourceDatasets }: {
  job: { id: string; source_dataset_id: string; output_dataset_id: string | null; output_name: string; method: string; row_count: number; status: string; error_message: string | null; created_at: string; completed_at: string | null }
  sourceDatasets: { id: string; name: string }[]
}) {
  const navigate = useNavigate()
  const sourceName = sourceDatasets.find((d) => d.id === job.source_dataset_id)?.name ?? 'Unknown'
  const method = METHODS.find((m) => m.id === job.method)

  return (
    <div style={{
      padding: '16px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.output_name || `${sourceName} (synthetic)`}</p>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            {sourceName} · {job.row_count.toLocaleString()} rows · {method?.label}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {job.status === 'failed' && job.error_message && (
        <p style={{ fontSize: '12px', color: 'var(--bad)', background: 'var(--bad-dim)', padding: '4px 8px', borderRadius: 'var(--radius-btn)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={job.error_message}>
          {job.error_message}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{formatRelativeTime(job.created_at)}</span>
        {job.status === 'complete' && job.output_dataset_id && (
          <button
            onClick={() => navigate(`/datasets/${job.output_dataset_id}`)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            View dataset <ExternalLink style={{ width: '12px', height: '12px' }} />
          </button>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'complete') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(52,211,153,.22)', borderRadius: 'var(--radius-btn)', padding: '3px 10px', flexShrink: 0 }}>
      <CheckCircle2 style={{ width: '12px', height: '12px' }} /> Done
    </span>
  )
  if (status === 'failed') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--bad-dim)', color: 'var(--bad)', border: '1px solid rgba(239,68,68,.22)', borderRadius: 'var(--radius-btn)', padding: '3px 10px', flexShrink: 0 }}>
      <XCircle style={{ width: '12px', height: '12px' }} /> Failed
    </span>
  )
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--blue-tint)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,.22)', borderRadius: 'var(--radius-btn)', padding: '3px 10px', flexShrink: 0 }}>
      <Loader2 style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} /> {status === 'running' ? 'Running' : 'Pending'}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────

export function SyntheticPage() {
  const qc = useQueryClient()

  const [sourceId, setSourceId] = useState('')
  const [outputName, setOutputName] = useState('')
  const [method, setMethod] = useState<SyntheticMethod>('statistical')
  const [rowCount, setRowCount] = useState(1000)
  const [rowCountInput, setRowCountInput] = useState('1000')
  const [overrides, setOverrides] = useState<Record<string, ColOverride>>({})
  const [pollingJobId, setPollingJobId] = useState<string | null>(null)

  const { data: datasets = [] } = useQuery({
    queryKey: ['datasets'],
    queryFn: api.datasets.list,
  })

  const { data: columns = [] } = useQuery({
    queryKey: ['columns', sourceId],
    queryFn: () => api.columns.list(sourceId),
    enabled: !!sourceId,
  })

  const { data: jobs = [] } = useQuery({
    queryKey: ['synthetic-jobs'],
    queryFn: api.synthetic.listJobs,
  })

  const { data: trainedModels = [] } = useQuery({
    queryKey: ['trained-models'],
    queryFn: api.synthetic.listModels,
  })

  const deleteModelMutation = useMutation({
    mutationFn: (modelId: string) => api.synthetic.deleteModel(modelId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trained-models'] }),
  })

  const cachedModel = (m: SyntheticMethod) =>
    sourceId
      ? trainedModels.find((tm) => tm.dataset_id === sourceId && tm.method === m && tm.status === 'ready')
      : undefined

  // Poll active job until done
  useQuery({
    queryKey: ['synthetic-job', pollingJobId],
    queryFn: () => api.synthetic.getJob(pollingJobId!),
    enabled: !!pollingJobId,
    refetchInterval: (q) => {
      const d = q.state.data as SyntheticJob | undefined
      if (!d) return 2000
      if (d.status === 'complete' || d.status === 'failed') {
        setPollingJobId(null)
        qc.invalidateQueries({ queryKey: ['synthetic-jobs'] })
        qc.invalidateQueries({ queryKey: ['datasets'] })
        qc.invalidateQueries({ queryKey: ['trained-models'] })
        return false
      }
      return 2000
    },
  } as Parameters<typeof useQuery>[0])

  // Reset when source changes
  useEffect(() => {
    if (!sourceId) return
    const ds = datasets.find((d) => d.id === sourceId)
    if (ds) {
      setOutputName(`${ds.name} (synthetic)`)
      setOverrides({})
    }
  }, [sourceId])

  const createMutation = useMutation({
    mutationFn: () => api.synthetic.createJob({
      source_dataset_id: sourceId,
      output_name: outputName,
      method,
      row_count: rowCount,
      column_overrides: Object.keys(overrides).length > 0 ? overrides : null,
    }),
    onSuccess: (job) => {
      setPollingJobId(job.id)
      qc.invalidateQueries({ queryKey: ['synthetic-jobs'] })
    },
  })

  const readyDatasets = datasets.filter((d) => d.status === 'ready')
  const sourceDataset = readyDatasets.find((d) => d.id === sourceId)
  const activeJobs = jobs.filter((j) => j.status === 'pending' || j.status === 'running')
  const canGenerate = !!sourceId && rowCount > 0 && !createMutation.isPending && activeJobs.length === 0

  const ROW_PRESETS = sourceDataset
    ? [
        { label: '×0.5', value: Math.max(1, Math.floor((sourceDataset.row_count ?? 1000) * 0.5)) },
        { label: '×1', value: sourceDataset.row_count ?? 1000 },
        { label: '×2', value: (sourceDataset.row_count ?? 1000) * 2 },
        { label: '×5', value: (sourceDataset.row_count ?? 1000) * 5 },
      ]
    : [
        { label: '100', value: 100 },
        { label: '1K', value: 1000 },
        { label: '10K', value: 10000 },
        { label: '100K', value: 100000 },
      ]

  const cardStyle: React.CSSProperties = {
    padding: '20px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-inset)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-btn)',
    padding: '8px 12px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    width: '100%',
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-card)', background: 'var(--blue-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles style={{ width: '20px', height: '20px', color: 'var(--accent)' }} />
        </div>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>Synthetic Data Engine</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Generate privacy-safe synthetic datasets using statistical or ML models</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px' }}>
        {/* ── Left: form ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Source dataset */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Source dataset</h2>
            {readyDatasets.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>No ready datasets found. Upload one first.</p>
            ) : (
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select a dataset…</option>
                {readyDatasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({(d.row_count ?? 0).toLocaleString()} rows · {d.column_count} cols)
                  </option>
                ))}
              </select>
            )}
            {sourceId && (
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Output dataset name</label>
                <input
                  value={outputName}
                  onChange={(e) => setOutputName(e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}
          </div>

          {/* Method */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Generation method</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              {METHODS.map((m) => {
                const cached = cachedModel(m.id)
                const isSelected = method === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    style={{
                      textAlign: 'left',
                      padding: '12px',
                      borderRadius: 'var(--radius-card)',
                      border: isSelected ? '2px solid var(--accent)' : '2px solid var(--border)',
                      background: isSelected ? 'var(--blue-tint)' : 'var(--bg-2)',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-accent)' }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{m.label}</span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-btn)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        background: isSelected ? 'var(--accent)' : 'var(--bg-3)',
                        color: isSelected ? 'var(--text-on-accent, #fff)' : 'var(--text-tertiary)',
                      }}>
                        {m.tag}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{m.desc}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                      {cached ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 500, color: 'var(--green)' }}>
                          <CheckCircle2 style={{ width: '12px', height: '12px' }} /> Cached
                        </span>
                      ) : (
                        <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{m.time}</p>
                      )}
                      {cached && isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteModelMutation.mutate(cached.id)
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--bad)')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)')}
                          title="Delete cached model and retrain next run"
                        >
                          <RotateCcw style={{ width: '12px', height: '12px' }} /> Retrain
                        </button>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Row count */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Row count</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                min={1}
                max={1000000}
                value={rowCountInput}
                onChange={(e) => {
                  setRowCountInput(e.target.value)
                  const v = parseInt(e.target.value)
                  if (!isNaN(v) && v > 0) setRowCount(v)
                }}
                style={{ ...inputStyle, width: '144px' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>rows</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                {ROW_PRESETS.map((p) => {
                  const isActive = rowCount === p.value
                  return (
                    <button
                      key={p.label}
                      onClick={() => { setRowCount(p.value); setRowCountInput(String(p.value)) }}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        borderRadius: 'var(--radius-btn)',
                        border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: isActive ? 'var(--blue-tint)' : 'transparent',
                        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: isActive ? 500 : 400,
                        cursor: 'pointer',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Column overrides */}
          {sourceId && columns.length > 0 && (
            <ColOverridesTable
              profiles={columns}
              overrides={overrides}
              onChange={setOverrides}
            />
          )}

          {/* Generate button */}
          <Button
            className="w-full"
            disabled={!canGenerate}
            loading={createMutation.isPending || !!pollingJobId}
            onClick={() => createMutation.mutate()}
          >
            {pollingJobId ? (
              <>
                <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                {cachedModel(method) ? 'Sampling from model…' : method === 'statistical' ? 'Generating…' : 'Training model…'}
              </>
            ) : (
              <>
                <Sparkles style={{ width: '16px', height: '16px' }} />
                {cachedModel(method) ? 'Generate (model cached)' : 'Generate synthetic dataset'}
                <ArrowRight style={{ width: '16px', height: '16px' }} />
              </>
            )}
          </Button>

          {activeJobs.length > 0 && !pollingJobId && (
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
              A job is already running — wait for it to finish before starting another.
            </p>
          )}
        </div>

        {/* ── Right: history ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Job history</h2>
          {jobs.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '14px', color: 'var(--text-tertiary)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
              No jobs yet — generate your first synthetic dataset.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {jobs.map((job) => (
                <JobHistoryItem key={job.id} job={job} sourceDatasets={readyDatasets} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
