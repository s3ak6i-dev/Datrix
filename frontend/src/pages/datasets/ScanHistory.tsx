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
  if (status === 'complete') return <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--green)' }} />
  if (status === 'failed') return <XCircle style={{ width: 16, height: 16, color: 'var(--bad)' }} />
  return <Clock style={{ width: 16, height: 16, color: 'var(--text-tertiary)' }} />
}

export function ScanHistory({ datasetId }: Props) {
  const { data: scans = [], isLoading } = useQuery({
    queryKey: ['scans', datasetId],
    queryFn: () => api.scans.list(datasetId),
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
        <Loader2 style={{ width: 20, height: 20, color: 'var(--text-tertiary)', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (scans.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
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

  const deltaColor =
    delta == null ? 'var(--text-tertiary)'
    : delta > 0 ? 'var(--green)'
    : delta < 0 ? 'var(--bad)'
    : 'var(--text-primary)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div style={{ padding: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 400, marginBottom: 4 }}>Total scans</p>
          <p style={{ fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{scans.length}</p>
        </div>
        <div style={{ padding: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 400, marginBottom: 4 }}>Latest score</p>
          <p style={{ fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            {latest?.score?.overall ?? '—'}
          </p>
        </div>
        <div style={{ padding: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 400, marginBottom: 4 }}>Score change</p>
          <p style={{ fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-mono)', color: deltaColor }}>
            {delta == null ? '—' : delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
          </p>
        </div>
      </div>

      {/* Trend chart */}
      {hasMultiple ? (
        <div style={{ padding: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 16, fontFamily: 'var(--font-sans)' }}>Quality score over time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                }}
                formatter={(value: unknown, name: unknown) => [
                  `${(value as number)?.toFixed(1)}`,
                  DIM_LABELS[name as string] ?? (name as string),
                ] as [string, string]}
              />
              <ReferenceLine y={80} stroke="var(--green)" strokeDasharray="4 2" strokeOpacity={0.4} />
              <ReferenceLine y={60} stroke="var(--warn)" strokeDasharray="4 2" strokeOpacity={0.4} />
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
            {Object.entries(DIM_COLORS).map(([dim, color]) => (
              <span key={dim} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                <span style={{ width: 12, height: 2, borderRadius: 9999, display: 'inline-block', background: color }} />
                {DIM_LABELS[dim]}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding: 16, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
          Run at least 2 scans to see the quality trend chart.
        </div>
      )}

      {/* Scan log */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-inset)' }}>
          <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 400 }}>Scan log</h3>
        </div>
        <div>
          {[...scans].reverse().map((scan, i) => (
            <div key={scan.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <StatusIcon status={scan.status} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
                  Scan #{scans.length - i}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
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
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {scan.score.overall}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>{scan.issues.length} issues</p>
                </div>
              )}
              {scan.status === 'failed' && (
                <span style={{ fontSize: 11, color: 'var(--bad)', fontFamily: 'var(--font-sans)' }}>Failed</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
