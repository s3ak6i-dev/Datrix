import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ReactFlow, Background, Controls, Handle, Position,
  type Node, type Edge, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowLeft, Play, Download, Save, Loader2, CheckCircle2,
  XCircle, Plus, Trash2, Filter, Columns, Minus, PenLine,
  Droplets, Copy, CaseSensitive, BarChart2, Hash, ArrowUpDown,
  ChevronRight, Database, AlertCircle, TableIcon, ChevronDown, ChevronUp,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import type { Pipeline, PipelineStep, PipelineRun, StepType, ColumnSchema } from '@/types'

// ── Step library definition ───────────────────────────────────────────

interface StepDef {
  type: StepType
  label: string
  icon: React.ReactNode
  defaultConfig: Record<string, unknown>
}

const STEP_DEFS: StepDef[] = [
  { type: 'filter',            label: 'Filter rows',        icon: <Filter className="w-4 h-4" />,       defaultConfig: { column: '', operator: '>', value: '' } },
  { type: 'select_columns',    label: 'Select columns',     icon: <Columns className="w-4 h-4" />,      defaultConfig: { columns: [] } },
  { type: 'drop_columns',      label: 'Drop columns',       icon: <Minus className="w-4 h-4" />,        defaultConfig: { columns: [] } },
  { type: 'rename_column',     label: 'Rename column',      icon: <PenLine className="w-4 h-4" />,      defaultConfig: { from: '', to: '' } },
  { type: 'fill_nulls',        label: 'Fill nulls',         icon: <Droplets className="w-4 h-4" />,     defaultConfig: { column: '', strategy: 'drop_rows' } },
  { type: 'deduplicate',       label: 'Deduplicate',        icon: <Copy className="w-4 h-4" />,         defaultConfig: { columns: [] } },
  { type: 'lowercase',         label: 'Lowercase',          icon: <CaseSensitive className="w-4 h-4" />, defaultConfig: { column: '' } },
  { type: 'normalize',         label: 'Normalize',          icon: <BarChart2 className="w-4 h-4" />,    defaultConfig: { column: '' } },
  { type: 'encode_categorical', label: 'Encode categorical', icon: <Hash className="w-4 h-4" />,        defaultConfig: { column: '' } },
  { type: 'sort',              label: 'Sort',               icon: <ArrowUpDown className="w-4 h-4" />,  defaultConfig: { column: '', descending: false } },
]

const STEP_ICON: Record<StepType, React.ReactNode> = Object.fromEntries(
  STEP_DEFS.map((d) => [d.type, d.icon])
) as Record<StepType, React.ReactNode>

function stepSummary(step: PipelineStep): string {
  const c = step.config
  switch (step.type) {
    case 'filter': {
      if (!c.column) return 'Not configured'
      const opMap: Record<string, string> = { '>': '>', '<': '<', '>=': '≥', '<=': '≤', '==': '=', '!=': '≠', not_null: 'not null', is_null: 'is null', contains: 'contains' }
      return `${c.column} ${opMap[c.operator as string] ?? c.operator}${c.value ? ` ${c.value}` : ''}`
    }
    case 'select_columns': return (c.columns as string[])?.length ? `${(c.columns as string[]).length} columns kept` : 'Not configured'
    case 'drop_columns':   return (c.columns as string[])?.length ? `Drop ${(c.columns as string[]).length} columns` : 'Not configured'
    case 'rename_column':  return c.from && c.to ? `${c.from} → ${c.to}` : 'Not configured'
    case 'fill_nulls':     return c.column ? `${c.column}: ${c.strategy}` : 'Not configured'
    case 'deduplicate':    return (c.columns as string[])?.length ? `${(c.columns as string[]).length} cols` : 'All columns'
    case 'lowercase':      return (c.column as string) || 'Not configured'
    case 'normalize':      return (c.column as string) || 'Not configured'
    case 'encode_categorical': return (c.column as string) || 'Not configured'
    case 'sort':           return c.column ? `${c.column} ${c.descending ? '↓' : '↑'}` : 'Not configured'
    default:               return ''
  }
}

// ── React Flow custom nodes ───────────────────────────────────────────

function SourceNode({ data }: NodeProps) {
  const d = data as { name: string; rows: number | null; cols: number | null }
  return (
    <div className="bg-brand-50 border-2 border-brand/40 rounded-lg px-3 py-2 w-36 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1">
        <Database className="w-3 h-3 text-brand flex-shrink-0" />
        <span className="text-[10px] font-bold text-brand uppercase tracking-wider">Source</span>
      </div>
      <p className="text-xs font-medium text-text-primary truncate">{d.name || 'No dataset'}</p>
      {d.rows != null && (
        <p className="text-[10px] text-text-tertiary mt-0.5">{d.rows.toLocaleString()} rows</p>
      )}
      <Handle type="source" position={Position.Right} className="!bg-brand !border-brand !w-2 !h-2" />
    </div>
  )
}

function StepNode({ data, selected }: NodeProps) {
  const d = data as { step: PipelineStep; result?: { rows_in: number; rows_out: number } | null; onDelete: () => void }
  const { step, result } = d
  const dropped = result ? result.rows_in - result.rows_out : 0
  return (
    <div className={cn(
      'bg-surface-primary border-2 rounded-xl px-4 py-3 w-44 shadow-sm transition-colors group',
      selected ? 'border-brand' : 'border-border hover:border-brand/40',
    )}>
      <Handle type="target" position={Position.Left} className="!bg-border !w-2.5 !h-2.5" />
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-text-secondary">
          {STEP_ICON[step.type]}
          <span className="text-xs font-semibold uppercase tracking-wide">{step.type.replace(/_/g, ' ')}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); d.onDelete() }}
          className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger transition-colors nodrag p-0.5 rounded"
          title="Remove step"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <p className="text-xs text-text-secondary truncate">{stepSummary(step)}</p>
      {result && (
        <div className="mt-2 pt-2 border-t border-border flex items-center gap-1 text-xs">
          <span className="text-text-primary font-medium">{result.rows_out.toLocaleString()}</span>
          <span className="text-text-tertiary">rows</span>
          {dropped > 0 && <span className="text-danger ml-1">−{dropped.toLocaleString()}</span>}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-border !w-2.5 !h-2.5" />
    </div>
  )
}

function OutputNode({ data }: NodeProps) {
  const d = data as { run: PipelineRun | null }
  const run = d.run
  return (
    <div className="bg-success-50 border-2 border-success/40 rounded-lg px-3 py-2 w-32 shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-success/60 !w-2 !h-2" />
      <div className="flex items-center gap-1.5 mb-1">
        <Download className="w-3 h-3 text-success flex-shrink-0" />
        <span className="text-[10px] font-bold text-success uppercase tracking-wider">Output</span>
      </div>
      {run?.status === 'complete' && !run.is_dry_run ? (
        <a
          href={api.pipelines.downloadUrl(run.id)}
          download
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] text-brand underline"
        >
          Download CSV
        </a>
      ) : (
        <p className="text-[10px] text-text-tertiary">CSV · Parquet</p>
      )}
      {run?.rows_out != null && (
        <p className="text-[10px] text-text-tertiary mt-0.5">{run.rows_out.toLocaleString()} rows</p>
      )}
    </div>
  )
}

const NODE_TYPES = { sourceNode: SourceNode, stepNode: StepNode, outputNode: OutputNode }

// ── Dry run preview table ─────────────────────────────────────────────

function PreviewTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return null
  const cols = Object.keys(rows[0])
  return (
    <div className="overflow-auto h-full">
      <table className="text-xs border-collapse min-w-full">
        <thead className="sticky top-0 z-10">
          <tr>
            {cols.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left font-medium text-text-secondary bg-surface-tertiary border-b border-r border-border whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-surface-primary' : 'bg-surface-secondary'}>
              {cols.map((col) => {
                const val = row[col]
                const display = val === null || val === undefined ? (
                  <span className="text-text-tertiary italic">null</span>
                ) : typeof val === 'number' ? (
                  Number.isInteger(val) ? String(val) : val.toFixed(4)
                ) : String(val)
                return (
                  <td key={col} className="px-3 py-1.5 border-b border-r border-border whitespace-nowrap max-w-[200px] truncate text-text-primary font-mono">
                    {display}
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

// ── Step config panel ─────────────────────────────────────────────────

function StepConfigPanel({
  step,
  columns,
  onChange,
  onClose,
  onDelete,
}: {
  step: PipelineStep
  columns: ColumnSchema[]
  onChange: (config: Record<string, unknown>) => void
  onClose: () => void
  onDelete: () => void
}) {
  const c = step.config
  const set = (key: string, val: unknown) => onChange({ ...c, [key]: val })
  const colNames = columns.map((c) => c.name)
  const def = STEP_DEFS.find((d) => d.type === step.type)

  const ColSelect = ({ k }: { k: string }) => (
    <select
      value={(c[k] as string) ?? ''}
      onChange={(e) => set(k, e.target.value)}
      className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
    >
      <option value="">Select column…</option>
      {colNames.map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  )

  const MultiColSelect = ({ k }: { k: string }) => {
    const selected: string[] = (c[k] as string[]) ?? []
    const toggle = (name: string) =>
      set(k, selected.includes(name) ? selected.filter((x) => x !== name) : [...selected, name])
    return (
      <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
        {colNames.length === 0 ? (
          <p className="px-3 py-2 text-xs text-text-tertiary">No columns available</p>
        ) : colNames.map((n) => (
          <label key={n} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-tertiary cursor-pointer border-b border-border last:border-0">
            <input
              type="checkbox"
              checked={selected.includes(n)}
              onChange={() => toggle(n)}
              className="accent-brand"
            />
            <span className="text-sm font-mono text-text-primary">{n}</span>
          </label>
        ))}
      </div>
    )
  }

  return (
    <div className="w-72 border-l border-border bg-surface-primary flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-tertiary">
        <div className="flex items-center gap-2">
          {def?.icon}
          <span className="text-sm font-semibold text-text-primary">{def?.label}</span>
        </div>
        <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-0">
        {step.type === 'filter' && (
          <>
            <div><label className="label">Column</label><ColSelect k="column" /></div>
            <div>
              <label className="label">Operator</label>
              <select value={(c.operator as string) ?? '>'} onChange={(e) => set('operator', e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30">
                <option value=">">Greater than (&gt;)</option>
                <option value="<">Less than (&lt;)</option>
                <option value=">=">Greater or equal (≥)</option>
                <option value="<=">Less or equal (≤)</option>
                <option value="==">Equal to (=)</option>
                <option value="!=">Not equal to (≠)</option>
                <option value="contains">Contains</option>
                <option value="not_null">Is not null</option>
                <option value="is_null">Is null</option>
              </select>
            </div>
            {c.operator !== 'not_null' && c.operator !== 'is_null' && (
              <div>
                <label className="label">Value</label>
                <input value={(c.value as string) ?? ''} onChange={(e) => set('value', e.target.value)}
                  placeholder="e.g. 0" className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            )}
          </>
        )}

        {(step.type === 'select_columns' || step.type === 'drop_columns') && (
          <div>
            <label className="label">
              {step.type === 'select_columns' ? 'Columns to keep' : 'Columns to drop'}
            </label>
            <MultiColSelect k="columns" />
          </div>
        )}

        {step.type === 'rename_column' && (
          <>
            <div><label className="label">Rename from</label><ColSelect k="from" /></div>
            <div>
              <label className="label">New name</label>
              <input value={(c.to as string) ?? ''} onChange={(e) => set('to', e.target.value)}
                placeholder="new_column_name" className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
          </>
        )}

        {step.type === 'fill_nulls' && (
          <>
            <div><label className="label">Column</label><ColSelect k="column" /></div>
            <div>
              <label className="label">Strategy</label>
              <select value={(c.strategy as string) ?? 'drop_rows'} onChange={(e) => set('strategy', e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface-primary focus:outline-none focus:ring-2 focus:ring-brand/30">
                <option value="drop_rows">Drop rows with nulls</option>
                <option value="mean">Fill with mean</option>
                <option value="mode">Fill with mode</option>
                <option value="value">Fill with fixed value</option>
              </select>
            </div>
            {c.strategy === 'value' && (
              <div>
                <label className="label">Fill value</label>
                <input value={(c.value as string) ?? ''} onChange={(e) => set('value', e.target.value)}
                  placeholder="e.g. unknown" className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            )}
          </>
        )}

        {step.type === 'deduplicate' && (
          <div>
            <label className="label">Subset columns <span className="text-text-tertiary font-normal">(empty = all)</span></label>
            <MultiColSelect k="columns" />
          </div>
        )}

        {(step.type === 'lowercase' || step.type === 'normalize' || step.type === 'encode_categorical') && (
          <div><label className="label">Column</label><ColSelect k="column" /></div>
        )}

        {step.type === 'sort' && (
          <>
            <div><label className="label">Column</label><ColSelect k="column" /></div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!(c.descending)} onChange={(e) => set('descending', e.target.checked)} className="accent-brand" />
              <span className="text-sm text-text-primary">Descending</span>
            </label>
          </>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <button
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-danger border border-danger/20 rounded-lg hover:bg-danger-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Remove step
        </button>
      </div>
    </div>
  )
}

// ── Main editor ───────────────────────────────────────────────────────

function newStepId() {
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

export function PipelineEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [latestRun, setLatestRun] = useState<PipelineRun | null>(null)
  const [runPollingId, setRunPollingId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({})
  const savePositionsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: pipeline, isLoading } = useQuery({
    queryKey: ['pipeline', id],
    queryFn: () => api.pipelines.get(id!),
    enabled: !!id,
  })

  const { data: datasets = [] } = useQuery({
    queryKey: ['datasets'],
    queryFn: api.datasets.list,
  })

  const { data: columns = [] } = useQuery({
    queryKey: ['columns', pipeline?.dataset_id],
    queryFn: () => api.columns.list(pipeline!.dataset_id!),
    enabled: !!pipeline?.dataset_id,
  })

  const { data: runs = [] } = useQuery({
    queryKey: ['pipeline-runs', id],
    queryFn: () => api.pipelines.listRuns(id!),
    enabled: !!id,
  })

  // Poll the active run until complete/failed
  useQuery({
    queryKey: ['pipeline-run', runPollingId],
    queryFn: () => api.pipelines.getRun(runPollingId!),
    enabled: !!runPollingId,
    refetchInterval: (q) => {
      const d = q.state.data as PipelineRun | undefined
      if (!d) return 2000
      if (d.status === 'complete' || d.status === 'failed') {
        setLatestRun(d)
        setRunPollingId(null)
        qc.invalidateQueries({ queryKey: ['pipeline-runs', id] })
        if (d.status === 'complete' && d.is_dry_run) setShowPreview(true)
        return false
      }
      return 1500
    },
    onSuccess: (d: PipelineRun) => {
      if (d.status === 'running') setLatestRun(d)
    },
  } as Parameters<typeof useQuery>[0])

  const saveMutation = useMutation({
    mutationFn: (patch: Partial<Pipeline> & { steps?: unknown[] }) =>
      api.pipelines.update(id!, patch as Parameters<typeof api.pipelines.update>[1]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipeline', id] }),
  })

  const runMutation = useMutation({
    mutationFn: (dryRun: boolean) => api.pipelines.run(id!, dryRun),
    onSuccess: (run) => {
      setRunPollingId(run.id)
      setLatestRun(run)
    },
  })

  // Derive local editable state from server data
  const [localPipeline, setLocalPipeline] = useState<Pipeline | null>(null)
  useEffect(() => {
    if (pipeline && !localPipeline) {
      setLocalPipeline(pipeline)
      if (pipeline.node_positions) setNodePositions(pipeline.node_positions)
    }
  }, [pipeline])

  const p = localPipeline ?? pipeline
  const selectedStep = p?.steps.find((s) => s.id === selectedStepId) ?? null
  const dataset = datasets.find((d) => d.id === p?.dataset_id)

  const updateSteps = useCallback((steps: PipelineStep[]) => {
    if (!p) return
    const updated = { ...p, steps }
    setLocalPipeline(updated)
    saveMutation.mutate({ steps: steps as unknown[] })
  }, [p, saveMutation])

  const addStep = (def: StepDef) => {
    if (!p) return
    const newStep: PipelineStep = { id: newStepId(), type: def.type, config: { ...def.defaultConfig } }
    const steps = [...p.steps, newStep]
    updateSteps(steps)
    setSelectedStepId(newStep.id)
  }

  const deleteStep = useCallback((stepId: string) => {
    if (!p) return
    updateSteps(p.steps.filter((s) => s.id !== stepId))
    if (selectedStepId === stepId) setSelectedStepId(null)
  }, [p, selectedStepId, updateSteps])

  const updateStepConfig = (stepId: string, config: Record<string, unknown>) => {
    if (!p) return
    const steps = p.steps.map((s) => s.id === stepId ? { ...s, config } : s)
    updateSteps(steps)
  }

  // Build React Flow nodes
  const nodes: Node[] = useMemo(() => {
    if (!p) return []
    const GAP = 200
    const pos = (id: string, fallback: { x: number; y: number }) =>
      nodePositions[id] ?? fallback
    const result: Node[] = [
      {
        id: 'source',
        type: 'sourceNode',
        position: pos('source', { x: 0, y: 0 }),
        data: { name: dataset?.name ?? 'No dataset', rows: dataset?.row_count ?? null, cols: dataset?.column_count ?? null },
      },
      ...p.steps.map((step, i) => {
        const stepResult = latestRun?.step_results?.find((r) => r.step_id === step.id) ?? null
        return {
          id: step.id,
          type: 'stepNode',
          position: pos(step.id, { x: GAP * (i + 1), y: 0 }),
          selected: step.id === selectedStepId,
          data: { step, result: stepResult, onDelete: () => deleteStep(step.id) },
        }
      }),
      {
        id: 'output',
        type: 'outputNode',
        position: pos('output', { x: GAP * (p.steps.length + 1), y: 0 }),
        data: { run: latestRun },
      },
    ]
    return result
  }, [p, dataset, latestRun, selectedStepId, deleteStep, nodePositions])

  const edges: Edge[] = useMemo(() => {
    if (!p) return []
    const ids = ['source', ...p.steps.map((s) => s.id), 'output']
    return ids.slice(0, -1).map((src, i) => ({
      id: `e-${src}-${ids[i + 1]}`,
      source: src,
      target: ids[i + 1],
      type: 'smoothstep',
      style: { stroke: '#E5E7EB', strokeWidth: 2 },
    }))
  }, [p])

  const isRunning = latestRun?.status === 'pending' || latestRun?.status === 'running' || runMutation.isPending

  if (isLoading || !p) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface-primary flex-shrink-0">
        <button
          onClick={() => navigate('/pipelines')}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Pipelines
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />

        <input
          value={p.name}
          onChange={(e) => {
            const updated = { ...p, name: e.target.value }
            setLocalPipeline(updated)
          }}
          onBlur={() => saveMutation.mutate({ name: p.name })}
          className="text-sm font-semibold text-text-primary bg-transparent border-b border-transparent hover:border-border focus:border-brand focus:outline-none px-1 py-0.5 min-w-0 flex-shrink"
        />

        {/* Dataset selector */}
        <select
          value={p.dataset_id ?? ''}
          onChange={(e) => {
            const dsId = e.target.value || null
            const updated = { ...p, dataset_id: dsId }
            setLocalPipeline(updated)
            saveMutation.mutate({ dataset_id: dsId ?? undefined })
          }}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-surface-primary text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand/30 max-w-[160px]"
        >
          <option value="">No dataset</option>
          {datasets.filter((d) => d.status === 'ready').map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <div className="flex-1" />

        {saveMutation.isPending && (
          <span className="text-xs text-text-tertiary flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving…
          </span>
        )}

        <Button
          variant="secondary"
          size="sm"
          loading={isRunning}
          disabled={!p.dataset_id || p.steps.length === 0}
          onClick={() => runMutation.mutate(true)}
        >
          <Play className="w-3.5 h-3.5" />
          Dry run
        </Button>

        <Button
          size="sm"
          loading={isRunning}
          disabled={!p.dataset_id || p.steps.length === 0}
          onClick={() => runMutation.mutate(false)}
        >
          <Play className="w-3.5 h-3.5" />
          Full run
        </Button>
      </div>

      {/* ── Main area ── */}
      <div className="flex flex-1 min-h-0">

        {/* Left: step library */}
        <div className="w-52 border-r border-border bg-surface-primary flex flex-col flex-shrink-0">
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">Add step</p>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {STEP_DEFS.map((def) => (
              <button
                key={def.type}
                onClick={() => addStep(def)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-tertiary transition-colors group"
              >
                <span className="text-text-tertiary group-hover:text-brand transition-colors">{def.icon}</span>
                <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">{def.label}</span>
                <Plus className="w-3 h-3 text-text-tertiary group-hover:text-brand ml-auto opacity-0 group-hover:opacity-100 transition-all" />
              </button>
            ))}
          </div>

          {/* Recent runs */}
          {runs.length > 0 && (
            <div className="border-t border-border">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">Recent runs</p>
              </div>
              <div className="max-h-40 overflow-y-auto">
                {runs.slice(0, 5).map((run) => (
                  <button
                    key={run.id}
                    onClick={() => setLatestRun(run)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-tertiary transition-colors"
                  >
                    {run.status === 'complete' && <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />}
                    {run.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-danger flex-shrink-0" />}
                    {(run.status === 'pending' || run.status === 'running') && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-secondary truncate">
                        {run.is_dry_run ? 'Dry run' : 'Full run'}
                      </p>
                      <p className="text-xs text-text-tertiary">{formatRelativeTime(run.created_at)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Centre: canvas */}
        <div className="flex-1 min-w-0 relative">
          {p.steps.length === 0 && !p.dataset_id ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <p className="text-sm font-medium text-text-secondary mb-1">Start by selecting a dataset above</p>
              <p className="text-xs text-text-tertiary">then add steps from the left panel</p>
            </div>
          ) : p.steps.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <p className="text-sm font-medium text-text-secondary mb-1">No steps yet</p>
              <p className="text-xs text-text-tertiary">Click a step type on the left to add it</p>
            </div>
          ) : null}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodeClick={(_, node) => {
              if (node.type === 'stepNode') setSelectedStepId(node.id)
            }}
            onPaneClick={() => setSelectedStepId(null)}
            onNodeDragStop={(_, node) => {
              const updated = { ...nodePositions, [node.id]: node.position }
              setNodePositions(updated)
              if (savePositionsTimer.current) clearTimeout(savePositionsTimer.current)
              savePositionsTimer.current = setTimeout(() => {
                saveMutation.mutate({ node_positions: updated })
              }, 500)
            }}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            nodesConnectable={false}
            elementsSelectable={true}
            panOnScroll
            zoomOnScroll={false}
            minZoom={0.3}
            maxZoom={2}
          >
            <Background color="#E5E7EB" gap={20} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>

          {/* Run status banner */}
          {latestRun && (latestRun.status === 'running' || latestRun.status === 'pending') && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-brand text-white text-sm px-4 py-2 rounded-full shadow-lg">
              <Loader2 className="w-4 h-4 animate-spin" />
              {latestRun.is_dry_run ? 'Dry run' : 'Full run'} in progress…
            </div>
          )}
          {latestRun?.status === 'failed' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-danger text-white text-sm px-4 py-2 rounded-xl shadow-lg max-w-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{latestRun.error_message ?? 'Run failed'}</span>
            </div>
          )}
          {latestRun?.status === 'complete' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-success text-white text-sm px-4 py-2 rounded-full shadow-lg">
              <CheckCircle2 className="w-4 h-4" />
              {latestRun.is_dry_run
                ? `Dry run complete — ${latestRun.rows_out?.toLocaleString()} rows out`
                : `Full run complete — `}
              {!latestRun.is_dry_run && latestRun.output_path && (
                <a href={api.pipelines.downloadUrl(latestRun.id)} download className="underline font-medium">
                  Download
                </a>
              )}
            </div>
          )}
        </div>

        {/* Bottom: dry run preview panel */}
        {latestRun?.is_dry_run && latestRun.status === 'complete' && latestRun.output_preview && (
          <div
            className="absolute bottom-0 left-0 right-0 bg-surface-primary border-t border-border z-20 flex flex-col transition-all"
            style={{ height: showPreview ? '260px' : '36px' }}
          >
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 w-full text-left border-b border-border hover:bg-surface-tertiary transition-colors flex-shrink-0"
            >
              <TableIcon className="w-3.5 h-3.5 text-text-secondary" />
              <span className="text-xs font-semibold text-text-primary">Dry run preview</span>
              <span className="text-xs text-text-tertiary ml-1">
                {latestRun.output_preview.length} of {latestRun.rows_out?.toLocaleString()} rows · {Object.keys(latestRun.output_preview[0] ?? {}).length} columns
              </span>
              <span className="ml-auto text-text-tertiary">
                {showPreview ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </span>
            </button>
            {showPreview && (
              <div className="flex-1 min-h-0">
                <PreviewTable rows={latestRun.output_preview} />
              </div>
            )}
          </div>
        )}

        {/* Right: step config panel (slide in when a step is selected) */}
        {selectedStep && (
          <StepConfigPanel
            step={selectedStep}
            columns={columns}
            onChange={(config) => updateStepConfig(selectedStep.id, config)}
            onClose={() => setSelectedStepId(null)}
            onDelete={() => { deleteStep(selectedStep.id); setSelectedStepId(null) }}
          />
        )}
      </div>
    </div>
  )
}
