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
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Pipelines</h1>
        <div className="flex items-center gap-2">
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
              className="px-3 py-1.5 text-sm border border-brand rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 w-52"
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
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-border bg-surface-primary animate-pulse" />
          ))}
        </div>
      ) : pipelines.length === 0 ? (
        <div className="py-24 text-center">
          <div className="w-14 h-14 rounded-full bg-surface-tertiary flex items-center justify-center mb-4 mx-auto">
            <GitBranch className="w-6 h-6 text-text-tertiary" />
          </div>
          <p className="text-base font-medium text-text-primary mb-1">No pipelines yet</p>
          <p className="text-sm text-text-secondary mb-4 max-w-xs mx-auto">
            Build a reusable transformation pipeline for any dataset
          </p>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4" />
            New pipeline
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
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
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 p-4 rounded-xl border border-border bg-surface-primary hover:border-brand/30 hover:shadow-sm cursor-pointer transition-all group"
    >
      <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
        <GitBranch className="w-5 h-5 text-brand" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{pipeline.name}</p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-text-tertiary">
          <span>{pipeline.steps.length} step{pipeline.steps.length !== 1 ? 's' : ''}</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(pipeline.updated_at)}
          </span>
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger-50 transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <ChevronRight className="w-4 h-4 text-text-tertiary flex-shrink-0" />
    </div>
  )
}
