import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sparkles, ChevronDown, ChevronRight, CheckCircle2, XCircle,
  Loader2, ArrowRight, ExternalLink, RotateCcw,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import type { SyntheticMethod, ColOverride, ColumnProfile } from '@/types'

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

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-surface-tertiary border-b border-border flex items-center justify-between">
        <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">
          Column overrides
        </p>
        <p className="text-xs text-text-tertiary">{profiles.length} columns</p>
      </div>
      <div className="divide-y divide-border max-h-96 overflow-y-auto">
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
            <div key={col.name}>
              {/* Row header */}
              <div
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-tertiary cursor-pointer select-none"
                onClick={() => toggle(col.name)}
              >
                {isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
                  : <ChevronRight className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
                }
                <span className="text-sm font-mono text-text-primary flex-1 truncate">{col.name}</span>
                <span className={cn(
                  'text-[10px] font-medium px-1.5 py-0.5 rounded',
                  isNum ? 'bg-brand-50 text-brand' : isCat ? 'bg-success-50 text-success' : 'bg-surface-tertiary text-text-tertiary'
                )}>
                  {col.dtype}
                </span>
                {/* Null rate quick badge */}
                <span className="text-xs text-text-tertiary w-12 text-right">
                  {ov.null_rate != null && ov.null_rate > 0
                    ? <span className="text-warning font-medium">{(ov.null_rate * 100).toFixed(0)}% null</span>
                    : null
                  }
                </span>
                {hasOverride && (
                  <span className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />
                )}
              </div>

              {/* Expanded controls */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 space-y-3 bg-surface-secondary">
                  {/* Null rate — universal */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-text-secondary">Null rate</label>
                      <span className="text-xs text-text-tertiary">
                        {((ov.null_rate ?? 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range" min={0} max={1} step={0.01}
                      value={ov.null_rate ?? 0}
                      onChange={(e) => set(col.name, { null_rate: parseFloat(e.target.value) })}
                      className="w-full accent-brand"
                    />
                  </div>

                  {/* Numeric controls */}
                  {isNum && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-text-secondary block mb-1">Distribution</label>
                        <select
                          value={ov.distribution ?? 'auto'}
                          onChange={(e) => set(col.name, { distribution: e.target.value })}
                          className="w-full text-sm border border-border rounded-lg px-3 py-1.5 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                        >
                          {DISTRIBUTIONS.map((d) => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-medium text-text-secondary block mb-1">Min clamp</label>
                          <input
                            type="number"
                            value={ov.min ?? ''}
                            onChange={(e) => set(col.name, { min: e.target.value ? parseFloat(e.target.value) : undefined })}
                            placeholder={col.stats?.min != null ? String(col.stats.min) : 'none'}
                            className="w-full text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-text-secondary block mb-1">Max clamp</label>
                          <input
                            type="number"
                            value={ov.max ?? ''}
                            onChange={(e) => set(col.name, { max: e.target.value ? parseFloat(e.target.value) : undefined })}
                            placeholder={col.stats?.max != null ? String(col.stats.max) : 'none'}
                            className="w-full text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Categorical class weights */}
                  {isCat && col.distribution.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-text-secondary">Class weights</label>
                        <button
                          onClick={() => {
                            const cats = col.distribution.map((d) => d.label)
                            const eq = Object.fromEntries(cats.map((c) => [c, 1 / cats.length]))
                            set(col.name, { class_weights: eq })
                          }}
                          className="text-xs text-brand hover:underline"
                        >
                          Equalize
                        </button>
                      </div>
                      <div className="space-y-2">
                        {col.distribution.slice(0, 10).map(({ label, pct }) => {
                          const w = ov.class_weights?.[label] ?? (pct / 100)
                          return (
                            <div key={label} className="flex items-center gap-2">
                              <span className="text-xs font-mono text-text-secondary w-24 truncate">{label}</span>
                              <input
                                type="range" min={0} max={1} step={0.01}
                                value={w}
                                onChange={(e) => {
                                  const prev = ov.class_weights ?? Object.fromEntries(
                                    col.distribution.slice(0, 10).map((d) => [d.label, d.pct / 100])
                                  )
                                  set(col.name, { class_weights: { ...prev, [label]: parseFloat(e.target.value) } })
                                }}
                                className="flex-1 accent-brand"
                              />
                              <span className="text-xs text-text-tertiary w-10 text-right">
                                {(w * 100).toFixed(0)}%
                              </span>
                            </div>
                          )
                        })}
                        {col.distribution.length > 10 && (
                          <p className="text-xs text-text-tertiary">
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
    <div className="p-4 bg-surface-primary border border-border rounded-xl space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{job.output_name || `${sourceName} (synthetic)`}</p>
          <p className="text-xs text-text-tertiary mt-0.5">
            {sourceName} · {job.row_count.toLocaleString()} rows · {method?.label}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {job.status === 'failed' && job.error_message && (
        <p className="text-xs text-danger bg-danger-50 px-2 py-1 rounded truncate" title={job.error_message}>
          {job.error_message}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-text-tertiary">{formatRelativeTime(job.created_at)}</span>
        {job.status === 'complete' && job.output_dataset_id && (
          <button
            onClick={() => navigate(`/datasets/${job.output_dataset_id}`)}
            className="flex items-center gap-1 text-xs text-brand hover:underline"
          >
            View dataset <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'complete') return (
    <span className="flex items-center gap-1 text-xs font-medium text-success bg-success-50 px-2 py-0.5 rounded-full flex-shrink-0">
      <CheckCircle2 className="w-3 h-3" /> Done
    </span>
  )
  if (status === 'failed') return (
    <span className="flex items-center gap-1 text-xs font-medium text-danger bg-danger-50 px-2 py-0.5 rounded-full flex-shrink-0">
      <XCircle className="w-3 h-3" /> Failed
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-brand bg-brand-50 px-2 py-0.5 rounded-full flex-shrink-0">
      <Loader2 className="w-3 h-3 animate-spin" /> {status === 'running' ? 'Running' : 'Pending'}
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
      const d = q.state.data
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-brand" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Synthetic Data Engine</h1>
          <p className="text-sm text-text-secondary">Generate privacy-safe synthetic datasets using statistical or ML models</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* ── Left: form (3 cols) ── */}
        <div className="col-span-3 space-y-5">

          {/* Source dataset */}
          <div className="p-5 bg-surface-primary border border-border rounded-xl space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">Source dataset</h2>
            {readyDatasets.length === 0 ? (
              <p className="text-sm text-text-tertiary">No ready datasets found. Upload one first.</p>
            ) : (
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
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
                <label className="text-xs font-medium text-text-secondary block mb-1">Output dataset name</label>
                <input
                  value={outputName}
                  onChange={(e) => setOutputName(e.target.value)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            )}
          </div>

          {/* Method */}
          <div className="p-5 bg-surface-primary border border-border rounded-xl space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">Generation method</h2>
            <div className="grid grid-cols-3 gap-3">
              {METHODS.map((m) => {
                const cached = cachedModel(m.id)
                return (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      'text-left p-3 rounded-xl border-2 transition-colors',
                      method === m.id
                        ? 'border-brand bg-brand-50'
                        : 'border-border hover:border-brand/40 bg-surface-secondary',
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-text-primary">{m.label}</span>
                      <span className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide',
                        method === m.id ? 'bg-brand text-white' : 'bg-surface-tertiary text-text-tertiary'
                      )}>
                        {m.tag}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">{m.desc}</p>
                    <div className="flex items-center justify-between mt-2">
                      {cached ? (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-success">
                          <CheckCircle2 className="w-3 h-3" /> Cached
                        </span>
                      ) : (
                        <p className="text-[10px] text-text-tertiary font-medium">{m.time}</p>
                      )}
                      {cached && method === m.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteModelMutation.mutate(cached.id)
                          }}
                          className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-danger transition-colors"
                          title="Delete cached model and retrain next run"
                        >
                          <RotateCcw className="w-3 h-3" /> Retrain
                        </button>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Row count */}
          <div className="p-5 bg-surface-primary border border-border rounded-xl space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">Row count</h2>
            <div className="flex items-center gap-2">
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
                className="w-36 text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              <span className="text-xs text-text-tertiary">rows</span>
              <div className="flex items-center gap-1 ml-2">
                {ROW_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => { setRowCount(p.value); setRowCountInput(String(p.value)) }}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-lg border transition-colors',
                      rowCount === p.value
                        ? 'border-brand bg-brand-50 text-brand font-medium'
                        : 'border-border text-text-secondary hover:border-brand/40'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
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
                <Loader2 className="w-4 h-4 animate-spin" />
                {cachedModel(method) ? 'Sampling from model…' : method === 'statistical' ? 'Generating…' : 'Training model…'}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {cachedModel(method) ? 'Generate (model cached)' : 'Generate synthetic dataset'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>

          {activeJobs.length > 0 && !pollingJobId && (
            <p className="text-xs text-text-tertiary text-center">
              A job is already running — wait for it to finish before starting another.
            </p>
          )}
        </div>

        {/* ── Right: history (2 cols) ── */}
        <div className="col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Job history</h2>
          {jobs.length === 0 ? (
            <div className="p-6 text-center text-sm text-text-tertiary bg-surface-primary border border-border rounded-xl">
              No jobs yet — generate your first synthetic dataset.
            </div>
          ) : (
            <div className="space-y-3">
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
