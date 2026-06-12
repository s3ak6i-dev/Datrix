import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck, AlertTriangle, Eye, Search, Download, RefreshCw,
  CheckCircle, XCircle, Info, ChevronDown, ChevronRight, Trash2,
  GitBranch, FileText, Activity, Lock, Zap, Plus, X, Check,
  Database, GitMerge, Brain, BarChart3, Sparkles, ShoppingBag,
  ExternalLink, Clock, Filter,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type {
  ComplianceDashboard, ComplianceScan, ScanSummary, CompliancePolicy,
  PolicyViolation, AnonymizationJob, AuditEvent, ComplianceReport,
  LineageGraph, LineageNode, LineageEdge, PiiSeverity, PolicySeverity,
  PolicyType, AnonMethod, ComplianceFramework, ColumnConfig,
} from '@/types'

// ── Constants ─────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  high:     'text-orange-400 bg-orange-500/10 border-orange-500/20',
  medium:   'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
  low:      'text-blue-400 bg-blue-500/10 border-blue-500/20',
  clean:    'text-green-400 bg-green-500/10 border-green-500/20',
  unscanned:'text-text-tertiary bg-surface-tertiary border-border',
  pass:     'text-green-400 bg-green-500/10 border-green-500/20',
  fail:     'text-red-400 bg-red-500/10 border-red-500/20',
  info:     'text-blue-400 bg-blue-500/10 border-blue-500/20',
  warning:  'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
}

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-400', high: 'bg-orange-400', medium: 'bg-yellow-400',
  low: 'bg-blue-400', clean: 'bg-green-400', unscanned: 'bg-surface-tertiary border border-border',
}

const NODE_ICONS: Record<string, React.ReactNode> = {
  dataset: <Database className="w-3.5 h-3.5" />,
  pipeline: <GitBranch className="w-3.5 h-3.5" />,
  pipeline_run: <GitMerge className="w-3.5 h-3.5" />,
  synthetic_job: <Sparkles className="w-3.5 h-3.5" />,
  al_session: <Brain className="w-3.5 h-3.5" />,
  benchmark_job: <BarChart3 className="w-3.5 h-3.5" />,
  marketplace_asset: <ShoppingBag className="w-3.5 h-3.5" />,
}

const POLICY_TYPE_LABELS: Record<string, string> = {
  no_pii_in_training: 'No PII in training data',
  pii_scan_required: 'PII scan required',
  min_quality_score: 'Min quality score',
  max_retention_days: 'Max retention days',
  min_row_count_for_training: 'Min row count',
  no_unscanned_in_pipeline: 'No unscanned in pipeline',
  model_accuracy_floor: 'Model accuracy floor',
  benchmark_winner_required: 'Benchmark winner required',
}

const ANON_METHOD_LABELS: Record<AnonMethod, string> = {
  keep: 'Keep (unchanged)',
  suppress: 'Suppress (remove column)',
  redact: 'Redact ([REDACTED])',
  mask: 'Mask (j***@e***.com)',
  hash: 'Hash (SHA-256)',
  generalize: 'Generalize (buckets)',
  pseudonymize: 'Pseudonymize (fake ID)',
}

const REPORT_SECTIONS = [
  { id: 'dataset_inventory', label: 'Dataset Inventory' },
  { id: 'pii_findings', label: 'PII Findings' },
  { id: 'policy_status', label: 'Policy Status' },
  { id: 'lineage_summary', label: 'Lineage Summary' },
  { id: 'audit_excerpt', label: 'Audit Excerpt' },
  { id: 'recommendations', label: 'Recommendations' },
]

// ── Helpers ───────────────────────────────────────────────────────────

function SeverityBadge({ severity, label }: { severity: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border', SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.unscanned)}>
      {label ?? severity.toUpperCase()}
    </span>
  )
}

function SeverityDot({ severity, size = 'sm' }: { severity: string; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
  return <span className={cn('rounded-full flex-shrink-0', sz, SEVERITY_DOT[severity] ?? SEVERITY_DOT.unscanned)} />
}

function RiskGauge({ score, grade }: { score: number; grade: string }) {
  const gradeColor = { A: '#22c55e', 'B+': '#84cc16', B: '#eab308', C: '#f97316', D: '#ef4444', F: '#dc2626' }[grade] ?? '#94a3b8'
  const r = 44
  const circ = 2 * Math.PI * r
  const arcLen = (score / 100) * circ * 0.75
  const offset = circ * 0.125

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="90" viewBox="0 0 120 90">
        <circle cx="60" cy="70" r={r} fill="none" stroke="currentColor" strokeWidth="8"
          strokeDasharray={`${circ * 0.75} ${circ}`} strokeDashoffset={-offset}
          className="text-surface-tertiary" strokeLinecap="round" />
        <circle cx="60" cy="70" r={r} fill="none" stroke={gradeColor} strokeWidth="8"
          strokeDasharray={`${arcLen} ${circ}`} strokeDashoffset={-offset}
          strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
        <text x="60" y="62" textAnchor="middle" fontSize="22" fontWeight="700" fill={gradeColor}>{grade}</text>
        <text x="60" y="76" textAnchor="middle" fontSize="11" fill="#94a3b8">{score}/100</text>
      </svg>
      <span className="text-xs text-text-tertiary -mt-1">Risk Score</span>
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="bg-surface-secondary border border-border rounded-xl p-4 text-center">
      <div className={cn('text-2xl font-bold', color ?? 'text-text-primary')}>{value}</div>
      <div className="text-xs font-medium text-text-secondary mt-0.5">{label}</div>
      {sub && <div className="text-xs text-text-tertiary mt-0.5">{sub}</div>}
    </div>
  )
}

function EmptyState({ icon, title, desc, action }: { icon: React.ReactNode; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-text-tertiary mb-3">{icon}</div>
      <p className="font-semibold text-text-primary">{title}</p>
      <p className="text-sm text-text-tertiary mt-1 max-w-xs">{desc}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ── Sub-nav ───────────────────────────────────────────────────────────

type SubView = 'dashboard' | 'scanner' | 'lineage' | 'policies' | 'anonymize' | 'audit' | 'reports'

const NAV_ITEMS: { id: SubView; icon: React.ReactNode; label: string }[] = [
  { id: 'dashboard', icon: <ShieldCheck className="w-4 h-4" />, label: 'Dashboard' },
  { id: 'scanner',   icon: <Search className="w-4 h-4" />,      label: 'PII Scanner' },
  { id: 'lineage',   icon: <GitBranch className="w-4 h-4" />,   label: 'Data Lineage' },
  { id: 'policies',  icon: <Lock className="w-4 h-4" />,         label: 'Policies' },
  { id: 'anonymize', icon: <Eye className="w-4 h-4" />,          label: 'Anonymization' },
  { id: 'audit',     icon: <Activity className="w-4 h-4" />,     label: 'Audit Log' },
  { id: 'reports',   icon: <FileText className="w-4 h-4" />,     label: 'Reports' },
]

// ═══════════════════════════════════════════════════════════════════
// 1. DASHBOARD
// ═══════════════════════════════════════════════════════════════════

function Dashboard({ onNavigate }: { onNavigate: (v: SubView) => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['compliance-dashboard'],
    queryFn: api.compliance.dashboard,
    refetchInterval: 30_000,
  })

  const evaluateMut = useMutation({
    mutationFn: api.compliance.evaluatePolicies,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-dashboard'] }),
  })

  const scanAllMut = useMutation({
    mutationFn: api.compliance.scanAll,
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ['compliance-dashboard'] }), 3000),
  })

  if (isLoading) return <div className="flex items-center justify-center h-full text-sm text-text-tertiary">Loading…</div>
  if (!data) return null

  const { risk, stats, recent_violations, dataset_coverage } = data

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Top row */}
      <div className="flex items-start gap-5">
        <div className="bg-surface-secondary border border-border rounded-xl p-5 flex items-center gap-6">
          <RiskGauge score={risk.score} grade={risk.grade} />
          <div className="space-y-2 min-w-[180px]">
            {Object.entries(risk.breakdown).map(([key, val]) => (
              <div key={key}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-text-tertiary capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-text-secondary">{val.pct}% risk</span>
                </div>
                <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', val.pct > 50 ? 'bg-red-400' : val.pct > 20 ? 'bg-yellow-400' : 'bg-green-400')}
                    style={{ width: `${val.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-3">
          <StatCard label="Violations" value={stats.violations} color={stats.violations > 0 ? 'text-red-400' : 'text-green-400'} />
          <StatCard label="Unscanned datasets" value={stats.unscanned_datasets} color={stats.unscanned_datasets > 0 ? 'text-yellow-400' : 'text-green-400'} />
          <StatCard label="PII columns found" value={stats.pii_columns} color={stats.pii_columns > 0 ? 'text-orange-400' : 'text-green-400'} />
          <StatCard label="Audit events (7d)" value={stats.audit_events_7d} />
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => scanAllMut.mutate()} disabled={scanAllMut.isPending}>
          {scanAllMut.isPending ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Scanning…</> : <><Search className="w-3.5 h-3.5 mr-1.5" />Scan all datasets</>}
        </Button>
        <Button size="sm" variant="outline" onClick={() => evaluateMut.mutate()} disabled={evaluateMut.isPending}>
          {evaluateMut.isPending ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Evaluating…</> : <><Zap className="w-3.5 h-3.5 mr-1.5" />Evaluate all policies</>}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate('reports')}>
          <FileText className="w-3.5 h-3.5 mr-1.5" />Generate report
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Recent violations */}
        <div className="bg-surface-secondary border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Recent Violations</h3>
            <button onClick={() => onNavigate('policies')} className="text-xs text-brand hover:underline">View all</button>
          </div>
          {recent_violations.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-400 py-2">
              <CheckCircle className="w-4 h-4" />No violations
            </div>
          ) : (
            <div className="space-y-2">
              {recent_violations.slice(0, 6).map(v => (
                <div key={v.id} className="flex items-start gap-2 text-xs">
                  <SeverityDot severity={v.severity} />
                  <div className="min-w-0">
                    <span className="font-medium text-text-primary">{v.entity_name}</span>
                    <span className="text-text-tertiary mx-1">·</span>
                    <span className="text-text-tertiary">{v.policy_name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dataset coverage grid */}
        <div className="bg-surface-secondary border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Dataset Coverage</h3>
            <button onClick={() => onNavigate('scanner')} className="text-xs text-brand hover:underline">Scanner →</button>
          </div>
          {dataset_coverage.length === 0 ? (
            <p className="text-xs text-text-tertiary">No datasets yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {dataset_coverage.map(d => (
                <div key={d.id} className={cn('border rounded-lg px-3 py-2 cursor-pointer hover:border-brand/50 transition-colors',
                  d.pii_risk === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                  d.pii_risk === 'high' ? 'border-orange-500/30 bg-orange-500/5' :
                  d.pii_risk === 'clean' ? 'border-green-500/30 bg-green-500/5' :
                  'border-border bg-surface-primary'
                )} onClick={() => onNavigate('scanner')}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <SeverityDot severity={d.pii_risk} />
                    <span className="text-xs font-medium text-text-primary truncate">{d.name}</span>
                  </div>
                  <span className="text-xs text-text-tertiary">{d.pii_risk}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// 2. PII SCANNER
// ═══════════════════════════════════════════════════════════════════

function PiiScanner({ onAnonymize }: { onAnonymize: (dsId: string) => void }) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | PiiSeverity>('all')
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set())

  const { data: scans = [] } = useQuery({ queryKey: ['compliance-scans'], queryFn: api.compliance.listScans, refetchInterval: 3000 })
  const { data: activeScan } = useQuery({
    queryKey: ['compliance-scan-detail', selected],
    queryFn: () => api.compliance.getScan(selected!),
    enabled: !!selected,
    refetchInterval: (q) => q.state.data?.status === 'running' ? 1000 : false,
  })

  const scanMut = useMutation({
    mutationFn: (id: string) => api.compliance.triggerScan(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-scans'] }); qc.invalidateQueries({ queryKey: ['compliance-scan-detail', selected] }) },
  })
  const scanAllMut = useMutation({
    mutationFn: api.compliance.scanAll,
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ['compliance-scans'] }), 1500),
  })

  const filtered = filter === 'all' ? scans : scans.filter(s => (s.scan?.overall_risk ?? 'unscanned') === filter)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="w-64 flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => scanAllMut.mutate()} disabled={scanAllMut.isPending}>
              {scanAllMut.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <><Search className="w-3 h-3 mr-1" />Scan all</>}
            </Button>
          </div>
          <select className="w-full bg-surface-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none"
            value={filter} onChange={e => setFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="clean">Clean</option>
            <option value="unscanned">Unscanned</option>
          </select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map(s => (
            <button key={s.dataset_id} onClick={() => setSelected(s.dataset_id)}
              className={cn('w-full text-left px-3 py-2.5 border-b border-border hover:bg-surface-secondary transition-colors',
                selected === s.dataset_id && 'bg-brand/5 border-l-2 border-l-brand')}>
              <div className="flex items-center gap-2 mb-0.5">
                <SeverityDot severity={s.scan?.overall_risk ?? 'unscanned'} />
                <span className="text-sm text-text-primary font-medium truncate flex-1">{s.dataset_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-tertiary">
                  {s.scan ? `${s.scan.pii_column_count} PII col${s.scan.pii_column_count !== 1 ? 's' : ''}` : 'Not scanned'}
                </span>
                {!s.scan && (
                  <button className="text-xs text-brand hover:underline" onClick={e => { e.stopPropagation(); scanMut.mutate(s.dataset_id) }}>
                    Scan
                  </button>
                )}
                {s.scan?.status === 'running' && <RefreshCw className="w-3 h-3 text-brand animate-spin" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto p-5">
        {!selected ? (
          <EmptyState icon={<Search className="w-10 h-10" />} title="Select a dataset" desc="Choose a dataset from the left to view its PII scan results." />
        ) : !activeScan ? (
          <div className="text-sm text-text-tertiary">Loading scan…</div>
        ) : activeScan.status === 'running' ? (
          <div className="flex items-center gap-2 text-sm text-brand"><RefreshCw className="w-4 h-4 animate-spin" />Scanning dataset…</div>
        ) : activeScan.status === 'failed' ? (
          <div className="text-sm text-red-400">Scan failed: {activeScan.error_message}</div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge severity={activeScan.overall_risk} />
                  <span className="text-xs text-text-tertiary">{activeScan.rows_sampled} rows sampled · {activeScan.duration_ms}ms</span>
                </div>
                <div className="flex gap-3 text-xs">
                  {activeScan.critical_count > 0 && <span className="text-red-400">{activeScan.critical_count} critical</span>}
                  {activeScan.high_count > 0 && <span className="text-orange-400">{activeScan.high_count} high</span>}
                  {activeScan.medium_count > 0 && <span className="text-yellow-500">{activeScan.medium_count} medium</span>}
                  {activeScan.low_count > 0 && <span className="text-blue-400">{activeScan.low_count} low</span>}
                </div>
              </div>
              {activeScan.findings.length > 0 && (
                <Button size="sm" onClick={() => onAnonymize(activeScan.dataset_id)}>
                  <Lock className="w-3.5 h-3.5 mr-1.5" />Anonymize →
                </Button>
              )}
            </div>

            {activeScan.findings.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <CheckCircle className="w-5 h-5" />No PII detected in this dataset.
              </div>
            ) : (
              <div className="space-y-2">
                {activeScan.findings.map(f => {
                  const key = f.column
                  const expanded = expandedFindings.has(key)
                  return (
                    <div key={key} className="border border-border rounded-xl overflow-hidden">
                      <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary transition-colors text-left"
                        onClick={() => setExpandedFindings(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })}>
                        <SeverityDot severity={f.severity} size="md" />
                        <span className="font-medium text-text-primary text-sm flex-1">{f.column}</span>
                        <SeverityBadge severity={f.severity} />
                        <span className="text-xs text-text-tertiary">{f.pii_category.replace(/_/g, ' ')}</span>
                        <div className="w-20 h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', f.severity === 'critical' ? 'bg-red-400' : f.severity === 'high' ? 'bg-orange-400' : f.severity === 'medium' ? 'bg-yellow-400' : 'bg-blue-400')}
                            style={{ width: `${f.confidence * 100}%` }} />
                        </div>
                        <span className="text-xs text-text-tertiary w-8">{(f.confidence * 100).toFixed(0)}%</span>
                        {expanded ? <ChevronDown className="w-4 h-4 text-text-tertiary" /> : <ChevronRight className="w-4 h-4 text-text-tertiary" />}
                      </button>
                      {expanded && (
                        <div className="px-4 pb-4 pt-1 bg-surface-secondary border-t border-border space-y-3">
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div><span className="text-text-tertiary">Detection: </span><span className="text-text-primary">{f.detection_method.replace(/_/g, ' ')}</span></div>
                            <div><span className="text-text-tertiary">Category: </span><span className="text-text-primary">{f.pii_category.replace(/_/g, ' ')}</span></div>
                            <div><span className="text-text-tertiary">Confidence: </span><span className="text-text-primary">{(f.confidence * 100).toFixed(1)}%</span></div>
                          </div>
                          {f.sample_values.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                              {f.sample_values.map((v, i) => (
                                <code key={i} className="text-xs bg-surface-primary border border-border rounded px-2 py-0.5 text-text-secondary">{v}</code>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-1.5 flex-wrap">
                            {f.suggested_methods.map(m => (
                              <button key={m} onClick={() => onAnonymize(activeScan.dataset_id)}
                                className="text-xs bg-brand/10 text-brand border border-brand/20 rounded px-2 py-0.5 hover:bg-brand/20">
                                → {ANON_METHOD_LABELS[m]}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// 3. DATA LINEAGE
// ═══════════════════════════════════════════════════════════════════

function DataLineage() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedNode, setSelectedNode] = useState<LineageNode | null>(null)
  const [pan, setPan] = useState({ x: 40, y: 40 })
  const [zoom, setZoom] = useState(1)
  const [filterType, setFilterType] = useState<string>('all')
  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const { data: graph, isLoading } = useQuery({ queryKey: ['compliance-lineage'], queryFn: api.compliance.getLineage, staleTime: 30_000 })

  // Simple force-directed layout: assign positions
  const nodePositions = useCallback(() => {
    if (!graph) return {}
    const positions: Record<string, { x: number; y: number }> = {}
    const nodes = graph.nodes
    const cols: Record<string, number> = { dataset: 0, pipeline: 1, pipeline_run: 1, synthetic_job: 2, al_session: 2, benchmark_job: 2, marketplace_asset: 0 }
    const colCounts: Record<number, number> = {}
    nodes.forEach(n => {
      const col = cols[n.type] ?? 1
      colCounts[col] = (colCounts[col] ?? 0) + 1
    })
    const colIdx: Record<number, number> = {}
    nodes.forEach(n => {
      const col = cols[n.type] ?? 1
      const idx = colIdx[col] ?? 0
      colIdx[col] = idx + 1
      const count = colCounts[col]
      positions[n.id] = { x: col * 220 + 60, y: idx * 80 + 60 }
    })
    return positions
  }, [graph])

  const positions = nodePositions()

  const filteredNodes = graph?.nodes.filter(n => filterType === 'all' || n.type === filterType) ?? []
  const filteredIds = new Set(filteredNodes.map(n => n.id))
  const filteredEdges = graph?.edges.filter(e => filteredIds.has(e.source) && filteredIds.has(e.target)) ?? []

  const svgW = Math.max(...Object.values(positions).map(p => p.x), 0) + 200
  const svgH = Math.max(...Object.values(positions).map(p => p.y), 0) + 100

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-node]')) return
    isPanning.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return
    setPan(p => ({ x: p.x + e.clientX - lastPos.current.x, y: p.y + e.clientY - lastPos.current.y }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseUp = () => { isPanning.current = false }

  if (isLoading) return <div className="flex items-center justify-center h-full text-sm text-text-tertiary">Loading lineage…</div>
  if (!graph || graph.nodes.length === 0) {
    return <EmptyState icon={<GitBranch className="w-10 h-10" />} title="No lineage yet" desc="Upload datasets and run pipelines to see your data lineage graph." />
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 relative overflow-hidden bg-surface-primary"
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
        {/* Toolbar */}
        <div className="absolute top-3 left-3 z-10 flex gap-2 items-center">
          <div className="flex gap-1 bg-surface-primary border border-border rounded-lg p-1">
            <button onClick={() => setZoom(z => Math.min(z + 0.2, 2))} className="w-6 h-6 flex items-center justify-center text-text-secondary hover:text-text-primary text-sm">+</button>
            <button onClick={() => setZoom(1)} className="px-2 text-xs text-text-secondary hover:text-text-primary">{Math.round(zoom * 100)}%</button>
            <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.3))} className="w-6 h-6 flex items-center justify-center text-text-secondary hover:text-text-primary text-sm">−</button>
          </div>
          <button onClick={() => { setPan({ x: 40, y: 40 }); setZoom(1) }} className="bg-surface-primary border border-border rounded-lg px-2 py-1 text-xs text-text-secondary hover:text-text-primary">Fit</button>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="bg-surface-primary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none">
            <option value="all">All types</option>
            <option value="dataset">Datasets</option>
            <option value="pipeline">Pipelines</option>
            <option value="synthetic_job">Synthetic</option>
            <option value="al_session">AL Sessions</option>
            <option value="benchmark_job">Benchmarks</option>
            <option value="marketplace_asset">Marketplace</option>
          </select>
        </div>

        <svg ref={svgRef} width="100%" height="100%" style={{ cursor: 'grab' }}>
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* Edges */}
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#475569" />
              </marker>
            </defs>
            {filteredEdges.map(e => {
              const s = positions[e.source]
              const t = positions[e.target]
              if (!s || !t) return null
              const mx = (s.x + t.x) / 2
              return (
                <g key={e.id}>
                  <path d={`M ${s.x + 70},${s.y + 18} C ${mx},${s.y + 18} ${mx},${t.y + 18} ${t.x},${t.y + 18}`}
                    fill="none" stroke="#334155" strokeWidth="1.5" markerEnd="url(#arrow)" />
                  <text x={mx} y={(s.y + t.y) / 2 + 14} textAnchor="middle" fontSize="9" fill="#64748b">{e.label}</text>
                </g>
              )
            })}
            {/* Nodes */}
            {filteredNodes.map(n => {
              const p = positions[n.id]
              if (!p) return null
              const isSelected = selectedNode?.id === n.id
              const scan = n.type === 'dataset' ? (n.meta.pii_risk as string) : null
              const piiColor = { critical: '#ef4444', high: '#f97316', medium: '#eab308' }[scan ?? '']
              return (
                <g key={n.id} data-node="1" transform={`translate(${p.x},${p.y})`}
                  style={{ cursor: 'pointer' }} onClick={() => setSelectedNode(isSelected ? null : n)}>
                  <rect width="140" height="36" rx="8"
                    fill={isSelected ? `${n.color}22` : '#1e293b'}
                    stroke={isSelected ? n.color : '#334155'}
                    strokeWidth={isSelected ? 2 : 1} />
                  {piiColor && <circle cx="132" cy="4" r="5" fill={piiColor} />}
                  <text x="12" y="14" fontSize="10" fill={n.color} fontWeight="600">{n.type.replace(/_/g, ' ')}</text>
                  <text x="12" y="26" fontSize="11" fill="#e2e8f0" fontWeight="500">
                    {n.label.length > 16 ? n.label.slice(0, 15) + '…' : n.label}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {/* Node detail panel */}
      {selectedNode && (
        <div className="w-64 flex-shrink-0 border-l border-border overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-tertiary font-medium uppercase">{selectedNode.type.replace(/_/g, ' ')}</span>
            <button onClick={() => setSelectedNode(null)} className="text-text-tertiary hover:text-text-primary"><X className="w-4 h-4" /></button>
          </div>
          <h3 className="font-semibold text-text-primary">{selectedNode.label}</h3>
          <div className="space-y-1.5">
            {Object.entries(selectedNode.meta).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => (
              <div key={k} className="text-xs">
                <span className="text-text-tertiary capitalize">{k.replace(/_/g, ' ')}: </span>
                <span className="text-text-primary">
                  {typeof v === 'number' && k.includes('bytes') ? `${(v / 1024).toFixed(1)} KB`
                   : typeof v === 'number' && k.includes('accuracy') ? `${(v * 100).toFixed(1)}%`
                   : String(v)}
                </span>
              </div>
            ))}
          </div>
          {selectedNode.meta.pii_risk && (
            <SeverityBadge severity={selectedNode.meta.pii_risk as string} label={`PII: ${selectedNode.meta.pii_risk}`} />
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// 4. POLICIES
// ═══════════════════════════════════════════════════════════════════

function Policies() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [form, setForm] = useState({ name: '', policy_type: 'no_pii_in_training' as PolicyType, severity: 'warning' as PolicySeverity, parameters: '{}', enabled: true })

  const { data: policies = [] } = useQuery({ queryKey: ['compliance-policies'], queryFn: api.compliance.listPolicies })
  const { data: violations = [] } = useQuery({ queryKey: ['compliance-violations'], queryFn: () => api.compliance.listViolations(false) })

  const evaluateMut = useMutation({
    mutationFn: api.compliance.evaluatePolicies,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-policies'] }); qc.invalidateQueries({ queryKey: ['compliance-violations'] }) },
  })

  const createMut = useMutation({
    mutationFn: () => api.compliance.createPolicy({
      name: form.name, policy_type: form.policy_type, severity: form.severity,
      parameters: JSON.parse(form.parameters || '{}'), enabled: form.enabled,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-policies'] }); setShowCreate(false) },
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.compliance.updatePolicy(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-policies'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.compliance.deletePolicy(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-policies'] }),
  })

  const resolveMut = useMutation({
    mutationFn: (id: string) => api.compliance.resolveViolation(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-violations'] }); qc.invalidateQueries({ queryKey: ['compliance-policies'] }) },
  })

  const violsByPolicy = violations.reduce<Record<string, PolicyViolation[]>>((acc, v) => {
    acc[v.policy_id] = [...(acc[v.policy_id] ?? []), v]
    return acc
  }, {})

  return (
    <div className="p-5 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-text-primary">Policies ({policies.length})</h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            {violations.length > 0 ? `${violations.length} active violation${violations.length !== 1 ? 's' : ''}` : 'All passing'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => evaluateMut.mutate()} disabled={evaluateMut.isPending}>
            {evaluateMut.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <><Zap className="w-3.5 h-3.5 mr-1.5" />Evaluate all</>}
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />New policy
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-surface-secondary border border-border rounded-xl p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">New Policy</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-tertiary mb-1">Name *</label>
              <input className="w-full bg-surface-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-brand"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">Type</label>
              <select className="w-full bg-surface-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none"
                value={form.policy_type} onChange={e => setForm(f => ({ ...f, policy_type: e.target.value as PolicyType }))}>
                {Object.entries(POLICY_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">Severity</label>
              <select className="w-full bg-surface-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none"
                value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value as PolicySeverity }))}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">Parameters (JSON)</label>
              <input className="w-full bg-surface-primary border border-border rounded-lg px-3 py-1.5 text-sm font-mono text-text-primary focus:outline-none focus:border-brand"
                value={form.parameters} onChange={e => setForm(f => ({ ...f, parameters: e.target.value }))} placeholder='{"threshold": 0.8}' />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMut.mutate()} disabled={!form.name.trim() || createMut.isPending}>
              {createMut.isPending ? 'Creating…' : 'Create'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
          {createMut.isError && <p className="text-xs text-danger">{(createMut.error as Error).message}</p>}
        </div>
      )}

      <div className="space-y-2">
        {policies.map(p => {
          const viols = violsByPolicy[p.id] ?? []
          const isExpanded = expanded.has(p.id)
          return (
            <div key={p.id} className={cn('border rounded-xl overflow-hidden', viols.length > 0 ? 'border-orange-500/30' : 'border-border')}>
              <div className="flex items-center gap-3 px-4 py-3">
                {viols.length === 0 ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary text-sm">{p.name}</span>
                    <SeverityBadge severity={p.severity} />
                    {viols.length > 0 && <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5">{viols.length} violation{viols.length !== 1 ? 's' : ''}</span>}
                  </div>
                  <span className="text-xs text-text-tertiary">{POLICY_TYPE_LABELS[p.policy_type]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleMut.mutate({ id: p.id, enabled: !p.enabled })}
                    className={cn('w-9 h-5 rounded-full transition-colors relative', p.enabled ? 'bg-brand' : 'bg-surface-tertiary')}>
                    <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', p.enabled ? 'translate-x-4' : 'translate-x-0.5')} />
                  </button>
                  {viols.length > 0 && (
                    <button onClick={() => setExpanded(s => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })}
                      className="text-text-tertiary hover:text-text-primary">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  )}
                  <button onClick={() => { if (window.confirm(`Delete "${p.name}"?`)) deleteMut.mutate(p.id) }} className="text-text-tertiary hover:text-danger">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {isExpanded && viols.length > 0 && (
                <div className="border-t border-border bg-surface-secondary px-4 py-2 space-y-2">
                  {viols.map(v => (
                    <div key={v.id} className="flex items-start gap-2 text-xs py-1.5 border-b border-border last:border-0">
                      <SeverityDot severity={v.severity} />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-text-primary">{v.entity_name}</span>
                        <span className="text-text-tertiary ml-1">· {v.message}</span>
                      </div>
                      <button onClick={() => resolveMut.mutate(v.id)} className="text-green-400 hover:text-green-300 flex-shrink-0 flex items-center gap-1">
                        <Check className="w-3 h-3" />Resolve
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// 5. ANONYMIZATION
// ═══════════════════════════════════════════════════════════════════

function Anonymization({ initialDatasetId }: { initialDatasetId?: string }) {
  const qc = useQueryClient()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [sourceId, setSourceId] = useState(initialDatasetId ?? '')
  const [outputName, setOutputName] = useState('')
  const [configs, setConfigs] = useState<ColumnConfig[]>([])
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  const { data: datasets = [] } = useQuery({ queryKey: ['datasets'], queryFn: api.datasets.list })
  const { data: scan } = useQuery({
    queryKey: ['compliance-scan-detail', sourceId],
    queryFn: () => api.compliance.getScan(sourceId),
    enabled: !!sourceId,
  })
  const { data: jobs = [] } = useQuery({ queryKey: ['compliance-anon-jobs'], queryFn: api.compliance.listAnonJobs })
  const { data: activeJob } = useQuery({
    queryKey: ['compliance-anon-job', activeJobId],
    queryFn: () => api.compliance.getAnonJob(activeJobId!),
    enabled: !!activeJobId,
    refetchInterval: (q) => q.state.data?.status === 'running' || q.state.data?.status === 'pending' ? 1000 : false,
  })

  useEffect(() => {
    if (initialDatasetId) setSourceId(initialDatasetId)
  }, [initialDatasetId])

  const selectedDs = datasets.find(d => d.id === sourceId)

  const initConfigs = useCallback(() => {
    if (!selectedDs) return
    const schema = selectedDs.schema ?? []
    const piiMap = new Map(scan?.findings.map(f => [f.column, f]) ?? [])
    setConfigs(schema.map(col => {
      const finding = piiMap.get(col.name)
      let method: AnonMethod = 'keep'
      if (finding) {
        if (finding.severity === 'critical') method = 'hash'
        else if (finding.severity === 'high') method = 'mask'
        else if (finding.severity === 'medium') method = 'generalize'
      }
      return { column: col.name, method, params: {} }
    }))
    setOutputName(`${selectedDs.name.replace('.csv', '')}_anonymized`)
    setStep(2)
  }, [selectedDs, scan])

  const createMut = useMutation({
    mutationFn: () => api.compliance.createAnonJob({ source_dataset_id: sourceId, output_name: outputName, column_configs: configs }),
    onSuccess: (res) => {
      setActiveJobId(res.job_id)
      qc.invalidateQueries({ queryKey: ['compliance-anon-jobs'] })
      setStep(3)
    },
  })

  return (
    <div className="p-5 overflow-y-auto h-full space-y-5">
      {/* Wizard */}
      <div className="bg-surface-secondary border border-border rounded-xl overflow-hidden">
        {/* Step header */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
          {(['Select dataset', 'Configure columns', 'Review & generate'] as const).map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="w-3 h-3 text-text-tertiary" />}
              <div className={cn('flex items-center gap-1.5 text-xs', step === i + 1 ? 'text-brand font-medium' : step > i + 1 ? 'text-text-secondary' : 'text-text-tertiary')}>
                <span className={cn('w-5 h-5 rounded-full text-xs flex items-center justify-center border',
                  step === i + 1 ? 'bg-brand text-white border-brand' : step > i + 1 ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'border-border'
                )}>{step > i + 1 ? <Check className="w-3 h-3" /> : i + 1}</span>
                {label}
              </div>
            </div>
          ))}
        </div>

        <div className="p-5">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1.5">Select source dataset</label>
                <select className="w-full bg-surface-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
                  value={sourceId} onChange={e => setSourceId(e.target.value)}>
                  <option value="">Choose a dataset…</option>
                  {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              {sourceId && !scan && (
                <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  This dataset hasn't been scanned. PII suggestions won't be available, but you can still configure manually.
                </div>
              )}
              {sourceId && scan && (
                <div className="text-xs text-text-secondary bg-surface-primary border border-border rounded-lg p-3">
                  Last scan: <SeverityBadge severity={scan.overall_risk} /> · {scan.pii_column_count} PII columns detected
                </div>
              )}
              <Button onClick={initConfigs} disabled={!sourceId}>Configure columns →</Button>
            </div>
          )}

          {step === 2 && configs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-tertiary">{configs.length} columns · {configs.filter(c => c.method !== 'keep').length} will be transformed</p>
                <button className="text-xs text-brand hover:underline" onClick={() => {
                  const piiMap = new Map(scan?.findings.map(f => [f.column, f]) ?? [])
                  setConfigs(prev => prev.map(c => {
                    const f = piiMap.get(c.column)
                    if (!f) return c
                    return { ...c, method: f.severity === 'critical' ? 'hash' : f.severity === 'high' ? 'mask' : 'generalize' }
                  }))
                }}>Auto-suggest from scan</button>
              </div>
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-tertiary border-b border-border">
                      <th className="px-3 py-2 text-left text-text-tertiary">Column</th>
                      <th className="px-3 py-2 text-left text-text-tertiary">PII Risk</th>
                      <th className="px-3 py-2 text-left text-text-tertiary">Method</th>
                      <th className="px-3 py-2 text-left text-text-tertiary">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configs.map((c, i) => {
                      const finding = scan?.findings.find(f => f.column === c.column)
                      const preview = c.method === 'suppress' ? '—' : c.method === 'redact' ? '[REDACTED]' : c.method === 'mask' ? 'j***@e***.com' : c.method === 'hash' ? 'a3f9b2c1…' : c.method === 'generalize' ? '20–29' : c.method === 'pseudonymize' ? 'ID-00001' : 'original'
                      return (
                        <tr key={c.column} className={cn('border-b border-border last:border-0', i % 2 === 0 ? 'bg-surface-primary' : 'bg-surface-secondary')}>
                          <td className="px-3 py-2 font-medium text-text-primary">{c.column}</td>
                          <td className="px-3 py-2">
                            {finding ? <SeverityBadge severity={finding.severity} /> : <span className="text-text-tertiary">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            <select value={c.method} onChange={e => setConfigs(prev => prev.map((cc, j) => j === i ? { ...cc, method: e.target.value as AnonMethod } : cc))}
                              className="bg-surface-primary border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none w-full">
                              {(Object.keys(ANON_METHOD_LABELS) as AnonMethod[]).map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2 font-mono text-text-tertiary">{preview}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div>
                <label className="block text-xs text-text-tertiary mb-1">Output dataset name</label>
                <input className="w-full bg-surface-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
                  value={outputName} onChange={e => setOutputName(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep(1)}>← Back</Button>
                <Button size="sm" onClick={() => setStep(3)} disabled={!outputName.trim()}>Review →</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-surface-primary border border-border rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium text-text-primary">Summary</p>
                <div className="grid grid-cols-3 gap-3 text-xs text-center">
                  <div className="bg-surface-secondary rounded-lg p-3"><div className="text-lg font-bold text-text-primary">{configs.length}</div><div className="text-text-tertiary">Total columns</div></div>
                  <div className="bg-surface-secondary rounded-lg p-3"><div className="text-lg font-bold text-brand">{configs.filter(c => c.method !== 'keep').length}</div><div className="text-text-tertiary">Transformed</div></div>
                  <div className="bg-surface-secondary rounded-lg p-3"><div className="text-lg font-bold text-text-primary">{configs.filter(c => c.method === 'suppress').length}</div><div className="text-text-tertiary">Suppressed</div></div>
                </div>
                <p className="text-xs text-text-tertiary">Output: <span className="text-text-primary font-medium">{outputName}</span></p>
              </div>

              {activeJob && (
                <div className={cn('border rounded-xl p-4 text-sm', activeJob.status === 'complete' ? 'border-green-500/20 bg-green-500/5 text-green-400' : activeJob.status === 'failed' ? 'border-red-500/20 bg-red-500/5 text-red-400' : 'border-brand/20 bg-brand/5 text-brand')}>
                  {activeJob.status === 'complete' ? (
                    <div className="flex items-center gap-2"><Check className="w-4 h-4" />Anonymized dataset created · {activeJob.rows_processed.toLocaleString()} rows · {activeJob.columns_transformed} columns transformed</div>
                  ) : activeJob.status === 'failed' ? (
                    <div className="flex items-center gap-2"><XCircle className="w-4 h-4" />{activeJob.error_message}</div>
                  ) : (
                    <div className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />Processing…</div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep(2)}>← Back</Button>
                <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !!activeJobId}>
                  {createMut.isPending ? 'Starting…' : 'Generate anonymized dataset'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Previous jobs */}
      {jobs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Previous Jobs</h3>
          <div className="space-y-2">
            {jobs.map(j => (
              <div key={j.id} className="flex items-center gap-3 bg-surface-secondary border border-border rounded-xl px-4 py-3 text-sm">
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0', j.status === 'complete' ? 'bg-green-400' : j.status === 'failed' ? 'bg-red-400' : 'bg-brand animate-pulse')} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary">{j.output_name}</p>
                  <p className="text-xs text-text-tertiary">{j.columns_transformed} columns · {j.rows_processed.toLocaleString()} rows · {new Date(j.created_at).toLocaleDateString()}</p>
                </div>
                {j.status === 'complete' && j.output_dataset_id && (
                  <a href="/datasets" className="text-xs text-brand hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />View</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// 6. AUDIT LOG
// ═══════════════════════════════════════════════════════════════════

const CATEGORY_COLORS: Record<string, string> = {
  data: 'bg-blue-500', pipeline: 'bg-purple-500', ml: 'bg-green-500',
  compliance: 'bg-orange-500', marketplace: 'bg-pink-500', settings: 'bg-slate-500',
}

function AuditLog() {
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const LIMIT = 50

  const { data } = useQuery({
    queryKey: ['compliance-audit', category, search, offset],
    queryFn: () => api.compliance.getAuditLog({ category: category || undefined, entity_name: search || undefined, limit: LIMIT, offset }),
    staleTime: 10_000,
  })

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex gap-3 p-4 border-b border-border flex-shrink-0 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
          <input className="w-full bg-surface-secondary border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand"
            placeholder="Search entity name…" value={search} onChange={e => { setSearch(e.target.value); setOffset(0) }} />
        </div>
        <select className="bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none"
          value={category} onChange={e => { setCategory(e.target.value); setOffset(0) }}>
          <option value="">All categories</option>
          {['data', 'pipeline', 'ml', 'compliance', 'marketplace', 'settings'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <a href={api.compliance.auditExportUrl()} className="text-xs text-brand border border-brand/30 rounded-lg px-3 py-1.5 hover:bg-brand/5 flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" />Export CSV
        </a>
      </div>

      {data && (
        <div className="flex-shrink-0 px-4 py-2 text-xs text-text-tertiary border-b border-border">
          {data.total.toLocaleString()} total events
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {data?.events.map(e => {
          const isExp = expanded.has(e.id)
          return (
            <div key={e.id} className="border-b border-border">
              <button className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-secondary transition-colors text-left"
                onClick={() => setExpanded(s => { const n = new Set(s); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n })}>
                <div className={cn('w-1.5 h-full min-h-[32px] rounded-full flex-shrink-0 mt-1', CATEGORY_COLORS[e.category] ?? 'bg-slate-500')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary text-sm">{e.event_type}</span>
                    {e.entity_name && <span className="text-text-secondary text-sm">· {e.entity_name}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-tertiary">{e.category}</span>
                    {e.duration_ms && <span className="text-xs text-text-tertiary">· {e.duration_ms}ms</span>}
                    <span className="text-xs text-text-tertiary">· {new Date(e.created_at).toLocaleString()}</span>
                  </div>
                </div>
                {isExp ? <ChevronDown className="w-4 h-4 text-text-tertiary flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-text-tertiary flex-shrink-0" />}
              </button>
              {isExp && Object.keys(e.metadata).length > 0 && (
                <div className="px-8 pb-3">
                  <pre className="text-xs text-text-secondary bg-surface-tertiary border border-border rounded-lg p-3 overflow-x-auto">
                    {JSON.stringify(e.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )
        })}
        {data && data.total > offset + LIMIT && (
          <div className="p-4 text-center">
            <Button size="sm" variant="outline" onClick={() => setOffset(o => o + LIMIT)}>Load {LIMIT} more</Button>
          </div>
        )}
        {data?.events.length === 0 && (
          <EmptyState icon={<Activity className="w-10 h-10" />} title="No events yet" desc="Actions across Datrix will appear here." />
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// 7. REPORTS
// ═══════════════════════════════════════════════════════════════════

const FRAMEWORK_LABELS: Record<ComplianceFramework, string> = {
  gdpr: 'GDPR Article 30', ccpa: 'CCPA Inventory', hipaa: 'HIPAA Data Inventory',
  general: 'General Summary', custom: 'Custom',
}

function Reports() {
  const qc = useQueryClient()
  const [framework, setFramework] = useState<ComplianceFramework>('general')
  const [sections, setSections] = useState<string[]>(REPORT_SECTIONS.map(s => s.id))
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<ComplianceReport | null>(null)

  const { data: reports = [] } = useQuery({ queryKey: ['compliance-reports'], queryFn: api.compliance.listReports, refetchInterval: 5000 })

  const generateMut = useMutation({
    mutationFn: () => api.compliance.generateReport({ framework, sections }),
    onSuccess: (r) => {
      setGenerated(r)
      setGenerating(false)
      qc.invalidateQueries({ queryKey: ['compliance-reports'] })
    },
    onError: () => setGenerating(false),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.compliance.deleteReport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-reports'] }),
  })

  const toggleSection = (id: string) =>
    setSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])

  return (
    <div className="flex h-full overflow-hidden gap-0">
      {/* Left — generate */}
      <div className="w-72 flex-shrink-0 border-r border-border overflow-y-auto p-5 space-y-5">
        <h3 className="font-semibold text-text-primary">Generate Report</h3>
        <div>
          <p className="text-xs font-medium text-text-tertiary mb-2">Framework</p>
          <div className="space-y-1.5">
            {(Object.entries(FRAMEWORK_LABELS) as [ComplianceFramework, string][]).map(([v, l]) => (
              <label key={v} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                framework === v ? 'border-brand bg-brand/5 text-brand' : 'border-border text-text-secondary hover:bg-surface-secondary')}>
                <input type="radio" name="fw" value={v} checked={framework === v} onChange={() => setFramework(v)} className="sr-only" />
                <span className="text-sm">{l}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-text-tertiary mb-2">Sections</p>
          <div className="space-y-1.5">
            {REPORT_SECTIONS.map(s => (
              <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer text-text-secondary hover:text-text-primary">
                <input type="checkbox" checked={sections.includes(s.id)} onChange={() => toggleSection(s.id)}
                  className="w-3.5 h-3.5 accent-brand" />
                {s.label}
              </label>
            ))}
          </div>
        </div>
        <Button className="w-full" onClick={() => { setGenerating(true); setGenerated(null); generateMut.mutate() }}
          disabled={generateMut.isPending || sections.length === 0}>
          {generateMut.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Generating…</> : <>Generate {FRAMEWORK_LABELS[framework].split(' ')[0]} report</>}
        </Button>
        {generated && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-xs text-green-400">
            <div className="flex items-center gap-1.5 mb-2"><Check className="w-3.5 h-3.5" />Report generated</div>
            <div className="flex gap-2">
              <a href={api.compliance.downloadReportUrl(generated.id, 'html')} className="underline">HTML</a>
              <a href={api.compliance.downloadReportUrl(generated.id, 'json')} className="underline">JSON</a>
            </div>
          </div>
        )}
      </div>

      {/* Right — history */}
      <div className="flex-1 overflow-y-auto p-5">
        <h3 className="font-semibold text-text-primary mb-4">Report History</h3>
        {reports.length === 0 ? (
          <EmptyState icon={<FileText className="w-10 h-10" />} title="No reports yet" desc="Generate your first compliance report to get a snapshot of your data posture." />
        ) : (
          <div className="space-y-3">
            {reports.map(r => (
              <div key={r.id} className="bg-surface-secondary border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-text-primary text-sm">{FRAMEWORK_LABELS[r.framework]}</span>
                      {r.status === 'complete'
                        ? <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded px-1.5 py-0.5">Complete</span>
                        : r.status === 'failed'
                        ? <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-1.5 py-0.5">Failed</span>
                        : <span className="text-xs text-brand bg-brand/10 border border-brand/20 rounded px-1.5 py-0.5 flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5 animate-spin" />Pending</span>}
                    </div>
                    <p className="text-xs text-text-tertiary">
                      {new Date(r.created_at).toLocaleString()} · Score {r.risk_score}/100 · {r.entity_count} datasets · {r.violation_count} violations
                    </p>
                  </div>
                  <button onClick={() => { if (window.confirm('Delete this report?')) deleteMut.mutate(r.id) }} className="text-text-tertiary hover:text-danger flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {r.status === 'complete' && (
                  <div className="flex gap-2">
                    <a href={api.compliance.downloadReportUrl(r.id, 'html')} className="text-xs text-brand border border-brand/20 rounded px-2.5 py-1 hover:bg-brand/5 flex items-center gap-1">
                      <Download className="w-3 h-3" />HTML
                    </a>
                    <a href={api.compliance.downloadReportUrl(r.id, 'json')} className="text-xs text-text-secondary border border-border rounded px-2.5 py-1 hover:bg-surface-tertiary flex items-center gap-1">
                      <Download className="w-3 h-3" />JSON
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// ROOT PAGE
// ═══════════════════════════════════════════════════════════════════

export default function CompliancePage() {
  const [view, setView] = useState<SubView>('dashboard')
  const [anonDatasetId, setAnonDatasetId] = useState<string | undefined>()

  const { data: dashboard } = useQuery({
    queryKey: ['compliance-dashboard'],
    queryFn: api.compliance.dashboard,
    staleTime: 30_000,
  })

  const navHealthDot = (id: SubView): string => {
    if (!dashboard) return 'bg-surface-tertiary'
    const { stats } = dashboard
    if (id === 'scanner' && stats.unscanned_datasets > 0) return 'bg-yellow-400'
    if (id === 'policies' && stats.violations > 0) return 'bg-red-400'
    if (id === 'scanner' && stats.critical_pii_datasets > 0) return 'bg-red-400'
    return 'bg-green-400'
  }

  const handleAnonymize = (dsId: string) => {
    setAnonDatasetId(dsId)
    setView('anonymize')
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sub-nav */}
      <nav className="w-44 flex-shrink-0 border-r border-border flex flex-col py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <button key={item.id} onClick={() => setView(item.id)}
            className={cn('flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left relative',
              view === item.id ? 'bg-brand/5 text-brand font-medium' : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary')}>
            {item.icon}
            <span>{item.label}</span>
            <span className={cn('absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full', navHealthDot(item.id))} />
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {view === 'dashboard'  && <Dashboard onNavigate={setView} />}
        {view === 'scanner'    && <PiiScanner onAnonymize={handleAnonymize} />}
        {view === 'lineage'    && <DataLineage />}
        {view === 'policies'   && <Policies />}
        {view === 'anonymize'  && <Anonymization initialDatasetId={anonDatasetId} />}
        {view === 'audit'      && <AuditLog />}
        {view === 'reports'    && <Reports />}
      </div>
    </div>
  )
}
