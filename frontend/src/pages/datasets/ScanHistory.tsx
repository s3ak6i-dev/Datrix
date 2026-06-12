import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'
import type { QualityScan } from '@/types'

interface Props {
  datasetId: string
}

const DIM_COLORS: Record<string, string> = {
  overall: '#1A56DB',
  completeness: '#059669',
  consistency: '#D97706',
  accuracy: '#7C3AED',
  distribution: '#DB2777',
  label_quality: '#0891B2',
}

const DIM_LABELS: Record<string, string> = {
  overall: 'Overall',
  completeness: 'Completeness',
  consistency: 'Consistency',
  accuracy: 'Accuracy',
  distribution: 'Distribution',
  label_quality: 'Label quality',
}

function scanToChartPoint(s: QualityScan, i: number) {
  return {
    name: `Scan ${i + 1}`,
    date: s.completed_at ?? s.created_at,
    overall: s.score?.overall ?? null,
    completeness: s.score?.completeness ?? null,
    consistency: s.score?.consistency ?? null,
    accuracy: s.score?.accuracy ?? null,
    distribution: s.score?.distribution ?? null,
    label_quality: s.score?.label_quality ?? null,
    issues: s.issues.length,
    duration_ms: s.scan_duration_ms,
    status: s.status,
  }
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'complete') return <CheckCircle2 className="w-4 h-4 text-success" />
  if (status === 'failed') return <XCircle className="w-4 h-4 text-danger" />
  return <Clock className="w-4 h-4 text-text-tertiary" />
}

export function ScanHistory({ datasetId }: Props) {
  const { data: scans = [], isLoading } = useQuery({
    queryKey: ['scans', datasetId],
    queryFn: () => api.scans.list(datasetId),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
      </div>
    )
  }

  if (scans.length === 0) {
    return (
      <div className="text-center py-16 text-text-secondary text-sm">
        No scan history yet. Run another scan to start tracking quality over time.
      </div>
    )
  }

  const completed = scans.filter((s) => s.status === 'complete')
  const chartData = scans.map(scanToChartPoint)
  const hasMultiple = completed.length >= 2
  const latest = completed[completed.length - 1]
  const previous = completed[completed.length - 2]
  const delta = latest && previous && latest.score && previous.score
    ? latest.score.overall - previous.score.overall
    : null

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-surface-primary border border-border rounded-xl">
          <p className="text-xs text-text-tertiary uppercase tracking-wide mb-1">Total scans</p>
          <p className="text-2xl font-semibold font-mono text-text-primary">{scans.length}</p>
        </div>
        <div className="p-4 bg-surface-primary border border-border rounded-xl">
          <p className="text-xs text-text-tertiary uppercase tracking-wide mb-1">Latest score</p>
          <p className="text-2xl font-semibold font-mono text-text-primary">
            {latest?.score?.overall ?? '—'}
          </p>
        </div>
        <div className="p-4 bg-surface-primary border border-border rounded-xl">
          <p className="text-xs text-text-tertiary uppercase tracking-wide mb-1">Score change</p>
          <p className={`text-2xl font-semibold font-mono ${
            delta == null ? 'text-text-tertiary'
            : delta > 0 ? 'text-success'
            : delta < 0 ? 'text-danger'
            : 'text-text-primary'
          }`}>
            {delta == null ? '—' : delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
          </p>
        </div>
      </div>

      {/* Trend chart */}
      {hasMultiple ? (
        <div className="p-5 bg-surface-primary border border-border rounded-xl">
          <h3 className="text-sm font-medium text-text-primary mb-4">Quality score over time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  border: '1px solid #E5E7EB',
                  borderRadius: 8,
                  fontSize: 12,
                  background: '#fff',
                }}
                formatter={(value: number, name: string) => [
                  `${value?.toFixed(1)}`,
                  DIM_LABELS[name] ?? name,
                ]}
              />
              <ReferenceLine y={80} stroke="#059669" strokeDasharray="4 2" strokeOpacity={0.4} />
              <ReferenceLine y={60} stroke="#D97706" strokeDasharray="4 2" strokeOpacity={0.4} />
              {Object.keys(DIM_COLORS).map((dim) => (
                <Line
                  key={dim}
                  type="monotone"
                  dataKey={dim}
                  stroke={DIM_COLORS[dim]}
                  strokeWidth={dim === 'overall' ? 2.5 : 1.5}
                  dot={{ r: dim === 'overall' ? 4 : 2, fill: DIM_COLORS[dim] }}
                  connectNulls
                  strokeOpacity={dim === 'overall' ? 1 : 0.6}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-3">
            {Object.entries(DIM_COLORS).map(([dim, color]) => (
              <span key={dim} className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: color }} />
                {DIM_LABELS[dim]}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-surface-secondary border border-border rounded-xl text-sm text-text-secondary text-center">
          Run at least 2 scans to see the quality trend chart.
        </div>
      )}

      {/* Scan log */}
      <div className="bg-surface-primary border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-tertiary">
          <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide">Scan log</h3>
        </div>
        <div className="divide-y divide-border">
          {[...scans].reverse().map((scan, i) => (
            <div key={scan.id} className="flex items-center gap-4 px-4 py-3">
              <StatusIcon status={scan.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">
                  Scan #{scans.length - i}
                </p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {scan.completed_at
                    ? formatRelativeTime(scan.completed_at)
                    : formatRelativeTime(scan.created_at)}
                  {scan.scan_duration_ms != null && (
                    <> · {scan.scan_duration_ms < 1000
                      ? `${scan.scan_duration_ms}ms`
                      : `${(scan.scan_duration_ms / 1000).toFixed(1)}s`}</>
                  )}
                </p>
              </div>
              {scan.score && (
                <div className="text-right">
                  <p className="text-sm font-mono font-semibold text-text-primary">
                    {scan.score.overall}
                  </p>
                  <p className="text-xs text-text-tertiary">{scan.issues.length} issues</p>
                </div>
              )}
              {scan.status === 'failed' && (
                <span className="text-xs text-danger">Failed</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
