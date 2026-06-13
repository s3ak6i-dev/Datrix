import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Star, Download, Eye, Package, Database, GitBranch, Brain, BarChart3, X, Plus, ChevronRight, Check, ExternalLink, Upload, Trash2, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import type {
  MarketplaceAsset, MarketplaceAssetType, MarketplaceCategory,
  MarketplaceLicense, MarketplaceSort, Dataset, Pipeline,
} from '@/types'

// ── Constants ─────────────────────────────────────────────────────────

const ASSET_TYPE_LABELS: Record<MarketplaceAssetType, string> = {
  dataset: 'Dataset',
  pipeline: 'Pipeline',
  model: 'ML Model',
  benchmark_config: 'Benchmark',
}

const ASSET_TYPE_ICONS: Record<MarketplaceAssetType, React.ReactNode> = {
  dataset: <Database style={{ width: 16, height: 16 }} />,
  pipeline: <GitBranch style={{ width: 16, height: 16 }} />,
  model: <Brain style={{ width: 16, height: 16 }} />,
  benchmark_config: <BarChart3 style={{ width: 16, height: 16 }} />,
}

const CATEGORY_LABELS: Record<MarketplaceCategory, string> = {
  ecommerce: 'E-Commerce', finance: 'Finance', healthcare: 'Healthcare',
  marketing: 'Marketing', logistics: 'Logistics', hr: 'HR',
  nlp: 'NLP', timeseries: 'Time Series', general: 'General',
}

const LICENSE_LABELS: Record<MarketplaceLicense, string> = {
  mit: 'MIT', cc_by: 'CC BY', cc_by_nc: 'CC BY-NC',
  apache2: 'Apache 2.0', proprietary: 'Proprietary',
}

const SORT_OPTIONS: { value: MarketplaceSort; label: string }[] = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'trending', label: 'Trending' },
]

const VALID_CATEGORIES: MarketplaceCategory[] = [
  'ecommerce', 'finance', 'healthcare', 'marketing', 'logistics', 'hr', 'nlp', 'timeseries', 'general',
]

const VALID_LICENSES: MarketplaceLicense[] = ['mit', 'cc_by', 'cc_by_nc', 'apache2', 'proprietary']

// ── Helpers ───────────────────────────────────────────────────────────

function fmtCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 12 : 16
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          style={{
            width: sz, height: sz,
            color: i <= Math.round(rating) ? '#facc15' : 'var(--border)',
            fill: i <= Math.round(rating) ? '#facc15' : 'none',
          }}
        />
      ))}
    </span>
  )
}

const TYPE_BADGE_COLORS: Record<MarketplaceAssetType, { bg: string; color: string }> = {
  dataset:          { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
  pipeline:         { bg: 'rgba(168,85,247,0.12)',  color: '#c084fc' },
  model:            { bg: 'rgba(34,197,94,0.12)',   color: 'var(--green)' },
  benchmark_config: { bg: 'rgba(249,115,22,0.12)',  color: 'var(--warn)' },
}

function TypeBadge({ type }: { type: MarketplaceAssetType }) {
  const { bg, color } = TYPE_BADGE_COLORS[type]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 'var(--radius-btn)',
      background: bg, color, fontSize: 12, fontWeight: 500,
      fontFamily: 'var(--font-sans)',
    }}>
      {ASSET_TYPE_ICONS[type]}
      {ASSET_TYPE_LABELS[type]}
    </span>
  )
}

// ── Asset Card ────────────────────────────────────────────────────────

function AssetCard({ asset, onClick }: { asset: MarketplaceAsset; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', textAlign: 'left',
        background: hovered ? 'var(--bg-3)' : 'var(--bg-card)',
        border: `1px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-card)',
        padding: '14px 16px', cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
        display: 'flex', flexDirection: 'column', gap: 6,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <TypeBadge type={asset.asset_type} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <h3 style={{
          fontWeight: 600, color: hovered ? 'var(--accent)' : 'var(--text-primary)',
          fontSize: 13, lineHeight: 1.4, margin: 0, flex: 1,
          transition: 'color 0.15s',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {asset.title}
        </h3>
        {asset.is_seeded && (
          <Check style={{ width: 12, height: 12, color: 'var(--green)', flexShrink: 0, marginBottom: 1 }} />
        )}
      </div>
      <p style={{
        fontSize: 12, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5,
        display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{asset.description}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
        <Download style={{ width: 11, height: 11 }} />
        <span>{fmtCount(asset.download_count)}</span>
      </div>
    </button>
  )
}

// ── Asset Detail Drawer ───────────────────────────────────────────────

function ReviewForm({ assetId, onDone }: { assetId: string; onDone: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const mut = useMutation({
    mutationFn: () => api.marketplace.submitReview(assetId, { author_name: name, rating, comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mp-reviews', assetId] })
      qc.invalidateQueries({ queryKey: ['mp-asset', assetId] })
      onDone()
    },
  })

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-inset)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-btn)', padding: '8px 12px', color: 'var(--text-primary)',
    fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 12,
      border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
      padding: 16, background: 'var(--bg-card)',
    }}>
      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Write a Review</p>
      <input
        style={inputStyle}
        placeholder="Your name"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 4 }}>
        {[1,2,3,4,5].map(i => (
          <button key={i} onClick={() => setRating(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Star style={{
              width: 20, height: 20,
              color: i <= rating ? '#facc15' : 'var(--border)',
              fill: i <= rating ? '#facc15' : 'none',
            }} />
          </button>
        ))}
      </div>
      <textarea
        style={{ ...inputStyle, resize: 'none' }}
        placeholder="Share your experience (optional)"
        rows={3}
        value={comment}
        onChange={e => setComment(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="sm" onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending}>
          {mut.isPending ? 'Submitting…' : 'Submit'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
      {mut.isError && <p style={{ fontSize: 12, color: 'var(--bad)' }}>{(mut.error as Error).message}</p>}
    </div>
  )
}

function AssetDetailDrawer({ asset: initial, onClose }: { asset: MarketplaceAsset; onClose: () => void }) {
  const qc = useQueryClient()
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [installed, setInstalled] = useState<string | null>(null)

  const { data: asset } = useQuery({
    queryKey: ['mp-asset', initial.id],
    queryFn: () => api.marketplace.get(initial.id),
    initialData: initial,
  })
  const { data: reviews = [] } = useQuery({
    queryKey: ['mp-reviews', initial.id],
    queryFn: () => api.marketplace.listReviews(initial.id),
  })

  const installMut = useMutation({
    mutationFn: () => api.marketplace.install(initial.id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['mp-installs'] })
      qc.invalidateQueries({ queryKey: ['mp-asset', initial.id] })
      qc.invalidateQueries({ queryKey: ['datasets'] })
      qc.invalidateQueries({ queryKey: ['pipelines'] })
      setInstalled(res.message)
    },
  })

  if (!asset) return null

  const preview = asset.preview as Record<string, unknown>

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
      <button style={{ flex: 1, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer' }} onClick={onClose} />
      <div style={{
        width: 520, background: 'var(--bg)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: 20, borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <TypeBadge type={asset.asset_type} />
              {asset.is_seeded && (
                <span style={{
                  fontSize: 11, color: 'var(--text-tertiary)',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-btn)', padding: '2px 6px',
                }}>Official</span>
              )}
            </div>
            <h2 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 18, lineHeight: 1.3 }}>{asset.title}</h2>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>by {asset.author_name} · v{asset.version} · {LICENSE_LABELS[asset.license]}</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, marginLeft: 12 }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'var(--border)', margin: 20, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {[
              { label: 'Downloads', val: fmtCount(asset.download_count) },
              { label: 'Views', val: fmtCount(asset.view_count) },
              { label: 'Rating', val: asset.rating_count > 0 ? asset.rating_avg.toFixed(1) : '—' },
              { label: 'Reviews', val: String(asset.rating_count) },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-card)', padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{s.val}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Install button */}
            {installed ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--green-dim)', color: 'var(--green)',
                fontSize: 14, padding: 12, borderRadius: 'var(--radius-md)',
                border: '1px solid var(--green)',
              }}>
                <Check style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span>{installed}</span>
              </div>
            ) : (
              <Button
                onClick={() => installMut.mutate()}
                disabled={installMut.isPending}
                className="w-full"
              >
                {installMut.isPending ? (
                  <><RefreshCw style={{ width: 16, height: 16, marginRight: 8 }} className="animate-spin" />Installing…</>
                ) : (
                  <><Download style={{ width: 16, height: 16, marginRight: 8 }} />Install to Workspace</>
                )}
              </Button>
            )}
            {installMut.isError && (
              <p style={{ fontSize: 12, color: 'var(--bad)' }}>{(installMut.error as Error).message}</p>
            )}

            {/* Description */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>About</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {asset.long_description || asset.description}
              </p>
            </div>

            {/* Preview */}
            {asset.asset_type === 'dataset' && !!preview.schema && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Preview</h3>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  {(preview.row_count as number)?.toLocaleString()} rows · {(preview.column_count as number)} columns
                </div>
                <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
                        {(preview.schema as {name:string;dtype:string}[]).slice(0, 6).map(col => (
                          <th key={col.name} style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {col.name}
                            <span style={{ marginLeft: 4, color: 'var(--text-tertiary)', opacity: 0.6 }}>{col.dtype}</span>
                          </th>
                        ))}
                        {(preview.schema as unknown[]).length > 6 && (
                          <th style={{ padding: '6px 8px', color: 'var(--text-tertiary)' }}>+{(preview.schema as unknown[]).length - 6} more</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(preview.sample_rows as Record<string, unknown>[] | undefined)?.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--bg)' : 'var(--bg-card)' }}>
                          {(preview.schema as {name:string}[]).slice(0, 6).map(col => (
                            <td key={col.name} style={{ padding: '6px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {row[col.name] === null || row[col.name] === undefined ? <span style={{ color: 'var(--text-tertiary)' }}>null</span> : String(row[col.name])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {asset.asset_type === 'pipeline' && !!preview.steps && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Pipeline Steps</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(preview.steps as {type: string}[]).map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: 'var(--blue-tint)', color: 'var(--accent)',
                        fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>{i+1}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{s.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {asset.asset_type === 'model' && !!preview.model_type && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Model Info</h3>
                <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 14 }}>
                  {[
                    ['Model type', String(preview.model_type)],
                    ['Task', String(preview.task_type)],
                    ['Rounds', String(preview.rounds_completed)],
                    ['Labeled rows', String(preview.labeled_count)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{k}</dt>
                      <dd style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{v}</dd>
                    </div>
                  ))}
                </dl>
                {!!preview.metrics && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {Object.entries(preview.metrics as Record<string, number>).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{(v * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {asset.asset_type === 'benchmark_config' && !!preview.candidates && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Benchmark Config</h3>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>{String(preview.eval_protocol)} · {String(preview.task_type)}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(preview.candidates as {label:string;model_type:string;preset:string}[]).map((c, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-btn)', padding: '6px 8px',
                    }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500, flex: 1 }}>{c.label || c.model_type}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>{c.preset}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {asset.tags.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Tags</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {asset.tags.map(t => (
                    <span key={t} style={{
                      fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-pill)', padding: '4px 10px', color: 'var(--text-secondary)',
                    }}>{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Reviews {reviews.length > 0 && `(${reviews.length})`}
                </h3>
                {!showReviewForm && (
                  <button
                    onClick={() => setShowReviewForm(true)}
                    style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    + Write review
                  </button>
                )}
              </div>
              {showReviewForm && (
                <ReviewForm assetId={initial.id} onDone={() => setShowReviewForm(false)} />
              )}
              {reviews.length === 0 && !showReviewForm ? (
                <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No reviews yet. Be the first!</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {reviews.map(r => (
                    <div key={r.id} style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)', padding: 12,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{r.author_name}</span>
                        <Stars rating={r.rating} />
                      </div>
                      {r.comment && <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{r.comment}</p>}
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Publish Wizard ────────────────────────────────────────────────────

function PublishWizard({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [step, setStep] = useState(1)
  const [assetType, setAssetType] = useState<MarketplaceAssetType>('dataset')
  const [sourceId, setSourceId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [longDesc, setLongDesc] = useState('')
  const [category, setCategory] = useState<MarketplaceCategory>('general')
  const [license, setLicense] = useState<MarketplaceLicense>('mit')
  const [version, setVersion] = useState('1.0.0')
  const [tags, setTags] = useState('')
  const [authorName, setAuthorName] = useState('You')
  const [done, setDone] = useState(false)

  const { data: datasets = [] } = useQuery<Dataset[]>({ queryKey: ['datasets'], queryFn: api.datasets.list })
  const { data: pipelines = [] } = useQuery<Pipeline[]>({ queryKey: ['pipelines'], queryFn: api.pipelines.list })
  const { data: alSessions = [] } = useQuery({ queryKey: ['al-sessions'], queryFn: api.al.listSessions })
  const { data: benchmarkJobs = [] } = useQuery({ queryKey: ['benchmark-jobs'], queryFn: api.benchmark.listJobs })

  const sources = assetType === 'dataset' ? datasets
    : assetType === 'pipeline' ? pipelines
    : assetType === 'model' ? alSessions.filter(s => s.status === 'complete')
    : benchmarkJobs.filter(j => j.status === 'complete')

  const publishMut = useMutation({
    mutationFn: () => api.marketplace.publish({
      source_id: sourceId,
      asset_type: assetType,
      title, description,
      long_description: longDesc,
      category, license, version,
      author_name: authorName,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mp-list'] })
      qc.invalidateQueries({ queryKey: ['mp-my-listings'] })
      setDone(true)
    },
  })

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-inset)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-btn)', padding: '8px 12px', color: 'var(--text-primary)',
    fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: 4,
  }

  if (done) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)', padding: 32, width: 420, textAlign: 'center',
        fontFamily: 'var(--font-sans)',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', background: 'var(--green-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
        }}>
          <Check style={{ width: 24, height: 24, color: 'var(--green)' }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Published!</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>Your asset is now live in the marketplace.</p>
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)', width: 520, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>Publish to Marketplace</h2>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderBottom: '1px solid var(--border)' }}>
          {['Choose asset', 'Metadata', 'Review'].map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {i > 0 && <ChevronRight style={{ width: 12, height: 12, color: 'var(--text-tertiary)' }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                color: step === i + 1 ? 'var(--accent)' : step > i + 1 ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                fontWeight: step === i + 1 ? 500 : 400,
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%', fontSize: 11,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${step === i + 1 ? 'var(--accent)' : step > i + 1 ? 'var(--green)' : 'var(--border)'}`,
                  background: step === i + 1 ? 'var(--accent)' : step > i + 1 ? 'var(--green-dim)' : 'transparent',
                  color: step === i + 1 ? 'white' : step > i + 1 ? 'var(--green)' : 'inherit',
                }}>
                  {step > i + 1 ? <Check style={{ width: 12, height: 12 }} /> : i + 1}
                </span>
                {label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {step === 1 && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>What are you publishing?</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(['dataset', 'pipeline', 'model', 'benchmark_config'] as MarketplaceAssetType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => { setAssetType(t); setSourceId('') }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: 12,
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${assetType === t ? 'var(--accent)' : 'var(--border)'}`,
                        background: assetType === t ? 'var(--blue-tint)' : 'transparent',
                        color: assetType === t ? 'var(--accent)' : 'var(--text-secondary)',
                        fontSize: 14, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {ASSET_TYPE_ICONS[t]}
                      {ASSET_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Select {ASSET_TYPE_LABELS[assetType]}
                  {assetType === 'model' && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> (completed sessions only)</span>}
                  {assetType === 'benchmark_config' && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> (completed jobs only)</span>}
                </label>
                {sources.length === 0 ? (
                  <div style={{
                    fontSize: 14, color: 'var(--text-tertiary)', background: 'var(--bg-card)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    padding: 16, textAlign: 'center',
                  }}>
                    No {ASSET_TYPE_LABELS[assetType].toLowerCase()}s available to publish
                  </div>
                ) : (
                  <select
                    style={{ ...inputStyle }}
                    value={sourceId}
                    onChange={e => setSourceId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {(sources as { id: string; name: string }[]).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label style={labelStyle}>Title *</label>
                <input style={inputStyle} placeholder="Give your asset a clear title" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Short description *</label>
                <input style={inputStyle} placeholder="One sentence description" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Full description</label>
                <textarea style={{ ...inputStyle, resize: 'none' }} placeholder="Detailed description, use cases, methodology…" rows={4} value={longDesc} onChange={e => setLongDesc(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value as MarketplaceCategory)}>
                    {VALID_CATEGORIES.map(c => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>License</label>
                  <select style={inputStyle} value={license} onChange={e => setLicense(e.target.value as MarketplaceLicense)}>
                    {VALID_LICENSES.map(l => (
                      <option key={l} value={l}>{LICENSE_LABELS[l]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Version</label>
                  <input style={inputStyle} placeholder="1.0.0" value={version} onChange={e => setVersion(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Author name</label>
                  <input style={inputStyle} placeholder="Your name" value={authorName} onChange={e => setAuthorName(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Tags <span style={{ fontWeight: 400 }}>(comma-separated)</span></label>
                <input style={inputStyle} placeholder="classification, tabular, real-world" value={tags} onChange={e => setTags(e.target.value)} />
              </div>
            </>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-card)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TypeBadge type={assetType} />
                </div>
                <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{description}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: 'var(--text-tertiary)' }}>Category: </span><span style={{ color: 'var(--text-primary)' }}>{CATEGORY_LABELS[category]}</span></div>
                  <div><span style={{ color: 'var(--text-tertiary)' }}>License: </span><span style={{ color: 'var(--text-primary)' }}>{LICENSE_LABELS[license]}</span></div>
                  <div><span style={{ color: 'var(--text-tertiary)' }}>Version: </span><span style={{ color: 'var(--text-primary)' }}>{version}</span></div>
                </div>
                {tags && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                      <span key={t} style={{
                        fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-pill)', padding: '2px 8px', color: 'var(--text-secondary)',
                      }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
              {publishMut.isError && (
                <p style={{
                  fontSize: 14, color: 'var(--bad)', background: 'var(--bad-dim)',
                  border: '1px solid var(--bad)', borderRadius: 'var(--radius-md)', padding: 12,
                }}>
                  {(publishMut.error as Error).message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <Button variant="ghost" onClick={step === 1 ? onClose : () => setStep(s => s - 1)}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={
                step === 1 ? !sourceId :
                step === 2 ? !title.trim() || !description.trim() : false
              }
            >
              Next <ChevronRight style={{ width: 16, height: 16, marginLeft: 4 }} />
            </Button>
          ) : (
            <Button onClick={() => publishMut.mutate()} disabled={publishMut.isPending}>
              {publishMut.isPending ? 'Publishing…' : 'Publish'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────

type Tab = 'browse' | 'featured' | 'my-listings' | 'installs'

export default function MarketplacePage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('browse')
  const [selectedAsset, setSelectedAsset] = useState<MarketplaceAsset | null>(null)
  const [showPublish, setShowPublish] = useState(false)
  const [q, setQ] = useState('')
  const [filterType, setFilterType] = useState<MarketplaceAssetType | ''>('')
  const [filterCat, setFilterCat] = useState<MarketplaceCategory | ''>('')
  const [sort, setSort] = useState<MarketplaceSort>('popular')

  const { data: stats } = useQuery({
    queryKey: ['mp-stats'],
    queryFn: api.marketplace.stats,
    staleTime: 60_000,
  })

  const { data: featured = [], isLoading: featLoading } = useQuery({
    queryKey: ['mp-featured'],
    queryFn: api.marketplace.featured,
    enabled: tab === 'featured',
    staleTime: 60_000,
  })

  const { data: browseList = [], isLoading: browseLoading } = useQuery({
    queryKey: ['mp-list', q, filterType, filterCat, sort],
    queryFn: () => api.marketplace.list({
      q: q || undefined,
      type: filterType || undefined,
      category: filterCat || undefined,
      sort,
    }),
    enabled: tab === 'browse',
    staleTime: 30_000,
  })

  const { data: myListings = [] } = useQuery({
    queryKey: ['mp-my-listings'],
    queryFn: api.marketplace.myListings,
    enabled: tab === 'my-listings',
  })

  const { data: installs = [] } = useQuery({
    queryKey: ['mp-installs'],
    queryFn: api.marketplace.installs,
    enabled: tab === 'installs',
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.marketplace.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mp-my-listings'] })
      qc.invalidateQueries({ queryKey: ['mp-list'] })
    },
  })

  const tabs: { id: Tab; label: string }[] = [
    { id: 'browse', label: 'Browse' },
    { id: 'featured', label: 'Featured' },
    { id: 'my-listings', label: 'My Listings' },
    { id: 'installs', label: 'Install History' },
  ]

  const sidebarBtnStyle = (active: boolean): React.CSSProperties => ({
    width: '100%', textAlign: 'left', fontSize: 13, padding: '6px 8px',
    borderRadius: 'var(--radius-btn)', border: 'none', cursor: 'pointer',
    background: active ? 'var(--blue-tint)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 8,
  })

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-inset)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-btn)', padding: '8px 12px', fontSize: 14,
    color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-sans)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--font-sans)' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Marketplace</h1>
          {stats && (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {stats.total_assets.toLocaleString()} assets · {stats.total_downloads.toLocaleString()} downloads
            </p>
          )}
        </div>
        <Button onClick={() => setShowPublish(true)}>
          <Upload style={{ width: 16, height: 16, marginRight: 8 }} />
          Publish Asset
        </Button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '12px 24px 0', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 16px', fontSize: 14, fontWeight: 500, border: 'none',
              borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
              color: tab === t.id ? 'var(--accent)' : 'var(--text-tertiary)',
              background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* Browse tab */}
        {tab === 'browse' && (
          <>
            {/* Filter sidebar */}
            <div style={{ width: 208, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 400, marginBottom: 8 }}>Type</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button onClick={() => setFilterType('')} style={sidebarBtnStyle(!filterType)}>All types</button>
                  {(['dataset', 'pipeline', 'model', 'benchmark_config'] as MarketplaceAssetType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t === filterType ? '' : t)}
                      style={sidebarBtnStyle(filterType === t)}
                    >
                      {ASSET_TYPE_ICONS[t]}
                      {ASSET_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 400, marginBottom: 8 }}>Category</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button onClick={() => setFilterCat('')} style={sidebarBtnStyle(!filterCat)}>All categories</button>
                  {VALID_CATEGORIES.map(c => (
                    <button
                      key={c}
                      onClick={() => setFilterCat(c === filterCat ? '' : c)}
                      style={sidebarBtnStyle(filterCat === c)}
                    >
                      {CATEGORY_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main browse area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              {/* Search + sort */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-tertiary)' }} />
                  <input
                    style={{
                      width: '100%', background: 'var(--bg-inset)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-btn)', padding: '8px 12px 8px 36px',
                      color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                      fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
                    }}
                    placeholder="Search assets…"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                  />
                </div>
                <select
                  style={selectStyle}
                  value={sort}
                  onChange={e => setSort(e.target.value as MarketplaceSort)}
                >
                  {SORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {browseLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'var(--text-tertiary)', fontSize: 14 }}>Loading…</div>
              ) : browseList.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', textAlign: 'center' }}>
                  <Package style={{ width: 40, height: 40, color: 'var(--text-tertiary)', marginBottom: 12 }} />
                  <p style={{ color: 'var(--text-primary)', fontWeight: 500 }}>No assets found</p>
                  <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 4 }}>Try adjusting your filters</p>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>{browseList.length} asset{browseList.length !== 1 ? 's' : ''}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    {browseList.map(a => (
                      <AssetCard key={a.id} asset={a} onClick={() => setSelectedAsset(a)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Featured tab */}
        {tab === 'featured' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 20 }}>Hand-picked assets from the community</p>
            {featLoading ? (
              <div style={{ fontSize: 14, color: 'var(--text-tertiary)', textAlign: 'center', padding: '80px 0' }}>Loading…</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {featured.map(a => (
                  <AssetCard key={a.id} asset={a} onClick={() => setSelectedAsset(a)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Listings tab */}
        {tab === 'my-listings' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {myListings.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', textAlign: 'center' }}>
                <Upload style={{ width: 40, height: 40, color: 'var(--text-tertiary)', marginBottom: 12 }} />
                <p style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Nothing published yet</p>
                <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 4 }}>Share your datasets, pipelines, and models with the community</p>
                <div style={{ marginTop: 16 }}>
                  <Button onClick={() => setShowPublish(true)}>
                    <Plus style={{ width: 16, height: 16, marginRight: 8 }} />Publish your first asset
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {myListings.map(a => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-card)', padding: 16,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <TypeBadge type={a.asset_type} />
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>v{a.version}</span>
                      </div>
                      <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{a.title}</h3>
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{a.description}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Download style={{ width: 14, height: 14 }} />{a.download_count}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Eye style={{ width: 14, height: 14 }} />{a.view_count}</span>
                      {a.rating_count > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Star style={{ width: 14, height: 14, color: '#facc15', fill: '#facc15' }} />{a.rating_avg.toFixed(1)}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedAsset(a)}>
                        <ExternalLink style={{ width: 14, height: 14 }} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete "${a.title}" from the marketplace?`)) deleteMut.mutate(a.id)
                        }}
                        style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }}
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Install History tab */}
        {tab === 'installs' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {installs.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', textAlign: 'center' }}>
                <Download style={{ width: 40, height: 40, color: 'var(--text-tertiary)', marginBottom: 12 }} />
                <p style={{ color: 'var(--text-primary)', fontWeight: 500 }}>No installs yet</p>
                <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 4 }}>Browse the marketplace and install assets to your workspace</p>
                <div style={{ marginTop: 16 }}>
                  <Button onClick={() => setTab('browse')}>Browse marketplace</Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>{installs.length} total install{installs.length !== 1 ? 's' : ''}</p>
                {installs.map(i => (
                  <div key={i.id} style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-card)', padding: 16,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 'var(--radius-md)',
                      background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Check style={{ width: 16, height: 16, color: 'var(--green)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 14 }}>{i.asset_title}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <TypeBadge type={i.asset_type as MarketplaceAssetType} />
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>ID: {i.resulting_id.slice(0, 8)}…</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      {new Date(i.installed_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedAsset && (
        <AssetDetailDrawer asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
      {showPublish && (
        <PublishWizard onClose={() => setShowPublish(false)} />
      )}
    </div>
  )
}
