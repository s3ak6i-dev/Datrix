import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3, Plus, Trash2, ChevronRight, ChevronDown,
  CheckCircle2, Loader2, XCircle, Trophy, ArrowRight,
  Download, Zap, Brain, Database, Clock, TrendingUp,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import type {
  BenchmarkJob, BenchmarkCandidateConfig, BenchmarkCandidateResult,
  BenchmarkModelType, BenchmarkPreset, BenchmarkEvalProtocol,
  Dataset, ColumnProfile, ALSession,
} from '@/types'

// ── Static config ─────────────────────────────────────────────────────

const MODEL_LABELS: Record<BenchmarkModelType, string> = {
  logistic_regression: 'Logistic Regression',
  random_forest: 'Random Forest',
  xgboost: 'XGBoost',
  svm: 'SVM',
  mlp: 'Neural Net (MLP)',
}

const PRESET_LABELS: Record<BenchmarkPreset, string> = {
  default: 'Default',
  tuned: 'Tuned',
  grid_search: 'Grid Search',
}

const PRESET_DESC: Record<BenchmarkPreset, string> = {
  default: 'sklearn defaults — fast, good baseline',
  tuned: 'Hand-picked hyperparameters — better quality, moderate speed',
  grid_search: 'Small CV grid search — best quality, slower',
}

const PROTOCOL_LABELS: Record<BenchmarkEvalProtocol, string> = {
  kfold_5: '5-Fold CV',
  kfold_10: '10-Fold CV',
  holdout_80: '80/20 Holdout',
  holdout_90: '90/10 Holdout',
}

const PROTOCOL_DESC: Record<BenchmarkEvalProtocol, string> = {
  kfold_5: 'Stratified 5-fold cross-validation. Best default — reliable estimates with all data used.',
  kfold_10: '10-fold CV. More accurate but slower. Good for smaller datasets.',
  holdout_80: 'Train on 80%, test on 20%. Fast, but higher variance on small datasets.',
  holdout_90: 'Train on 90%, test on 10%. Use for larger datasets with enough test samples.',
}

const ALL_MODELS: BenchmarkModelType[] = ['logistic_regression', 'random_forest', 'xgboost', 'svm', 'mlp']

function fmtPct(v: number) { return `${(v * 100).toFixed(1)}%` }
function fmtMs(ms: number) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
function mkId() { return Math.random().toString(36).slice(2, 10) }

// ── Sub-components ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'complete') return (
    <span className="flex items-center gap-1 text-xs font-medium text-success bg-success-50 border border-success/20 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="w-3 h-3" /> Complete
    </span>
  )
  if (status === 'running') return (
    <span className="flex items-center gap-1 text-xs font-medium text-brand bg-brand-50 border border-brand/20 px-2 py-0.5 rounded-full">
      <Loader2 className="w-3 h-3 animate-spin" /> Running
    </span>
  )
  if (status === 'failed') return (
    <span className="flex items-center gap-1 text-xs font-medium text-danger bg-danger-50 border border-danger/20 px-2 py-0.5 rounded-full">
      <XCircle className="w-3 h-3" /> Failed
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-text-tertiary bg-surface-tertiary border border-border px-2 py-0.5 rounded-full">
      <Clock className="w-3 h-3" /> Pending
    </span>
  )
}

// ── Confusion matrix ──────────────────────────────────────────────────

function ConfusionMatrix({ matrix, classes }: { matrix: number[][], classes: string[] }) {
  const maxVal = Math.max(...matrix.flat(), 1)
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="p-1.5 text-text-tertiary text-right text-[10px]">Act ↓ / Pred →</th>
            {classes.map(c => (
              <th key={c} className="p-1.5 text-text-secondary text-center min-w-[48px] font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, ri) => (
            <tr key={ri}>
              <td className="p-1.5 text-text-secondary text-right pr-2 font-medium">{classes[ri] ?? `C${ri}`}</td>
              {row.map((val, ci) => {
                const intensity = val / maxVal
                const isDiag = ri === ci
                return (
                  <td key={ci} className="p-1.5 text-center">
                    <div
                      className={cn('rounded px-2 py-1 font-mono font-semibold text-xs', isDiag ? 'text-brand' : 'text-danger')}
                      style={{
                        background: isDiag
                          ? `rgba(99,102,241,${0.08 + intensity * 0.25})`
                          : `rgba(239,68,68,${intensity * 0.18})`,
                      }}
                    >
                      {val}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Feature importance bars ───────────────────────────────────────────

function FeatureImportanceBars({ items }: { items: { feature: string; importance: number }[] }) {
  const max = items[0]?.importance ?? 1
  return (
    <div className="space-y-2">
      {items.slice(0, 10).map(item => (
        <div key={item.feature} className="flex items-center gap-3">
          <div className="w-28 text-xs text-text-secondary truncate text-right">{item.feature}</div>
          <div className="flex-1 h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
            <div className="h-full bg-brand rounded-full" style={{ width: `${(item.importance / max) * 100}%` }} />
          </div>
          <div className="w-10 text-xs text-text-tertiary text-right">{fmtPct(item.importance)}</div>
        </div>
      ))}
    </div>
  )
}

// ── Learning curve chart ──────────────────────────────────────────────

function LearningCurveChart({ data }: { data: { train_size: number; train_score: number; val_score: number }[] }) {
  if (data.length < 2) return null
  const W = 280, H = 110, PAD = 28
  const allScores = [...data.map(d => d.train_score), ...data.map(d => d.val_score)]
  const minY = Math.max(0, Math.min(...allScores) - 0.05)
  const maxY = Math.min(1, Math.max(...allScores) + 0.05)
  const range = maxY - minY || 1
  const xs = data.map((_, i) => PAD + (i / (data.length - 1)) * (W - PAD * 2))

  const toY = (v: number) => H - PAD - ((v - minY) / range) * (H - PAD * 2)
  const trainPts = xs.map((x, i) => `${x},${toY(data[i].train_score)}`).join(' ')
  const valPts   = xs.map((x, i) => `${x},${toY(data[i].val_score)}`).join(' ')

  return (
    <div>
      <div className="flex items-center gap-4 mb-1.5">
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
          <div className="w-3 h-0.5 bg-brand/50" /> Train
        </div>
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
          <div className="w-3 h-0.5 bg-brand" /> Validation
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
        {[0.25, 0.5, 0.75].map(t => {
          const y = H - PAD - t * (H - PAD * 2)
          return <line key={t} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
        })}
        <polyline points={trainPts} fill="none" stroke="rgba(99,102,241,0.4)" strokeWidth="1.5" strokeDasharray="4 2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={valPts} fill="none" stroke="rgb(99,102,241)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={toY(data[i].val_score)} r="2.5" fill="rgb(99,102,241)" />
        ))}
        {xs.map((x, i) => (
          <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.4">
            {data[i].train_size}
          </text>
        ))}
      </svg>
    </div>
  )
}

// ── Metric comparison chart (grouped SVG bars) ────────────────────────

function MetricComparisonChart({ job }: { job: BenchmarkJob }) {
  const complete = job.results.filter(r => r.status === 'complete')
  if (complete.length === 0) return null

  const isClf = job.task_type === 'classification'
  const metrics = isClf
    ? ['accuracy', 'f1', 'precision', 'recall']
    : ['r2', 'mae', 'rmse']

  const candMap = Object.fromEntries(job.candidates.map(c => [c.id, c]))
  const colors = ['rgb(99,102,241)', 'rgb(34,197,94)', 'rgb(251,191,36)', 'rgb(239,68,68)', 'rgb(168,85,247)']

  const W = 500, H = 160, PAD_L = 40, PAD_B = 30, PAD_T = 16, PAD_R = 16
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B
  const groupW = chartW / metrics.length
  const barW   = Math.min(18, (groupW - 8) / complete.length)
  const gap    = 3

  // For regression, normalize to 0-1 scale for display
  const maxVals: Record<string, number> = {}
  metrics.forEach(m => {
    maxVals[m] = Math.max(...complete.map(r => Math.abs(r.metrics[m] ?? 0)), 0.001)
  })

  const barHeight = (val: number, metric: string) => {
    const norm = Math.min(Math.abs(val) / maxVals[metric], 1)
    return Math.max(norm * chartH, 2)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-3">
        {complete.map((r, i) => {
          const cand = candMap[r.candidate_id]
          const isWinner = r.candidate_id === job.winner_candidate_id
          return (
            <div key={r.candidate_id} className="flex items-center gap-1.5 text-xs text-text-secondary">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: colors[i % colors.length] }} />
              {isWinner && <Trophy className="w-3 h-3 text-yellow-500" />}
              <span className={isWinner ? 'font-semibold text-text-primary' : ''}>{cand?.label ?? r.candidate_id}</span>
            </div>
          )
        })}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '160px' }}>
        {/* Y axis line */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1.0].map(t => {
          const y = H - PAD_B - t * chartH
          return (
            <g key={t}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
              <text x={PAD_L - 4} y={y + 3} textAnchor="end" fontSize="8" fill="currentColor" opacity="0.4">{(t * 100).toFixed(0)}</text>
            </g>
          )
        })}
        {/* Bars */}
        {metrics.map((metric, mi) => {
          const groupX = PAD_L + mi * groupW + groupW / 2 - (complete.length * (barW + gap)) / 2
          return (
            <g key={metric}>
              {complete.map((r, ri) => {
                const val = r.metrics[metric] ?? 0
                const h   = barHeight(val, metric)
                const x   = groupX + ri * (barW + gap)
                const y   = H - PAD_B - h
                const isWinner = r.candidate_id === job.winner_candidate_id
                return (
                  <g key={r.candidate_id}>
                    <rect x={x} y={y} width={barW} height={h}
                      fill={colors[ri % colors.length]}
                      fillOpacity={isWinner ? 1 : 0.65}
                      rx="2"
                    />
                    {h > 16 && (
                      <text x={x + barW / 2} y={y + 10} textAnchor="middle" fontSize="7" fill="white" fontWeight="600">
                        {isClf ? (val * 100).toFixed(0) : val.toFixed(2)}
                      </text>
                    )}
                  </g>
                )
              })}
              <text
                x={PAD_L + mi * groupW + groupW / 2}
                y={H - PAD_B + 14}
                textAnchor="middle"
                fontSize="9"
                fill="currentColor"
                opacity="0.6"
                className="capitalize"
              >
                {metric.replace('_', ' ')}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Candidate result row (expandable) ─────────────────────────────────

function CandidateRow({
  candidate, result, isWinner, rank,
  taskType,
}: {
  candidate: BenchmarkCandidateConfig
  result: BenchmarkCandidateResult | undefined
  isWinner: boolean
  rank: number
  taskType: string
}) {
  const [open, setOpen] = useState(false)
  const isClf   = taskType === 'classification'
  const status  = result?.status ?? 'pending'
  const metrics = result?.metrics ?? {}

  const primaryMetric = isClf
    ? (metrics.accuracy != null ? fmtPct(metrics.accuracy) : '—')
    : (metrics.r2 != null ? metrics.r2.toFixed(3) : '—')

  const primaryLabel = isClf ? 'Accuracy' : 'R²'

  return (
    <div className={cn(
      'border rounded-xl overflow-hidden transition-all',
      isWinner ? 'border-yellow-400/50 bg-yellow-50/30' : 'border-border bg-surface-primary',
    )}>
      {/* Header row */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 cursor-pointer select-none',
          status === 'complete' ? 'hover:bg-surface-secondary' : '',
        )}
        onClick={() => status === 'complete' && setOpen(v => !v)}
      >
        {/* Rank */}
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
          isWinner ? 'bg-yellow-400 text-white' : 'bg-surface-tertiary text-text-tertiary',
        )}>
          {isWinner ? <Trophy className="w-3 h-3" /> : rank}
        </div>

        {/* Label + model info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-sm font-medium', isWinner ? 'text-text-primary' : 'text-text-primary')}>
              {candidate.label}
            </span>
            {isWinner && (
              <span className="text-xs font-semibold text-yellow-600 bg-yellow-100 border border-yellow-300 px-1.5 py-0.5 rounded-full">
                Winner
              </span>
            )}
          </div>
          <div className="text-xs text-text-tertiary mt-0.5 flex gap-2 flex-wrap">
            <span>{MODEL_LABELS[candidate.model_type]}</span>
            <span>·</span>
            <span>{PRESET_LABELS[candidate.preset]}</span>
            {result?.training_time_ms ? <><span>·</span><span>{fmtMs(result.training_time_ms)}</span></> : null}
          </div>
        </div>

        {/* Metrics summary */}
        {status === 'complete' && (
          <div className="flex items-center gap-4 text-right flex-shrink-0">
            <div>
              <div className={cn('text-base font-bold', isWinner ? 'text-brand' : 'text-text-primary')}>{primaryMetric}</div>
              <div className="text-xs text-text-tertiary">{primaryLabel}</div>
            </div>
            {isClf && metrics.f1 != null && (
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-text-primary">{fmtPct(metrics.f1)}</div>
                <div className="text-xs text-text-tertiary">F1</div>
              </div>
            )}
            {isClf && metrics.accuracy_std != null && (
              <div className="hidden md:block">
                <div className="text-sm text-text-secondary">±{fmtPct(metrics.accuracy_std)}</div>
                <div className="text-xs text-text-tertiary">Std</div>
              </div>
            )}
            {!isClf && metrics.mae != null && (
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-text-primary">{metrics.mae.toFixed(4)}</div>
                <div className="text-xs text-text-tertiary">MAE</div>
              </div>
            )}
          </div>
        )}

        {/* Status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={status} />
          {status === 'complete' && (
            open
              ? <ChevronDown className="w-3.5 h-3.5 text-text-tertiary" />
              : <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
          )}
          {status === 'failed' && result?.error_message && (
            <span className="text-xs text-danger max-w-[160px] truncate hidden sm:block">{result.error_message}</span>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {open && result && status === 'complete' && (
        <div className="border-t border-border bg-surface-secondary px-4 py-4 space-y-5">
          {/* All metrics */}
          <div>
            <p className="text-xs font-semibold text-text-secondary mb-2">All metrics</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metrics).map(([k, v]) => (
                <div key={k} className="px-3 py-1.5 bg-surface-primary border border-border rounded-lg text-center min-w-[80px]">
                  <div className="text-xs text-text-tertiary capitalize">{k.replace(/_/g, ' ')}</div>
                  <div className="text-sm font-semibold text-text-primary mt-0.5">
                    {isClf && !k.includes('std') ? fmtPct(v) : v.toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Confusion matrix */}
            {result.confusion_matrix && result.label_classes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-secondary mb-2">Confusion Matrix</p>
                <ConfusionMatrix matrix={result.confusion_matrix} classes={result.label_classes} />
              </div>
            )}

            {/* Feature importances */}
            {result.feature_importances.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-secondary mb-2">Feature Importance</p>
                <FeatureImportanceBars items={result.feature_importances} />
              </div>
            )}
          </div>

          {/* Learning curve */}
          {result.learning_curve.length >= 2 && (
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-2">Learning Curve</p>
              <LearningCurveChart data={result.learning_curve} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Leaderboard ───────────────────────────────────────────────────────

function Leaderboard({ job }: { job: BenchmarkJob }) {
  const isClf    = job.task_type === 'classification'
  const resultMap = Object.fromEntries(job.results.map(r => [r.candidate_id, r]))

  const sorted = [...job.candidates].sort((a, b) => {
    const ra = resultMap[a.id], rb = resultMap[b.id]
    if (!ra || ra.status !== 'complete') return 1
    if (!rb || rb.status !== 'complete') return -1
    const scoreA = isClf ? (ra.metrics.f1 ?? 0) * 0.6 + (ra.metrics.accuracy ?? 0) * 0.4 : (ra.metrics.r2 ?? -999)
    const scoreB = isClf ? (rb.metrics.f1 ?? 0) * 0.6 + (rb.metrics.accuracy ?? 0) * 0.4 : (rb.metrics.r2 ?? -999)
    return scoreB - scoreA
  })

  const complete  = job.results.filter(r => r.status === 'complete').length
  const pending   = job.results.filter(r => r.status === 'pending').length
  const running   = job.results.filter(r => r.status === 'running').length
  const failed    = job.results.filter(r => r.status === 'failed').length
  const total     = job.candidates.length

  return (
    <div className="space-y-4">
      {/* Progress bar while running */}
      {job.status === 'running' && (
        <div className="p-4 bg-brand-50 border border-brand/20 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-brand font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Running candidates in parallel…
            </span>
            <span className="text-text-secondary">{complete} / {total} complete{failed > 0 ? ` · ${failed} failed` : ''}</span>
          </div>
          <div className="h-1.5 bg-brand/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand rounded-full transition-all duration-500"
              style={{ width: `${(complete / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Winner banner */}
      {job.status === 'complete' && job.winner_candidate_id && (() => {
        const winner = job.candidates.find(c => c.id === job.winner_candidate_id)
        const result = resultMap[job.winner_candidate_id]
        if (!winner || !result) return null
        const primary = isClf ? fmtPct(result.metrics.accuracy ?? 0) : result.metrics.r2?.toFixed(3) ?? '—'
        const label   = isClf ? 'accuracy' : 'R²'
        return (
          <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-xl flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-yellow-400 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-primary">{winner.label} wins</p>
              <p className="text-xs text-text-secondary mt-0.5">
                Best {label}: <strong>{primary}</strong>
                {isClf && result.metrics.f1 != null && ` · F1: ${fmtPct(result.metrics.f1)}`}
                {` · ${fmtMs(result.training_time_ms)}`}
              </p>
            </div>
            <a
              href={api.benchmark.exportUrl(job.id)}
              download
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </a>
          </div>
        )
      })()}

      {/* Metric comparison chart */}
      {job.status === 'complete' && (
        <div className="p-4 bg-surface-primary border border-border rounded-xl">
          <p className="text-xs font-semibold text-text-secondary mb-3">Metric Comparison</p>
          <MetricComparisonChart job={job} />
        </div>
      )}

      {/* Candidate rows */}
      <div className="space-y-2">
        {sorted.map((cand, idx) => (
          <CandidateRow
            key={cand.id}
            candidate={cand}
            result={resultMap[cand.id]}
            isWinner={cand.id === job.winner_candidate_id}
            rank={idx + 1}
            taskType={job.task_type}
          />
        ))}
      </div>
    </div>
  )
}

// ── Job view ──────────────────────────────────────────────────────────

function JobView({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const qc = useQueryClient()

  const { data: job, isLoading } = useQuery<BenchmarkJob>({
    queryKey: ['benchmark-job', jobId],
    queryFn: () => api.benchmark.getJob(jobId),
    refetchInterval: q => q.state.data?.status === 'running' ? 1500 : false,
  })

  const deleteMut = useMutation({
    mutationFn: () => api.benchmark.deleteJob(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['benchmark-jobs'] })
      onBack()
    },
  })

  if (isLoading || !job) {
    return <div className="flex items-center justify-center h-64 text-text-tertiary text-sm"><Loader2 className="w-4 h-4 animate-spin mr-2" />Loading…</div>
  }

  const complete = job.results.filter(r => r.status === 'complete').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary mb-2 transition-colors"
          >
            ← All benchmarks
          </button>
          <h1 className="text-xl font-semibold text-text-primary">{job.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary flex-wrap">
            <span>Target: <span className="text-text-secondary font-medium">{job.target_column}</span></span>
            <span>{PROTOCOL_LABELS[job.eval_protocol]}</span>
            <span>{job.candidates.length} candidates</span>
            <span>{complete}/{job.candidates.length} complete</span>
            <span>{formatRelativeTime(job.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={job.status} />
          <button
            onClick={() => deleteMut.mutate()}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-tertiary hover:text-danger hover:border-danger/30 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      <Leaderboard job={job} />
    </div>
  )
}

// ── Setup wizard ──────────────────────────────────────────────────────

interface DraftCandidate {
  id: string
  model_type: BenchmarkModelType
  preset: BenchmarkPreset
  dataset_id: string | null
  al_session_id: string | null
  exclude_columns: string[]
  label: string
}

function SetupWizard({ onCreated }: { onCreated: (job: BenchmarkJob) => void }) {
  const qc = useQueryClient()
  const [step, setStep] = useState(1)

  // Step 1 state
  const [datasetId, setDatasetId] = useState('')
  const [targetCol, setTargetCol] = useState('')
  const [taskType, setTaskType] = useState<'classification' | 'regression'>('classification')
  const [evalProtocol, setEvalProtocol] = useState<BenchmarkEvalProtocol>('kfold_5')
  const [jobName, setJobName] = useState('')

  // Step 2 state
  const [candidates, setCandidates] = useState<DraftCandidate[]>([
    { id: mkId(), model_type: 'random_forest', preset: 'default', dataset_id: null, al_session_id: null, exclude_columns: [], label: '' },
    { id: mkId(), model_type: 'xgboost', preset: 'default', dataset_id: null, al_session_id: null, exclude_columns: [], label: '' },
  ])

  const { data: datasets = [] } = useQuery<Dataset[]>({
    queryKey: ['datasets'],
    queryFn: () => api.datasets.list(),
  })

  const { data: columnProfiles = [] } = useQuery<ColumnProfile[]>({
    queryKey: ['columns', datasetId],
    queryFn: () => api.columns.list(datasetId),
    enabled: !!datasetId,
  })
  const columns = columnProfiles.map(c => c.name)

  const { data: alSessions = [] } = useQuery<ALSession[]>({
    queryKey: ['al-sessions'],
    queryFn: () => api.al.listSessions(),
  })
  const completeSessions = alSessions.filter(s => s.status === 'complete')

  const createMut = useMutation({
    mutationFn: () => api.benchmark.createJob({
      name: jobName,
      dataset_id: datasetId,
      target_column: targetCol,
      task_type: taskType,
      eval_protocol: evalProtocol,
      candidates: candidates.map(c => ({
        label: c.label,
        model_type: c.model_type,
        preset: c.preset,
        dataset_id: c.dataset_id,
        al_session_id: c.al_session_id,
        exclude_columns: c.exclude_columns,
      })),
    }),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ['benchmark-jobs'] })
      onCreated(job)
    },
  })

  const addAllModels = () => {
    const existing = new Set(candidates.map(c => `${c.model_type}-${c.preset}`))
    const toAdd = ALL_MODELS
      .filter(m => !existing.has(`${m}-default`))
      .map(m => ({
        id: mkId(), model_type: m, preset: 'default' as BenchmarkPreset,
        dataset_id: null, al_session_id: null, exclude_columns: [], label: '',
      }))
    setCandidates(cs => [...cs, ...toAdd])
  }

  const updateCandidate = (id: string, patch: Partial<DraftCandidate>) =>
    setCandidates(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c))

  const removeCandidate = (id: string) =>
    setCandidates(cs => cs.filter(c => c.id !== id))

  const addCandidate = () =>
    setCandidates(cs => [...cs, {
      id: mkId(), model_type: 'random_forest', preset: 'default',
      dataset_id: null, al_session_id: null, exclude_columns: [], label: '',
    }])

  const step1Valid = !!datasetId && !!targetCol
  const step2Valid = candidates.length > 0

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => {}} className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary mb-5 transition-colors">
      </button>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
              step === s ? 'bg-brand text-white' :
              step > s   ? 'bg-success text-white' :
              'bg-surface-tertiary text-text-tertiary',
            )}>
              {step > s ? <CheckCircle2 className="w-3.5 h-3.5" /> : s}
            </div>
            <span className={cn('text-xs font-medium', step >= s ? 'text-text-primary' : 'text-text-tertiary')}>
              {s === 1 ? 'Data & Protocol' : s === 2 ? 'Candidates' : 'Review'}
            </span>
            {s < 3 && <ChevronRight className="w-3 h-3 text-text-tertiary" />}
          </div>
        ))}
      </div>

      {/* ── Step 1 ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="p-5 bg-surface-primary border border-border rounded-xl space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">Dataset & Target</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1.5">Job name (optional)</label>
                <input
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
                  placeholder="e.g. Churn model comparison"
                  value={jobName}
                  onChange={e => setJobName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1.5">Task type</label>
                <div className="flex gap-2">
                  {(['classification', 'regression'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTaskType(t)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors',
                        taskType === t ? 'border-brand bg-brand-50 text-brand' : 'border-border text-text-secondary hover:border-brand/40 bg-surface-secondary',
                      )}
                    >
                      {t === 'classification' ? 'Classification' : 'Regression'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1.5">Source dataset *</label>
                <select
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
                  value={datasetId}
                  onChange={e => { setDatasetId(e.target.value); setTargetCol('') }}
                >
                  <option value="">Select dataset…</option>
                  {datasets.filter(d => d.status === 'ready').map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1.5">Target column *</label>
                <select
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
                  value={targetCol}
                  onChange={e => setTargetCol(e.target.value)}
                  disabled={!datasetId}
                >
                  <option value="">Select column…</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Eval protocol */}
          <div className="p-5 bg-surface-primary border border-border rounded-xl space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">Evaluation protocol</h2>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PROTOCOL_LABELS) as BenchmarkEvalProtocol[]).map(p => (
                <button
                  key={p}
                  onClick={() => setEvalProtocol(p)}
                  className={cn(
                    'p-3 rounded-xl text-left border-2 transition-colors',
                    evalProtocol === p ? 'border-brand bg-brand-50' : 'border-border hover:border-brand/40 bg-surface-secondary',
                  )}
                >
                  <div className={cn('text-xs font-semibold', evalProtocol === p ? 'text-brand' : 'text-text-primary')}>
                    {PROTOCOL_LABELS[p]}
                  </div>
                  <div className="text-xs text-text-tertiary mt-0.5 leading-snug">{PROTOCOL_DESC[p]}</div>
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" disabled={!step1Valid} onClick={() => setStep(2)}>
            Next: Configure candidates <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* ── Step 2 ─────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Candidates ({candidates.length})</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={addAllModels}
                className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:border-brand/40 hover:text-brand transition-colors flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" /> Add all models
              </button>
              <button
                onClick={addCandidate}
                className="text-xs px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add candidate
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {candidates.map((cand, idx) => (
              <div key={cand.id} className="p-4 bg-surface-primary border border-border rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-tertiary">Candidate {idx + 1}</span>
                  <button onClick={() => removeCandidate(cand.id)} className="text-text-tertiary hover:text-danger transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-text-secondary block mb-1">Model</label>
                    <select
                      className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
                      value={cand.model_type}
                      onChange={e => updateCandidate(cand.id, { model_type: e.target.value as BenchmarkModelType })}
                    >
                      {ALL_MODELS.map(m => <option key={m} value={m}>{MODEL_LABELS[m]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary block mb-1">Preset</label>
                    <select
                      className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
                      value={cand.preset}
                      onChange={e => updateCandidate(cand.id, { preset: e.target.value as BenchmarkPreset })}
                    >
                      {(Object.keys(PRESET_LABELS) as BenchmarkPreset[]).map(p => (
                        <option key={p} value={p}>{PRESET_LABELS[p]} — {PRESET_DESC[p]}</option>
                      ))}
                    </select>
                  </div>

                  {/* Custom label */}
                  <div>
                    <label className="text-xs text-text-secondary block mb-1">Label (optional)</label>
                    <input
                      className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
                      placeholder="Auto-generated if blank"
                      value={cand.label}
                      onChange={e => updateCandidate(cand.id, { label: e.target.value })}
                    />
                  </div>

                  {/* Dataset override */}
                  <div>
                    <label className="text-xs text-text-secondary block mb-1">
                      <Database className="w-3 h-3 inline mr-1" />Dataset override
                    </label>
                    <select
                      className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
                      value={cand.dataset_id ?? ''}
                      onChange={e => updateCandidate(cand.id, { dataset_id: e.target.value || null, al_session_id: null })}
                    >
                      <option value="">Same as job dataset</option>
                      {datasets.filter(d => d.status === 'ready').map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* AL session override */}
                  {completeSessions.length > 0 && (
                    <div className="col-span-2">
                      <label className="text-xs text-text-secondary block mb-1">
                        <Brain className="w-3 h-3 inline mr-1" />Use AL session labels
                      </label>
                      <select
                        className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
                        value={cand.al_session_id ?? ''}
                        onChange={e => updateCandidate(cand.id, { al_session_id: e.target.value || null, dataset_id: null })}
                      >
                        <option value="">No — use full dataset</option>
                        {completeSessions.map(s => (
                          <option key={s.id} value={s.id}>{s.name || s.id.slice(0, 8)} ({s.labeled_count} labeled)</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-xl border border-border text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              ← Back
            </button>
            <Button className="flex-1" disabled={!step2Valid} onClick={() => setStep(3)}>
              Next: Review <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3 ─────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="p-5 bg-surface-primary border border-border rounded-xl space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">Review</h2>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-surface-secondary rounded-xl">
                <p className="text-xs text-text-tertiary">Dataset</p>
                <p className="font-medium text-text-primary mt-0.5">
                  {datasets.find(d => d.id === datasetId)?.name ?? '—'}
                </p>
              </div>
              <div className="p-3 bg-surface-secondary rounded-xl">
                <p className="text-xs text-text-tertiary">Target column</p>
                <p className="font-medium text-text-primary mt-0.5">{targetCol}</p>
              </div>
              <div className="p-3 bg-surface-secondary rounded-xl">
                <p className="text-xs text-text-tertiary">Task type</p>
                <p className="font-medium text-text-primary mt-0.5 capitalize">{taskType}</p>
              </div>
              <div className="p-3 bg-surface-secondary rounded-xl">
                <p className="text-xs text-text-tertiary">Eval protocol</p>
                <p className="font-medium text-text-primary mt-0.5">{PROTOCOL_LABELS[evalProtocol]}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-text-secondary mb-2">Candidates ({candidates.length})</p>
              <div className="space-y-1.5">
                {candidates.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2 text-xs text-text-secondary">
                    <span className="w-4 text-text-tertiary">{i + 1}.</span>
                    <span className="font-medium text-text-primary">{c.label || `${MODEL_LABELS[c.model_type]} (${PRESET_LABELS[c.preset]})`}</span>
                    {c.al_session_id && <span className="text-brand">· AL labels</span>}
                    {c.dataset_id && <span className="text-text-tertiary">· custom dataset</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {createMut.error && (
            <div className="p-3 bg-danger-50 border border-danger/20 rounded-xl text-xs text-danger">
              {(createMut.error as Error).message}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-xl border border-border text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              ← Back
            </button>
            <Button
              className="flex-1"
              loading={createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              <BarChart3 className="w-4 h-4" />
              Run Benchmark
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Job list ──────────────────────────────────────────────────────────

function JobList({
  jobs, onSelect, onCreate,
}: {
  jobs: BenchmarkJob[]
  onSelect: (id: string) => void
  onCreate: () => void
}) {
  const qc = useQueryClient()
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.benchmark.deleteJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['benchmark-jobs'] }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-brand" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-text-primary">Benchmark</h1>
          <p className="text-sm text-text-secondary">Compare multiple ML models side-by-side on the same dataset with a consistent evaluation protocol.</p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="w-4 h-4" />
          New Benchmark
        </Button>
      </div>

      {jobs.length === 0 ? (
        <div className="p-12 bg-surface-primary border border-dashed border-border rounded-2xl text-center">
          <BarChart3 className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
          <p className="text-sm font-medium text-text-primary mb-1">No benchmarks yet</p>
          <p className="text-sm text-text-tertiary mb-6">Run a benchmark to compare model performance across algorithms, presets, or datasets.</p>
          <Button onClick={onCreate}>
            Create first benchmark
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(j => {
            const complete = j.results.filter(r => r.status === 'complete').length
            const winner   = j.candidates.find(c => c.id === j.winner_candidate_id)
            const isClf    = j.task_type === 'classification'
            const winResult = j.results.find(r => r.candidate_id === j.winner_candidate_id)
            const bestMetric = winResult
              ? isClf
                ? `${fmtPct(winResult.metrics.accuracy ?? 0)} acc`
                : `R² ${winResult.metrics.r2?.toFixed(3) ?? '—'}`
              : null

            return (
              <div
                key={j.id}
                onClick={() => onSelect(j.id)}
                className="p-5 bg-surface-primary border border-border hover:border-brand/30 rounded-xl cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-medium text-text-primary">{j.name}</span>
                      <StatusBadge status={j.status} />
                    </div>
                    <div className="text-xs text-text-tertiary mt-1 flex gap-3 flex-wrap">
                      <span>Target: <span className="text-text-secondary">{j.target_column}</span></span>
                      <span>{PROTOCOL_LABELS[j.eval_protocol]}</span>
                      <span>{j.candidates.length} candidates</span>
                      <span className="capitalize">{j.task_type}</span>
                      <span>{formatRelativeTime(j.created_at)}</span>
                    </div>
                    {winner && bestMetric && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                        <Trophy className="w-3 h-3 text-yellow-500" />
                        <span className="text-text-secondary">{winner.label}</span>
                        <span className="text-brand font-semibold">{bestMetric}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {j.status === 'running' && (
                      <div className="text-right">
                        <p className="text-xs font-semibold text-brand">{complete}/{j.candidates.length}</p>
                        <p className="text-xs text-text-tertiary">running</p>
                      </div>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); deleteMut.mutate(j.id) }}
                      className="text-xs text-text-tertiary hover:text-danger transition-colors px-2 py-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {j.status === 'running' && (
                  <div className="mt-3 h-1 bg-surface-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full transition-all"
                      style={{ width: `${(complete / j.candidates.length) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page root ─────────────────────────────────────────────────────────

type View = { type: 'list' } | { type: 'setup' } | { type: 'job'; id: string }

export default function BenchmarkPage() {
  const [view, setView] = useState<View>({ type: 'list' })

  const { data: jobs = [], isLoading } = useQuery<BenchmarkJob[]>({
    queryKey: ['benchmark-jobs'],
    queryFn: () => api.benchmark.listJobs(),
    refetchInterval: q => {
      const list = q.state.data ?? []
      return list.some(j => j.status === 'running') ? 2000 : false
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 text-text-tertiary animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {view.type === 'list' && (
        <JobList
          jobs={jobs}
          onSelect={id => setView({ type: 'job', id })}
          onCreate={() => setView({ type: 'setup' })}
        />
      )}

      {view.type === 'setup' && (
        <div>
          <button
            onClick={() => setView({ type: 'list' })}
            className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary mb-5 transition-colors"
          >
            ← All benchmarks
          </button>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-text-primary">New Benchmark</h1>
              <p className="text-sm text-text-secondary">Configure candidates and run a side-by-side comparison</p>
            </div>
          </div>
          <SetupWizard onCreated={job => setView({ type: 'job', id: job.id })} />
        </div>
      )}

      {view.type === 'job' && (
        <JobView
          jobId={view.id}
          onBack={() => setView({ type: 'list' })}
        />
      )}
    </div>
  )
}
