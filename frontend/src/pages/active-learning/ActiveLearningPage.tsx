import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Brain, ChevronRight, CheckCircle2, Loader2,
  ArrowRight, Target, TrendingUp, Zap, BarChart3, Download,
  Plus, Trash2, Wand2, Keyboard, ExternalLink,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { formatRelativeTime } from '@/lib/utils'
import type {
  ALSession, ALBatch, ALBatchRow, ALRound, ALPredictOut,
  ALTaskType, ALModelType, ALSamplingStrategy,
  Dataset, ColumnProfile,
} from '@/types'

// ── Static config ─────────────────────────────────────────────────────

const MODEL_LABELS: Record<ALModelType, string> = {
  logistic_regression: 'Logistic Regression',
  random_forest: 'Random Forest',
  xgboost: 'XGBoost',
  svm: 'SVM',
  mlp: 'Neural Net (MLP)',
}

const STRATEGY_LABELS: Record<ALSamplingStrategy, string> = {
  random: 'Random (Seed)',
  least_confidence: 'Least Confidence',
  margin: 'Margin Sampling',
  entropy: 'Entropy Sampling',
  coreset: 'Core-Set',
  committee: 'Query by Committee',
}

const STRATEGY_DESC: Record<ALSamplingStrategy, string> = {
  random: 'Random seed — good for diversity in the first round.',
  least_confidence: 'Pick examples the model is least certain about.',
  margin: 'Pick examples where top-2 class probabilities are closest.',
  entropy: 'Highest uncertainty across all classes. Best overall default.',
  coreset: 'Geometrically diverse examples via k-means in feature space.',
  committee: 'Examples where an ensemble of weak models disagrees most.',
}

const BATCH_DESC: Record<number, string> = {
  20: 'Quick rounds. Faster iteration, more rounds needed.',
  30: 'Balanced. Good default for most datasets.',
  50: 'Efficient. Fewer rounds needed, more work each round.',
  100: 'Large batches. Best for big datasets.',
}

function fmtPct(v: number) { return `${(v * 100).toFixed(1)}%` }

// ── Shared style helpers ──────────────────────────────────────────────

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

const monoLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  fontWeight: 400,
}

// ── Setup form ────────────────────────────────────────────────────────

function SetupForm({ onCreated }: { onCreated: (s: ALSession) => void }) {
  const qc = useQueryClient()
  const { data: datasets = [] } = useQuery<Dataset[]>({
    queryKey: ['datasets'],
    queryFn: () => api.datasets.list(),
  })

  const [datasetId, setDatasetId] = useState('')
  const [name, setName] = useState('')
  const [modelName, setModelName] = useState('')
  const [targetCol, setTargetCol] = useState('')
  const [taskType, setTaskType] = useState<ALTaskType>('classification')
  const [modelType, setModelType] = useState<ALModelType>('random_forest')
  const [strategy, setStrategy] = useState<ALSamplingStrategy>('entropy')
  const [batchSize, setBatchSize] = useState(30)
  const [labelClasses, setLabelClasses] = useState('')
  const [excludeCols, setExcludeCols] = useState('')
  const [targetAcc, setTargetAcc] = useState('')
  const [maxRounds, setMaxRounds] = useState(10)

  const { data: columnProfiles = [] } = useQuery<ColumnProfile[]>({
    queryKey: ['columns', datasetId],
    queryFn: () => api.columns.list(datasetId),
    enabled: !!datasetId,
  })
  const columns = columnProfiles.map(c => c.name)

  const createMut = useMutation({
    mutationFn: () => api.al.createSession({
      name,
      model_name: modelName,
      dataset_id: datasetId,
      target_column: targetCol,
      task_type: taskType,
      model_type: modelType,
      sampling_strategy: strategy,
      batch_size: batchSize,
      label_classes: taskType === 'classification'
        ? labelClasses.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      exclude_columns: excludeCols.split(',').map(s => s.trim()).filter(Boolean),
      target_accuracy: targetAcc ? parseFloat(targetAcc) / 100 : null,
      max_rounds: maxRounds,
    }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['al-sessions'] })
      onCreated(s)
    },
  })

  const ready = !!datasetId && !!targetCol

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Session identity */}
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Session setup</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Session name (optional)</label>
            <input style={inputStyle} placeholder="e.g. Order classification v1" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Export model name (optional)</label>
            <input style={inputStyle} placeholder="e.g. order_value_classifier_v1" value={modelName} onChange={e => setModelName(e.target.value)} />
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
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Max rounds</label>
            <input type="number" min="1" max="50" style={inputStyle} value={maxRounds} onChange={e => setMaxRounds(parseInt(e.target.value) || 10)} />
          </div>
        </div>

        {/* Task type */}
        <div>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Task type</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['classification', 'regression'] as ALTaskType[]).map(t => {
              const isActive = taskType === t
              return (
                <button
                  key={t}
                  onClick={() => setTaskType(t)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 'var(--radius-btn)',
                    fontSize: '14px',
                    fontWeight: 500,
                    border: isActive ? '2px solid var(--accent)' : '2px solid var(--border)',
                    background: isActive ? 'var(--blue-tint)' : 'var(--bg-2)',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {t === 'classification' ? 'Classification' : 'Regression'}
                </button>
              )
            })}
          </div>
        </div>

        {taskType === 'classification' && (
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Label classes (comma-separated)</label>
            <input style={inputStyle} placeholder="e.g. high, medium, low" value={labelClasses} onChange={e => setLabelClasses(e.target.value)} />
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>Leave blank to auto-detect from labels you enter.</p>
          </div>
        )}

        {taskType === 'classification' && targetAcc !== undefined && (
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Stop when accuracy reaches (%)</label>
            <input type="number" min="50" max="100" style={inputStyle} placeholder="e.g. 90 — leave blank to run all rounds" value={targetAcc} onChange={e => setTargetAcc(e.target.value)} />
          </div>
        )}

        <div>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Exclude columns (comma-separated)</label>
          <input style={inputStyle} placeholder="e.g. id, created_at, order_id" value={excludeCols} onChange={e => setExcludeCols(e.target.value)} />
        </div>
      </div>

      {/* Model */}
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Model</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(Object.keys(MODEL_LABELS) as ALModelType[]).map(m => {
            const isActive = modelType === m
            return (
              <button
                key={m}
                onClick={() => setModelType(m)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-btn)',
                  fontSize: '12px',
                  fontWeight: 500,
                  border: isActive ? '2px solid var(--accent)' : '2px solid var(--border)',
                  background: isActive ? 'var(--blue-tint)' : 'var(--bg-2)',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                {MODEL_LABELS[m]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Sampling strategy */}
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Sampling strategy</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {(Object.keys(STRATEGY_LABELS) as ALSamplingStrategy[]).map(s => {
            const isActive = strategy === s
            return (
              <button
                key={s}
                onClick={() => setStrategy(s)}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-card)',
                  textAlign: 'left',
                  border: isActive ? '2px solid var(--accent)' : '2px solid var(--border)',
                  background: isActive ? 'var(--blue-tint)' : 'var(--bg-2)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {STRATEGY_LABELS[s]}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>{STRATEGY_DESC[s]}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Batch size */}
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Batch size per round</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
          {[20, 30, 50, 100].map(b => {
            const isActive = batchSize === b
            return (
              <button
                key={b}
                onClick={() => setBatchSize(b)}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-card)',
                  textAlign: 'left',
                  border: isActive ? '2px solid var(--accent)' : '2px solid var(--border)',
                  background: isActive ? 'var(--blue-tint)' : 'var(--bg-2)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 700, color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>{b}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>{BATCH_DESC[b]}</div>
              </button>
            )
          })}
        </div>
      </div>

      {createMut.error && (
        <div style={{ background: 'var(--bad-dim)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 'var(--radius-btn)', padding: '12px 16px', fontSize: '14px', color: 'var(--bad)' }}>
          {(createMut.error as Error).message}
        </div>
      )}

      <Button
        className="w-full"
        disabled={!ready}
        loading={createMut.isPending}
        onClick={() => createMut.mutate()}
      >
        <Brain style={{ width: '16px', height: '16px' }} />
        Start Active Learning
        <ArrowRight style={{ width: '16px', height: '16px' }} />
      </Button>
    </div>
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
              <th key={c} style={{ padding: '6px', color: 'var(--text-secondary)', textAlign: 'center', minWidth: '52px', fontWeight: 500 }}>{c}</th>
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

// ── Feature importance ────────────────────────────────────────────────

function FeatureImportanceBar({ items }: { items: { feature: string; importance: number }[] }) {
  const max = items[0]?.importance ?? 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.slice(0, 8).map(item => (
        <div key={item.feature} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '112px', fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{item.feature}</div>
          <div style={{ flex: 1, height: '6px', background: 'var(--bg-3)', borderRadius: '9999px', overflow: 'hidden' }}>
            <div
              style={{ height: '100%', background: 'var(--accent)', borderRadius: '9999px', width: `${(item.importance / max) * 100}%` }}
            />
          </div>
          <div style={{ width: '40px', fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'right' }}>{fmtPct(item.importance)}</div>
        </div>
      ))}
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────────

function MetricCard({ label, value, sub, accent = false }: {
  label: string; value: string; sub: string; accent?: boolean
}) {
  return (
    <div style={{
      borderRadius: 'var(--radius-card)',
      padding: '12px',
      border: accent ? '1px solid var(--border-accent)' : '1px solid var(--border)',
      background: accent ? 'var(--blue-tint)' : 'var(--bg-2)',
    }}>
      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '2px', color: accent ? 'var(--accent)' : 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{sub}</div>
    </div>
  )
}

// ── Metrics panel ─────────────────────────────────────────────────────

function MetricsPanel({ round }: { round: ALRound }) {
  const isReg = !('accuracy' in round.metrics)
  const [showExp, setShowExp] = useState(true)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {isReg ? (
          <>
            <MetricCard label="R²" value={(round.metrics.r2 ?? 0).toFixed(3)} sub="Variance explained" accent />
            <MetricCard label="MAE" value={(round.metrics.mae ?? 0).toFixed(4)} sub="Mean absolute error" />
            <MetricCard label="RMSE" value={(round.metrics.rmse ?? 0).toFixed(4)} sub="Root mean squared error" />
          </>
        ) : (
          <>
            <MetricCard label="Accuracy" value={fmtPct(round.metrics.accuracy ?? 0)} sub="Overall correctness" accent />
            <MetricCard label="F1 Score" value={fmtPct(round.metrics.f1 ?? 0)} sub="Precision × recall" />
            <MetricCard label="Precision" value={fmtPct(round.metrics.precision ?? 0)} sub="When it says yes" />
            <MetricCard label="Recall" value={fmtPct(round.metrics.recall ?? 0)} sub="Finds all positives" />
          </>
        )}
      </div>

      {round.confusion_matrix && round.label_classes.length > 0 && (
        <div style={{ padding: '16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>Confusion Matrix</p>
          <ConfusionMatrix matrix={round.confusion_matrix} classes={round.label_classes} />
        </div>
      )}

      {round.feature_importances.length > 0 && (
        <div style={{ padding: '16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>Feature Importance</p>
          <FeatureImportanceBar items={round.feature_importances} />
        </div>
      )}

      {/* Explanation */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
        <button
          onClick={() => setShowExp(v => !v)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--bg-inset)',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-2)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-inset)')}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>What happened this round?</span>
          <ChevronRight style={{ width: '14px', height: '14px', color: 'var(--text-tertiary)', transform: showExp ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>
        {showExp && (
          <div style={{ padding: '12px 16px 16px', background: 'var(--bg-card)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {round.explanation.split('\n').filter(l => l.trim()).map((line, i) => (
                <p key={i} dangerouslySetInnerHTML={{
                  __html: line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Accuracy trend chart ──────────────────────────────────────────────

function AccuracyChart({ rounds, taskType }: { rounds: ALRound[]; taskType: string }) {
  if (rounds.length < 2) return null
  const isReg = taskType === 'regression'
  const points = rounds.map(r => isReg ? (r.metrics.r2 ?? 0) : (r.metrics.accuracy ?? 0))
  const W = 280, H = 100, PAD = 24
  const minY = isReg ? Math.min(0, ...points) : 0
  const maxY = isReg ? Math.max(1, ...points) : 1
  const range = maxY - minY || 1
  const xs = points.map((_, i) => PAD + (i / (points.length - 1)) * (W - PAD * 2))
  const ys = points.map(v => H - PAD - ((v - minY) / range) * (H - PAD * 2))
  const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(' ')
  const lastX = xs[xs.length - 1], lastY = ys[ys.length - 1]
  const lastVal = points[points.length - 1]

  return (
    <div style={{ padding: '16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{isReg ? 'R² Trend' : 'Accuracy Trend'}</p>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>{isReg ? lastVal.toFixed(3) : fmtPct(lastVal)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '80px' }}>
        {[0.25, 0.5, 0.75].map(t => {
          const y = H - PAD - t * (H - PAD * 2)
          return <line key={t} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
        })}
        <polygon
          points={`${xs[0]},${H - PAD} ${polyline} ${lastX},${H - PAD}`}
          fill="rgb(99,102,241)"
          fillOpacity="0.08"
        />
        <polyline
          points={polyline}
          fill="none"
          stroke="rgb(99,102,241)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r="3" fill="rgb(99,102,241)" />
        ))}
        <text x={lastX} y={lastY - 7} textAnchor="middle" fontSize="9" fill="rgb(99,102,241)" fontWeight="600">
          {isReg ? lastVal.toFixed(2) : fmtPct(lastVal)}
        </text>
        {xs.map((x, i) => (
          <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.4">
            R{rounds[i].round}
          </text>
        ))}
      </svg>
    </div>
  )
}

// ── Rule builder types ────────────────────────────────────────────────

type ColType = 'numeric' | 'categorical' | 'boolean'
type Operator =
  | 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq' | 'between'
  | 'is' | 'is_not' | 'is_one_of' | 'is_not_one_of' | 'contains'
  | 'is_true' | 'is_false' | 'is_null' | 'is_not_null'

interface Condition {
  id: string
  column: string
  operator: Operator
  value: string
  value2: string
  values: string[]
}

interface Rule {
  id: string
  conditions: Condition[]
  connector: 'AND' | 'OR'
  label: string
}

const NUMERIC_OPS: { op: Operator; label: string }[] = [
  { op: 'gt', label: '> greater than' },
  { op: 'gte', label: '>= at least' },
  { op: 'lt', label: '< less than' },
  { op: 'lte', label: '<= at most' },
  { op: 'eq', label: '= equals' },
  { op: 'neq', label: '≠ not equals' },
  { op: 'between', label: 'between' },
  { op: 'is_null', label: 'is null' },
  { op: 'is_not_null', label: 'is not null' },
]

const CAT_OPS: { op: Operator; label: string }[] = [
  { op: 'is', label: 'is' },
  { op: 'is_not', label: 'is not' },
  { op: 'is_one_of', label: 'is one of' },
  { op: 'is_not_one_of', label: 'is not one of' },
  { op: 'contains', label: 'contains' },
  { op: 'is_null', label: 'is null' },
  { op: 'is_not_null', label: 'is not null' },
]

const BOOL_OPS: { op: Operator; label: string }[] = [
  { op: 'is_true', label: 'is true' },
  { op: 'is_false', label: 'is false' },
  { op: 'is_null', label: 'is null' },
  { op: 'is_not_null', label: 'is not null' },
]

function detectColType(col: string, rows: ALBatchRow[]): ColType {
  const vals = rows.map(r => r.data[col]).filter(v => v != null)
  if (vals.length === 0) return 'categorical'
  if (vals.every(v => typeof v === 'boolean')) return 'boolean'
  if (vals.every(v => typeof v === 'number')) return 'numeric'
  if (vals.every(v => typeof v === 'string' && !isNaN(Number(v)) && v.trim() !== '')) return 'numeric'
  return 'categorical'
}

function getOpsForType(t: ColType) {
  if (t === 'numeric') return NUMERIC_OPS
  if (t === 'boolean') return BOOL_OPS
  return CAT_OPS
}

function getUniqueVals(col: string, rows: ALBatchRow[]): string[] {
  const seen = new Set<string>()
  rows.forEach(r => { if (r.data[col] != null) seen.add(String(r.data[col])) })
  return Array.from(seen).sort()
}

function evalCondition(val: unknown, cond: Condition, colType: ColType): boolean {
  const { operator, value, value2, values } = cond
  if (operator === 'is_null') return val == null || val === ''
  if (operator === 'is_not_null') return val != null && val !== ''
  if (operator === 'is_true') return val === true || val === 'true' || val === 1
  if (operator === 'is_false') return val === false || val === 'false' || val === 0
  if (val == null) return false

  if (colType === 'numeric') {
    const n = typeof val === 'number' ? val : parseFloat(String(val))
    const v1 = parseFloat(value)
    const v2 = parseFloat(value2)
    if (isNaN(n)) return false
    if (operator === 'gt') return n > v1
    if (operator === 'gte') return n >= v1
    if (operator === 'lt') return n < v1
    if (operator === 'lte') return n <= v1
    if (operator === 'eq') return n === v1
    if (operator === 'neq') return n !== v1
    if (operator === 'between') return n >= v1 && n <= v2
  } else {
    const s = String(val).toLowerCase()
    if (operator === 'is') return s === value.toLowerCase()
    if (operator === 'is_not') return s !== value.toLowerCase()
    if (operator === 'is_one_of') return values.map(v => v.toLowerCase()).includes(s)
    if (operator === 'is_not_one_of') return !values.map(v => v.toLowerCase()).includes(s)
    if (operator === 'contains') return s.includes(value.toLowerCase())
  }
  return false
}

function evalRule(row: ALBatchRow, rule: Rule, colTypes: Record<string, ColType>): boolean {
  if (rule.conditions.length === 0) return false
  const results = rule.conditions.map(c => evalCondition(row.data[c.column], c, colTypes[c.column] ?? 'categorical'))
  return rule.connector === 'AND' ? results.every(Boolean) : results.some(Boolean)
}

function applyRules(rows: ALBatchRow[], rules: Rule[], defaultLabel: string, colTypes: Record<string, ColType>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const row of rows) {
    for (const rule of rules) {
      if (rule.label && evalRule(row, rule, colTypes)) {
        out[String(row.row_index)] = rule.label
        break
      }
    }
    if (!out[String(row.row_index)] && defaultLabel) {
      out[String(row.row_index)] = defaultLabel
    }
  }
  return out
}

function mkId() { return Math.random().toString(36).slice(2) }
function mkCondition(col: string): Condition {
  return { id: mkId(), column: col, operator: 'gt', value: '', value2: '', values: [] }
}
function mkRule(firstCol: string, label: string): Rule {
  return { id: mkId(), conditions: [mkCondition(firstCol)], connector: 'AND', label }
}

// ── Rule builder component ────────────────────────────────────────────

function RuleBuilder({
  batch,
  session,
  featureCols,
  allCols,
  onApply,
}: {
  batch: ALBatch
  session: ALSession
  featureCols: string[]
  allCols: string[]
  onApply: (labels: Record<string, string>) => void
}) {
  const classes = session.label_classes
  const [rules, setRules] = useState<Rule[]>([mkRule(featureCols[0] ?? '', classes[0] ?? '')])
  const [defaultLabel, setDefaultLabel] = useState(classes[classes.length - 1] ?? '')
  const [refCol, setRefCol] = useState('')

  const colTypes: Record<string, ColType> = {}
  featureCols.forEach(c => { colTypes[c] = detectColType(c, batch.batch) })

  const counts = rules.map(rule =>
    batch.batch.filter(row => evalRule(row, rule, colTypes)).length
  )
  const totalCovered = new Set(
    batch.batch
      .filter(row => rules.some(r => r.label && evalRule(row, r, colTypes)))
      .map(r => r.row_index)
  ).size
  const uncovered = batch.batch.length - totalCovered

  const setRule = (id: string, patch: Partial<Rule>) =>
    setRules(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))

  const setCond = (ruleId: string, condId: string, patch: Partial<Condition>) =>
    setRules(rs => rs.map(r => r.id === ruleId ? {
      ...r,
      conditions: r.conditions.map(c => c.id === condId ? { ...c, ...patch } : c)
    } : r))

  const addCond = (ruleId: string) =>
    setRules(rs => rs.map(r => r.id === ruleId ? {
      ...r, conditions: [...r.conditions, mkCondition(featureCols[0] ?? '')]
    } : r))

  const removeCond = (ruleId: string, condId: string) =>
    setRules(rs => rs.map(r => r.id === ruleId ? {
      ...r, conditions: r.conditions.filter(c => c.id !== condId)
    } : r))

  const handleApply = () => {
    if (refCol) {
      const out: Record<string, string> = {}
      batch.batch.forEach(row => {
        const v = row.data[refCol]
        if (v != null) out[String(row.row_index)] = String(v)
      })
      onApply(out)
    } else {
      onApply(applyRules(batch.batch, rules, defaultLabel, colTypes))
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-inset)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wand2 style={{ width: '16px', height: '16px', color: 'var(--accent)' }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Auto-label with rules</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
          {totalCovered}/{batch.batch.length} rows matched · {uncovered} will use default
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-card)' }}>
        {/* Reference column shortcut */}
        <div style={{ padding: '12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Quick: copy from existing column</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              style={{ ...inputSmStyle, flex: 1 }}
              value={refCol}
              onChange={e => setRefCol(e.target.value)}
            >
              <option value="">— select column —</option>
              {allCols.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {refCol && (
              <button
                onClick={handleApply}
                style={{ padding: '6px 12px', borderRadius: 'var(--radius-btn)', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 500, border: 'none', cursor: 'pointer' }}
              >
                Apply
              </button>
            )}
          </div>
          {refCol && (
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
              Will copy values from <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{refCol}</span> as labels for all {batch.batch.length} rows.
            </p>
          )}
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>or build rules</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        {/* Rules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rules.map((rule, rIdx) => {
            void (rule.conditions[0]
              ? getOpsForType(colTypes[rule.conditions[0].column] ?? 'categorical')
              : CAT_OPS)

            return (
              <div key={rule.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
                {/* Rule header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ ...monoLabelStyle, width: '64px' }}>Rule {rIdx + 1}</span>
                  <div style={{ flex: 1 }} />
                  {rule.conditions.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)', padding: '2px' }}>
                      {(['AND', 'OR'] as const).map(c => (
                        <button
                          key={c}
                          onClick={() => setRule(rule.id, { connector: c })}
                          style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: '12px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                            background: rule.connector === c ? 'var(--accent)' : 'transparent',
                            color: rule.connector === c ? '#fff' : 'var(--text-tertiary)',
                            transition: 'background 0.15s',
                          }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>→</span>
                  <select
                    style={{ ...inputSmStyle, width: 'auto' }}
                    value={rule.label}
                    onChange={e => setRule(rule.id, { label: e.target.value })}
                  >
                    <option value="">select label…</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span style={{
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 500,
                    background: counts[rIdx] > 0 ? 'var(--blue-tint)' : 'var(--bg-3)',
                    color: counts[rIdx] > 0 ? 'var(--accent)' : 'var(--text-tertiary)',
                  }}>
                    {counts[rIdx]} rows
                  </span>
                  <button
                    onClick={() => setRules(rs => rs.filter(r => r.id !== rule.id))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--bad)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)')}
                  >
                    <Trash2 style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>

                {/* Conditions */}
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {rule.conditions.map((cond, cIdx) => {
                    const cType = colTypes[cond.column] ?? 'categorical'
                    const availOps = getOpsForType(cType)
                    const uniqueVals = getUniqueVals(cond.column, batch.batch)
                    const needsNoInput = ['is_null', 'is_not_null', 'is_true', 'is_false'].includes(cond.operator)
                    const needsTwo = cond.operator === 'between'
                    const needsMulti = cond.operator === 'is_one_of' || cond.operator === 'is_not_one_of'

                    return (
                      <div key={cond.id}>
                        {cIdx > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0' }}>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', background: 'var(--blue-tint)', padding: '2px 8px', borderRadius: 'var(--radius-btn)' }}>{rule.connector}</span>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                          <select
                            style={inputSmStyle}
                            value={cond.column}
                            onChange={e => {
                              const newType = colTypes[e.target.value] ?? 'categorical'
                              const newOps = getOpsForType(newType)
                              setCond(rule.id, cond.id, {
                                column: e.target.value,
                                operator: newOps[0].op,
                                value: '', value2: '', values: [],
                              })
                            }}
                          >
                            {featureCols.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>

                          <select
                            style={inputSmStyle}
                            value={cond.operator}
                            onChange={e => setCond(rule.id, cond.id, { operator: e.target.value as Operator, value: '', value2: '', values: [] })}
                          >
                            {availOps.map(o => <option key={o.op} value={o.op}>{o.label}</option>)}
                          </select>

                          {!needsNoInput && !needsMulti && !needsTwo && (
                            cType === 'categorical' && uniqueVals.length > 0 && uniqueVals.length <= 20 ? (
                              <select
                                style={inputSmStyle}
                                value={cond.value}
                                onChange={e => setCond(rule.id, cond.id, { value: e.target.value })}
                              >
                                <option value="">select…</option>
                                {uniqueVals.map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            ) : (
                              <input
                                type={cType === 'numeric' ? 'number' : 'text'}
                                style={{ ...inputSmStyle, width: '112px' }}
                                placeholder="value"
                                value={cond.value}
                                onChange={e => setCond(rule.id, cond.id, { value: e.target.value })}
                              />
                            )
                          )}

                          {needsTwo && (
                            <>
                              <input
                                type="number"
                                style={{ ...inputSmStyle, width: '96px' }}
                                placeholder="min"
                                value={cond.value}
                                onChange={e => setCond(rule.id, cond.id, { value: e.target.value })}
                              />
                              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', alignSelf: 'center' }}>and</span>
                              <input
                                type="number"
                                style={{ ...inputSmStyle, width: '96px' }}
                                placeholder="max"
                                value={cond.value2}
                                onChange={e => setCond(rule.id, cond.id, { value2: e.target.value })}
                              />
                            </>
                          )}

                          {needsMulti && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {uniqueVals.map(v => {
                                const isSelected = cond.values.includes(v)
                                return (
                                  <button
                                    key={v}
                                    onClick={() => {
                                      const next = cond.values.includes(v)
                                        ? cond.values.filter(x => x !== v)
                                        : [...cond.values, v]
                                      setCond(rule.id, cond.id, { values: next })
                                    }}
                                    style={{
                                      fontSize: '12px',
                                      padding: '2px 8px',
                                      borderRadius: 'var(--radius-btn)',
                                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                                      background: isSelected ? 'var(--accent)' : 'var(--bg-2)',
                                      color: isSelected ? '#fff' : 'var(--text-secondary)',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s',
                                    }}
                                  >
                                    {v}
                                  </button>
                                )
                              })}
                            </div>
                          )}

                          {rule.conditions.length > 1 && (
                            <button
                              onClick={() => removeCond(rule.id, cond.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignSelf: 'center', marginLeft: 'auto' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--bad)')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)')}
                            >
                              <Trash2 style={{ width: '12px', height: '12px' }} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  <button
                    onClick={() => addCond(rule.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginTop: '4px' }}
                  >
                    <Plus style={{ width: '12px', height: '12px' }} /> Add condition
                  </button>
                </div>
              </div>
            )
          })}

          <button
            onClick={() => setRules(rs => [...rs, mkRule(featureCols[0] ?? '', classes[0] ?? '')])}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--accent)',
              border: '1px dashed var(--border-accent)',
              borderRadius: 'var(--radius-card)',
              padding: '10px 16px',
              width: '100%',
              background: 'transparent',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--blue-tint)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          >
            <Plus style={{ width: '14px', height: '14px' }} /> Add rule
          </button>
        </div>

        {/* Default label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, flexShrink: 0 }}>Default (no rule matched):</span>
          <select
            style={{ ...inputSmStyle, width: 'auto' }}
            value={defaultLabel}
            onChange={e => setDefaultLabel(e.target.value)}
          >
            <option value="">— skip unmatched rows —</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{uncovered} rows will use this</span>
        </div>

        {/* Apply */}
        <button
          onClick={handleApply}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 'var(--radius-card)',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--accent-hover)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--accent)')}
        >
          <Wand2 style={{ width: '16px', height: '16px' }} />
          Apply rules to {batch.batch.length} rows
        </button>
      </div>
    </div>
  )
}

// ── Annotation table ──────────────────────────────────────────────────

function AnnotationTable({
  session,
  batch,
  onSubmit,
  isSubmitting,
}: {
  session: ALSession
  batch: ALBatch
  onSubmit: (labels: Record<string, unknown>) => void
  isSubmitting: boolean
}) {
  const [pendingLabels, setPendingLabels] = useState<Record<string, string>>({})
  const [showRules, setShowRules] = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(0)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)
  const isClassification = session.task_type === 'classification'
  const classes = session.label_classes
  const labeledCount = Object.keys(pendingLabels).length
  const hasConfidence = batch.batch.some(r => r.confidence != null)

  const allCols = batch.batch[0] ? Object.keys(batch.batch[0].data) : []
  const displayCols = allCols.filter(c => c !== session.target_column).slice(0, 5)
  const featureCols = allCols.filter(c => c !== session.target_column && !session.exclude_columns.includes(c))

  const labelAll = (cls: string) => {
    const all: Record<string, string> = {}
    batch.batch.forEach(r => { all[String(r.row_index)] = cls })
    setPendingLabels(all)
  }

  const assignLabel = useCallback((rowArrayIdx: number, cls: string) => {
    const row = batch.batch[rowArrayIdx]
    if (!row) return
    setPendingLabels(p => ({ ...p, [String(row.row_index)]: cls }))
  }, [batch.batch])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isClassification) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIdx(i => Math.min(i + 1, batch.batch.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIdx(i => Math.max(i - 1, 0))
      } else if (e.key >= '1' && e.key <= '9') {
        const classIdx = parseInt(e.key) - 1
        if (classIdx < classes.length) {
          assignLabel(focusedIdx, classes[classIdx])
          setFocusedIdx(i => Math.min(i + 1, batch.batch.length - 1))
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isClassification, focusedIdx, classes, assignLabel, batch.batch.length])

  const toggleBtnBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    padding: '6px 12px',
    borderRadius: 'var(--radius-btn)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
          Round {session.current_round} · {labeledCount} / {batch.batch.length} labeled
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isClassification && (
            <button
              onClick={() => setShowShortcuts(v => !v)}
              style={{
                ...toggleBtnBase,
                border: showShortcuts ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: showShortcuts ? 'var(--blue-tint)' : 'transparent',
                color: showShortcuts ? 'var(--accent)' : 'var(--text-secondary)',
              }}
              title="Keyboard shortcuts"
            >
              <Keyboard style={{ width: '14px', height: '14px' }} />
            </button>
          )}
          <button
            onClick={() => setShowRules(v => !v)}
            style={{
              ...toggleBtnBase,
              border: showRules ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: showRules ? 'var(--blue-tint)' : 'transparent',
              color: showRules ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            <Wand2 style={{ width: '14px', height: '14px' }} />
            Auto-label
          </button>
          <Button
            onClick={() => onSubmit(pendingLabels)}
            disabled={labeledCount === 0}
            loading={isSubmitting}
            size="sm"
          >
            Submit &amp; Train ({labeledCount})
          </Button>
        </div>
      </div>

      {/* Keyboard shortcuts help */}
      {showShortcuts && isClassification && (
        <div style={{ padding: '12px', background: 'var(--blue-tint)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-card)', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <p style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: '6px' }}>Keyboard shortcuts</p>
          <p><kbd style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)', padding: '2px 6px', fontFamily: 'var(--font-mono)' }}>↑ ↓</kbd> Navigate rows</p>
          {classes.map((cls, i) => (
            <p key={cls}><kbd style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)', padding: '2px 6px', fontFamily: 'var(--font-mono)' }}>{i + 1}</kbd> Label as <strong>{cls}</strong> (advances to next row)</p>
          ))}
          <p style={{ color: 'var(--text-tertiary)', marginTop: '4px' }}>Click anywhere outside an input to use shortcuts.</p>
        </div>
      )}

      {/* Rule builder */}
      {showRules && isClassification && (
        <RuleBuilder
          batch={batch}
          session={session}
          featureCols={featureCols}
          allCols={allCols}
          onApply={(labels) => { setPendingLabels(labels); setShowRules(false) }}
        />
      )}

      {/* Bulk label bar */}
      {isClassification && classes.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', flexShrink: 0 }}>Label all as:</span>
          {classes.map(cls => (
            <button
              key={cls}
              onClick={() => labelAll(cls)}
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-btn)',
                fontSize: '12px',
                fontWeight: 500,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
            >
              {cls}
            </button>
          ))}
          {labeledCount > 0 && (
            <button
              onClick={() => setPendingLabels({})}
              style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--bad)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)')}
            >
              Clear all
            </button>
          )}
        </div>
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }} ref={tableRef}>
        <div style={{ overflowX: 'auto', maxHeight: '480px', overflowY: 'auto' }}>
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0 }}>
              <tr style={{ background: 'var(--bg-inset)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', ...monoLabelStyle, width: '48px' }}>#</th>
                {displayCols.map(c => (
                  <th key={c} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500, maxWidth: '120px' }}>{c}</th>
                ))}
                {hasConfidence && (
                  <th style={{ padding: '10px 12px', textAlign: 'left', ...monoLabelStyle, width: '80px' }}>Conf.</th>
                )}
                <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--accent)', fontWeight: 600 }}>Label *</th>
              </tr>
            </thead>
            <tbody>
              {batch.batch.map((row: ALBatchRow, arrayIdx: number) => {
                const labeled = pendingLabels[String(row.row_index)]
                const isFocused = arrayIdx === focusedIdx
                return (
                  <tr
                    key={row.row_index}
                    onClick={() => setFocusedIdx(arrayIdx)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: labeled ? 'var(--blue-tint)' : isFocused ? 'var(--bg-2)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!labeled && !isFocused) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)' }}
                    onMouseLeave={e => { if (!labeled && !isFocused) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: isFocused ? 'var(--accent)' : 'var(--text-tertiary)', fontWeight: isFocused ? 600 : 400 }}>
                        {isFocused ? '→' : row.row_index}
                      </span>
                    </td>
                    {displayCols.map(c => (
                      <td key={c} style={{ padding: '8px 12px', color: 'var(--text-secondary)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.data[c] == null
                          ? <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>null</span>
                          : String(row.data[c])}
                      </td>
                    ))}
                    {hasConfidence && (
                      <td style={{ padding: '8px 12px' }}>
                        {row.confidence != null ? (
                          <span style={{
                            fontSize: '12px',
                            fontWeight: 500,
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-btn)',
                            background: row.confidence >= 0.8 ? 'var(--green-dim)' : row.confidence >= 0.5 ? 'var(--blue-tint)' : 'var(--bad-dim)',
                            color: row.confidence >= 0.8 ? 'var(--green)' : row.confidence >= 0.5 ? 'var(--accent)' : 'var(--bad)',
                          }}>
                            {(row.confidence * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </td>
                    )}
                    <td style={{ padding: '8px 12px' }}>
                      {isClassification && classes.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {classes.map((cls, ci) => {
                            const isActive = labeled === cls
                            return (
                              <button
                                key={cls}
                                onClick={e => { e.stopPropagation(); setPendingLabels(p => ({ ...p, [String(row.row_index)]: cls })) }}
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 'var(--radius-btn)',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                                  background: isActive ? 'var(--accent)' : 'var(--bg-2)',
                                  color: isActive ? '#fff' : 'var(--text-secondary)',
                                  cursor: 'pointer',
                                  transition: 'all 0.1s',
                                }}
                                title={`Press ${ci + 1}`}
                              >
                                {cls}
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <input
                          type={isClassification ? 'text' : 'number'}
                          style={{ ...inputSmStyle, width: '112px' }}
                          placeholder={isClassification ? 'class' : 'value'}
                          value={pendingLabels[String(row.row_index)] ?? ''}
                          onChange={e => setPendingLabels(p => ({ ...p, [String(row.row_index)]: e.target.value }))}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {labeledCount > 0 && labeledCount < batch.batch.length && (
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
          You can submit a partial batch — only the {labeledCount} labeled rows will be used for training.
        </p>
      )}
    </div>
  )
}

// ── Session view ──────────────────────────────────────────────────────

function SessionView({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const qc = useQueryClient()
  const [activeRound, setActiveRound] = useState<number | null>(null)

  const { data: session, isLoading } = useQuery<ALSession>({
    queryKey: ['al-session', sessionId],
    queryFn: () => api.al.getSession(sessionId),
    refetchInterval: (q) => q.state.data?.status === 'training' ? 1500 : false,
  })

  const { data: batch } = useQuery<ALBatch>({
    queryKey: ['al-batch', sessionId],
    queryFn: () => api.al.getBatch(sessionId),
    enabled: session?.status === 'annotating',
  })

  useEffect(() => {
    if (session?.status === 'annotating') {
      qc.invalidateQueries({ queryKey: ['al-batch', sessionId] })
    }
  }, [session?.status])

  useEffect(() => {
    if (session?.rounds.length) {
      setActiveRound(session.rounds[session.rounds.length - 1].round)
    }
  }, [session?.rounds.length])

  const submitMut = useMutation({
    mutationFn: (labels: Record<string, unknown>) => api.al.submitLabels(sessionId, labels),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['al-session', sessionId] })
      qc.invalidateQueries({ queryKey: ['al-sessions'] })
    },
  })

  const stopMut = useMutation({
    mutationFn: () => api.al.stop(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['al-session', sessionId] })
      qc.invalidateQueries({ queryKey: ['al-sessions'] })
    },
  })

  const [editingModelName, setEditingModelName] = useState(false)
  const [modelNameDraft, setModelNameDraft] = useState('')
  const [predictResult, setPredictResult] = useState<ALPredictOut | null>(null)

  const renameMut = useMutation({
    mutationFn: (name: string) => api.al.renameModel(sessionId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['al-session', sessionId] })
      setEditingModelName(false)
    },
  })

  const predictMut = useMutation({
    mutationFn: () => api.al.predict(sessionId),
    onSuccess: (result) => {
      setPredictResult(result)
      qc.invalidateQueries({ queryKey: ['datasets'] })
    },
  })

  if (isLoading || !session) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px', color: 'var(--text-tertiary)', fontSize: '14px' }}>Loading…</div>
  }

  const currentRoundData = activeRound != null
    ? session.rounds.find(r => r.round === activeRound)
    : null

  const progressPct = Math.min(100, ((session.current_round - 1) / session.max_rounds) * 100)

  const actionBtnBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    padding: '6px 12px',
    borderRadius: 'var(--radius-btn)',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all 0.15s',
    textDecoration: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <button
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '8px', transition: 'color 0.15s' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)')}
          >
            ← All sessions
          </button>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {session.name || 'Active Learning Session'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px', fontSize: '12px', color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
            <span>Target: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{session.target_column}</span></span>
            <span>Model: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{MODEL_LABELS[session.model_type]}</span></span>
            <span>Strategy: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{STRATEGY_LABELS[session.sampling_strategy]}</span></span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{session.labeled_count} labeled</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {session.status === 'training' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--accent)', background: 'var(--blue-tint)', border: '1px solid var(--border-accent)', padding: '4px 10px', borderRadius: 'var(--radius-pill)' }}>
              <Loader2 style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} /> Training…
            </span>
          )}
          {session.status === 'annotating' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--green)', background: 'var(--green-dim)', border: '1px solid rgba(52,211,153,.22)', padding: '4px 10px', borderRadius: 'var(--radius-pill)' }}>
              <Zap style={{ width: '12px', height: '12px' }} /> Annotating
            </span>
          )}
          {session.status === 'complete' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--green)', background: 'var(--green-dim)', border: '1px solid rgba(52,211,153,.22)', padding: '4px 10px', borderRadius: 'var(--radius-pill)' }}>
              <CheckCircle2 style={{ width: '12px', height: '12px' }} /> Complete
            </span>
          )}
          {session.labeled_count > 0 && (
            <a
              href={api.al.exportLabelsUrl(sessionId)}
              download
              style={{ ...actionBtnBase, border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
            >
              <Download style={{ width: '14px', height: '14px' }} />
              Export labels
            </a>
          )}
          {session.model_path && (
            <>
              <button
                onClick={() => predictMut.mutate()}
                disabled={predictMut.isPending}
                style={{ ...actionBtnBase, border: '1px solid var(--border-accent)', color: 'var(--accent)', background: 'transparent', opacity: predictMut.isPending ? 0.5 : 1 }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--blue-tint)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                {predictMut.isPending
                  ? <><Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> Predicting…</>
                  : <><TrendingUp style={{ width: '14px', height: '14px' }} /> Predict dataset</>}
              </button>
              <a
                href={api.al.exportUrl(sessionId)}
                download
                style={{ ...actionBtnBase, background: 'var(--accent)', color: '#fff', border: 'none' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--accent-hover)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--accent)')}
              >
                <Download style={{ width: '14px', height: '14px' }} />
                Export model
              </a>
            </>
          )}
          {session.status !== 'complete' && (
            <button
              onClick={() => stopMut.mutate()}
              style={{ ...actionBtnBase, border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Progress + model name */}
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-tertiary)' }}>
          <span>Round {Math.max(0, session.current_round - 1)} of {session.max_rounds}</span>
          <span>{session.labeled_count} total labeled examples</span>
        </div>
        <div style={{ height: '6px', background: 'var(--bg-3)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
          <div
            style={{ height: '100%', background: 'var(--accent)', borderRadius: 'var(--radius-pill)', transition: 'width 0.3s', width: `${progressPct}%` }}
          />
        </div>

        {/* Model name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', flexShrink: 0 }}>Model name:</span>
          {editingModelName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <input
                autoFocus
                style={{ ...inputSmStyle, flex: 1 }}
                value={modelNameDraft}
                onChange={e => setModelNameDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') renameMut.mutate(modelNameDraft)
                  if (e.key === 'Escape') setEditingModelName(false)
                }}
              />
              <button
                onClick={() => renameMut.mutate(modelNameDraft)}
                disabled={renameMut.isPending || !modelNameDraft.trim()}
                style={{ fontSize: '12px', padding: '4px 8px', borderRadius: 'var(--radius-btn)', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', opacity: (renameMut.isPending || !modelNameDraft.trim()) ? 0.4 : 1 }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingModelName(false)}
                style={{ fontSize: '12px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{session.model_name || '—'}</span>
              <button
                onClick={() => { setModelNameDraft(session.model_name || ''); setEditingModelName(true) }}
                style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Rename
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Predict result banner */}
      {predictResult && (
        <div style={{ padding: '12px', background: 'var(--green-dim)', border: '1px solid rgba(52,211,153,.22)', borderRadius: 'var(--radius-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600, color: 'var(--green)' }}>Predictions complete!</span>
            {' '}Created dataset <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{predictResult.dataset_name}</span> with {predictResult.row_count.toLocaleString()} rows.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href="/datasets"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--accent)', textDecoration: 'underline', fontWeight: 500 }}
            >
              View in Datasets <ExternalLink style={{ width: '12px', height: '12px' }} />
            </a>
            <button onClick={() => setPredictResult(null)} style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', marginLeft: '8px' }}>✕</button>
          </div>
        </div>
      )}

      {/* Predict error */}
      {predictMut.isError && (
        <div style={{ padding: '12px', background: 'var(--bad-dim)', border: '1px solid rgba(239,68,68,.22)', borderRadius: 'var(--radius-card)', fontSize: '12px', color: 'var(--bad)' }}>
          Prediction failed: {(predictMut.error as Error).message}
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '20px' }}>
        {/* Left: annotation */}
        <div>
          {session.status === 'training' && (
            <div style={{ padding: '32px', background: 'var(--blue-tint)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-card)', textAlign: 'center' }}>
              <Loader2 style={{ width: '32px', height: '32px', color: 'var(--accent)', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Training in progress…</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>The model is learning from your labels. This usually takes a few seconds.</p>
            </div>
          )}
          {session.status === 'complete' && (
            <div style={{ padding: '32px', background: 'var(--green-dim)', border: '1px solid rgba(52,211,153,.22)', borderRadius: 'var(--radius-card)', textAlign: 'center' }}>
              <CheckCircle2 style={{ width: '40px', height: '40px', color: 'var(--green)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Session Complete</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {session.rounds.length} round{session.rounds.length !== 1 ? 's' : ''} completed · {session.labeled_count} examples labeled
              </p>
            </div>
          )}
          {session.status === 'annotating' && batch && (
            <AnnotationTable
              session={session}
              batch={batch}
              onSubmit={submitMut.mutate}
              isSubmitting={submitMut.isPending}
            />
          )}
          {session.status === 'annotating' && !batch && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', color: 'var(--text-tertiary)', fontSize: '14px' }}>
              Loading batch…
            </div>
          )}
        </div>

        {/* Right: metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {session.rounds.length >= 2 && (
            <AccuracyChart rounds={session.rounds} taskType={session.task_type} />
          )}
          {session.rounds.length > 0 && (
            <div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Round history</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {session.rounds.map(r => {
                  const isActive = activeRound === r.round
                  return (
                    <button
                      key={r.round}
                      onClick={() => setActiveRound(r.round)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-btn)',
                        fontSize: '12px',
                        fontWeight: 500,
                        border: isActive ? '2px solid var(--accent)' : '2px solid var(--border)',
                        background: isActive ? 'var(--blue-tint)' : 'var(--bg-2)',
                        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      Round {r.round}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {currentRoundData ? (
            <MetricsPanel round={currentRoundData} />
          ) : (
            <div style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', textAlign: 'center' }}>
              <BarChart3 style={{ width: '32px', height: '32px', color: 'var(--text-tertiary)', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Metrics appear after the first training round.</p>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>Label some examples and click Submit &amp; Train.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Session list ──────────────────────────────────────────────────────

function SessionList({
  sessions,
  onSelect,
  onCreate,
}: {
  sessions: ALSession[]
  onSelect: (id: string) => void
  onCreate: () => void
}) {
  const qc = useQueryClient()
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.al.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['al-sessions'] }),
  })

  const getMetricSummary = (s: ALSession) => {
    if (!s.rounds.length) return null
    const last = s.rounds[s.rounds.length - 1]
    if (s.task_type === 'classification') {
      const acc = last.metrics.accuracy
      return acc != null ? `${fmtPct(acc)} acc` : null
    }
    const r2 = last.metrics.r2
    return r2 != null ? `R² ${r2.toFixed(3)}` : null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-card)', background: 'var(--blue-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Brain style={{ width: '20px', height: '20px', color: 'var(--accent)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>Active Learning</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Train models with minimal labeled data — the model picks the most informative examples each round.</p>
        </div>
        <Button onClick={onCreate}>
          <Brain style={{ width: '16px', height: '16px' }} />
          New Session
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div style={{ padding: '48px', background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: '16px', textAlign: 'center' }}>
          <Target style={{ width: '40px', height: '40px', color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>No sessions yet</p>
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '24px' }}>
            Start an active learning session to train a model with minimal labeled data.
          </p>
          <Button onClick={onCreate}>
            Create first session
            <ArrowRight style={{ width: '16px', height: '16px' }} />
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sessions.map(s => {
            const metricSummary = getMetricSummary(s)
            const lastRound = s.rounds[s.rounds.length - 1]
            return (
              <div
                key={s.id}
                onClick={() => onSelect(s.id)}
                style={{
                  padding: '20px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-card)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-accent)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{s.name || 'Unnamed Session'}</span>
                      <StatusBadge status={s.status} />
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span>Target: <span style={{ color: 'var(--text-secondary)' }}>{s.target_column}</span></span>
                      <span>{MODEL_LABELS[s.model_type]}</span>
                      <span>{STRATEGY_LABELS[s.sampling_strategy]}</span>
                      <span>Round {Math.max(0, s.current_round - 1)} / {s.max_rounds}</span>
                      <span>{s.labeled_count} labeled</span>
                      <span>{formatRelativeTime(s.created_at)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    {metricSummary && (
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>{metricSummary}</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>round {lastRound?.round}</p>
                      </div>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); deleteMut.mutate(s.id) }}
                      style={{ fontSize: '12px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', transition: 'color 0.15s' }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--bad)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)')}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Mini progress */}
                <div style={{ marginTop: '12px' }}>
                  <div style={{ height: '4px', background: 'var(--bg-3)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        borderRadius: 'var(--radius-pill)',
                        background: s.status === 'complete' ? 'var(--green)' : 'var(--accent)',
                        width: `${Math.min(100, ((s.current_round - 1) / s.max_rounds) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'complete') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(52,211,153,.22)', borderRadius: 'var(--radius-pill)', padding: '3px 10px' }}>
      <CheckCircle2 style={{ width: '12px', height: '12px' }} /> Complete
    </span>
  )
  if (status === 'training') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--blue-tint)', color: 'var(--accent)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-pill)', padding: '3px 10px' }}>
      <Loader2 style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} /> Training
    </span>
  )
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(52,211,153,.22)', borderRadius: 'var(--radius-pill)', padding: '3px 10px' }}>
      <TrendingUp style={{ width: '12px', height: '12px' }} /> Annotating
    </span>
  )
}

// ── Page root ─────────────────────────────────────────────────────────

type View = { type: 'list' } | { type: 'setup' } | { type: 'session'; id: string }

export default function ActiveLearningPage() {
  const [view, setView] = useState<View>({ type: 'list' })

  const { data: sessions = [], isLoading } = useQuery<ALSession[]>({
    queryKey: ['al-sessions'],
    queryFn: () => api.al.listSessions(),
    refetchInterval: (q) => {
      const list = q.state.data ?? []
      return list.some(s => s.status === 'training') ? 2000 : false
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
        <SessionList
          sessions={sessions}
          onSelect={id => setView({ type: 'session', id })}
          onCreate={() => setView({ type: 'setup' })}
        />
      )}

      {view.type === 'setup' && (
        <div style={{ maxWidth: '768px', margin: '0 auto' }}>
          <button
            onClick={() => setView({ type: 'list' })}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', transition: 'color 0.15s' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)')}
          >
            ← All sessions
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-card)', background: 'var(--blue-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain style={{ width: '20px', height: '20px', color: 'var(--accent)' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>New Session</h1>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Configure your active learning experiment</p>
            </div>
          </div>
          <SetupForm onCreated={s => setView({ type: 'session', id: s.id })} />
        </div>
      )}

      {view.type === 'session' && (
        <SessionView
          sessionId={view.id}
          onBack={() => setView({ type: 'list' })}
        />
      )}
    </div>
  )
}
