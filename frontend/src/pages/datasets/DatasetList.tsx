import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { Upload, Plus, Search, Database, Loader2, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { formatBytes, formatNumber, formatRelativeTime } from '@/lib/utils'
import { QualityBadge } from '@/components/ui/QualityBadge'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DatasetRowSkeleton } from '@/components/ui/Skeleton'
import type { Dataset } from '@/types'

export function DatasetList() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const { data: datasets = [], isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: api.datasets.list,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!Array.isArray(data)) return false
      const hasPending = data.some((d: Dataset) =>
        d.status === 'ingesting' || d.status === 'scanning'
      )
      return hasPending ? 2000 : false
    },
  })

  const handleUpload = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    setUploadProgress(0)
    try {
      const ds = await api.datasets.upload(file, setUploadProgress)
      qc.invalidateQueries({ queryKey: ['datasets'] })
      navigate(`/datasets/${ds.id}`)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleUpload,
    accept: {
      'text/csv': ['.csv'],
      'application/json': ['.json', '.jsonl'],
      'application/octet-stream': ['.parquet'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
    disabled: uploading,
  })

  const filtered = datasets.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Datasets</h1>
        <div {...getRootProps()}>
          <input {...getInputProps()} />
          <Button loading={uploading} disabled={uploading}>
            <Plus className="w-4 h-4" />
            New dataset
          </Button>
        </div>
      </div>

      {/* Upload zone (when no datasets or drag active) */}
      {(datasets.length === 0 || isDragActive) && !isLoading && (
        <div
          {...getRootProps()}
          className={`mb-6 border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-brand bg-brand-50'
              : 'border-border hover:border-brand hover:bg-brand-50/30'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 mx-auto mb-3 text-text-tertiary" />
          <p className="text-sm font-medium text-text-primary">
            {isDragActive ? 'Drop to upload' : 'Upload your first dataset'}
          </p>
          <p className="text-xs text-text-tertiary mt-1">
            CSV, JSON, JSONL, Parquet, Excel — drag and drop or click
          </p>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="mb-4 p-4 rounded-lg border border-brand/20 bg-brand-50 flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-brand" />
          <div className="flex-1">
            <p className="text-sm font-medium text-brand">Uploading…</p>
            <div className="mt-1.5 h-1 bg-brand/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-mono text-brand">{uploadProgress}%</span>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="mb-4 p-3 rounded-lg border border-danger/20 bg-danger-50 flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {uploadError}
        </div>
      )}

      {/* Search */}
      {datasets.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search datasets…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-surface-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
        </div>
      )}

      {/* Dataset list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <DatasetRowSkeleton key={i} />)}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ds) => (
            <DatasetRow key={ds.id} dataset={ds} onClick={() => navigate(`/datasets/${ds.id}`)} />
          ))}
          {filtered.length === 0 && datasets.length > 0 && (
            <p className="text-center text-text-tertiary py-8 text-sm">
              No datasets match "{search}"
            </p>
          )}
        </div>
      )}

      {/* Drag overlay */}
      {isDragActive && datasets.length > 0 && (
        <div className="fixed inset-0 bg-brand/10 border-4 border-dashed border-brand rounded-none z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-xl px-8 py-6 shadow-lg text-center">
            <Upload className="w-8 h-8 mx-auto mb-2 text-brand" />
            <p className="text-lg font-semibold text-brand">Drop to upload</p>
          </div>
        </div>
      )}
    </div>
  )
}

function DatasetRow({ dataset, onClick }: { dataset: Dataset; onClick: () => void }) {
  const isProcessing = dataset.status === 'ingesting' || dataset.status === 'scanning'

  return (
    <div
      onClick={isProcessing ? undefined : onClick}
      className={`flex items-center gap-4 p-4 rounded-xl border border-border bg-surface-primary transition-all ${
        isProcessing ? 'opacity-75' : 'hover:border-brand/30 hover:shadow-sm cursor-pointer'
      }`}
    >
      {/* Score / status */}
      <div className="flex-shrink-0">
        {dataset.latest_score != null ? (
          <QualityBadge score={dataset.latest_score} size="md" />
        ) : isProcessing ? (
          <div className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full border-2 border-dashed border-border flex items-center justify-center">
            <Database className="w-4 h-4 text-text-tertiary" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{dataset.name}</p>
        <p className="text-xs text-text-tertiary mt-0.5">
          {dataset.row_count != null ? `${formatNumber(dataset.row_count)} rows` : '—'}
          {dataset.column_count != null ? ` · ${dataset.column_count} cols` : ''}
          {dataset.size_bytes != null ? ` · ${formatBytes(dataset.size_bytes)}` : ''}
          {' · '}
          {formatRelativeTime(dataset.updated_at)}
        </p>
      </div>

      {/* Status badge */}
      <div className="flex-shrink-0">
        {isProcessing && (
          <Badge variant="default">
            {dataset.status === 'ingesting' ? 'Ingesting…' : 'Scanning…'}
          </Badge>
        )}
        {dataset.status === 'error' && <Badge variant="danger">Error</Badge>}
      </div>
    </div>
  )
}
