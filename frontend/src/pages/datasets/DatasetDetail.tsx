import { useState } from 'react'
import { useParams, useNavigate, NavLink } from 'react-router-dom'
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
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-7 w-72" />
        <StatRowSkeleton />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <IssueCardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (!dataset) {
    return (
      <div className="p-6 text-center text-text-secondary">
        Dataset not found.{' '}
        <button onClick={() => navigate('/datasets')} className="text-brand underline">
          Go back
        </button>
      </div>
    )
  }

  const isProcessing = dataset.status === 'ingesting' || dataset.status === 'scanning'
  const openIssues = scan?.issues.filter((i) => i.status === 'open') ?? []
  const resolvedIssues = scan?.issues.filter((i) => i.status === 'resolved') ?? []
  const criticalCount = openIssues.filter((i) => i.severity === 'critical').length
  const warningCount = openIssues.filter((i) => i.severity === 'warning').length
  const totalGain = openIssues.reduce((s, i) => s + (i.fix_available ? i.impact_score : 0), 0)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'columns', label: 'Columns' },
    { key: 'issues', label: `Issues${scan ? ` (${openIssues.length})` : ''}` },
    { key: 'cleaning', label: 'Cleaning' },
    { key: 'history', label: 'History' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => navigate('/datasets')}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Datasets
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
        <span className="text-sm font-medium text-text-primary truncate max-w-xs">
          {dataset.name}
        </span>
      </div>

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{dataset.name}</h1>
          {dataset.status === 'error' && (
            <p className="flex items-center gap-1.5 text-sm text-danger mt-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Processing failed
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
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
      <div className="grid grid-cols-5 gap-4 p-5 bg-surface-primary border border-border rounded-xl mb-4">
        {scan?.score ? (
          <div className="flex flex-col items-center gap-1">
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
        <div className="flex items-center gap-3 p-4 mb-4 rounded-lg border border-brand/20 bg-brand-50">
          <Loader2 className="w-4 h-4 animate-spin text-brand" />
          <div>
            <p className="text-sm font-medium text-brand">
              {dataset.status === 'ingesting' ? 'Ingesting data…' : 'Running quality scan…'}
            </p>
            <p className="text-xs text-brand/70 mt-0.5">This may take a few minutes</p>
          </div>
        </div>
      )}

      {/* Scan running */}
      {scan?.status === 'running' && (
        <div className="flex items-center gap-3 p-4 mb-4 rounded-lg border border-brand/20 bg-brand-50">
          <Loader2 className="w-4 h-4 animate-spin text-brand" />
          <p className="text-sm font-medium text-brand">Quality scan in progress…</p>
        </div>
      )}

      {/* Tabs */}
      {dataset.status === 'ready' && (
        <>
          <div className="flex gap-1 border-b border-border mb-5">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === key
                    ? 'border-brand text-brand'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {tab === 'overview' && scan?.score && (
            <div className="grid grid-cols-2 gap-5">
              {/* Quality breakdown */}
              <div className="p-5 bg-surface-primary border border-border rounded-xl">
                <h3 className="text-sm font-medium text-text-primary mb-4">Quality breakdown</h3>
                <div className="space-y-2.5">
                  <ScoreBar label="Completeness" score={scan.score.completeness} />
                  <ScoreBar label="Consistency" score={scan.score.consistency} />
                  <ScoreBar label="Accuracy" score={scan.score.accuracy} />
                  <ScoreBar label="Distribution" score={scan.score.distribution} />
                  <ScoreBar label="Label quality" score={scan.score.label_quality} />
                </div>
                {totalGain > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-text-secondary">
                      Estimated gain from fixing all issues:{' '}
                      <span className="text-success font-medium">+{totalGain.toFixed(1)}% accuracy</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Top issues */}
              <div className="p-5 bg-surface-primary border border-border rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-text-primary">
                    Top issues
                    {criticalCount > 0 && (
                      <span className="ml-2 text-xs text-danger">
                        {criticalCount} critical
                      </span>
                    )}
                  </h3>
                  {openIssues.length > 3 && (
                    <button
                      onClick={() => setTab('issues')}
                      className="text-xs text-brand hover:underline"
                    >
                      View all
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {openIssues.slice(0, 4).map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      compact
                      onFix={(i) => { setFixingIssue(i); setTab('cleaning') }}
                    />
                  ))}
                  {openIssues.length === 0 && (
                    <div className="flex items-center gap-2 py-4 text-sm text-success">
                      <CheckCircle2 className="w-4 h-4" />
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
            <div className="grid grid-cols-2 gap-5">
              <div className="p-5 bg-surface-primary border border-border rounded-xl space-y-3">
                <Skeleton className="h-4 w-32" />
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
              </div>
              <div className="p-5 bg-surface-primary border border-border rounded-xl space-y-2">
                <Skeleton className="h-4 w-24" />
                {Array.from({ length: 4 }).map((_, i) => <IssueCardSkeleton key={i} />)}
              </div>
            </div>
          )}

          {tab === 'overview' && !scan && !scanLoading && (
            <div className="text-center py-12">
              <p className="text-text-secondary text-sm mb-3">No quality scan yet</p>
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
            <div className="space-y-4">
              {openIssues.length > 0 ? (
                <div className="space-y-2">
                  {openIssues.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      onFix={(i) => { setFixingIssue(i); setTab('cleaning') }}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 py-6 text-sm text-success justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                  {resolvedIssues.length > 0
                    ? 'All issues fixed — run a new scan to update the quality score'
                    : 'No issues detected — your dataset is in great shape!'
                  }
                </div>
              )}
              {resolvedIssues.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">
                    Resolved ({resolvedIssues.length})
                  </p>
                  <div className="space-y-2">
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
