import { X, Upload, ScanLine, Wrench, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import type { Dataset, QualityScan } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  dataset: Dataset
  scans: QualityScan[]
}

export function DatasetChangesPanel({ open, onClose, dataset, scans }: Props) {
  const completed = [...scans].filter((s) => s.status === 'complete').reverse()

  const events = [
    // One event per completed scan
    ...completed.map((scan, i) => {
      const prev = completed[i + 1]
      const scoreDelta =
        scan.score && prev?.score
          ? +(scan.score.overall - prev.score.overall).toFixed(1)
          : null
      const resolved = scan.issues.filter((iss) => iss.status === 'resolved').length
      const open = scan.issues.filter((iss) => iss.status === 'open').length
      return { type: 'scan' as const, scan, scoreDelta, resolved, open, isLatest: i === 0 }
    }),
    // Upload event at the bottom
    { type: 'upload' as const, date: dataset.created_at },
  ]

  return (
    <>
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={onClose} />}

      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100%',
          width: 320,
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms ease-in-out',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>Dataset changes</h2>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180, fontFamily: 'var(--font-sans)' }}>{dataset.name}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 6,
              borderRadius: 'var(--radius-btn)',
              color: 'var(--text-tertiary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.color = 'var(--text-primary)'
              btn.style.background = 'var(--bg-inset)'
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.color = 'var(--text-tertiary)'
              btn.style.background = 'none'
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Timeline */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {events.length === 1 ? (
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', padding: '32px 0', fontFamily: 'var(--font-sans)' }}>
              Run a quality scan to start tracking changes.
            </p>
          ) : (
            <ol style={{ position: 'relative', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 24, marginLeft: 8, paddingLeft: 0, listStyle: 'none', margin: 0 }}>
              {events.map((event, i) => (
                <li key={i} style={{ marginLeft: 20 }}>
                  {event.type === 'scan' ? (
                    <ScanEvent
                      scan={event.scan}
                      scoreDelta={event.scoreDelta}
                      resolved={event.resolved}
                      openCount={event.open}
                      isLatest={event.isLatest}
                    />
                  ) : (
                    <UploadEvent date={event.date} />
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  )
}

function ScanEvent({
  scan,
  scoreDelta,
  resolved,
  openCount,
  isLatest,
}: {
  scan: QualityScan
  scoreDelta: number | null
  resolved: number
  openCount: number
  isLatest: boolean
}) {
  const deltaColor =
    scoreDelta == null ? 'var(--text-tertiary)'
    : scoreDelta > 0 ? 'var(--green)'
    : scoreDelta < 0 ? 'var(--bad)'
    : 'var(--text-tertiary)'

  return (
    <>
      <span style={{
        position: 'absolute',
        left: -8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: isLatest ? 'var(--accent)' : 'var(--bg-inset)',
        outline: '2px solid var(--bg-card)',
      }}>
        <ScanLine style={{ width: 10, height: 10, color: isLatest ? '#fff' : 'var(--text-tertiary)' }} />
      </span>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>Quality scan</p>
          {isLatest && (
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              color: 'var(--accent)',
              background: 'var(--blue-tint)',
              padding: '2px 6px',
              borderRadius: 9999,
              fontFamily: 'var(--font-sans)',
            }}>Latest</span>
          )}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, fontFamily: 'var(--font-sans)' }}>
          {formatRelativeTime(scan.completed_at ?? scan.created_at)}
          {scan.scan_duration_ms != null && (
            <> · {scan.scan_duration_ms < 1000
              ? `${scan.scan_duration_ms}ms`
              : `${(scan.scan_duration_ms / 1000).toFixed(1)}s`}</>
          )}
        </p>

        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
          {/* Score */}
          {scan.score && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Quality score</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{scan.score.overall}</span>
                {scoreDelta !== null && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontWeight: 500, color: deltaColor, fontFamily: 'var(--font-sans)' }}>
                    {scoreDelta > 0
                      ? <TrendingUp style={{ width: 12, height: 12 }} />
                      : scoreDelta < 0
                      ? <TrendingDown style={{ width: 12, height: 12 }} />
                      : <Minus style={{ width: 12, height: 12 }} />}
                    {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Issues */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Issues found</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{scan.issues.length}</span>
          </div>

          {resolved > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--green)', fontFamily: 'var(--font-sans)' }}>
                <Wrench style={{ width: 12, height: 12 }} />
                Fixed
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 500 }}>{resolved}</span>
            </div>
          )}

          {openCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Still open</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--warn)' }}>{openCount}</span>
            </div>
          )}

          {/* Dimension breakdown */}
          {scan.score && (
            <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                ['Completeness', scan.score.completeness],
                ['Consistency', scan.score.consistency],
                ['Accuracy', scan.score.accuracy],
                ['Distribution', scan.score.distribution],
                ['Label quality', scan.score.label_quality],
              ].map(([label, val]) => (
                <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--text-tertiary)', width: 96, flexShrink: 0, fontFamily: 'var(--font-sans)' }}>{label}</span>
                  <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div
                      style={{ height: '100%', borderRadius: 9999, background: 'var(--accent)', opacity: 0.6, width: `${val}%` }}
                    />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', width: 28, textAlign: 'right' }}>{val}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function UploadEvent({ date }: { date: string }) {
  return (
    <>
      <span style={{
        position: 'absolute',
        left: -8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: 'var(--bg-inset)',
        outline: '2px solid var(--bg-card)',
      }}>
        <Upload style={{ width: 10, height: 10, color: 'var(--text-tertiary)' }} />
      </span>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>Dataset uploaded</p>
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>{formatRelativeTime(date)}</p>
    </>
  )
}
