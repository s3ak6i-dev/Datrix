import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, RefreshCw, Loader2, AlertCircle, CheckCircle2,
  ChevronRight, Zap, History,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatBytes, formatNumber, formatRelativeTime } from '@/lib/utils'
import { QualityBadge } from '@/components/ui/QualityBadge'
import { ScoreBar } from '@/components/ui/ScoreBar'
import { StatCell } from '@/components/ui/StatCell'
import { IssueCard } from '@/components/ui/IssueCard'
import { Button } from '@/components/ui/Button'
import { ColumnExplorer } from './ColumnExplorer'
import { CleaningWizard } from './CleaningWizard'
import { ScanHistory } from './ScanHistory'
import { DatasetChangesPanel } from './DatasetChangesPanel'
import { StatRowSkeleton, IssueCardSkeleton, Skeleton } from '@/components/ui/Skeleton'
import type { QualityIssue } from '@/types'

type Tab = 'overview' | 'columns' | 'issues' | 'cleaning' | 'history'

export function DatasetDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')
  const [fixingIssue, setFixingIssue] = useState<QualityIssue | null>(null)
  const [changesOpen, setChangesOpen] = useState(false)

  const { data: dataset, isLoading: dsLoading } = useQuery({
    queryKey: ['dataset', id],
    queryFn: () => api.datasets.get(id!),
    enabled: !!id,
    refetchInterval: (q) => {
      const d = q.state.data
      if (!d) return false
      return d.status === 'ingesting' || d.status === 'scanning' ? 2000 : false
    },
  })

  const { data: allScans = [] } = useQuery({
    queryKey: ['scans', id],
    queryFn: () => api.scans.list(id!),
    enabled: !!id && dataset?.status === 'ready',
  })

  const { data: scan, isLoading: scanLoading } = useQuery({
    queryKey: ['scan', id, 'latest'],
    queryFn: () => api.scans.latest(id!),
    enabled: !!id && dataset?.status === 'ready',
    refetchInterval: (q) => {
      const d = q.state.data
      return d?.status === 'running' || d?.status === 'queued' ? 2000 : false
    },
  })

  const scanMutation = useMutation({
    mutationFn: () => api.scans.trigger(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scan', id, 'latest'] })
      qc.invalidateQueries({ queryKey: ['scans', id] })
      qc.invalidateQueries({ queryKey: ['dataset', id] })
    },
  })

  if (dsLoading) {
    return (
      <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-7 w-72" />
        <StatRowSkeleton />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Array.from({ length: 3 }).map((_, i) => <IssueCardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (!dataset) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Dataset not found.{' '}
        <button
          onClick={() => navigate('/datasets')}
          style={{ color: 'var(--accent)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)' }}
        >
          Go back
        </button>
      </div>
    )
  }

  const isProcessing = dataset.status === 'ingesting' || dataset.status === 'scanning'
  const openIssues = scan?.issues.filter((i) => i.status === 'open') ?? []
  const resolvedIssues = scan?.issues.filter((i) => i.status === 'resolved') ?? []
  const criticalCount = openIssues.filter((i) => i.severity === 'critical').length
  void openIssues.filter((i) => i.severity === 'warning').length
  const totalGain = openIssues.reduce((s, i) => s + (i.fix_available ? i.impact_score : 0), 0)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'columns', label: 'Columns' },
    { key: 'issues', label: `Issues${scan ? ` (${openIssues.length})` : ''}` },
    { key: 'cleaning', label: 'Cleaning' },
    { key: 'history', label: 'History' },
  ]

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => navigate('/datasets')}
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
          Datasets
        </button>
        <ChevronRight style={{ width: '14px', height: '14px', color: 'var(--text-tertiary)' }} />
        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>
          {dataset.name}
        </span>
      </div>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: '0 0 4px' }}>
            {dataset.name}
          </h1>
          {dataset.status === 'error' && (
            <p style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--bad)', margin: 0 }}>
              <AlertCircle style={{ width: '14px', height: '14px' }} />
              Processing failed
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {dataset.status === 'ready' && allScans.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setChangesOpen(true)}
            >
              <History className="w-3.5 h-3.5" />
              Changes
            </Button>
          )}
          {dataset.status === 'ready' && (
            <Button
              variant="secondary"
              size="sm"
              loading={scanMutation.isPending}
              onClick={() => scanMutation.mutate()}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Scan now
            </Button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '16px',
        padding: '20px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        marginBottom: '16px',
      }}>
        {scan?.score ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <QualityBadge score={scan.score.overall} size="lg" showLabel />
          </div>
        ) : (
          <StatCell value="—" label="Quality" />
        )}
        <StatCell value={dataset.row_count != null ? formatNumber(dataset.row_count) : '—'} label="Rows" />
        <StatCell value={dataset.column_count ?? '—'} label="Columns" />
        <StatCell value={dataset.size_bytes != null ? formatBytes(dataset.size_bytes) : '—'} label="Size" />
        <StatCell
          value={dataset.latest_scan_id ? formatRelativeTime(dataset.updated_at) : '—'}
          label="Last scan"
        />
      </div>

      {/* Processing state */}
      {isProcessing && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px',
          marginBottom: '16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-accent)',
          background: 'var(--blue-tint)',
        }}>
          <Loader2 style={{ width: '16px', height: '16px', color: 'var(--accent)', flexShrink: 0 }} className="animate-spin" />
          <div>
            <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--accent)', margin: '0 0 2px' }}>
              {dataset.status === 'ingesting' ? 'Ingesting data…' : 'Running quality scan…'}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--accent)', opacity: 0.7, margin: 0 }}>This may take a few minutes</p>
          </div>
        </div>
      )}

      {/* Scan running */}
      {scan?.status === 'running' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px',
          marginBottom: '16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-accent)',
          background: 'var(--blue-tint)',
        }}>
          <Loader2 style={{ width: '16px', height: '16px', color: 'var(--accent)' }} className="animate-spin" />
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--accent)', margin: 0 }}>Quality scan in progress…</p>
        </div>
      )}

      {/* Tabs */}
      {dataset.status === 'ready' && (
        <>
          <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  background: 'none',
                  border: 'none',
                  borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: '-1px',
                  color: tab === key ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (tab !== key) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
                }}
                onMouseLeave={(e) => {
                  if (tab !== key) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {tab === 'overview' && scan?.score && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Quality breakdown */}
              <div style={{
                padding: '20px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-card)',
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 16px' }}>
                  Quality breakdown
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <ScoreBar label="Completeness" score={scan.score.completeness} />
                  <ScoreBar label="Consistency" score={scan.score.consistency} />
                  <ScoreBar label="Accuracy" score={scan.score.accuracy} />
                  <ScoreBar label="Distribution" score={scan.score.distribution} />
                  <ScoreBar label="Label quality" score={scan.score.label_quality} />
                </div>
                {totalGain > 0 && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                      Estimated gain from fixing all issues:{' '}
                      <span style={{ color: 'var(--green)', fontWeight: 500 }}>+{totalGain.toFixed(1)}% accuracy</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Top issues */}
              <div style={{
                padding: '20px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-card)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                    Top issues
                    {criticalCount > 0 && (
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--bad)' }}>
                        {criticalCount} critical
                      </span>
                    )}
                  </h3>
                  {openIssues.length > 3 && (
                    <button
                      onClick={() => setTab('issues')}
                      style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)', textDecoration: 'underline' }}
                    >
                      View all
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {openIssues.slice(0, 4).map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      compact
                      onFix={(i) => { setFixingIssue(i); setTab('cleaning') }}
                    />
                  ))}
                  {openIssues.length === 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 0', fontSize: '14px', color: 'var(--green)' }}>
                      <CheckCircle2 style={{ width: '16px', height: '16px' }} />
                      {resolvedIssues.length > 0
                        ? `All ${resolvedIssues.length} issues fixed — re-scan for an updated score`
                        : 'No significant issues found'
                      }
                    </div>
                  )}
                </div>
                {openIssues.some((i) => i.fix_available) && (
                  <Button
                    className="mt-4 w-full"
                    size="sm"
                    onClick={() => setTab('cleaning')}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Fix all auto-fixable ({openIssues.filter((i) => i.fix_available).length} issues)
                  </Button>
                )}
              </div>
            </div>
          )}

          {tab === 'overview' && !scan && scanLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Skeleton className="h-4 w-32" />
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
              </div>
              <div style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Skeleton className="h-4 w-24" />
                {Array.from({ length: 4 }).map((_, i) => <IssueCardSkeleton key={i} />)}
              </div>
            </div>
          )}

          {tab === 'overview' && !scan && !scanLoading && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px' }}>No quality scan yet</p>
              <Button
                onClick={() => scanMutation.mutate()}
                loading={scanMutation.isPending}
              >
                Run quality scan
              </Button>
            </div>
          )}

          {tab === 'columns' && <ColumnExplorer datasetId={id!} />}
          {tab === 'issues' && scan && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {openIssues.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {openIssues.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      onFix={(i) => { setFixingIssue(i); setTab('cleaning') }}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '24px 0', fontSize: '14px', color: 'var(--green)', justifyContent: 'center' }}>
                  <CheckCircle2 style={{ width: '20px', height: '20px' }} />
                  {resolvedIssues.length > 0
                    ? 'All issues fixed — run a new scan to update the quality score'
                    : 'No issues detected — your dataset is in great shape!'
                  }
                </div>
              )}
              {resolvedIssues.length > 0 && (
                <div>
                  <p style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--text-tertiary)',
                    fontWeight: 400,
                    marginBottom: '8px',
                  }}>
                    Resolved ({resolvedIssues.length})
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {resolvedIssues.map((issue) => (
                      <IssueCard key={issue.id} issue={issue} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === 'cleaning' && scan && (
            <CleaningWizard
              datasetId={id!}
              issues={scan.issues.filter((i) => i.status === 'open')}
              initialIssue={fixingIssue}
              onComplete={() => {
                scanMutation.mutate()
                setTab('overview')
                setFixingIssue(null)
              }}
            />
          )}
          {tab === 'history' && <ScanHistory datasetId={id!} />}
        </>
      )}

      <DatasetChangesPanel
        open={changesOpen}
        onClose={() => setChangesOpen(false)}
        dataset={dataset}
        scans={allScans}
      />
    </div>
  )
}
