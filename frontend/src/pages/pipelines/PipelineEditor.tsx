import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ReactFlow, Background, Controls, Handle, Position,
  type Node, type Edge, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowLeft, Play, Download, Loader2, CheckCircle2,
  XCircle, Plus, Trash2, Filter, Columns, Minus, PenLine,
  Droplets, Copy, CaseSensitive, BarChart2, Hash, ArrowUpDown,
  ChevronRight, Database, AlertCircle, TableIcon, ChevronDown, ChevronUp,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
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
    <div style={{
      background: 'var(--blue-tint)',
      border: '2px solid var(--accent)',
      borderRadius: 'var(--radius-md)',
      padding: '8px 12px',
      width: '144px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <Database style={{ width: '12px', height: '12px', color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--accent)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>Source</span>
      </div>
      <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {d.name || 'No dataset'}
      </p>
      {d.rows != null && (
        <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', margin: '2px 0 0', fontFamily: 'var(--font-mono)' }}>
          {d.rows.toLocaleString()} rows
        </p>
      )}
      <Handle type="source" position={Position.Right} style={{ background: 'var(--accent)', border: '1px solid var(--accent)', width: '8px', height: '8px' }} />
    </div>
  )
}

function StepNode({ data, selected }: NodeProps) {
  const d = data as { step: PipelineStep; result?: { rows_in: number; rows_out: number } | null; onDelete: () => void }
  const { step, result } = d
  const dropped = result ? result.rows_in - result.rows_out : 0
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-card)',
      padding: '12px 16px',
      width: '176px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      transition: 'border-color 0.15s',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--border-strong)', border: '1px solid var(--border)', width: '10px', height: '10px' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
          {STEP_ICON[step.type]}
          <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {step.type.replace(/_/g, ' ')}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); d.onDelete() }}
          title="Remove step"
          className="nodrag"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            padding: '2px',
            borderRadius: 'var(--radius-xs)',
            display: 'flex',
            alignItems: 'center',
            opacity: 0,
            transition: 'color 0.15s, opacity 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '1'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--bad)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '0'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)'
          }}
        >
          <Trash2 style={{ width: '12px', height: '12px' }} />
        </button>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {stepSummary(step)}
      </p>
      {result && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{result.rows_out.toLocaleString()}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>rows</span>
          {dropped > 0 && <span style={{ color: 'var(--bad)', marginLeft: '4px' }}>−{dropped.toLocaleString()}</span>}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: 'var(--border-strong)', border: '1px solid var(--border)', width: '10px', height: '10px' }} />
    </div>
  )
}

function OutputNode({ data }: NodeProps) {
  const d = data as { run: PipelineRun | null }
  const run = d.run
  return (
    <div style={{
      background: 'var(--green-dim)',
      border: '2px solid var(--green)',
      borderRadius: 'var(--radius-md)',
      padding: '8px 12px',
      width: '128px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--green)', opacity: 0.6, width: '8px', height: '8px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <Download style={{ width: '12px', height: '12px', color: 'var(--green)', flexShrink: 0 }} />
        <span style={{
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--green)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>Output</span>
      </div>
      {run?.status === 'complete' && !run.is_dry_run ? (
        <a
          href={api.pipelines.downloadUrl(run.id)}
          download
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: '10px', color: 'var(--accent)', textDecoration: 'underline' }}
        >
          Download CSV
        </a>
      ) : (
        <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', margin: 0 }}>CSV · Parquet</p>
      )}
      {run?.rows_out != null && (
        <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', margin: '2px 0 0', fontFamily: 'var(--font-mono)' }}>
          {run.rows_out.toLocaleString()} rows
        </p>
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
    <div style={{ overflow: 'auto', height: '100%' }}>
      <table style={{ fontSize: '12px', borderCollapse: 'collapse', minWidth: '100%' }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          <tr>
            {cols.map((col) => (
              <th
                key={col}
                style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-2)',
                  borderBottom: '1px solid var(--border)',
                  borderRight: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-2)' }}>
              {cols.map((col) => {
                const val = row[col]
                const display = val === null || val === undefined ? (
                  <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>null</span>
                ) : typeof val === 'number' ? (
                  Number.isInteger(val) ? String(val) : val.toFixed(4)
                ) : String(val)
                return (
                  <td
                    key={col}
                    style={{
                      padding: '6px 12px',
                      borderBottom: '1px solid var(--border)',
                      borderRight: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                      maxWidth: '200px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                    }}
                  >
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

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-inset)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-btn)',
  padding: '8px 12px',
  color: 'var(--text-primary)',
  fontSize: '14px',
  outline: 'none',
  width: '100%',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  fontWeight: 400,
  marginBottom: '6px',
}

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
      style={inputStyle}
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
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)', overflow: 'hidden', maxHeight: '192px', overflowY: 'auto' }}>
        {colNames.length === 0 ? (
          <p style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>No columns available</p>
        ) : colNames.map((n) => (
          <label
            key={n}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              borderBottom: '1px solid var(--border)',
              fontSize: '14px',
            }}
          >
            <input
              type="checkbox"
              checked={selected.includes(n)}
              onChange={() => toggle(n)}
              style={{ accentColor: 'var(--accent)' }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>{n}</span>
          </label>
        ))}
      </div>
    )
  }

  return (
    <div style={{
      width: '288px',
      borderLeft: '1px solid var(--border)',
      background: 'var(--bg-card)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
          {def?.icon}
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{def?.label}</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '2px' }}
        >
          <XCircle style={{ width: '16px', height: '16px' }} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {step.type === 'filter' && (
          <>
            <div><label style={labelStyle}>Column</label><ColSelect k="column" /></div>
            <div>
              <label style={labelStyle}>Operator</label>
              <select value={(c.operator as string) ?? '>'} onChange={(e) => set('operator', e.target.value)} style={inputStyle}>
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
                <label style={labelStyle}>Value</label>
                <input
                  value={(c.value as string) ?? ''}
                  onChange={(e) => set('value', e.target.value)}
                  placeholder="e.g. 0"
                  style={inputStyle}
                />
              </div>
            )}
          </>
        )}

        {(step.type === 'select_columns' || step.type === 'drop_columns') && (
          <div>
            <label style={labelStyle}>
              {step.type === 'select_columns' ? 'Columns to keep' : 'Columns to drop'}
            </label>
            <MultiColSelect k="columns" />
          </div>
        )}

        {step.type === 'rename_column' && (
          <>
            <div><label style={labelStyle}>Rename from</label><ColSelect k="from" /></div>
            <div>
              <label style={labelStyle}>New name</label>
              <input
                value={(c.to as string) ?? ''}
                onChange={(e) => set('to', e.target.value)}
                placeholder="new_column_name"
                style={inputStyle}
              />
            </div>
          </>
        )}

        {step.type === 'fill_nulls' && (
          <>
            <div><label style={labelStyle}>Column</label><ColSelect k="column" /></div>
            <div>
              <label style={labelStyle}>Strategy</label>
              <select value={(c.strategy as string) ?? 'drop_rows'} onChange={(e) => set('strategy', e.target.value)} style={inputStyle}>
                <option value="drop_rows">Drop rows with nulls</option>
                <option value="mean">Fill with mean</option>
                <option value="mode">Fill with mode</option>
                <option value="value">Fill with fixed value</option>
              </select>
            </div>
            {c.strategy === 'value' && (
              <div>
                <label style={labelStyle}>Fill value</label>
                <input
                  value={(c.value as string) ?? ''}
                  onChange={(e) => set('value', e.target.value)}
                  placeholder="e.g. unknown"
                  style={inputStyle}
                />
              </div>
            )}
          </>
        )}

        {step.type === 'deduplicate' && (
          <div>
            <label style={labelStyle}>
              Subset columns{' '}
              <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(empty = all)</span>
            </label>
            <MultiColSelect k="columns" />
          </div>
        )}

        {(step.type === 'lowercase' || step.type === 'normalize' || step.type === 'encode_categorical') && (
          <div><label style={labelStyle}>Column</label><ColSelect k="column" /></div>
        )}

        {step.type === 'sort' && (
          <>
            <div><label style={labelStyle}>Column</label><ColSelect k="column" /></div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!(c.descending)}
                onChange={(e) => set('descending', e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Descending</span>
            </label>
          </>
        )}
      </div>

      <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={onDelete}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 12px',
            fontSize: '14px',
            color: 'var(--bad)',
            border: '1px solid var(--bad-dim)',
            borderRadius: 'var(--radius-btn)',
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bad-dim)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Trash2 style={{ width: '14px', height: '14px' }} />
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
    saveMutation.mutate({ steps })
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
      style: { stroke: 'var(--border-strong)', strokeWidth: 2 },
    }))
  }, [p])

  const isRunning = latestRun?.status === 'pending' || latestRun?.status === 'running' || runMutation.isPending

  if (isLoading || !p) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Loader2 style={{ width: '20px', height: '20px', color: 'var(--text-tertiary)' }} className="animate-spin" />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* ── Top bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate('/pipelines')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '14px',
            color: 'var(--text-secondary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontFamily: 'var(--font-sans)',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <ArrowLeft style={{ width: '14px', height: '14px' }} />
          Pipelines
        </button>
        <ChevronRight style={{ width: '14px', height: '14px', color: 'var(--text-tertiary)' }} />

        <input
          value={p.name}
          onChange={(e) => {
            const updated = { ...p, name: e.target.value }
            setLocalPipeline(updated)
          }}
          onBlur={() => saveMutation.mutate({ name: p.name })}
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid transparent',
            outline: 'none',
            padding: '2px 4px',
            fontFamily: 'var(--font-sans)',
            minWidth: 0,
            flexShrink: 1,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = 'var(--border)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = 'transparent')}
          onFocus={(e) => (e.currentTarget.style.borderBottomColor = 'var(--accent)')}
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
          style={{
            fontSize: '12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-btn)',
            padding: '6px 8px',
            background: 'var(--bg-inset)',
            color: 'var(--text-secondary)',
            outline: 'none',
            maxWidth: '160px',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <option value="">No dataset</option>
          {datasets.filter((d) => d.status === 'ready').map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <div style={{ flex: 1 }} />

        {saveMutation.isPending && (
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Loader2 style={{ width: '12px', height: '12px' }} className="animate-spin" /> Saving…
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
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* Left: step library */}
        <div style={{
          width: '208px',
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-card)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              fontWeight: 400,
              margin: 0,
            }}>Add step</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {STEP_DEFS.map((def) => (
              <button
                key={def.type}
                onClick={() => addStep(def)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ color: 'var(--text-tertiary)', display: 'flex', flexShrink: 0 }}>{def.icon}</span>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', flex: 1 }}>{def.label}</span>
                <Plus style={{ width: '12px', height: '12px', color: 'var(--accent)', flexShrink: 0, opacity: 0 }} />
              </button>
            ))}
          </div>

          {/* Recent runs */}
          {runs.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                <p style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text-tertiary)',
                  fontWeight: 400,
                  margin: 0,
                }}>Recent runs</p>
              </div>
              <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                {runs.slice(0, 5).map((run) => (
                  <button
                    key={run.id}
                    onClick={() => setLatestRun(run)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    {run.status === 'complete' && <CheckCircle2 style={{ width: '14px', height: '14px', color: 'var(--green)', flexShrink: 0 }} />}
                    {run.status === 'failed' && <XCircle style={{ width: '14px', height: '14px', color: 'var(--bad)', flexShrink: 0 }} />}
                    {(run.status === 'pending' || run.status === 'running') && <Loader2 style={{ width: '14px', height: '14px', color: 'var(--accent)', flexShrink: 0 }} className="animate-spin" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {run.is_dry_run ? 'Dry run' : 'Full run'}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0, fontFamily: 'var(--font-mono)' }}>
                        {formatRelativeTime(run.created_at)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Centre: canvas */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {p.steps.length === 0 && !p.dataset_id ? (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              pointerEvents: 'none',
            }}>
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', margin: '0 0 4px' }}>
                Start by selecting a dataset above
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>then add steps from the left panel</p>
            </div>
          ) : p.steps.length === 0 ? (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              pointerEvents: 'none',
            }}>
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', margin: '0 0 4px' }}>No steps yet</p>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>Click a step type on the left to add it</p>
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
            <Background color="var(--border)" gap={20} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>

          {/* Run status banner */}
          {latestRun && (latestRun.status === 'running' || latestRun.status === 'pending') && (
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: '14px',
              padding: '8px 16px',
              borderRadius: '999px',
              boxShadow: 'var(--blue-glow)',
            }}>
              <Loader2 style={{ width: '16px', height: '16px' }} className="animate-spin" />
              {latestRun.is_dry_run ? 'Dry run' : 'Full run'} in progress…
            </div>
          )}
          {latestRun?.status === 'failed' && (
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bad)',
              color: '#fff',
              fontSize: '14px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-card)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              maxWidth: '320px',
            }}>
              <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {latestRun.error_message ?? 'Run failed'}
              </span>
            </div>
          )}
          {latestRun?.status === 'complete' && (
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--green)',
              color: '#fff',
              fontSize: '14px',
              padding: '8px 16px',
              borderRadius: '999px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
              <CheckCircle2 style={{ width: '16px', height: '16px' }} />
              {latestRun.is_dry_run
                ? `Dry run complete — ${latestRun.rows_out?.toLocaleString()} rows out`
                : 'Full run complete — '}
              {!latestRun.is_dry_run && latestRun.output_path && (
                <a
                  href={api.pipelines.downloadUrl(latestRun.id)}
                  download
                  style={{ textDecoration: 'underline', fontWeight: 500, color: '#fff' }}
                >
                  Download
                </a>
              )}
            </div>
          )}

          {/* Bottom: dry run preview panel */}
          {latestRun?.is_dry_run && latestRun.status === 'complete' && latestRun.output_preview && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'var(--bg-card)',
                borderTop: '1px solid var(--border)',
                zIndex: 20,
                display: 'flex',
                flexDirection: 'column',
                transition: 'height 0.2s',
                height: showPreview ? '260px' : '36px',
              }}
            >
              <button
                onClick={() => setShowPreview((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontFamily: 'var(--font-sans)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <TableIcon style={{ width: '14px', height: '14px', color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Dry run preview</span>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                  {latestRun.output_preview.length} of {latestRun.rows_out?.toLocaleString()} rows · {Object.keys(latestRun.output_preview[0] ?? {}).length} columns
                </span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', display: 'flex' }}>
                  {showPreview
                    ? <ChevronDown style={{ width: '14px', height: '14px' }} />
                    : <ChevronUp style={{ width: '14px', height: '14px' }} />
                  }
                </span>
              </button>
              {showPreview && (
                <div style={{ flex: 1, minHeight: 0 }}>
                  <PreviewTable rows={latestRun.output_preview} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: step config panel (slide in when a step is selected) */}
        {selectedStep && (
          <StepConfigPanel
            step={selectedStep}
            columns={columns as unknown as import('@/types').ColumnSchema[]}
            onChange={(config) => updateStepConfig(selectedStep.id, config)}
            onClose={() => setSelectedStepId(null)}
            onDelete={() => { deleteStep(selectedStep.id); setSelectedStepId(null) }}
          />
        )}
      </div>
    </div>
  )
}
