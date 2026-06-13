import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck, Eye, Search, Download, RefreshCw,
  CheckCircle, XCircle, ChevronDown, ChevronRight, Trash2,
  GitBranch, FileText, Activity, Lock, Zap, Plus, X, Check,
  ExternalLink,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import type {
  PolicyViolation, ComplianceReport,
  LineageNode, PiiSeverity, PolicySeverity,
  PolicyType, AnonMethod, ComplianceFramework, ColumnConfig,
} from '@/types'

// ── Severity color maps (inline style values) ─────────────────────────

const SEV_COLOR: Record<string, string> = {
  critical: 'var(--bad)',
  high:     '#f97316',
  medium:   'var(--warn)',
  low:      '#60a5fa',
  clean:    'var(--green)',
  unscanned:'var(--text-tertiary)',
  pass:     'var(--green)',
  fail:     'var(--bad)',
  info:     '#60a5fa',
  warning:  'var(--warn)',
}

const SEV_BG: Record<string, string> = {
  critical: 'var(--bad-dim)',
  high:     'rgba(249,115,22,.12)',
  medium:   'var(--warn-dim)',
  low:      'rgba(96,165,250,.12)',
  clean:    'var(--green-dim)',
  unscanned:'var(--bg-3)',
  pass:     'var(--green-dim)',
  fail:     'var(--bad-dim)',
  info:     'rgba(96,165,250,.12)',
  warning:  'var(--warn-dim)',
}

const SEV_BORDER: Record<string, string> = {
  critical: 'rgba(239,68,68,.22)',
  high:     'rgba(249,115,22,.22)',
  medium:   'rgba(234,179,8,.22)',
  low:      'rgba(96,165,250,.22)',
  clean:    'rgba(52,211,153,.22)',
  unscanned:'var(--border)',
  pass:     'rgba(52,211,153,.22)',
  fail:     'rgba(239,68,68,.22)',
  info:     'rgba(96,165,250,.22)',
  warning:  'rgba(234,179,8,.22)',
}

const SEV_DOT_BG: Record<string, string> = {
  critical: 'var(--bad)',
  high:     '#f97316',
  medium:   'var(--warn)',
  low:      '#60a5fa',
  clean:    'var(--green)',
  unscanned:'var(--bg-3)',
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

const CATEGORY_DOT_COLOR: Record<string, string> = {
  data: '#3b82f6', pipeline: '#a855f7', ml: 'var(--green)',
  compliance: '#f97316', marketplace: '#ec4899', settings: '#64748b',
}

// ── Helpers ───────────────────────────────────────────────────────────

function SeverityBadge({ severity, label }: { severity: string; label?: string }) {
  const color = SEV_COLOR[severity] ?? SEV_COLOR.unscanned
  const bg = SEV_BG[severity] ?? SEV_BG.unscanned
  const border = SEV_BORDER[severity] ?? SEV_BORDER.unscanned
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: 'var(--radius-btn)',
      fontSize: '11px',
      fontWeight: 600,
      border: `1px solid ${border}`,
      color,
      background: bg,
      fontFamily: 'var(--font-mono)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
    }}>
      {label ?? severity.toUpperCase()}
    </span>
  )
}

function SeverityDot({ severity, size = 'sm' }: { severity: string; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? '8px' : '10px'
  return (
    <span style={{
      display: 'inline-block',
      width: sz,
      height: sz,
      borderRadius: '50%',
      flexShrink: 0,
      background: SEV_DOT_BG[severity] ?? 'var(--bg-3)',
      border: severity === 'unscanned' ? '1px solid var(--border)' : 'none',
    }} />
  )
}

function RiskGauge({ score, grade }: { score: number; grade: string }) {
  const gradeColor = ({ A: '#22c55e', 'B+': '#84cc16', B: '#eab308', C: '#f97316', D: '#ef4444', F: '#dc2626' } as Record<string, string>)[grade] ?? '#94a3b8'
  const r = 44
  const circ = 2 * Math.PI * r
  const arcLen = (score / 100) * circ * 0.75
  const offset = circ * 0.125

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width="120" height="90" viewBox="0 0 120 90">
        <circle cx="60" cy="70" r={r} fill="none" stroke="var(--bg-3)" strokeWidth="8"
          strokeDasharray={`${circ * 0.75} ${circ}`} strokeDashoffset={-offset}
          strokeLinecap="round" />
        <circle cx="60" cy="70" r={r} fill="none" stroke={gradeColor} strokeWidth="8"
          strokeDasharray={`${arcLen} ${circ}`} strokeDashoffset={-offset}
          strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
        <text x="60" y="62" textAnchor="middle" fontSize="22" fontWeight="700" fill={gradeColor}>{grade}</text>
        <text x="60" y="76" textAnchor="middle" fontSize="11" fill="var(--text-tertiary)">{score}/100</text>
      </svg>
      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '-4px' }}>Risk Score</span>
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px', textAlign: 'center' }}>
      <div style={{ fontSize: '24px', fontWeight: 700, color: color ?? 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '2px' }}>{label}</div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

function EmptyState({ icon, title, desc, action }: { icon: React.ReactNode; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', textAlign: 'center' }}>
      <div style={{ color: 'var(--text-tertiary)', marginBottom: '12px' }}>{icon}</div>
      <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{title}</p>
      <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginTop: '4px', maxWidth: '320px' }}>{desc}</p>
      {action && <div style={{ marginTop: '16px' }}>{action}</div>}
    </div>
  )
}

// ── Sub-nav ───────────────────────────────────────────────────────────

type SubView = 'dashboard' | 'scanner' | 'lineage' | 'policies' | 'anonymize' | 'audit' | 'reports'

const NAV_ITEMS: { id: SubView; icon: React.ReactNode; label: string }[] = [
  { id: 'dashboard', icon: <ShieldCheck style={{ width: '16px', height: '16px' }} />, label: 'Dashboard' },
  { id: 'scanner',   icon: <Search style={{ width: '16px', height: '16px' }} />,      label: 'PII Scanner' },
  { id: 'lineage',   icon: <GitBranch style={{ width: '16px', height: '16px' }} />,   label: 'Data Lineage' },
  { id: 'policies',  icon: <Lock style={{ width: '16px', height: '16px' }} />,         label: 'Policies' },
  { id: 'anonymize', icon: <Eye style={{ width: '16px', height: '16px' }} />,          label: 'Anonymization' },
  { id: 'audit',     icon: <Activity style={{ width: '16px', height: '16px' }} />,     label: 'Audit Log' },
  { id: 'reports',   icon: <FileText style={{ width: '16px', height: '16px' }} />,     label: 'Reports' },
]

// ── Shared input style ────────────────────────────────────────────────

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

  if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '14px', color: 'var(--text-tertiary)' }}>Loading…</div>
  if (!data) return null

  const { risk, stats, recent_violations, dataset_coverage } = data

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', height: '100%' }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '20px', display: 'flex', alignItems: 'center', gap: '24px' }}>
          <RiskGauge score={risk.score} grade={risk.grade} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '180px' }}>
            {Object.entries(risk.breakdown).map(([key, val]) => (
              <div key={key}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
                  <span style={{ color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{val.pct}% risk</span>
                </div>
                <div style={{ height: '6px', background: 'var(--bg-3)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    borderRadius: 'var(--radius-pill)',
                    background: val.pct > 50 ? 'var(--bad)' : val.pct > 20 ? 'var(--warn)' : 'var(--green)',
                    width: `${val.pct}%`,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <StatCard label="Violations" value={stats.violations} color={stats.violations > 0 ? 'var(--bad)' : 'var(--green)'} />
          <StatCard label="Unscanned datasets" value={stats.unscanned_datasets} color={stats.unscanned_datasets > 0 ? 'var(--warn)' : 'var(--green)'} />
          <StatCard label="PII columns found" value={stats.pii_columns} color={stats.pii_columns > 0 ? '#f97316' : 'var(--green)'} />
          <StatCard label="Audit events (7d)" value={stats.audit_events_7d} />
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button size="sm" variant="ghost" onClick={() => scanAllMut.mutate()} disabled={scanAllMut.isPending}>
          {scanAllMut.isPending ? <><RefreshCw style={{ width: '14px', height: '14px', marginRight: '6px', animation: 'spin 1s linear infinite' }} />Scanning…</> : <><Search style={{ width: '14px', height: '14px', marginRight: '6px' }} />Scan all datasets</>}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => evaluateMut.mutate()} disabled={evaluateMut.isPending}>
          {evaluateMut.isPending ? <><RefreshCw style={{ width: '14px', height: '14px', marginRight: '6px', animation: 'spin 1s linear infinite' }} />Evaluating…</> : <><Zap style={{ width: '14px', height: '14px', marginRight: '6px' }} />Evaluate all policies</>}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onNavigate('reports')}>
          <FileText style={{ width: '14px', height: '14px', marginRight: '6px' }} />Generate report
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Recent violations */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Recent Violations</h3>
            <button onClick={() => onNavigate('policies')} style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>View all</button>
          </div>
          {recent_violations.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--green)', padding: '8px 0' }}>
              <CheckCircle style={{ width: '16px', height: '16px' }} />No violations
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recent_violations.slice(0, 6).map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px' }}>
                  <SeverityDot severity={v.severity} />
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v.entity_name}</span>
                    <span style={{ color: 'var(--text-tertiary)', margin: '0 4px' }}>·</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>{v.policy_name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dataset coverage grid */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Dataset Coverage</h3>
            <button onClick={() => onNavigate('scanner')} style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Scanner →</button>
          </div>
          {dataset_coverage.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No datasets yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {dataset_coverage.map(d => (
                <div key={d.id} style={{
                  border: `1px solid ${SEV_BORDER[d.pii_risk] ?? 'var(--border)'}`,
                  background: SEV_BG[d.pii_risk] ?? 'var(--bg-card)',
                  borderRadius: 'var(--radius-btn)',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }} onClick={() => onNavigate('scanner')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <SeverityDot severity={d.pii_risk} />
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{d.pii_risk}</span>
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
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left panel */}
      <div style={{ width: '256px', flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button size="sm" variant="ghost" style={{ flex: 1 }} onClick={() => scanAllMut.mutate()} disabled={scanAllMut.isPending}>
              {scanAllMut.isPending ? <RefreshCw style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : <><Search style={{ width: '12px', height: '12px', marginRight: '4px' }} />Scan all</>}
            </Button>
          </div>
          <select style={inputSmStyle} value={filter} onChange={e => setFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="clean">Clean</option>
            <option value="unscanned">Unscanned</option>
          </select>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.map(s => (
            <button key={s.dataset_id} onClick={() => setSelected(s.dataset_id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                background: selected === s.dataset_id ? 'var(--blue-tint)' : 'transparent',
                borderLeft: selected === s.dataset_id ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (selected !== s.dataset_id) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)' }}
              onMouseLeave={e => { if (selected !== s.dataset_id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <SeverityDot severity={s.scan?.overall_risk ?? 'unscanned'} />
                <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.dataset_name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  {s.scan ? `${s.scan.pii_column_count} PII col${s.scan.pii_column_count !== 1 ? 's' : ''}` : 'Not scanned'}
                </span>
                {!s.scan && (
                  <button style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }} onClick={e => { e.stopPropagation(); scanMut.mutate(s.dataset_id) }}>
                    Scan
                  </button>
                )}
                {s.scan?.status === 'running' && <RefreshCw style={{ width: '12px', height: '12px', color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {!selected ? (
          <EmptyState icon={<Search style={{ width: '40px', height: '40px' }} />} title="Select a dataset" desc="Choose a dataset from the left to view its PII scan results." />
        ) : !activeScan ? (
          <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Loading scan…</div>
        ) : activeScan.status === 'running' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--accent)' }}><RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />Scanning dataset…</div>
        ) : activeScan.status === 'failed' ? (
          <div style={{ fontSize: '14px', color: 'var(--bad)' }}>Scan failed: {activeScan.error_message}</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <SeverityBadge severity={activeScan.overall_risk} />
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{activeScan.rows_sampled} rows sampled · {activeScan.duration_ms}ms</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                  {activeScan.critical_count > 0 && <span style={{ color: 'var(--bad)' }}>{activeScan.critical_count} critical</span>}
                  {activeScan.high_count > 0 && <span style={{ color: '#f97316' }}>{activeScan.high_count} high</span>}
                  {activeScan.medium_count > 0 && <span style={{ color: 'var(--warn)' }}>{activeScan.medium_count} medium</span>}
                  {activeScan.low_count > 0 && <span style={{ color: '#60a5fa' }}>{activeScan.low_count} low</span>}
                </div>
              </div>
              {activeScan.findings.length > 0 && (
                <Button size="sm" onClick={() => onAnonymize(activeScan.dataset_id)}>
                  <Lock style={{ width: '14px', height: '14px', marginRight: '6px' }} />Anonymize →
                </Button>
              )}
            </div>

            {activeScan.findings.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--green)', background: 'var(--green-dim)', border: '1px solid rgba(52,211,153,.22)', borderRadius: 'var(--radius-card)', padding: '16px' }}>
                <CheckCircle style={{ width: '20px', height: '20px' }} />No PII detected in this dataset.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeScan.findings.map(f => {
                  const key = f.column
                  const expanded = expandedFindings.has(key)
                  return (
                    <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
                      <button
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-2)')}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                        onClick={() => setExpandedFindings(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })}
                      >
                        <SeverityDot severity={f.severity} size="md" />
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px', flex: 1 }}>{f.column}</span>
                        <SeverityBadge severity={f.severity} />
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{f.pii_category.replace(/_/g, ' ')}</span>
                        <div style={{ width: '80px', height: '6px', background: 'var(--bg-3)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            borderRadius: 'var(--radius-pill)',
                            background: f.severity === 'critical' ? 'var(--bad)' : f.severity === 'high' ? '#f97316' : f.severity === 'medium' ? 'var(--warn)' : '#60a5fa',
                            width: `${f.confidence * 100}%`,
                          }} />
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', width: '32px' }}>{(f.confidence * 100).toFixed(0)}%</span>
                        {expanded ? <ChevronDown style={{ width: '16px', height: '16px', color: 'var(--text-tertiary)' }} /> : <ChevronRight style={{ width: '16px', height: '16px', color: 'var(--text-tertiary)' }} />}
                      </button>
                      {expanded && (
                        <div style={{ padding: '4px 16px 16px', background: 'var(--bg-2)', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '12px' }}>
                            <div><span style={{ color: 'var(--text-tertiary)' }}>Detection: </span><span style={{ color: 'var(--text-primary)' }}>{f.detection_method.replace(/_/g, ' ')}</span></div>
                            <div><span style={{ color: 'var(--text-tertiary)' }}>Category: </span><span style={{ color: 'var(--text-primary)' }}>{f.pii_category.replace(/_/g, ' ')}</span></div>
                            <div><span style={{ color: 'var(--text-tertiary)' }}>Confidence: </span><span style={{ color: 'var(--text-primary)' }}>{(f.confidence * 100).toFixed(1)}%</span></div>
                          </div>
                          {f.sample_values.length > 0 && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {f.sample_values.map((v, i) => (
                                <code key={i} style={{ fontSize: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)', padding: '2px 8px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{v}</code>
                              ))}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {f.suggested_methods.map(m => (
                              <button key={m} onClick={() => onAnonymize(activeScan.dataset_id)}
                                style={{ fontSize: '12px', background: 'var(--blue-tint)', color: 'var(--accent)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-btn)', padding: '2px 8px', cursor: 'pointer', transition: 'background 0.1s' }}
                                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,.18)')}
                                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--blue-tint)')}
                              >
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

  const nodePositions = useCallback(() => {
    if (!graph) return {}
    const positions: Record<string, { x: number; y: number }> = {}
    const nodes = graph.nodes
    const cols: Record<string, number> = { dataset: 0, pipeline: 1, pipeline_run: 1, synthetic_job: 2, al_session: 2, benchmark_job: 2, marketplace_asset: 0 }
    const colIdx: Record<number, number> = {}
    nodes.forEach(n => {
      const col = cols[n.type] ?? 1
      const idx = colIdx[col] ?? 0
      colIdx[col] = idx + 1
      positions[n.id] = { x: col * 220 + 60, y: idx * 80 + 60 }
    })
    return positions
  }, [graph])

  const positions = nodePositions()

  const filteredNodes = graph?.nodes.filter(n => filterType === 'all' || n.type === filterType) ?? []
  const filteredIds = new Set(filteredNodes.map(n => n.id))
  const filteredEdges = graph?.edges.filter(e => filteredIds.has(e.source) && filteredIds.has(e.target)) ?? []

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

  if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '14px', color: 'var(--text-tertiary)' }}>Loading lineage…</div>
  if (!graph || graph.nodes.length === 0) {
    return <EmptyState icon={<GitBranch style={{ width: '40px', height: '40px' }} />} title="No lineage yet" desc="Upload datasets and run pipelines to see your data lineage graph." />
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--bg-card)' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
        {/* Toolbar */}
        <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10, display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)', padding: '4px' }}>
            <button onClick={() => setZoom(z => Math.min(z + 0.2, 2))} style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>+</button>
            <button onClick={() => setZoom(1)} style={{ padding: '0 8px', fontSize: '12px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>{Math.round(zoom * 100)}%</button>
            <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.3))} style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>−</button>
          </div>
          <button onClick={() => { setPan({ x: 40, y: 40 }); setZoom(1) }} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)', padding: '4px 8px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>Fit</button>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ ...inputSmStyle, width: 'auto' }}>
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
            {filteredNodes.map(n => {
              const p = positions[n.id]
              if (!p) return null
              const isSelected = selectedNode?.id === n.id
              const scan = n.type === 'dataset' ? (n.meta.pii_risk as string) : null
              const piiColor = ({ critical: '#ef4444', high: '#f97316', medium: '#eab308' } as Record<string, string>)[scan ?? '']
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
        <div style={{ width: '256px', flexShrink: 0, borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{selectedNode.type.replace(/_/g, ' ')}</span>
            <button onClick={() => setSelectedNode(null)} style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
          <h3 style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedNode.label}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {Object.entries(selectedNode.meta).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => (
              <div key={k} style={{ fontSize: '12px' }}>
                <span style={{ color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}: </span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {typeof v === 'number' && k.includes('bytes') ? `${(v / 1024).toFixed(1)} KB`
                   : typeof v === 'number' && k.includes('accuracy') ? `${(v * 100).toFixed(1)}%`
                   : String(v)}
                </span>
              </div>
            ))}
          </div>
          {!!selectedNode.meta.pii_risk && (
            <SeverityBadge severity={selectedNode.meta.pii_risk as string} label={`PII: ${String(selectedNode.meta.pii_risk)}`} />
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
    <div style={{ padding: '20px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Policies ({policies.length})</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            {violations.length > 0 ? `${violations.length} active violation${violations.length !== 1 ? 's' : ''}` : 'All passing'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button size="sm" variant="ghost" onClick={() => evaluateMut.mutate()} disabled={evaluateMut.isPending}>
            {evaluateMut.isPending ? <RefreshCw style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : <><Zap style={{ width: '14px', height: '14px', marginRight: '6px' }} />Evaluate all</>}
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus style={{ width: '14px', height: '14px', marginRight: '6px' }} />New policy
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>New Policy</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Name *</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Type</label>
              <select style={inputStyle} value={form.policy_type} onChange={e => setForm(f => ({ ...f, policy_type: e.target.value as PolicyType }))}>
                {Object.entries(POLICY_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Severity</label>
              <select style={inputStyle} value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value as PolicySeverity }))}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Parameters (JSON)</label>
              <input style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} value={form.parameters} onChange={e => setForm(f => ({ ...f, parameters: e.target.value }))} placeholder='{"threshold": 0.8}' />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button size="sm" onClick={() => createMut.mutate()} disabled={!form.name.trim() || createMut.isPending}>
              {createMut.isPending ? 'Creating…' : 'Create'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
          {createMut.isError && <p style={{ fontSize: '12px', color: 'var(--bad)' }}>{(createMut.error as Error).message}</p>}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {policies.map(p => {
          const viols = violsByPolicy[p.id] ?? []
          const isExpanded = expanded.has(p.id)
          return (
            <div key={p.id} style={{ border: `1px solid ${viols.length > 0 ? 'rgba(249,115,22,.3)' : 'var(--border)'}`, borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
                {viols.length === 0
                  ? <CheckCircle style={{ width: '16px', height: '16px', color: 'var(--green)', flexShrink: 0 }} />
                  : <XCircle style={{ width: '16px', height: '16px', color: 'var(--bad)', flexShrink: 0 }} />
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px' }}>{p.name}</span>
                    <SeverityBadge severity={p.severity} />
                    {viols.length > 0 && (
                      <span style={{ fontSize: '12px', background: 'var(--bad-dim)', color: 'var(--bad)', border: '1px solid rgba(239,68,68,.22)', borderRadius: 'var(--radius-btn)', padding: '2px 6px' }}>
                        {viols.length} violation{viols.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{POLICY_TYPE_LABELS[p.policy_type]}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => toggleMut.mutate({ id: p.id, enabled: !p.enabled })}
                    style={{ width: '36px', height: '20px', borderRadius: 'var(--radius-pill)', transition: 'background 0.2s', position: 'relative', background: p.enabled ? 'var(--accent)' : 'var(--bg-3)', border: 'none', cursor: 'pointer' }}
                  >
                    <span style={{ position: 'absolute', top: '2px', width: '16px', height: '16px', background: '#fff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'transform 0.2s', transform: p.enabled ? 'translateX(18px)' : 'translateX(2px)' }} />
                  </button>
                  {viols.length > 0 && (
                    <button
                      onClick={() => setExpanded(s => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}
                    >
                      {isExpanded ? <ChevronDown style={{ width: '16px', height: '16px' }} /> : <ChevronRight style={{ width: '16px', height: '16px' }} />}
                    </button>
                  )}
                  <button
                    onClick={() => { if (window.confirm(`Delete "${p.name}"?`)) deleteMut.mutate(p.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', transition: 'color 0.15s' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--bad)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)')}
                  >
                    <Trash2 style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              </div>
              {isExpanded && viols.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-2)', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {viols.map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <SeverityDot severity={v.severity} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v.entity_name}</span>
                        <span style={{ color: 'var(--text-tertiary)', marginLeft: '4px' }}>· {v.message}</span>
                      </div>
                      <button
                        onClick={() => resolveMut.mutate(v.id)}
                        style={{ color: 'var(--green)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', transition: 'color 0.15s' }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.7')}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                      >
                        <Check style={{ width: '12px', height: '12px' }} />Resolve
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

  const stepLabels = ['Select dataset', 'Configure columns', 'Review & generate'] as const

  return (
    <div style={{ padding: '20px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Wizard */}
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
        {/* Step header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          {stepLabels.map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {i > 0 && <ChevronRight style={{ width: '12px', height: '12px', color: 'var(--text-tertiary)' }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: step === i + 1 ? 'var(--accent)' : step > i + 1 ? 'var(--text-secondary)' : 'var(--text-tertiary)', fontWeight: step === i + 1 ? 500 : 400 }}>
                <span style={{
                  width: '20px', height: '20px', borderRadius: '50%', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: step === i + 1 ? '1px solid var(--accent)' : step > i + 1 ? '1px solid rgba(52,211,153,.3)' : '1px solid var(--border)',
                  background: step === i + 1 ? 'var(--accent)' : step > i + 1 ? 'var(--green-dim)' : 'transparent',
                  color: step === i + 1 ? '#fff' : step > i + 1 ? 'var(--green)' : 'var(--text-tertiary)',
                }}>
                  {step > i + 1 ? <Check style={{ width: '12px', height: '12px' }} /> : i + 1}
                </span>
                {label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '20px' }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: '6px' }}>Select source dataset</label>
                <select style={inputStyle} value={sourceId} onChange={e => setSourceId(e.target.value)}>
                  <option value="">Choose a dataset…</option>
                  {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              {sourceId && !scan && (
                <div style={{ fontSize: '12px', color: 'var(--warn)', background: 'var(--warn-dim)', border: '1px solid rgba(234,179,8,.22)', borderRadius: 'var(--radius-btn)', padding: '12px' }}>
                  This dataset hasn't been scanned. PII suggestions won't be available, but you can still configure manually.
                </div>
              )}
              {sourceId && scan && (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)', padding: '12px' }}>
                  Last scan: <SeverityBadge severity={scan.overall_risk} /> · {scan.pii_column_count} PII columns detected
                </div>
              )}
              <Button onClick={initConfigs} disabled={!sourceId}>Configure columns →</Button>
            </div>
          )}

          {step === 2 && configs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{configs.length} columns · {configs.filter(c => c.method !== 'keep').length} will be transformed</p>
                <button style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => {
                  const piiMap = new Map(scan?.findings.map(f => [f.column, f]) ?? [])
                  setConfigs(prev => prev.map(c => {
                    const f = piiMap.get(c.column)
                    if (!f) return c
                    return { ...c, method: f.severity === 'critical' ? 'hash' : f.severity === 'high' ? 'mask' : 'generalize' }
                  }))
                }}>Auto-suggest from scan</button>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-inset)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-tertiary)' }}>Column</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-tertiary)' }}>PII Risk</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-tertiary)' }}>Method</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-tertiary)' }}>Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configs.map((c, i) => {
                      const finding = scan?.findings.find(f => f.column === c.column)
                      const preview = c.method === 'suppress' ? '—' : c.method === 'redact' ? '[REDACTED]' : c.method === 'mask' ? 'j***@e***.com' : c.method === 'hash' ? 'a3f9b2c1…' : c.method === 'generalize' ? '20–29' : c.method === 'pseudonymize' ? 'ID-00001' : 'original'
                      return (
                        <tr key={c.column} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-2)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--text-primary)' }}>{c.column}</td>
                          <td style={{ padding: '8px 12px' }}>
                            {finding ? <SeverityBadge severity={finding.severity} /> : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <select value={c.method} onChange={e => setConfigs(prev => prev.map((cc, j) => j === i ? { ...cc, method: e.target.value as AnonMethod } : cc))}
                              style={{ ...inputSmStyle, width: '100%' }}>
                              {(Object.keys(ANON_METHOD_LABELS) as AnonMethod[]).map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{preview}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Output dataset name</label>
                <input style={inputStyle} value={outputName} onChange={e => setOutputName(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>← Back</Button>
                <Button size="sm" onClick={() => setStep(3)} disabled={!outputName.trim()}>Review →</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Summary</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '12px', textAlign: 'center' }}>
                  <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius-btn)', padding: '12px' }}><div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{configs.length}</div><div style={{ color: 'var(--text-tertiary)' }}>Total columns</div></div>
                  <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius-btn)', padding: '12px' }}><div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent)' }}>{configs.filter(c => c.method !== 'keep').length}</div><div style={{ color: 'var(--text-tertiary)' }}>Transformed</div></div>
                  <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius-btn)', padding: '12px' }}><div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{configs.filter(c => c.method === 'suppress').length}</div><div style={{ color: 'var(--text-tertiary)' }}>Suppressed</div></div>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Output: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{outputName}</span></p>
              </div>

              {activeJob && (
                <div style={{
                  border: `1px solid ${activeJob.status === 'complete' ? 'rgba(52,211,153,.22)' : activeJob.status === 'failed' ? 'rgba(239,68,68,.22)' : 'var(--border-accent)'}`,
                  background: activeJob.status === 'complete' ? 'var(--green-dim)' : activeJob.status === 'failed' ? 'var(--bad-dim)' : 'var(--blue-tint)',
                  borderRadius: 'var(--radius-card)',
                  padding: '16px',
                  fontSize: '14px',
                  color: activeJob.status === 'complete' ? 'var(--green)' : activeJob.status === 'failed' ? 'var(--bad)' : 'var(--accent)',
                }}>
                  {activeJob.status === 'complete' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check style={{ width: '16px', height: '16px' }} />Anonymized dataset created · {activeJob.rows_processed.toLocaleString()} rows · {activeJob.columns_transformed} columns transformed</div>
                  ) : activeJob.status === 'failed' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><XCircle style={{ width: '16px', height: '16px' }} />{activeJob.error_message}</div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />Processing…</div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="ghost" size="sm" onClick={() => setStep(2)}>← Back</Button>
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
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Previous Jobs</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {jobs.map(j => (
              <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '12px 16px', fontSize: '14px' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  background: j.status === 'complete' ? 'var(--green)' : j.status === 'failed' ? 'var(--bad)' : 'var(--accent)',
                  animation: j.status !== 'complete' && j.status !== 'failed' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{j.output_name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{j.columns_transformed} columns · {j.rows_processed.toLocaleString()} rows · {new Date(j.created_at).toLocaleDateString()}</p>
                </div>
                {j.status === 'complete' && j.output_dataset_id && (
                  <a href="/datasets" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ExternalLink style={{ width: '12px', height: '12px' }} />View
                  </a>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '12px', padding: '16px', borderBottom: '1px solid var(--border)', flexShrink: 0, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text-tertiary)' }} />
          <input
            style={{ ...inputStyle, paddingLeft: '32px' }}
            placeholder="Search entity name…"
            value={search}
            onChange={e => { setSearch(e.target.value); setOffset(0) }}
          />
        </div>
        <select style={{ ...inputSmStyle, width: 'auto' }} value={category} onChange={e => { setCategory(e.target.value); setOffset(0) }}>
          <option value="">All categories</option>
          {['data', 'pipeline', 'ml', 'compliance', 'marketplace', 'settings'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <a href={api.compliance.auditExportUrl()} style={{ fontSize: '12px', color: 'var(--accent)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-btn)', padding: '6px 12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Download style={{ width: '14px', height: '14px' }} />Export CSV
        </a>
      </div>

      {data && (
        <div style={{ flexShrink: 0, padding: '8px 16px', fontSize: '12px', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)' }}>
          {data.total.toLocaleString()} total events
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {data?.events.map(e => {
          const isExp = expanded.has(e.id)
          return (
            <div key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <button
                style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                onMouseEnter={el => ((el.currentTarget as HTMLElement).style.background = 'var(--bg-2)')}
                onMouseLeave={el => ((el.currentTarget as HTMLElement).style.background = 'transparent')}
                onClick={() => setExpanded(s => { const n = new Set(s); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n })}
              >
                <div style={{ width: '6px', minHeight: '32px', borderRadius: 'var(--radius-pill)', flexShrink: 0, marginTop: '4px', background: CATEGORY_DOT_COLOR[e.category] ?? '#64748b' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px' }}>{e.event_type}</span>
                    {e.entity_name && <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>· {e.entity_name}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{e.category}</span>
                    {e.duration_ms && <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>· {e.duration_ms}ms</span>}
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>· {new Date(e.created_at).toLocaleString()}</span>
                  </div>
                </div>
                {isExp ? <ChevronDown style={{ width: '16px', height: '16px', color: 'var(--text-tertiary)', flexShrink: 0 }} /> : <ChevronRight style={{ width: '16px', height: '16px', color: 'var(--text-tertiary)', flexShrink: 0 }} />}
              </button>
              {isExp && Object.keys(e.metadata).length > 0 && (
                <div style={{ padding: '0 32px 12px' }}>
                  <pre style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)', padding: '12px', overflowX: 'auto', fontFamily: 'var(--font-mono)' }}>
                    {JSON.stringify(e.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )
        })}
        {data && data.total > offset + LIMIT && (
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <Button size="sm" variant="ghost" onClick={() => setOffset(o => o + LIMIT)}>Load {LIMIT} more</Button>
          </div>
        )}
        {data?.events.length === 0 && (
          <EmptyState icon={<Activity style={{ width: '40px', height: '40px' }} />} title="No events yet" desc="Actions across Datrix will appear here." />
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
  const [, setGenerating] = useState(false)
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
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left — generate */}
      <div style={{ width: '288px', flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Generate Report</h3>
        <div>
          <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: '8px' }}>Framework</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(Object.entries(FRAMEWORK_LABELS) as [ComplianceFramework, string][]).map(([v, l]) => (
              <label key={v} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-btn)',
                border: framework === v ? '1px solid var(--border-accent)' : '1px solid var(--border)',
                background: framework === v ? 'var(--blue-tint)' : 'transparent',
                color: framework === v ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontSize: '14px',
              }}>
                <input type="radio" name="fw" value={v} checked={framework === v} onChange={() => setFramework(v)} style={{ display: 'none' }} />
                <span>{l}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: '8px' }}>Sections</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {REPORT_SECTIONS.map(s => (
              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={sections.includes(s.id)} onChange={() => toggleSection(s.id)}
                  style={{ width: '14px', height: '14px', accentColor: 'var(--accent)' }} />
                {s.label}
              </label>
            ))}
          </div>
        </div>
        <Button className="w-full" onClick={() => { setGenerating(true); setGenerated(null); generateMut.mutate() }}
          disabled={generateMut.isPending || sections.length === 0}>
          {generateMut.isPending ? <><RefreshCw style={{ width: '16px', height: '16px', marginRight: '8px', animation: 'spin 1s linear infinite' }} />Generating…</> : <>Generate {FRAMEWORK_LABELS[framework].split(' ')[0]} report</>}
        </Button>
        {generated && (
          <div style={{ background: 'var(--green-dim)', border: '1px solid rgba(52,211,153,.22)', borderRadius: 'var(--radius-card)', padding: '12px', fontSize: '12px', color: 'var(--green)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}><Check style={{ width: '14px', height: '14px' }} />Report generated</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <a href={api.compliance.downloadReportUrl(generated.id, 'html')} style={{ color: 'var(--green)', textDecoration: 'underline' }}>HTML</a>
              <a href={api.compliance.downloadReportUrl(generated.id, 'json')} style={{ color: 'var(--green)', textDecoration: 'underline' }}>JSON</a>
            </div>
          </div>
        )}
      </div>

      {/* Right — history */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Report History</h3>
        {reports.length === 0 ? (
          <EmptyState icon={<FileText style={{ width: '40px', height: '40px' }} />} title="No reports yet" desc="Generate your first compliance report to get a snapshot of your data posture." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reports.map(r => (
              <div key={r.id} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px' }}>{FRAMEWORK_LABELS[r.framework]}</span>
                      {r.status === 'complete'
                        ? <span style={{ fontSize: '12px', color: 'var(--green)', background: 'var(--green-dim)', border: '1px solid rgba(52,211,153,.22)', borderRadius: 'var(--radius-btn)', padding: '2px 6px' }}>Complete</span>
                        : r.status === 'failed'
                        ? <span style={{ fontSize: '12px', color: 'var(--bad)', background: 'var(--bad-dim)', border: '1px solid rgba(239,68,68,.22)', borderRadius: 'var(--radius-btn)', padding: '2px 6px' }}>Failed</span>
                        : <span style={{ fontSize: '12px', color: 'var(--accent)', background: 'var(--blue-tint)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-btn)', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><RefreshCw style={{ width: '10px', height: '10px', animation: 'spin 1s linear infinite' }} />Pending</span>}
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                      {new Date(r.created_at).toLocaleString()} · Score {r.risk_score}/100 · {r.entity_count} datasets · {r.violation_count} violations
                    </p>
                  </div>
                  <button
                    onClick={() => { if (window.confirm('Delete this report?')) deleteMut.mutate(r.id) }}
                    style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', transition: 'color 0.15s' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--bad)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)')}
                  >
                    <Trash2 style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
                {r.status === 'complete' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a href={api.compliance.downloadReportUrl(r.id, 'html')} style={{ fontSize: '12px', color: 'var(--accent)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-btn)', padding: '4px 10px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Download style={{ width: '12px', height: '12px' }} />HTML
                    </a>
                    <a href={api.compliance.downloadReportUrl(r.id, 'json')} style={{ fontSize: '12px', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)', padding: '4px 10px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', transition: 'background 0.1s' }}>
                      <Download style={{ width: '12px', height: '12px' }} />JSON
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

  const navHealthDot = (id: SubView): React.CSSProperties => {
    if (!dashboard) return { background: 'var(--bg-3)' }
    const { stats } = dashboard
    if (id === 'scanner' && stats.unscanned_datasets > 0) return { background: 'var(--warn)' }
    if (id === 'policies' && stats.violations > 0) return { background: 'var(--bad)' }
    if (id === 'scanner' && stats.critical_pii_datasets > 0) return { background: 'var(--bad)' }
    return { background: 'var(--green)' }
  }

  const handleAnonymize = (dsId: string) => {
    setAnonDatasetId(dsId)
    setView('anonymize')
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sub-nav */}
      <div style={{ width: '176px', flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '12px 8px', gap: '2px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => {
          const isActive = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-btn)',
                fontSize: '14px',
                cursor: 'pointer',
                textAlign: 'left',
                position: 'relative',
                border: 'none',
                background: isActive ? 'var(--blue-tint)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: isActive ? 500 : 400,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)' } }}
              onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'transparent' } }}
            >
              {item.icon}
              <span>{item.label}</span>
              <span style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                ...navHealthDot(item.id),
              }} />
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
