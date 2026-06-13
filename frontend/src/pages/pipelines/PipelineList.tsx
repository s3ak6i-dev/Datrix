import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, GitBranch, Trash2, ChevronRight, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { formatRelativeTime } from '@/lib/utils'
import type { Pipeline } from '@/types'

export function PipelineList() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const { data: pipelines = [], isLoading } = useQuery({
    queryKey: ['pipelines'],
    queryFn: api.pipelines.list,
  })

  const createMutation = useMutation({
    mutationFn: () => api.pipelines.create(newName.trim() || 'Untitled pipeline'),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['pipelines'] })
      navigate(`/pipelines/${p.id}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.pipelines.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  })

  const handleCreate = () => {
    if (creating) {
      createMutation.mutate()
      setCreating(false)
      setNewName('')
    } else {
      setCreating(true)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0 }}>
          Pipelines
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {creating && (
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') { setCreating(false); setNewName('') }
              }}
              placeholder="Pipeline name…"
              style={{
                background: 'var(--bg-inset)',
                border: '1px solid var(--border-accent)',
                borderRadius: 'var(--radius-btn)',
                padding: '6px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                width: '208px',
                fontFamily: 'var(--font-sans)',
              }}
            />
          )}
          <Button onClick={handleCreate} loading={createMutation.isPending}>
            <Plus className="w-4 h-4" />
            {creating ? 'Create' : 'New pipeline'}
          </Button>
          {creating && (
            <Button variant="ghost" size="sm" onClick={() => { setCreating(false); setNewName('') }}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: '80px',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      ) : pipelines.length === 0 ? (
        <div style={{ padding: '96px 0', textAlign: 'center' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--bg-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <GitBranch style={{ width: '24px', height: '24px', color: 'var(--text-tertiary)' }} />
          </div>
          <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 4px' }}>No pipelines yet</p>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 auto 16px', maxWidth: '280px' }}>
            Build a reusable transformation pipeline for any dataset
          </p>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4" />
            New pipeline
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {pipelines.map((p) => (
            <PipelineRow
              key={p.id}
              pipeline={p}
              onClick={() => navigate(`/pipelines/${p.id}`)}
              onDelete={() => deleteMutation.mutate(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PipelineRow({
  pipeline,
  onClick,
  onDelete,
}: {
  pipeline: Pipeline
  onClick: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [deleteHovered, setDeleteHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setDeleteHovered(false) }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px',
        borderRadius: 'var(--radius-card)',
        border: `1px solid ${hovered ? 'var(--border-accent)' : 'var(--border)'}`,
        background: 'var(--bg-card)',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hovered ? 'var(--shadow-card)' : 'none',
      }}
    >
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--blue-tint)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <GitBranch style={{ width: '20px', height: '20px', color: 'var(--accent)' }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pipeline.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
          <span>{pipeline.steps.length} step{pipeline.steps.length !== 1 ? 's' : ''}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock style={{ width: '12px', height: '12px' }} />
            {formatRelativeTime(pipeline.updated_at)}
          </span>
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        onMouseEnter={() => setDeleteHovered(true)}
        onMouseLeave={() => setDeleteHovered(false)}
        style={{
          opacity: hovered ? 1 : 0,
          padding: '6px',
          borderRadius: 'var(--radius-btn)',
          border: 'none',
          background: deleteHovered ? 'var(--bad-dim)' : 'transparent',
          color: deleteHovered ? 'var(--bad)' : 'var(--text-tertiary)',
          cursor: 'pointer',
          transition: 'opacity 0.15s, color 0.15s, background 0.15s',
        }}
      >
        <Trash2 style={{ width: '16px', height: '16px' }} />
      </button>

      <ChevronRight style={{ width: '16px', height: '16px', color: 'var(--text-tertiary)', flexShrink: 0 }} />
    </div>
  )
}
