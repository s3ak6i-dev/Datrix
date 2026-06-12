import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Brain, ChevronRight, CheckCircle2, Loader2,
  ArrowRight, Target, TrendingUp, Zap, BarChart3, Download,
  Plus, Trash2, Wand2, Keyboard, ExternalLink,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
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
    <div className="space-y-5">
      {/* Session identity */}
      <div className="p-5 bg-surface-primary border border-border rounded-xl space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Session setup</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">Session name (optional)</label>
            <input
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
              placeholder="e.g. Order classification v1"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">Export model name (optional)</label>
            <input
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
              placeholder="e.g. order_value_classifier_v1"
              value={modelName}
              onChange={e => setModelName(e.target.value)}
            />
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
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">Max rounds</label>
            <input
              type="number" min="1" max="50"
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
              value={maxRounds}
              onChange={e => setMaxRounds(parseInt(e.target.value) || 10)}
            />
          </div>
        </div>

        {/* Task type */}
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1.5">Task type</label>
          <div className="flex gap-2">
            {(['classification', 'regression'] as ALTaskType[]).map(t => (
              <button
                key={t}
                onClick={() => setTaskType(t)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors',
                  taskType === t
                    ? 'border-brand bg-brand-50 text-brand'
                    : 'border-border text-text-secondary hover:border-brand/40 bg-surface-secondary'
                )}
              >
                {t === 'classification' ? 'Classification' : 'Regression'}
              </button>
            ))}
          </div>
        </div>

        {taskType === 'classification' && (
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">Label classes (comma-separated)</label>
            <input
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
              placeholder="e.g. high, medium, low"
              value={labelClasses}
              onChange={e => setLabelClasses(e.target.value)}
            />
            <p className="text-xs text-text-tertiary mt-1">Leave blank to auto-detect from labels you enter.</p>
          </div>
        )}

        {taskType === 'classification' && targetAcc !== undefined && (
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">Stop when accuracy reaches (%)</label>
            <input
              type="number" min="50" max="100"
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
              placeholder="e.g. 90 — leave blank to run all rounds"
              value={targetAcc}
              onChange={e => setTargetAcc(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1.5">Exclude columns (comma-separated)</label>
          <input
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
            placeholder="e.g. id, created_at, order_id"
            value={excludeCols}
            onChange={e => setExcludeCols(e.target.value)}
          />
        </div>
      </div>

      {/* Model */}
      <div className="p-5 bg-surface-primary border border-border rounded-xl space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Model</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MODEL_LABELS) as ALModelType[]).map(m => (
            <button
              key={m}
              onClick={() => setModelType(m)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-colors',
                modelType === m
                  ? 'border-brand bg-brand-50 text-brand'
                  : 'border-border text-text-secondary hover:border-brand/40 bg-surface-secondary'
              )}
            >
              {MODEL_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Sampling strategy */}
      <div className="p-5 bg-surface-primary border border-border rounded-xl space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Sampling strategy</h2>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(STRATEGY_LABELS) as ALSamplingStrategy[]).map(s => (
            <button
              key={s}
              onClick={() => setStrategy(s)}
              className={cn(
                'p-3 rounded-xl text-left border-2 transition-colors',
                strategy === s
                  ? 'border-brand bg-brand-50'
                  : 'border-border hover:border-brand/40 bg-surface-secondary'
              )}
            >
              <div className={cn('text-xs font-semibold', strategy === s ? 'text-brand' : 'text-text-primary')}>
                {STRATEGY_LABELS[s]}
              </div>
              <div className="text-xs text-text-secondary mt-0.5 leading-snug">{STRATEGY_DESC[s]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Batch size */}
      <div className="p-5 bg-surface-primary border border-border rounded-xl space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Batch size per round</h2>
        <div className="grid grid-cols-4 gap-2">
          {[20, 30, 50, 100].map(b => (
            <button
              key={b}
              onClick={() => setBatchSize(b)}
              className={cn(
                'p-3 rounded-xl text-left border-2 transition-colors',
                batchSize === b
                  ? 'border-brand bg-brand-50'
                  : 'border-border hover:border-brand/40 bg-surface-secondary'
              )}
            >
              <div className={cn('text-sm font-bold', batchSize === b ? 'text-brand' : 'text-text-primary')}>{b}</div>
              <div className="text-xs text-text-secondary mt-0.5 leading-snug">{BATCH_DESC[b]}</div>
            </button>
          ))}
        </div>
      </div>

      {createMut.error && (
        <div className="bg-danger-50 border border-danger/30 rounded-lg px-4 py-3 text-sm text-danger">
          {(createMut.error as Error).message}
        </div>
      )}

      <Button
        className="w-full"
        disabled={!ready}
        loading={createMut.isPending}
        onClick={() => createMut.mutate()}
      >
        <Brain className="w-4 h-4" />
        Start Active Learning
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
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
              <th key={c} className="p-1.5 text-text-secondary text-center min-w-[52px] font-medium">{c}</th>
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
                      className={cn('rounded px-2 py-1 font-mono font-semibold text-xs',
                        isDiag ? 'text-brand' : 'text-danger'
                      )}
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

// ── Feature importance ────────────────────────────────────────────────

function FeatureImportanceBar({ items }: { items: { feature: string; importance: number }[] }) {
  const max = items[0]?.importance ?? 1
  return (
    <div className="space-y-2">
      {items.slice(0, 8).map(item => (
        <div key={item.feature} className="flex items-center gap-3">
          <div className="w-28 text-xs text-text-secondary truncate text-right">{item.feature}</div>
          <div className="flex-1 h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-brand rounded-full"
              style={{ width: `${(item.importance / max) * 100}%` }}
            />
          </div>
          <div className="w-10 text-xs text-text-tertiary text-right">{fmtPct(item.importance)}</div>
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
    <div className={cn(
      'rounded-xl p-3 border',
      accent ? 'bg-brand-50 border-brand/20' : 'bg-surface-secondary border-border'
    )}>
      <div className="text-xs text-text-tertiary">{label}</div>
      <div className={cn('text-xl font-bold mt-0.5', accent ? 'text-brand' : 'text-text-primary')}>{value}</div>
      <div className="text-xs text-text-tertiary mt-0.5">{sub}</div>
    </div>
  )
}

// ── Metrics panel ─────────────────────────────────────────────────────

function MetricsPanel({ round }: { round: ALRound }) {
  const isReg = !('accuracy' in round.metrics)
  const [showExp, setShowExp] = useState(true)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
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
        <div className="p-4 bg-surface-secondary border border-border rounded-xl">
          <p className="text-xs font-semibold text-text-secondary mb-3">Confusion Matrix</p>
          <ConfusionMatrix matrix={round.confusion_matrix} classes={round.label_classes} />
        </div>
      )}

      {round.feature_importances.length > 0 && (
        <div className="p-4 bg-surface-secondary border border-border rounded-xl">
          <p className="text-xs font-semibold text-text-secondary mb-3">Feature Importance</p>
          <FeatureImportanceBar items={round.feature_importances} />
        </div>
      )}

      {/* Explanation */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowExp(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-surface-tertiary hover:bg-surface-secondary transition-colors"
        >
          <span className="text-xs font-semibold text-text-primary">What happened this round?</span>
          <ChevronRight className={cn('w-3.5 h-3.5 text-text-tertiary transition-transform', showExp && 'rotate-90')} />
        </button>
        {showExp && (
          <div className="px-4 pb-4 pt-3 bg-surface-primary">
            <div className="text-xs text-text-secondary leading-relaxed space-y-2">
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
    <div className="p-4 bg-surface-secondary border border-border rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-text-secondary">{isReg ? 'R² Trend' : 'Accuracy Trend'}</p>
        <span className="text-xs font-bold text-brand">{isReg ? lastVal.toFixed(3) : fmtPct(lastVal)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(t => {
          const y = H - PAD - t * (H - PAD * 2)
          return <line key={t} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
        })}
        {/* Area fill */}
        <polygon
          points={`${xs[0]},${H - PAD} ${polyline} ${lastX},${H - PAD}`}
          fill="rgb(99,102,241)"
          fillOpacity="0.08"
        />
        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="rgb(99,102,241)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots */}
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r="3" fill="rgb(99,102,241)" />
        ))}
        {/* Last value label */}
        <text x={lastX} y={lastY - 7} textAnchor="middle" fontSize="9" fill="rgb(99,102,241)" fontWeight="600">
          {isReg ? lastVal.toFixed(2) : fmtPct(lastVal)}
        </text>
        {/* X axis labels */}
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

  // Column type cache
  const colTypes: Record<string, ColType> = {}
  featureCols.forEach(c => { colTypes[c] = detectColType(c, batch.batch) })

  // Preview: count matches per rule
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
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-surface-tertiary border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-brand" />
          <span className="text-sm font-semibold text-text-primary">Auto-label with rules</span>
        </div>
        <div className="text-xs text-text-tertiary">
          {totalCovered}/{batch.batch.length} rows matched · {uncovered} will use default
        </div>
      </div>

      <div className="p-4 space-y-4 bg-surface-primary">
        {/* Reference column shortcut */}
        <div className="p-3 bg-surface-secondary border border-border rounded-xl">
          <p className="text-xs font-semibold text-text-secondary mb-2">Quick: copy from existing column</p>
          <div className="flex items-center gap-2">
            <select
              className="flex-1 text-sm border border-border rounded-lg px-3 py-1.5 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
              value={refCol}
              onChange={e => setRefCol(e.target.value)}
            >
              <option value="">— select column —</option>
              {allCols.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {refCol && (
              <button
                onClick={handleApply}
                className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand/90 transition-colors"
              >
                Apply
              </button>
            )}
          </div>
          {refCol && (
            <p className="text-xs text-text-tertiary mt-1.5">
              Will copy values from <span className="font-medium text-text-secondary">{refCol}</span> as labels for all {batch.batch.length} rows.
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-text-tertiary">or build rules</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Rules */}
        <div className="space-y-3">
          {rules.map((rule, rIdx) => {
            const ops = rule.conditions[0]
              ? getOpsForType(colTypes[rule.conditions[0].column] ?? 'categorical')
              : CAT_OPS

            return (
              <div key={rule.id} className="border border-border rounded-xl overflow-hidden">
                {/* Rule header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-secondary border-b border-border">
                  <span className="text-xs font-semibold text-text-tertiary w-16">Rule {rIdx + 1}</span>
                  <div className="flex-1" />
                  {/* Connector toggle */}
                  {rule.conditions.length > 1 && (
                    <div className="flex items-center gap-1 bg-surface-primary border border-border rounded-lg p-0.5">
                      {(['AND', 'OR'] as const).map(c => (
                        <button
                          key={c}
                          onClick={() => setRule(rule.id, { connector: c })}
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-semibold transition-colors',
                            rule.connector === c ? 'bg-brand text-white' : 'text-text-tertiary hover:text-text-secondary'
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Label */}
                  <span className="text-xs text-text-tertiary">→</span>
                  <select
                    className="text-xs border border-border rounded-lg px-2 py-1 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary font-medium"
                    value={rule.label}
                    onChange={e => setRule(rule.id, { label: e.target.value })}
                  >
                    <option value="">select label…</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {/* Match count */}
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    counts[rIdx] > 0 ? 'bg-brand-50 text-brand' : 'bg-surface-tertiary text-text-tertiary'
                  )}>
                    {counts[rIdx]} rows
                  </span>
                  {/* Delete rule */}
                  <button
                    onClick={() => setRules(rs => rs.filter(r => r.id !== rule.id))}
                    className="text-text-tertiary hover:text-danger transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Conditions */}
                <div className="p-3 space-y-2">
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
                          <div className="flex items-center gap-2 my-1.5">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[10px] font-bold text-brand bg-brand-50 px-2 py-0.5 rounded">{rule.connector}</span>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                        )}
                        <div className="flex items-start gap-2 flex-wrap">
                          {/* Column */}
                          <select
                            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
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

                          {/* Operator */}
                          <select
                            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
                            value={cond.operator}
                            onChange={e => setCond(rule.id, cond.id, { operator: e.target.value as Operator, value: '', value2: '', values: [] })}
                          >
                            {availOps.map(o => <option key={o.op} value={o.op}>{o.label}</option>)}
                          </select>

                          {/* Value inputs */}
                          {!needsNoInput && !needsMulti && !needsTwo && (
                            cType === 'categorical' && uniqueVals.length > 0 && uniqueVals.length <= 20 ? (
                              <select
                                className="text-xs border border-border rounded-lg px-2 py-1.5 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
                                value={cond.value}
                                onChange={e => setCond(rule.id, cond.id, { value: e.target.value })}
                              >
                                <option value="">select…</option>
                                {uniqueVals.map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            ) : (
                              <input
                                type={cType === 'numeric' ? 'number' : 'text'}
                                className="text-xs border border-border rounded-lg px-2 py-1.5 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary w-28"
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
                                className="text-xs border border-border rounded-lg px-2 py-1.5 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary w-24"
                                placeholder="min"
                                value={cond.value}
                                onChange={e => setCond(rule.id, cond.id, { value: e.target.value })}
                              />
                              <span className="text-xs text-text-tertiary self-center">and</span>
                              <input
                                type="number"
                                className="text-xs border border-border rounded-lg px-2 py-1.5 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary w-24"
                                placeholder="max"
                                value={cond.value2}
                                onChange={e => setCond(rule.id, cond.id, { value2: e.target.value })}
                              />
                            </>
                          )}

                          {needsMulti && (
                            <div className="flex flex-wrap gap-1">
                              {uniqueVals.map(v => (
                                <button
                                  key={v}
                                  onClick={() => {
                                    const next = cond.values.includes(v)
                                      ? cond.values.filter(x => x !== v)
                                      : [...cond.values, v]
                                    setCond(rule.id, cond.id, { values: next })
                                  }}
                                  className={cn(
                                    'text-xs px-2 py-0.5 rounded border transition-colors',
                                    cond.values.includes(v)
                                      ? 'bg-brand border-brand text-white'
                                      : 'border-border text-text-secondary bg-surface-secondary hover:border-brand/40'
                                  )}
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Remove condition */}
                          {rule.conditions.length > 1 && (
                            <button
                              onClick={() => removeCond(rule.id, cond.id)}
                              className="text-text-tertiary hover:text-danger transition-colors self-center ml-auto"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  <button
                    onClick={() => addCond(rule.id)}
                    className="flex items-center gap-1 text-xs text-brand hover:underline mt-1"
                  >
                    <Plus className="w-3 h-3" /> Add condition
                  </button>
                </div>
              </div>
            )
          })}

          <button
            onClick={() => setRules(rs => [...rs, mkRule(featureCols[0] ?? '', classes[0] ?? '')])}
            className="flex items-center gap-1.5 text-xs text-brand border border-dashed border-brand/40 rounded-xl px-4 py-2.5 w-full justify-center hover:bg-brand-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add rule
          </button>
        </div>

        {/* Default label */}
        <div className="flex items-center gap-3 p-3 bg-surface-secondary border border-border rounded-xl">
          <span className="text-xs text-text-secondary font-medium flex-shrink-0">Default (no rule matched):</span>
          <select
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
            value={defaultLabel}
            onChange={e => setDefaultLabel(e.target.value)}
          >
            <option value="">— skip unmatched rows —</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-xs text-text-tertiary">{uncovered} rows will use this</span>
        </div>

        {/* Apply */}
        <button
          onClick={handleApply}
          className="w-full py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors flex items-center justify-center gap-2"
        >
          <Wand2 className="w-4 h-4" />
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

  // Keyboard shortcuts
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-tertiary">
          Round {session.current_round} · {labeledCount} / {batch.batch.length} labeled
        </p>
        <div className="flex items-center gap-2">
          {isClassification && (
            <button
              onClick={() => setShowShortcuts(v => !v)}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
                showShortcuts ? 'border-brand bg-brand-50 text-brand' : 'border-border text-text-secondary hover:border-brand/40'
              )}
              title="Keyboard shortcuts"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setShowRules(v => !v)}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
              showRules
                ? 'border-brand bg-brand-50 text-brand'
                : 'border-border text-text-secondary hover:border-brand/40'
            )}
          >
            <Wand2 className="w-3.5 h-3.5" />
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
        <div className="p-3 bg-brand-50 border border-brand/20 rounded-xl text-xs text-text-secondary space-y-1">
          <p className="font-semibold text-brand mb-1.5">Keyboard shortcuts</p>
          <p><kbd className="bg-surface-primary border border-border rounded px-1.5 py-0.5 font-mono">↑ ↓</kbd> Navigate rows</p>
          {classes.map((cls, i) => (
            <p key={cls}><kbd className="bg-surface-primary border border-border rounded px-1.5 py-0.5 font-mono">{i + 1}</kbd> Label as <strong>{cls}</strong> (advances to next row)</p>
          ))}
          <p className="text-text-tertiary mt-1">Click anywhere outside an input to use shortcuts.</p>
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
        <div className="flex items-center gap-2 p-3 bg-surface-secondary border border-border rounded-xl">
          <span className="text-xs text-text-tertiary flex-shrink-0">Label all as:</span>
          {classes.map(cls => (
            <button
              key={cls}
              onClick={() => labelAll(cls)}
              className="px-3 py-1 rounded-lg text-xs font-medium border border-border bg-surface-primary text-text-secondary hover:border-brand hover:text-brand transition-colors"
            >
              {cls}
            </button>
          ))}
          {labeledCount > 0 && (
            <button
              onClick={() => setPendingLabels({})}
              className="ml-auto text-xs text-text-tertiary hover:text-danger transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      <div className="border border-border rounded-xl overflow-hidden" ref={tableRef}>
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0">
              <tr className="bg-surface-tertiary border-b border-border">
                <th className="px-3 py-2.5 text-left text-text-tertiary font-medium w-12">#</th>
                {displayCols.map(c => (
                  <th key={c} className="px-3 py-2.5 text-left text-text-secondary font-medium max-w-[120px]">{c}</th>
                ))}
                {hasConfidence && (
                  <th className="px-3 py-2.5 text-left text-text-tertiary font-medium w-20">Conf.</th>
                )}
                <th className="px-3 py-2.5 text-left text-brand font-semibold">Label *</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {batch.batch.map((row: ALBatchRow, arrayIdx: number) => {
                const labeled = pendingLabels[String(row.row_index)]
                const isFocused = arrayIdx === focusedIdx
                return (
                  <tr
                    key={row.row_index}
                    onClick={() => setFocusedIdx(arrayIdx)}
                    className={cn(
                      'transition-colors cursor-pointer',
                      labeled ? 'bg-brand-50' : isFocused ? 'bg-surface-secondary' : 'hover:bg-surface-secondary'
                    )}
                  >
                    <td className="px-3 py-2">
                      <span className={cn('font-mono', isFocused ? 'text-brand font-semibold' : 'text-text-tertiary')}>
                        {isFocused ? '→' : row.row_index}
                      </span>
                    </td>
                    {displayCols.map(c => (
                      <td key={c} className="px-3 py-2 text-text-secondary max-w-[120px] truncate">
                        {row.data[c] == null
                          ? <span className="text-text-tertiary italic">null</span>
                          : String(row.data[c])}
                      </td>
                    ))}
                    {hasConfidence && (
                      <td className="px-3 py-2">
                        {row.confidence != null ? (
                          <span className={cn(
                            'text-xs font-medium px-1.5 py-0.5 rounded',
                            row.confidence >= 0.8 ? 'bg-success-50 text-success' :
                            row.confidence >= 0.5 ? 'bg-brand-50 text-brand' :
                            'bg-danger-50 text-danger'
                          )}>
                            {(row.confidence * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {isClassification && classes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {classes.map((cls, ci) => (
                            <button
                              key={cls}
                              onClick={e => { e.stopPropagation(); setPendingLabels(p => ({ ...p, [String(row.row_index)]: cls })) }}
                              className={cn(
                                'px-2 py-0.5 rounded text-xs font-medium border transition-colors',
                                labeled === cls
                                  ? 'bg-brand border-brand text-white'
                                  : 'bg-surface-secondary border-border text-text-secondary hover:border-brand/40'
                              )}
                              title={`Press ${ci + 1}`}
                            >
                              {cls}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <input
                          type={isClassification ? 'text' : 'number'}
                          className="w-28 text-sm border border-border rounded px-2 py-0.5 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
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
        <p className="text-xs text-text-tertiary">
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
    return <div className="flex items-center justify-center h-64 text-text-tertiary text-sm">Loading…</div>
  }

  const currentRoundData = activeRound != null
    ? session.rounds.find(r => r.round === activeRound)
    : null

  const progressPct = Math.min(100, ((session.current_round - 1) / session.max_rounds) * 100)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary mb-2 transition-colors"
          >
            ← All sessions
          </button>
          <h1 className="text-xl font-semibold text-text-primary">
            {session.name || 'Active Learning Session'}
          </h1>
          <div className="flex items-center gap-4 mt-1 text-xs text-text-tertiary flex-wrap">
            <span>Target: <span className="text-text-secondary font-medium">{session.target_column}</span></span>
            <span>Model: <span className="text-text-secondary font-medium">{MODEL_LABELS[session.model_type]}</span></span>
            <span>Strategy: <span className="text-text-secondary font-medium">{STRATEGY_LABELS[session.sampling_strategy]}</span></span>
            <span className="text-text-secondary font-medium">{session.labeled_count} labeled</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.status === 'training' && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-brand bg-brand-50 border border-brand/20 px-2.5 py-1 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" /> Training…
            </span>
          )}
          {session.status === 'annotating' && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-success bg-success-50 border border-success/20 px-2.5 py-1 rounded-full">
              <Zap className="w-3 h-3" /> Annotating
            </span>
          )}
          {session.status === 'complete' && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-success bg-success-50 border border-success/20 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Complete
            </span>
          )}
          {session.labeled_count > 0 && (
            <a
              href={api.al.exportLabelsUrl(sessionId)}
              download
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              Export labels
            </a>
          )}
          {session.model_path && (
            <>
              <button
                onClick={() => predictMut.mutate()}
                disabled={predictMut.isPending}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-brand text-brand hover:bg-brand-50 transition-colors font-medium disabled:opacity-50"
              >
                {predictMut.isPending
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Predicting…</>
                  : <><TrendingUp className="w-3.5 h-3.5" /> Predict dataset</>}
              </button>
              <a
                href={api.al.exportUrl(sessionId)}
                download
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                Export model
              </a>
            </>
          )}
          {session.status !== 'complete' && (
            <button
              onClick={() => stopMut.mutate()}
              className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Progress + model name */}
      <div className="p-4 bg-surface-primary border border-border rounded-xl space-y-3">
        <div className="flex items-center justify-between text-xs text-text-tertiary">
          <span>Round {Math.max(0, session.current_round - 1)} of {session.max_rounds}</span>
          <span>{session.labeled_count} total labeled examples</span>
        </div>
        <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Model name */}
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <span className="text-xs text-text-tertiary flex-shrink-0">Model name:</span>
          {editingModelName ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                autoFocus
                className="flex-1 text-xs border border-border rounded px-2 py-1 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30 text-text-primary"
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
                className="text-xs px-2 py-1 rounded bg-brand text-white disabled:opacity-40"
              >
                Save
              </button>
              <button
                onClick={() => setEditingModelName(false)}
                className="text-xs text-text-tertiary hover:text-text-secondary"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs font-medium text-text-primary">{session.model_name || '—'}</span>
              <button
                onClick={() => { setModelNameDraft(session.model_name || ''); setEditingModelName(true) }}
                className="text-xs text-brand hover:underline"
              >
                Rename
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Predict result banner */}
      {predictResult && (
        <div className="p-3 bg-success-50 border border-success/20 rounded-xl flex items-center justify-between">
          <div className="text-xs text-text-secondary">
            <span className="font-semibold text-success">Predictions complete!</span>
            {' '}Created dataset <span className="font-medium text-text-primary">{predictResult.dataset_name}</span> with {predictResult.row_count.toLocaleString()} rows.
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/datasets"
              className="flex items-center gap-1 text-xs text-brand hover:underline font-medium"
            >
              View in Datasets <ExternalLink className="w-3 h-3" />
            </a>
            <button onClick={() => setPredictResult(null)} className="text-text-tertiary hover:text-text-secondary text-xs ml-2">✕</button>
          </div>
        </div>
      )}

      {/* Predict error */}
      {predictMut.isError && (
        <div className="p-3 bg-danger-50 border border-danger/20 rounded-xl text-xs text-danger">
          Prediction failed: {(predictMut.error as Error).message}
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-5 gap-5">
        {/* Left: annotation */}
        <div className="col-span-3">
          {session.status === 'training' && (
            <div className="p-8 bg-brand-50 border border-brand/20 rounded-xl text-center">
              <Loader2 className="w-8 h-8 text-brand animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium text-text-primary">Training in progress…</p>
              <p className="text-xs text-text-secondary mt-1">The model is learning from your labels. This usually takes a few seconds.</p>
            </div>
          )}
          {session.status === 'complete' && (
            <div className="p-8 bg-success-50 border border-success/20 rounded-xl text-center">
              <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" />
              <p className="text-sm font-semibold text-text-primary">Session Complete</p>
              <p className="text-xs text-text-secondary mt-1">
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
            <div className="flex items-center justify-center h-40 text-text-tertiary text-sm">
              Loading batch…
            </div>
          )}
        </div>

        {/* Right: metrics */}
        <div className="col-span-2 space-y-4">
          {session.rounds.length >= 2 && (
            <AccuracyChart rounds={session.rounds} taskType={session.task_type} />
          )}
          {session.rounds.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-2">Round history</p>
              <div className="flex flex-wrap gap-1.5">
                {session.rounds.map(r => (
                  <button
                    key={r.round}
                    onClick={() => setActiveRound(r.round)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium border-2 transition-colors',
                      activeRound === r.round
                        ? 'border-brand bg-brand-50 text-brand'
                        : 'border-border text-text-secondary hover:border-brand/40 bg-surface-secondary'
                    )}
                  >
                    Round {r.round}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentRoundData ? (
            <MetricsPanel round={currentRoundData} />
          ) : (
            <div className="p-6 bg-surface-primary border border-border rounded-xl text-center">
              <BarChart3 className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
              <p className="text-sm text-text-secondary">Metrics appear after the first training round.</p>
              <p className="text-xs text-text-tertiary mt-1">Label some examples and click Submit &amp; Train.</p>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
          <Brain className="w-5 h-5 text-brand" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-text-primary">Active Learning</h1>
          <p className="text-sm text-text-secondary">Train models with minimal labeled data — the model picks the most informative examples each round.</p>
        </div>
        <Button onClick={onCreate}>
          <Brain className="w-4 h-4" />
          New Session
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="p-12 bg-surface-primary border border-dashed border-border rounded-2xl text-center">
          <Target className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
          <p className="text-sm font-medium text-text-primary mb-1">No sessions yet</p>
          <p className="text-sm text-text-tertiary mb-6">
            Start an active learning session to train a model with minimal labeled data.
          </p>
          <Button onClick={onCreate}>
            Create first session
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => {
            const metricSummary = getMetricSummary(s)
            const lastRound = s.rounds[s.rounds.length - 1]
            return (
              <div
                key={s.id}
                onClick={() => onSelect(s.id)}
                className="p-5 bg-surface-primary border border-border hover:border-brand/30 rounded-xl cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-medium text-text-primary">{s.name || 'Unnamed Session'}</span>
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="text-xs text-text-tertiary mt-1 flex items-center gap-3 flex-wrap">
                      <span>Target: <span className="text-text-secondary">{s.target_column}</span></span>
                      <span>{MODEL_LABELS[s.model_type]}</span>
                      <span>{STRATEGY_LABELS[s.sampling_strategy]}</span>
                      <span>Round {Math.max(0, s.current_round - 1)} / {s.max_rounds}</span>
                      <span>{s.labeled_count} labeled</span>
                      <span>{formatRelativeTime(s.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {metricSummary && (
                      <div className="text-right">
                        <p className="text-sm font-semibold text-brand">{metricSummary}</p>
                        <p className="text-xs text-text-tertiary">round {lastRound?.round}</p>
                      </div>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); deleteMut.mutate(s.id) }}
                      className="text-xs text-text-tertiary hover:text-danger transition-colors px-2 py-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Mini progress */}
                <div className="mt-3">
                  <div className="h-1 bg-surface-tertiary rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', s.status === 'complete' ? 'bg-success' : 'bg-brand')}
                      style={{ width: `${Math.min(100, ((s.current_round - 1) / s.max_rounds) * 100)}%` }}
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
    <span className="flex items-center gap-1 text-xs font-medium text-success bg-success-50 border border-success/20 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="w-3 h-3" /> Complete
    </span>
  )
  if (status === 'training') return (
    <span className="flex items-center gap-1 text-xs font-medium text-brand bg-brand-50 border border-brand/20 px-2 py-0.5 rounded-full">
      <Loader2 className="w-3 h-3 animate-spin" /> Training
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-success bg-success-50 border border-success/20 px-2 py-0.5 rounded-full">
      <TrendingUp className="w-3 h-3" /> Annotating
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 text-text-tertiary animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {view.type === 'list' && (
        <SessionList
          sessions={sessions}
          onSelect={id => setView({ type: 'session', id })}
          onCreate={() => setView({ type: 'setup' })}
        />
      )}

      {view.type === 'setup' && (
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setView({ type: 'list' })}
            className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary mb-5 transition-colors"
          >
            ← All sessions
          </button>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
              <Brain className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-text-primary">New Session</h1>
              <p className="text-sm text-text-secondary">Configure your active learning experiment</p>
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
