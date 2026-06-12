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
      {open && <div className="fixed inset-0 z-30" onClick={onClose} />}

      <div
        className={`fixed top-0 right-0 h-full w-80 bg-surface-primary border-l border-border shadow-xl z-40 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Dataset changes</h2>
            <p className="text-xs text-text-tertiary mt-0.5 truncate max-w-[180px]">{dataset.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {events.length === 1 ? (
            <p className="text-xs text-text-tertiary text-center py-8">
              Run a quality scan to start tracking changes.
            </p>
          ) : (
            <ol className="relative border-l border-border space-y-6 ml-2">
              {events.map((event, i) => (
                <li key={i} className="ml-5">
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
  return (
    <>
      <span className={`absolute -left-2 flex items-center justify-center w-4 h-4 rounded-full ring-2 ring-surface-primary ${
        isLatest ? 'bg-brand' : 'bg-surface-tertiary'
      }`}>
        <ScanLine className={`w-2.5 h-2.5 ${isLatest ? 'text-white' : 'text-text-tertiary'}`} />
      </span>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-semibold text-text-primary">Quality scan</p>
          {isLatest && (
            <span className="text-[10px] font-medium text-brand bg-brand-50 px-1.5 py-0.5 rounded-full">Latest</span>
          )}
        </div>
        <p className="text-xs text-text-tertiary mb-2">
          {formatRelativeTime(scan.completed_at ?? scan.created_at)}
          {scan.scan_duration_ms != null && (
            <> · {scan.scan_duration_ms < 1000
              ? `${scan.scan_duration_ms}ms`
              : `${(scan.scan_duration_ms / 1000).toFixed(1)}s`}</>
          )}
        </p>

        <div className="bg-surface-secondary border border-border rounded-lg p-3 space-y-2 text-xs">
          {/* Score */}
          {scan.score && (
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Quality score</span>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold font-mono text-text-primary">{scan.score.overall}</span>
                {scoreDelta !== null && (
                  <span className={`flex items-center gap-0.5 font-medium ${
                    scoreDelta > 0 ? 'text-success' : scoreDelta < 0 ? 'text-danger' : 'text-text-tertiary'
                  }`}>
                    {scoreDelta > 0
                      ? <TrendingUp className="w-3 h-3" />
                      : scoreDelta < 0
                      ? <TrendingDown className="w-3 h-3" />
                      : <Minus className="w-3 h-3" />}
                    {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Issues */}
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Issues found</span>
            <span className="font-mono text-text-primary">{scan.issues.length}</span>
          </div>

          {resolved > 0 && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-success">
                <Wrench className="w-3 h-3" />
                Fixed
              </span>
              <span className="font-mono text-success font-medium">{resolved}</span>
            </div>
          )}

          {openCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Still open</span>
              <span className="font-mono text-warning">{openCount}</span>
            </div>
          )}

          {/* Dimension breakdown */}
          {scan.score && (
            <div className="pt-2 border-t border-border space-y-1.5">
              {[
                ['Completeness', scan.score.completeness],
                ['Consistency', scan.score.consistency],
                ['Accuracy', scan.score.accuracy],
                ['Distribution', scan.score.distribution],
                ['Label quality', scan.score.label_quality],
              ].map(([label, val]) => (
                <div key={label as string} className="flex items-center gap-2">
                  <span className="text-text-tertiary w-24 shrink-0">{label}</span>
                  <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand/60"
                      style={{ width: `${val}%` }}
                    />
                  </div>
                  <span className="font-mono text-text-secondary w-7 text-right">{val}</span>
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
      <span className="absolute -left-2 flex items-center justify-center w-4 h-4 rounded-full bg-surface-tertiary ring-2 ring-surface-primary">
        <Upload className="w-2.5 h-2.5 text-text-tertiary" />
      </span>
      <p className="text-xs font-semibold text-text-primary">Dataset uploaded</p>
      <p className="text-xs text-text-tertiary mt-0.5">{formatRelativeTime(date)}</p>
    </>
  )
}
