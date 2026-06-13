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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
        <Loader2 style={{ width: 20, height: 20, color: 'var(--text-tertiary)', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Column table */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 12 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search columns…"
            style={{
              width: '100%',
              background: 'var(--bg-inset)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-btn)',
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-inset)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 400 }}>
                  Column
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 400 }}>
                  Type
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 400 }}>
                  Nulls
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 400 }}>
                  Quality
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 400 }}>
                  Issues
                </th>
                <th style={{ width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((col) => {
                const isSelected = selected?.name === col.name
                return (
                  <tr
                    key={col.name}
                    onClick={() => setSelected(isSelected ? null : col)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'var(--blue-tint)' : 'var(--bg-card)',
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-inset)' }}
                    onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-card)' }}
                  >
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {col.name}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>{col.dtype}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {col.null_pct.toFixed(1)}%
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <QualityBadge score={col.quality_score} size="sm" />
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {col.issues.length > 0 ? (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {col.issues.slice(0, 2).map((issue) => (
                            <SeverityBadge key={issue.id} severity={issue.severity} />
                          ))}
                          {col.issues.length > 2 && (
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
                              +{col.issues.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <ChevronRight
                        style={{
                          width: 14,
                          height: 14,
                          color: 'var(--text-tertiary)',
                          transition: 'transform 0.15s',
                          transform: isSelected ? 'rotate(90deg)' : 'rotate(0deg)',
                        }}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Column detail panel */}
      {selected && (
        <div style={{
          width: 288,
          flexShrink: 0,
          padding: 16,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          alignSelf: 'flex-start',
          position: 'sticky',
          top: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{selected.name}</p>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>{selected.dtype}</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex', alignItems: 'center' }}
              onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)'}
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
            <QualityBadge score={selected.quality_score} size="lg" showLabel />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'var(--font-sans)' }}>
              <p>
                <span style={{ color: 'var(--text-tertiary)' }}>Nulls:</span>{' '}
                {selected.null_pct.toFixed(1)}%
              </p>
              {selected.unique_count != null && (
                <p>
                  <span style={{ color: 'var(--text-tertiary)' }}>Unique:</span>{' '}
                  {formatNumber(selected.unique_count)}
                </p>
              )}
            </div>
          </div>

          {/* Distribution */}
          {selected.distribution.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 400, marginBottom: 8 }}>
                Distribution
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selected.distribution.slice(0, 8).map((d) => (
                  <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 80, fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}>{d.label}</span>
                    <div style={{ flex: 1, height: 6, background: 'var(--bg-inset)', borderRadius: 9999, overflow: 'hidden' }}>
                      <div
                        style={{ height: '100%', background: 'var(--accent)', borderRadius: 9999, width: `${d.pct}%` }}
                      />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', width: 40, textAlign: 'right' }}>
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
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 400, marginBottom: 8 }}>
                Statistics
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(selected.stats).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>{k}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{String(v)}</span>
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
