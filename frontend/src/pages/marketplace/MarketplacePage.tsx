import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Star, Download, Eye, Package, Database, GitBranch, Brain, BarChart3, X, Plus, ChevronRight, Check, ExternalLink, Upload, Tag, Trash2, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
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
  dataset: <Database className="w-4 h-4" />,
  pipeline: <GitBranch className="w-4 h-4" />,
  model: <Brain className="w-4 h-4" />,
  benchmark_config: <BarChart3 className="w-4 h-4" />,
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

function fmtBytes(n: number) {
  if (n === 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function fmtCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn(cls, i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-border')} />
      ))}
    </span>
  )
}

function TypeBadge({ type }: { type: MarketplaceAssetType }) {
  const colors: Record<MarketplaceAssetType, string> = {
    dataset: 'bg-blue-500/10 text-blue-400',
    pipeline: 'bg-purple-500/10 text-purple-400',
    model: 'bg-green-500/10 text-green-400',
    benchmark_config: 'bg-orange-500/10 text-orange-400',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', colors[type])}>
      {ASSET_TYPE_ICONS[type]}
      {ASSET_TYPE_LABELS[type]}
    </span>
  )
}

// ── Asset Card ────────────────────────────────────────────────────────

function AssetCard({ asset, onClick }: { asset: MarketplaceAsset; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-surface-secondary border border-border rounded-xl p-4 hover:border-brand/50 hover:bg-surface-tertiary transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <TypeBadge type={asset.asset_type} />
        {asset.is_seeded && (
          <span className="text-xs text-text-tertiary bg-surface-primary border border-border rounded px-1.5 py-0.5">Official</span>
        )}
      </div>
      <h3 className="font-semibold text-text-primary text-sm leading-snug mb-1 group-hover:text-brand transition-colors line-clamp-2">
        {asset.title}
      </h3>
      <p className="text-xs text-text-tertiary line-clamp-2 mb-3">{asset.description}</p>
      <div className="flex items-center justify-between text-xs text-text-tertiary">
        <span className="flex items-center gap-1">
          {asset.rating_count > 0 ? (
            <>
              <Stars rating={asset.rating_avg} />
              <span>{asset.rating_avg.toFixed(1)}</span>
            </>
          ) : (
            <span>No ratings</span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1"><Download className="w-3 h-3" />{fmtCount(asset.download_count)}</span>
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{fmtCount(asset.view_count)}</span>
        </span>
      </div>
      {asset.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {asset.tags.slice(0, 3).map(t => (
            <span key={t} className="text-xs bg-surface-primary border border-border rounded px-1.5 py-0.5 text-text-tertiary">{t}</span>
          ))}
          {asset.tags.length > 3 && <span className="text-xs text-text-tertiary">+{asset.tags.length - 3}</span>}
        </div>
      )}
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
  return (
    <div className="space-y-3 border border-border rounded-lg p-4 bg-surface-secondary">
      <p className="text-sm font-medium text-text-primary">Write a Review</p>
      <input
        className="w-full bg-surface-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand"
        placeholder="Your name"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <div className="flex gap-1">
        {[1,2,3,4,5].map(i => (
          <button key={i} onClick={() => setRating(i)}>
            <Star className={cn('w-5 h-5', i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-border hover:text-yellow-300')} />
          </button>
        ))}
      </div>
      <textarea
        className="w-full bg-surface-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand resize-none"
        placeholder="Share your experience (optional)"
        rows={3}
        value={comment}
        onChange={e => setComment(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending}>
          {mut.isPending ? 'Submitting…' : 'Submit'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
      {mut.isError && <p className="text-xs text-danger">{(mut.error as Error).message}</p>}
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
    <div className="fixed inset-0 z-50 flex">
      <button className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-[520px] bg-surface-primary border-l border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <TypeBadge type={asset.asset_type} />
              {asset.is_seeded && (
                <span className="text-xs text-text-tertiary bg-surface-secondary border border-border rounded px-1.5 py-0.5">Official</span>
              )}
            </div>
            <h2 className="font-bold text-text-primary text-lg leading-snug">{asset.title}</h2>
            <p className="text-sm text-text-tertiary mt-1">by {asset.author_name} · v{asset.version} · {LICENSE_LABELS[asset.license]}</p>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary p-1 ml-3 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-px bg-border m-5 rounded-lg overflow-hidden">
            {[
              { label: 'Downloads', val: fmtCount(asset.download_count) },
              { label: 'Views', val: fmtCount(asset.view_count) },
              { label: 'Rating', val: asset.rating_count > 0 ? asset.rating_avg.toFixed(1) : '—' },
              { label: 'Reviews', val: String(asset.rating_count) },
            ].map(s => (
              <div key={s.label} className="bg-surface-secondary px-3 py-2.5 text-center">
                <div className="text-lg font-bold text-text-primary">{s.val}</div>
                <div className="text-xs text-text-tertiary">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="px-5 space-y-5 pb-5">
            {/* Install button */}
            {installed ? (
              <div className="flex items-center gap-2 bg-success/10 text-success text-sm p-3 rounded-lg border border-success/20">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>{installed}</span>
              </div>
            ) : (
              <Button
                onClick={() => installMut.mutate()}
                disabled={installMut.isPending}
                className="w-full"
              >
                {installMut.isPending ? (
                  <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Installing…</>
                ) : (
                  <><Download className="w-4 h-4 mr-2" />Install to Workspace</>
                )}
              </Button>
            )}
            {installMut.isError && (
              <p className="text-xs text-danger">{(installMut.error as Error).message}</p>
            )}

            {/* Description */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">About</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {asset.long_description || asset.description}
              </p>
            </div>

            {/* Preview */}
            {asset.asset_type === 'dataset' && preview.schema && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">Preview</h3>
                <div className="text-xs text-text-tertiary mb-2">
                  {(preview.row_count as number)?.toLocaleString()} rows · {(preview.column_count as number)} columns
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-surface-secondary border-b border-border">
                        {(preview.schema as {name:string;dtype:string}[]).slice(0, 6).map(col => (
                          <th key={col.name} className="px-2 py-1.5 text-left text-text-tertiary font-medium whitespace-nowrap">
                            {col.name}
                            <span className="ml-1 text-text-tertiary opacity-60">{col.dtype}</span>
                          </th>
                        ))}
                        {(preview.schema as unknown[]).length > 6 && (
                          <th className="px-2 py-1.5 text-text-tertiary">+{(preview.schema as unknown[]).length - 6} more</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(preview.sample_rows as Record<string, unknown>[] | undefined)?.map((row, i) => (
                        <tr key={i} className={cn('border-b border-border last:border-0', i % 2 === 0 ? 'bg-surface-primary' : 'bg-surface-secondary')}>
                          {(preview.schema as {name:string}[]).slice(0, 6).map(col => (
                            <td key={col.name} className="px-2 py-1.5 text-text-secondary whitespace-nowrap max-w-[100px] overflow-hidden text-ellipsis">
                              {row[col.name] === null || row[col.name] === undefined ? <span className="text-text-tertiary">null</span> : String(row[col.name])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {asset.asset_type === 'pipeline' && preview.steps && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">Pipeline Steps</h3>
                <div className="space-y-1">
                  {(preview.steps as {type: string}[]).map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-xs flex items-center justify-center flex-shrink-0">{i+1}</span>
                      <span className="text-text-secondary">{s.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {asset.asset_type === 'model' && preview.model_type && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">Model Info</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {[
                    ['Model type', String(preview.model_type)],
                    ['Task', String(preview.task_type)],
                    ['Rounds', String(preview.rounds_completed)],
                    ['Labeled rows', String(preview.labeled_count)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-text-tertiary text-xs">{k}</dt>
                      <dd className="text-text-primary font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
                {preview.metrics && (
                  <div className="mt-3 space-y-1">
                    {Object.entries(preview.metrics as Record<string, number>).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-xs">
                        <span className="text-text-tertiary capitalize">{k.replace(/_/g, ' ')}</span>
                        <span className="text-text-primary font-medium">{(v * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {asset.asset_type === 'benchmark_config' && preview.candidates && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">Benchmark Config</h3>
                <p className="text-xs text-text-tertiary mb-2">{String(preview.eval_protocol)} · {String(preview.task_type)}</p>
                <div className="space-y-1">
                  {(preview.candidates as {label:string;model_type:string;preset:string}[]).map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-surface-secondary border border-border rounded px-2 py-1.5">
                      <span className="text-text-primary font-medium flex-1">{c.label || c.model_type}</span>
                      <span className="text-text-tertiary">{c.preset}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {asset.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {asset.tags.map(t => (
                    <span key={t} className="text-xs bg-surface-secondary border border-border rounded-full px-2.5 py-1 text-text-secondary">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-primary">
                  Reviews {reviews.length > 0 && `(${reviews.length})`}
                </h3>
                {!showReviewForm && (
                  <button
                    onClick={() => setShowReviewForm(true)}
                    className="text-xs text-brand hover:underline"
                  >
                    + Write review
                  </button>
                )}
              </div>
              {showReviewForm && (
                <ReviewForm assetId={initial.id} onDone={() => setShowReviewForm(false)} />
              )}
              {reviews.length === 0 && !showReviewForm ? (
                <p className="text-sm text-text-tertiary">No reviews yet. Be the first!</p>
              ) : (
                <div className="space-y-3">
                  {reviews.map(r => (
                    <div key={r.id} className="bg-surface-secondary border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-text-primary">{r.author_name}</span>
                        <Stars rating={r.rating} />
                      </div>
                      {r.comment && <p className="text-sm text-text-secondary">{r.comment}</p>}
                      <p className="text-xs text-text-tertiary mt-1">
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

  if (done) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface-primary border border-border rounded-xl p-8 w-[420px] text-center">
        <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
          <Check className="w-6 h-6 text-success" />
        </div>
        <h2 className="text-lg font-bold text-text-primary mb-2">Published!</h2>
        <p className="text-sm text-text-secondary mb-6">Your asset is now live in the marketplace.</p>
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface-primary border border-border rounded-xl w-[520px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-text-primary">Publish to Marketplace</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border">
          {['Choose asset', 'Metadata', 'Review'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="w-3 h-3 text-text-tertiary" />}
              <div className={cn('flex items-center gap-1.5 text-xs', step === i + 1 ? 'text-brand font-medium' : step > i + 1 ? 'text-text-secondary' : 'text-text-tertiary')}>
                <span className={cn('w-5 h-5 rounded-full text-xs flex items-center justify-center border',
                  step === i + 1 ? 'bg-brand text-white border-brand' :
                  step > i + 1 ? 'bg-success/20 text-success border-success/30' : 'border-border'
                )}>
                  {step > i + 1 ? <Check className="w-3 h-3" /> : i + 1}
                </span>
                {label}
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">What are you publishing?</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['dataset', 'pipeline', 'model', 'benchmark_config'] as MarketplaceAssetType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => { setAssetType(t); setSourceId('') }}
                      className={cn('flex items-center gap-2 p-3 rounded-lg border text-sm text-left',
                        assetType === t ? 'border-brand bg-brand/5 text-brand' : 'border-border text-text-secondary hover:border-border hover:bg-surface-secondary'
                      )}
                    >
                      {ASSET_TYPE_ICONS[t]}
                      {ASSET_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Select {ASSET_TYPE_LABELS[assetType]}
                  {assetType === 'model' && <span className="text-text-tertiary font-normal"> (completed sessions only)</span>}
                  {assetType === 'benchmark_config' && <span className="text-text-tertiary font-normal"> (completed jobs only)</span>}
                </label>
                {sources.length === 0 ? (
                  <div className="text-sm text-text-tertiary bg-surface-secondary border border-border rounded-lg p-4 text-center">
                    No {ASSET_TYPE_LABELS[assetType].toLowerCase()}s available to publish
                  </div>
                ) : (
                  <select
                    className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
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
                <label className="block text-xs font-medium text-text-tertiary mb-1">Title *</label>
                <input
                  className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand"
                  placeholder="Give your asset a clear title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1">Short description *</label>
                <input
                  className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand"
                  placeholder="One sentence description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1">Full description</label>
                <textarea
                  className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand resize-none"
                  placeholder="Detailed description, use cases, methodology…"
                  rows={4}
                  value={longDesc}
                  onChange={e => setLongDesc(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-tertiary mb-1">Category</label>
                  <select
                    className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
                    value={category}
                    onChange={e => setCategory(e.target.value as MarketplaceCategory)}
                  >
                    {VALID_CATEGORIES.map(c => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-tertiary mb-1">License</label>
                  <select
                    className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
                    value={license}
                    onChange={e => setLicense(e.target.value as MarketplaceLicense)}
                  >
                    {VALID_LICENSES.map(l => (
                      <option key={l} value={l}>{LICENSE_LABELS[l]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-tertiary mb-1">Version</label>
                  <input
                    className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand"
                    placeholder="1.0.0"
                    value={version}
                    onChange={e => setVersion(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-tertiary mb-1">Author name</label>
                  <input
                    className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand"
                    placeholder="Your name"
                    value={authorName}
                    onChange={e => setAuthorName(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1">
                  Tags <span className="font-normal">(comma-separated)</span>
                </label>
                <input
                  className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand"
                  placeholder="classification, tabular, real-world"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                />
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-surface-secondary border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <TypeBadge type={assetType} />
                </div>
                <h3 className="font-semibold text-text-primary">{title}</h3>
                <p className="text-sm text-text-secondary">{description}</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-text-tertiary">Category: </span><span className="text-text-primary">{CATEGORY_LABELS[category]}</span></div>
                  <div><span className="text-text-tertiary">License: </span><span className="text-text-primary">{LICENSE_LABELS[license]}</span></div>
                  <div><span className="text-text-tertiary">Version: </span><span className="text-text-primary">{version}</span></div>
                </div>
                {tags && (
                  <div className="flex flex-wrap gap-1">
                    {tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                      <span key={t} className="text-xs bg-surface-primary border border-border rounded-full px-2 py-0.5 text-text-secondary">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              {publishMut.isError && (
                <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg p-3">
                  {(publishMut.error as Error).message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={step === 1 ? onClose : () => setStep(s => s - 1)}>
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
              Next <ChevronRight className="w-4 h-4 ml-1" />
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

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Marketplace</h1>
          {stats && (
            <p className="text-sm text-text-tertiary mt-0.5">
              {stats.total_assets.toLocaleString()} assets · {stats.total_downloads.toLocaleString()} downloads
            </p>
          )}
        </div>
        <Button onClick={() => setShowPublish(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Publish Asset
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b border-border flex-shrink-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t.id ? 'border-brand text-brand' : 'border-transparent text-text-tertiary hover:text-text-secondary'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Browse tab */}
        {tab === 'browse' && (
          <>
            {/* Filter sidebar */}
            <div className="w-52 flex-shrink-0 border-r border-border overflow-y-auto p-4 space-y-5">
              <div>
                <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Type</p>
                <div className="space-y-1">
                  <button
                    onClick={() => setFilterType('')}
                    className={cn('w-full text-left text-sm px-2 py-1.5 rounded', !filterType ? 'text-brand bg-brand/5' : 'text-text-secondary hover:bg-surface-secondary')}
                  >
                    All types
                  </button>
                  {(['dataset', 'pipeline', 'model', 'benchmark_config'] as MarketplaceAssetType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t === filterType ? '' : t)}
                      className={cn('w-full text-left text-sm px-2 py-1.5 rounded flex items-center gap-2',
                        filterType === t ? 'text-brand bg-brand/5' : 'text-text-secondary hover:bg-surface-secondary'
                      )}
                    >
                      {ASSET_TYPE_ICONS[t]}
                      {ASSET_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Category</p>
                <div className="space-y-1">
                  <button
                    onClick={() => setFilterCat('')}
                    className={cn('w-full text-left text-sm px-2 py-1.5 rounded', !filterCat ? 'text-brand bg-brand/5' : 'text-text-secondary hover:bg-surface-secondary')}
                  >
                    All categories
                  </button>
                  {VALID_CATEGORIES.map(c => (
                    <button
                      key={c}
                      onClick={() => setFilterCat(c === filterCat ? '' : c)}
                      className={cn('w-full text-left text-sm px-2 py-1.5 rounded',
                        filterCat === c ? 'text-brand bg-brand/5' : 'text-text-secondary hover:bg-surface-secondary'
                      )}
                    >
                      {CATEGORY_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main browse area */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Search + sort */}
              <div className="flex gap-3 mb-5">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  <input
                    className="w-full bg-surface-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand"
                    placeholder="Search assets…"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                  />
                </div>
                <select
                  className="bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
                  value={sort}
                  onChange={e => setSort(e.target.value as MarketplaceSort)}
                >
                  {SORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {browseLoading ? (
                <div className="flex items-center justify-center py-20 text-text-tertiary text-sm">Loading…</div>
              ) : browseList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Package className="w-10 h-10 text-text-tertiary mb-3" />
                  <p className="text-text-primary font-medium">No assets found</p>
                  <p className="text-sm text-text-tertiary mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-text-tertiary mb-4">{browseList.length} asset{browseList.length !== 1 ? 's' : ''}</p>
                  <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
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
          <div className="flex-1 overflow-y-auto p-6">
            <p className="text-sm text-text-tertiary mb-5">Hand-picked assets from the community</p>
            {featLoading ? (
              <div className="text-sm text-text-tertiary text-center py-20">Loading…</div>
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                {featured.map(a => (
                  <AssetCard key={a.id} asset={a} onClick={() => setSelectedAsset(a)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Listings tab */}
        {tab === 'my-listings' && (
          <div className="flex-1 overflow-y-auto p-6">
            {myListings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Upload className="w-10 h-10 text-text-tertiary mb-3" />
                <p className="text-text-primary font-medium">Nothing published yet</p>
                <p className="text-sm text-text-tertiary mt-1">Share your datasets, pipelines, and models with the community</p>
                <Button className="mt-4" onClick={() => setShowPublish(true)}>
                  <Plus className="w-4 h-4 mr-2" />Publish your first asset
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {myListings.map(a => (
                  <div key={a.id} className="flex items-center gap-4 bg-surface-secondary border border-border rounded-xl p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <TypeBadge type={a.asset_type} />
                        <span className="text-xs text-text-tertiary">v{a.version}</span>
                      </div>
                      <h3 className="font-semibold text-text-primary text-sm">{a.title}</h3>
                      <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">{a.description}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-text-tertiary flex-shrink-0">
                      <span className="flex items-center gap-1"><Download className="w-3.5 h-3.5" />{a.download_count}</span>
                      <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{a.view_count}</span>
                      {a.rating_count > 0 && <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-400" />{a.rating_avg.toFixed(1)}</span>}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedAsset(a)}>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete "${a.title}" from the marketplace?`)) deleteMut.mutate(a.id)
                        }}
                        className="text-danger border-danger/30 hover:bg-danger/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
          <div className="flex-1 overflow-y-auto p-6">
            {installs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Download className="w-10 h-10 text-text-tertiary mb-3" />
                <p className="text-text-primary font-medium">No installs yet</p>
                <p className="text-sm text-text-tertiary mt-1">Browse the marketplace and install assets to your workspace</p>
                <Button className="mt-4" onClick={() => setTab('browse')}>Browse marketplace</Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-text-tertiary mb-4">{installs.length} total install{installs.length !== 1 ? 's' : ''}</p>
                {installs.map(i => (
                  <div key={i.id} className="flex items-center gap-4 bg-surface-secondary border border-border rounded-xl p-4">
                    <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-primary text-sm">{i.asset_title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <TypeBadge type={i.asset_type as MarketplaceAssetType} />
                        <span className="text-xs text-text-tertiary">ID: {i.resulting_id.slice(0, 8)}…</span>
                      </div>
                    </div>
                    <span className="text-xs text-text-tertiary flex-shrink-0">
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
