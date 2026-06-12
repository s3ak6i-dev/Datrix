import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Loader2, X } from 'lucide-react'
import { api } from '@/lib/api'
import { QualityBadge } from '@/components/ui/QualityBadge'
import { SeverityBadge } from '@/components/ui/Badge'
import { formatNumber } from '@/lib/utils'
import type { ColumnProfile } from '@/types'

export function ColumnExplorer({ datasetId }: { datasetId: string }) {
  const [selected, setSelected] = useState<ColumnProfile | null>(null)
  const [search, setSearch] = useState('')

  const { data: columns = [], isLoading } = useQuery({
    queryKey: ['columns', datasetId],
    queryFn: () => api.columns.list(datasetId),
  })

  const filtered = columns.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
      </div>
    )
  }

  return (
    <div className="flex gap-4">
      {/* Column table */}
      <div className="flex-1 min-w-0">
        <div className="mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search columns…"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-tertiary border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">
                  Column
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">
                  Type
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase tracking-wide">
                  Nulls
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-text-secondary uppercase tracking-wide">
                  Quality
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">
                  Issues
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface-primary">
              {filtered.map((col) => (
                <tr
                  key={col.name}
                  onClick={() => setSelected(selected?.name === col.name ? null : col)}
                  className={`cursor-pointer transition-colors hover:bg-surface-tertiary ${
                    selected?.name === col.name ? 'bg-brand-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs font-medium text-text-primary">
                    {col.name}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-secondary">{col.dtype}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-text-secondary">
                    {col.null_pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <QualityBadge score={col.quality_score} size="sm" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {col.issues.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {col.issues.slice(0, 2).map((issue) => (
                          <SeverityBadge key={issue.id} severity={issue.severity} />
                        ))}
                        {col.issues.length > 2 && (
                          <span className="text-xs text-text-tertiary">
                            +{col.issues.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-text-tertiary">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight
                      className={`w-3.5 h-3.5 text-text-tertiary transition-transform ${
                        selected?.name === col.name ? 'rotate-90' : ''
                      }`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Column detail panel */}
      {selected && (
        <div className="w-72 flex-shrink-0 p-4 bg-surface-primary border border-border rounded-xl self-start sticky top-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-mono text-sm font-medium text-text-primary">{selected.name}</p>
              <p className="text-xs text-text-tertiary mt-0.5">{selected.dtype}</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
            <QualityBadge score={selected.quality_score} size="lg" showLabel />
            <div className="text-xs text-text-secondary space-y-1">
              <p>
                <span className="text-text-tertiary">Nulls:</span>{' '}
                {selected.null_pct.toFixed(1)}%
              </p>
              {selected.unique_count != null && (
                <p>
                  <span className="text-text-tertiary">Unique:</span>{' '}
                  {formatNumber(selected.unique_count)}
                </p>
              )}
            </div>
          </div>

          {/* Distribution */}
          {selected.distribution.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wide">
                Distribution
              </p>
              <div className="space-y-1.5">
                {selected.distribution.slice(0, 8).map((d) => (
                  <div key={d.label} className="flex items-center gap-2">
                    <span className="w-20 text-xs text-text-secondary truncate">{d.label}</span>
                    <div className="flex-1 h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand rounded-full"
                        style={{ width: `${d.pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-text-tertiary w-10 text-right">
                      {d.pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          {Object.keys(selected.stats).length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wide">
                Statistics
              </p>
              <div className="space-y-1">
                {Object.entries(selected.stats).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-text-tertiary">{k}</span>
                    <span className="font-mono text-text-primary">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
