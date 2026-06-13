import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3, Plus, Trash2, ChevronRight, ChevronDown,
  CheckCircle2, Loader2, XCircle, Trophy, ArrowRight,
  Download, Zap, Brain, Database, Clock,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
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

// ── Shared styles ─────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  padding: '20px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-card)',
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

const inputSmStyle: React.CSSProperties = {
  ...inputStyle,
  fontSize: '12px',
  padding: '6px 8px',
}

const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  fontWeight: 400,
}

// ── Sub-components ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'complete') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(52,211,153,.22)', borderRadius: 'var(--radius-pill)', padding: '3px 10px', flexShrink: 0 }}>
      <CheckCircle2 style={{ width: '12px', height: '12px' }} /> Complete
    </span>
  )
  if (status === 'running') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--blue-tint)', color: 'var(--accent)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-pill)', padding: '3px 10px', flexShrink: 0 }}>
      <Loader2 style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} /> Running
    </span>
  )
  if (status === 'failed') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--bad-dim)', color: 'var(--bad)', border: '1px solid rgba(239,68,68,.22)', borderRadius: 'var(--radius-pill)', padding: '3px 10px', flexShrink: 0 }}>
      <XCircle style={{ width: '12px', height: '12px' }} /> Failed
    </span>
  )
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--bg-3)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '3px 10px', flexShrink: 0 }}>
      <Clock style={{ width: '12px', height: '12px' }} /> Pending
    </span>
  )
}

// ── Confusion matrix ──────────────────────────────────────────────────

function ConfusionMatrix({ matrix, classes }: { matrix: number[][], classes: string[] }) {
  const maxVal = Math.max(...matrix.flat(), 1)
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ fontSize: '12px', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ padding: '6px', color: 'var(--text-tertiary)', textAlign: 'right', fontSize: '10px' }}>Act ↓ / Pred →</th>
            {classes.map(c => (
              <th key={c} style={{ padding: '6px', color: 'var(--text-secondary)', textAlign: 'center', minWidth: '48px', fontWeight: 500 }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, ri) => (
            <tr key={ri}>
              <td style={{ padding: '6px', color: 'var(--text-secondary)', textAlign: 'right', paddingRight: '8px', fontWeight: 500 }}>{classes[ri] ?? `C${ri}`}</td>
              {row.map((val, ci) => {
                const intensity = val / maxVal
                const isDiag = ri === ci
                return (
                  <td key={ci} style={{ padding: '6px', textAlign: 'center' }}>
                    <div
                      style={{
                        borderRadius: 'var(--radius-xs)',
                        padding: '4px 8px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        fontSize: '12px',
                        color: isDiag ? 'var(--accent)' : 'var(--bad)',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.slice(0, 10).map(item => (
        <div key={item.feature} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '112px', fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{item.feature}</div>
          <div style={{ flex: 1, height: '6px', background: 'var(--bg-3)', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '9999px', width: `${(item.importance / max) * 100}%` }} />
          </div>
          <div style={{ width: '40px', fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'right' }}>{fmtPct(item.importance)}</div>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
          <div style={{ width: '12px', height: '2px', background: 'rgba(99,102,241,0.5)' }} /> Train
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
          <div style={{ width: '12px', height: '2px', background: 'rgb(99,102,241)' }} /> Validation
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '96px' }}>
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
        {complete.map((r, i) => {
          const cand = candMap[r.candidate_id]
          const isWinner = r.candidate_id === job.winner_candidate_id
          return (
            <div key={r.candidate_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', flexShrink: 0, background: colors[i % colors.length] }} />
              {isWinner && <Trophy style={{ width: '12px', height: '12px', color: '#f59e0b' }} />}
              <span style={{ fontWeight: isWinner ? 600 : 400, color: isWinner ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{cand?.label ?? r.candidate_id}</span>
            </div>
          )
        })}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '160px' }}>
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
        {[0.25, 0.5, 0.75, 1.0].map(t => {
          const y = H - PAD_B - t * chartH
          return (
            <g key={t}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
              <text x={PAD_L - 4} y={y + 3} textAnchor="end" fontSize="8" fill="currentColor" opacity="0.4">{(t * 100).toFixed(0)}</text>
            </g>
          )
        })}
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
    <div style={{
      border: isWinner ? '1px solid rgba(245,158,11,.5)' : '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      overflow: 'hidden',
      background: isWinner ? 'rgba(245,158,11,.04)' : 'var(--bg-card)',
      transition: 'all 0.15s',
    }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          cursor: status === 'complete' ? 'pointer' : 'default',
        }}
        onClick={() => status === 'complete' && setOpen(v => !v)}
        onMouseEnter={e => { if (status === 'complete') (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        {/* Rank */}
        <div style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 700,
          flexShrink: 0,
          background: isWinner ? '#f59e0b' : 'var(--bg-3)',
          color: isWinner ? '#fff' : 'var(--text-tertiary)',
        }}>
          {isWinner ? <Trophy style={{ width: '12px', height: '12px' }} /> : rank}
        </div>

        {/* Label + model info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {candidate.label}
            </span>
            {isWinner && (
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', padding: '2px 6px', borderRadius: 'var(--radius-pill)' }}>
                Winner
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span>{MODEL_LABELS[candidate.model_type]}</span>
            <span>·</span>
            <span>{PRESET_LABELS[candidate.preset]}</span>
            {result?.training_time_ms ? <><span>·</span><span>{fmtMs(result.training_time_ms)}</span></> : null}
          </div>
        </div>

        {/* Metrics summary */}
        {status === 'complete' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'right', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: isWinner ? 'var(--accent)' : 'var(--text-primary)' }}>{primaryMetric}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{primaryLabel}</div>
            </div>
            {isClf && metrics.f1 != null && (
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{fmtPct(metrics.f1)}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>F1</div>
              </div>
            )}
            {isClf && metrics.accuracy_std != null && (
              <div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>±{fmtPct(metrics.accuracy_std)}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Std</div>
              </div>
            )}
            {!isClf && metrics.mae != null && (
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{metrics.mae.toFixed(4)}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>MAE</div>
              </div>
            )}
          </div>
        )}

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <StatusBadge status={status} />
          {status === 'complete' && (
            open
              ? <ChevronDown style={{ width: '14px', height: '14px', color: 'var(--text-tertiary)' }} />
              : <ChevronRight style={{ width: '14px', height: '14px', color: 'var(--text-tertiary)' }} />
          )}
          {status === 'failed' && result?.error_message && (
            <span style={{ fontSize: '12px', color: 'var(--bad)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.error_message}</span>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {open && result && status === 'complete' && (
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-2)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* All metrics */}
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>All metrics</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(metrics).map(([k, v]) => (
                <div key={k} style={{ padding: '6px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)', textAlign: 'center', minWidth: '80px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {isClf && !k.includes('std') ? fmtPct(v) : v.toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {result.confusion_matrix && result.label_classes.length > 0 && (
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Confusion Matrix</p>
                <ConfusionMatrix matrix={result.confusion_matrix} classes={result.label_classes} />
              </div>
            )}

            {result.feature_importances.length > 0 && (
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Feature Importance</p>
                <FeatureImportanceBars items={result.feature_importances} />
              </div>
            )}
          </div>

          {result.learning_curve.length >= 2 && (
            <div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Learning Curve</p>
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
  const failed    = job.results.filter(r => r.status === 'failed').length
  const total     = job.candidates.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Progress bar while running */}
      {job.status === 'running' && (
        <div style={{ padding: '16px', background: 'var(--blue-tint)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-card)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontWeight: 500 }}>
              <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
              Running candidates in parallel…
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>{complete} / {total} complete{failed > 0 ? ` · ${failed} failed` : ''}</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(99,102,241,.2)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
            <div
              style={{ height: '100%', background: 'var(--accent)', borderRadius: 'var(--radius-pill)', transition: 'width 0.5s', width: `${(complete / total) * 100}%` }}
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
          <div style={{ padding: '16px', background: '#fef9e7', border: '1px solid #fcd34d', borderRadius: 'var(--radius-card)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-card)', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Trophy style={{ width: '20px', height: '20px', color: '#fff' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{winner.label} wins</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Best {label}: <strong>{primary}</strong>
                {isClf && result.metrics.f1 != null && ` · F1: ${fmtPct(result.metrics.f1)}`}
                {` · ${fmtMs(result.training_time_ms)}`}
              </p>
            </div>
            <a
              href={api.benchmark.exportUrl(job.id)}
              download
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', borderRadius: 'var(--radius-btn)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none', flexShrink: 0, transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
            >
              <Download style={{ width: '14px', height: '14px' }} />
              Export CSV
            </a>
          </div>
        )
      })()}

      {/* Metric comparison chart */}
      {job.status === 'complete' && (
        <div style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>Metric Comparison</p>
          <MetricComparisonChart job={job} />
        </div>
      )}

      {/* Candidate rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px', color: 'var(--text-tertiary)', fontSize: '14px' }}>
        <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite', marginRight: '8px' }} />Loading…
      </div>
    )
  }

  const complete = job.results.filter(r => r.status === 'complete').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <button
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '8px', transition: 'color 0.15s' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)')}
          >
            ← All benchmarks
          </button>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>{job.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', fontSize: '12px', color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
            <span>Target: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{job.target_column}</span></span>
            <span>{PROTOCOL_LABELS[job.eval_protocol]}</span>
            <span>{job.candidates.length} candidates</span>
            <span>{complete}/{job.candidates.length} complete</span>
            <span>{formatRelativeTime(job.created_at)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <StatusBadge status={job.status} />
          <button
            onClick={() => deleteMut.mutate()}
            style={{ fontSize: '12px', padding: '6px 12px', borderRadius: 'var(--radius-btn)', border: '1px solid var(--border)', color: 'var(--text-tertiary)', background: 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--bad)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,.3)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
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

  const stepCircle = (s: number) => ({
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
    background: step === s ? 'var(--accent)' : step > s ? 'var(--green)' : 'var(--bg-3)',
    color: step === s || step > s ? '#fff' : 'var(--text-tertiary)',
    transition: 'all 0.2s',
  } as React.CSSProperties)

  return (
    <div style={{ maxWidth: '768px', margin: '0 auto' }}>
      {/* Steps indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={stepCircle(s)}>
              {step > s ? <CheckCircle2 style={{ width: '14px', height: '14px' }} /> : s}
            </div>
            <span style={{ fontSize: '12px', fontWeight: 500, color: step >= s ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
              {s === 1 ? 'Data & Protocol' : s === 2 ? 'Candidates' : 'Review'}
            </span>
            {s < 3 && <ChevronRight style={{ width: '12px', height: '12px', color: 'var(--text-tertiary)' }} />}
          </div>
        ))}
      </div>

      {/* ── Step 1 ── */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Dataset & Target</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Job name (optional)</label>
                <input style={inputStyle} placeholder="e.g. Churn model comparison" value={jobName} onChange={e => setJobName(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Task type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['classification', 'regression'] as const).map(t => {
                    const isActive = taskType === t
                    return (
                      <button
                        key={t}
                        onClick={() => setTaskType(t)}
                        style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-btn)', fontSize: '14px', fontWeight: 500, border: isActive ? '2px solid var(--accent)' : '2px solid var(--border)', background: isActive ? 'var(--blue-tint)' : 'var(--bg-2)', color: isActive ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                      >
                        {t === 'classification' ? 'Classification' : 'Regression'}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Source dataset *</label>
                <select style={inputStyle} value={datasetId} onChange={e => { setDatasetId(e.target.value); setTargetCol('') }}>
                  <option value="">Select dataset…</option>
                  {datasets.filter(d => d.status === 'ready').map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Target column *</label>
                <select style={inputStyle} value={targetCol} onChange={e => setTargetCol(e.target.value)} disabled={!datasetId}>
                  <option value="">Select column…</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Eval protocol */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Evaluation protocol</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {(Object.keys(PROTOCOL_LABELS) as BenchmarkEvalProtocol[]).map(p => {
                const isActive = evalProtocol === p
                return (
                  <button
                    key={p}
                    onClick={() => setEvalProtocol(p)}
                    style={{ padding: '12px', borderRadius: 'var(--radius-card)', textAlign: 'left', border: isActive ? '2px solid var(--accent)' : '2px solid var(--border)', background: isActive ? 'var(--blue-tint)' : 'var(--bg-2)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 600, color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {PROTOCOL_LABELS[p]}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px', lineHeight: 1.4 }}>{PROTOCOL_DESC[p]}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <Button className="w-full" disabled={!step1Valid} onClick={() => setStep(2)}>
            Next: Configure candidates <ArrowRight style={{ width: '16px', height: '16px' }} />
          </Button>
        </div>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Candidates ({candidates.length})</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={addAllModels}
                style={{ fontSize: '12px', padding: '6px 12px', borderRadius: 'var(--radius-btn)', border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
              >
                <Zap style={{ width: '14px', height: '14px' }} /> Add all models
              </button>
              <button
                onClick={addCandidate}
                style={{ fontSize: '12px', padding: '6px 12px', borderRadius: 'var(--radius-btn)', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'background 0.15s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--accent-hover)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--accent)')}
              >
                <Plus style={{ width: '14px', height: '14px' }} /> Add candidate
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {candidates.map((cand, idx) => (
              <div key={cand.id} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ ...monoLabel }}>Candidate {idx + 1}</span>
                  <button
                    onClick={() => removeCandidate(cand.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', transition: 'color 0.15s' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--bad)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)')}
                  >
                    <Trash2 style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Model</label>
                    <select style={inputSmStyle} value={cand.model_type} onChange={e => updateCandidate(cand.id, { model_type: e.target.value as BenchmarkModelType })}>
                      {ALL_MODELS.map(m => <option key={m} value={m}>{MODEL_LABELS[m]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Preset</label>
                    <select style={inputSmStyle} value={cand.preset} onChange={e => updateCandidate(cand.id, { preset: e.target.value as BenchmarkPreset })}>
                      {(Object.keys(PRESET_LABELS) as BenchmarkPreset[]).map(p => (
                        <option key={p} value={p}>{PRESET_LABELS[p]} — {PRESET_DESC[p]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Label (optional)</label>
                    <input style={inputSmStyle} placeholder="Auto-generated if blank" value={cand.label} onChange={e => updateCandidate(cand.id, { label: e.target.value })} />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      <Database style={{ width: '12px', height: '12px', display: 'inline', marginRight: '4px' }} />Dataset override
                    </label>
                    <select style={inputSmStyle} value={cand.dataset_id ?? ''} onChange={e => updateCandidate(cand.id, { dataset_id: e.target.value || null, al_session_id: null })}>
                      <option value="">Same as job dataset</option>
                      {datasets.filter(d => d.status === 'ready').map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {completeSessions.length > 0 && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        <Brain style={{ width: '12px', height: '12px', display: 'inline', marginRight: '4px' }} />Use AL session labels
                      </label>
                      <select style={inputSmStyle} value={cand.al_session_id ?? ''} onChange={e => updateCandidate(cand.id, { al_session_id: e.target.value || null, dataset_id: null })}>
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

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setStep(1)}
              style={{ padding: '9px 18px', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', fontSize: '14px', color: 'var(--text-secondary)', background: 'transparent', cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)')}
            >
              ← Back
            </button>
            <Button className="flex-1" disabled={!step2Valid} onClick={() => setStep(3)}>
              Next: Review <ArrowRight style={{ width: '16px', height: '16px' }} />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3 ── */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Review</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
              <div style={{ padding: '12px', background: 'var(--bg-2)', borderRadius: 'var(--radius-card)' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Dataset</p>
                <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {datasets.find(d => d.id === datasetId)?.name ?? '—'}
                </p>
              </div>
              <div style={{ padding: '12px', background: 'var(--bg-2)', borderRadius: 'var(--radius-card)' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Target column</p>
                <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px' }}>{targetCol}</p>
              </div>
              <div style={{ padding: '12px', background: 'var(--bg-2)', borderRadius: 'var(--radius-card)' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Task type</p>
                <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px', textTransform: 'capitalize' }}>{taskType}</p>
              </div>
              <div style={{ padding: '12px', background: 'var(--bg-2)', borderRadius: 'var(--radius-card)' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Eval protocol</p>
                <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px' }}>{PROTOCOL_LABELS[evalProtocol]}</p>
              </div>
            </div>

            <div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Candidates ({candidates.length})</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {candidates.map((c, i) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span style={{ width: '16px', color: 'var(--text-tertiary)' }}>{i + 1}.</span>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.label || `${MODEL_LABELS[c.model_type]} (${PRESET_LABELS[c.preset]})`}</span>
                    {c.al_session_id && <span style={{ color: 'var(--accent)' }}>· AL labels</span>}
                    {c.dataset_id && <span style={{ color: 'var(--text-tertiary)' }}>· custom dataset</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {createMut.error && (
            <div style={{ padding: '12px', background: 'var(--bad-dim)', border: '1px solid rgba(239,68,68,.22)', borderRadius: 'var(--radius-card)', fontSize: '12px', color: 'var(--bad)' }}>
              {(createMut.error as Error).message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setStep(2)}
              style={{ padding: '9px 18px', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', fontSize: '14px', color: 'var(--text-secondary)', background: 'transparent', cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)')}
            >
              ← Back
            </button>
            <Button
              className="flex-1"
              loading={createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              <BarChart3 style={{ width: '16px', height: '16px' }} />
              Run Benchmark
              <ArrowRight style={{ width: '16px', height: '16px' }} />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-card)', background: 'var(--blue-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BarChart3 style={{ width: '20px', height: '20px', color: 'var(--accent)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>Benchmark</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Compare multiple ML models side-by-side on the same dataset with a consistent evaluation protocol.</p>
        </div>
        <Button onClick={onCreate}>
          <Plus style={{ width: '16px', height: '16px' }} />
          New Benchmark
        </Button>
      </div>

      {jobs.length === 0 ? (
        <div style={{ padding: '48px', background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: '16px', textAlign: 'center' }}>
          <BarChart3 style={{ width: '40px', height: '40px', color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>No benchmarks yet</p>
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '24px' }}>Run a benchmark to compare model performance across algorithms, presets, or datasets.</p>
          <Button onClick={onCreate}>
            Create first benchmark
            <ArrowRight style={{ width: '16px', height: '16px' }} />
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-accent)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{j.name}</span>
                      <StatusBadge status={j.status} />
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span>Target: <span style={{ color: 'var(--text-secondary)' }}>{j.target_column}</span></span>
                      <span>{PROTOCOL_LABELS[j.eval_protocol]}</span>
                      <span>{j.candidates.length} candidates</span>
                      <span style={{ textTransform: 'capitalize' }}>{j.task_type}</span>
                      <span>{formatRelativeTime(j.created_at)}</span>
                    </div>
                    {winner && bestMetric && (
                      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                        <Trophy style={{ width: '12px', height: '12px', color: '#f59e0b' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{winner.label}</span>
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{bestMetric}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    {j.status === 'running' && (
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>{complete}/{j.candidates.length}</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>running</p>
                      </div>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); deleteMut.mutate(j.id) }}
                      style={{ fontSize: '12px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', transition: 'color 0.15s' }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--bad)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)')}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {j.status === 'running' && (
                  <div style={{ marginTop: '12px', height: '4px', background: 'var(--bg-3)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                    <div
                      style={{ height: '100%', background: 'var(--accent)', borderRadius: 'var(--radius-pill)', transition: 'width 0.3s', width: `${(complete / j.candidates.length) * 100}%` }}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px' }}>
        <Loader2 style={{ width: '20px', height: '20px', color: 'var(--text-tertiary)', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
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
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', transition: 'color 0.15s' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)')}
          >
            ← All benchmarks
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-card)', background: 'var(--blue-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 style={{ width: '20px', height: '20px', color: 'var(--accent)' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>New Benchmark</h1>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Configure candidates and run a side-by-side comparison</p>
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
