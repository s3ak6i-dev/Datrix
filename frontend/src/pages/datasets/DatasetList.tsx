import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { Upload, Plus, Search, Database, Loader2, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { formatBytes, formatNumber, formatRelativeTime } from '@/lib/utils'
import { QualityBadge } from '@/components/ui/QualityBadge'
import { Button } from '@/components/ui/Button'
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
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Add dataset button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
        <div {...getRootProps()}>
          <input {...getInputProps()} />
          <Button loading={uploading} disabled={uploading}>
            <Plus style={{ width: '15px', height: '15px' }} />
            New dataset
          </Button>
        </div>
      </div>

      {/* Upload zone (when no datasets or drag active) */}
      {(datasets.length === 0 || isDragActive) && !isLoading && (
        <div
          {...getRootProps()}
          style={{
            marginBottom: '24px',
            border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-card)',
            padding: '40px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragActive ? 'var(--blue-tint)' : 'transparent',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          <input {...getInputProps()} />
          <Upload style={{ width: '32px', height: '32px', margin: '0 auto 12px', color: 'var(--text-tertiary)', display: 'block' }} />
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 4px' }}>
            {isDragActive ? 'Drop to upload' : 'Upload your first dataset'}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
            CSV, JSON, JSONL, Parquet, Excel — drag and drop or click
          </p>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div style={{
          marginBottom: '16px',
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-accent)',
          background: 'var(--blue-tint)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <Loader2 style={{ width: '16px', height: '16px', color: 'var(--accent)', flexShrink: 0 }} className="animate-spin" />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--accent)', margin: '0 0 6px' }}>Uploading…</p>
            <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  background: 'var(--accent)',
                  borderRadius: '2px',
                  width: `${uploadProgress}%`,
                  transition: 'width 0.2s',
                }}
              />
            </div>
          </div>
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
            {uploadProgress}%
          </span>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--bad-dim)',
          background: 'var(--bad-dim)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          color: 'var(--bad)',
        }}>
          <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
          {uploadError}
        </div>
      )}

      {/* Search */}
      {datasets.length > 0 && (
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '16px',
            height: '16px',
            color: 'var(--text-tertiary)',
            pointerEvents: 'none',
          }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search datasets…"
            style={{
              width: '100%',
              paddingLeft: '36px',
              paddingRight: '16px',
              paddingTop: '8px',
              paddingBottom: '8px',
              fontSize: '14px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-btn)',
              background: 'var(--bg-inset)',
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Dataset list */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Array.from({ length: 4 }).map((_, i) => <DatasetRowSkeleton key={i} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((ds) => (
            <DatasetRow key={ds.id} dataset={ds} onClick={() => navigate(`/datasets/${ds.id}`)} />
          ))}
          {filtered.length === 0 && datasets.length > 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '32px 0', fontSize: '14px' }}>
              No datasets match "{search}"
            </p>
          )}
        </div>
      )}

      {/* Drag overlay */}
      {isDragActive && datasets.length > 0 && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--blue-tint)',
          border: '4px dashed var(--accent)',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-card)',
            padding: '24px 32px',
            boxShadow: 'var(--shadow-card)',
            textAlign: 'center',
          }}>
            <Upload style={{ width: '32px', height: '32px', margin: '0 auto 8px', color: 'var(--accent)', display: 'block' }} />
            <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent)', margin: 0 }}>Drop to upload</p>
          </div>
        </div>
      )}
    </div>
  )
}

function DatasetRow({ dataset, onClick }: { dataset: Dataset; onClick: () => void }) {
  const isProcessing = dataset.status === 'ingesting' || dataset.status === 'scanning'

  const statusBadgeStyle = (status: string): React.CSSProperties => {
    if (status === 'ingesting' || status === 'scanning') {
      return {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--radius-xs)',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.06em',
        background: 'var(--blue-tint)',
        color: 'var(--accent)',
        border: '1px solid var(--border-accent)',
      }
    }
    if (status === 'error') {
      return {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--radius-xs)',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.06em',
        background: 'var(--bad-dim)',
        color: 'var(--bad)',
        border: '1px solid var(--bad)',
      }
    }
    return {}
  }

  return (
    <div
      onClick={isProcessing ? undefined : onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        cursor: isProcessing ? 'default' : 'pointer',
        opacity: isProcessing ? 0.75 : 1,
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!isProcessing) {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-accent)'
          ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-card)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isProcessing) {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
          ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
        }
      }}
    >
      {/* Score / status */}
      <div style={{ flexShrink: 0 }}>
        {dataset.latest_score != null ? (
          <QualityBadge score={dataset.latest_score} size="md" />
        ) : isProcessing ? (
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '2px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Loader2 style={{ width: '16px', height: '16px', color: 'var(--text-tertiary)' }} className="animate-spin" />
          </div>
        ) : (
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '2px dashed var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Database style={{ width: '16px', height: '16px', color: 'var(--text-tertiary)' }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {dataset.name}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
          {dataset.row_count != null ? `${formatNumber(dataset.row_count)} rows` : '—'}
          {dataset.column_count != null ? ` · ${dataset.column_count} cols` : ''}
          {dataset.size_bytes != null ? ` · ${formatBytes(dataset.size_bytes)}` : ''}
          {' · '}
          {formatRelativeTime(dataset.updated_at)}
        </p>
      </div>

      {/* Status badge */}
      <div style={{ flexShrink: 0 }}>
        {isProcessing && (
          <span style={statusBadgeStyle(dataset.status)}>
            {dataset.status === 'ingesting' ? 'Ingesting…' : 'Scanning…'}
          </span>
        )}
        {dataset.status === 'error' && (
          <span style={statusBadgeStyle('error')}>Error</span>
        )}
      </div>
    </div>
  )
}
