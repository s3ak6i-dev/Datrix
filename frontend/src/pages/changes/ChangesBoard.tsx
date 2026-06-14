import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Plus, Check, X, RotateCcw, ChevronDown, Loader2,
  AlertTriangle, AlertOctagon, Minus, Zap, Clock, Undo2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationContext'
import './ChangesBoard.css'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function authFetch(path: string, token: string, init?: RequestInit) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  }).then(r => r.ok ? r.json() : r.json().then((e: { detail?: string }) => Promise.reject(e.detail ?? 'Request failed')))
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChangeRequest {
  id: string
  org_id: string
  user_id: string
  user_name: string | null
  user_color: string | null
  title: string
  description: string | null
  action_type: string
  impact: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'approved' | 'rejected' | 'auto_approved' | 'rolled_back'
  reviewer_id: string | null
  reviewer_name: string | null
  reviewer_comment: string | null
  rollback_comment: string | null
  auto_approve_at: string | null
  resubmit_count: number
  created_at: string
  reviewed_at: string | null
}

interface OrgInfo {
  id: string
  name: string
  role: string
}

const IMPACTS: ChangeRequest['impact'][] = ['low', 'medium', 'high', 'critical']

const IMPACT_META = {
  low:      { label: 'Low',      color: '#22c55e', dim: 'rgba(34,197,94,.12)',   icon: <Minus size={12} /> },
  medium:   { label: 'Medium',   color: '#f59e0b', dim: 'rgba(245,158,11,.12)',  icon: <AlertTriangle size={12} /> },
  high:     { label: 'High',     color: '#f97316', dim: 'rgba(249,115,22,.12)',  icon: <AlertOctagon size={12} /> },
  critical: { label: 'Critical', color: '#ef4444', dim: 'rgba(239,68,68,.12)',   icon: <Zap size={12} /> },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function MemberDot({ color, name, size = 28 }: { color: string | null; name: string | null; size?: number }) {
  const bg = color ?? '#64748b'
  return (
    <div
      className="cr-member-dot"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.36 }}
      title={name ?? undefined}
    >
      {initials(name)}
    </div>
  )
}

function ImpactBadge({ impact }: { impact: ChangeRequest['impact'] }) {
  const m = IMPACT_META[impact]
  return (
    <span className="cr-impact-badge" style={{ color: m.color, background: m.dim }}>
      {m.icon} {m.label}
    </span>
  )
}

function StatusBadge({ status }: { status: ChangeRequest['status'] }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending:      { label: 'Pending',      color: 'var(--warn)',            bg: 'var(--warn-dim)' },
    approved:     { label: 'Approved',     color: 'var(--green)',           bg: 'var(--green-dim)' },
    rejected:     { label: 'Rejected',     color: 'var(--bad)',             bg: 'var(--bad-dim)' },
    auto_approved:{ label: 'Auto-approved',color: 'var(--green)',           bg: 'var(--green-dim)' },
    rolled_back:  { label: 'Rolled back',  color: 'var(--text-secondary)',  bg: 'var(--bg-3)' },
  }
  const s = map[status] ?? map.pending
  return <span className="cr-status-badge" style={{ color: s.color, background: s.bg }}>{s.label}</span>
}

// ── Submit modal ──────────────────────────────────────────────────────────────

interface SubmitModalProps {
  orgs: OrgInfo[]
  onClose: () => void
  onCreated: (cr: ChangeRequest) => void
  token: string
  onPush: (n: { title: string; body: string; type: 'success' | 'error' | 'info'; category: 'job' | 'workspace' }) => void
}

function SubmitModal({ orgs, onClose, onCreated, token, onPush }: SubmitModalProps) {
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [actionType, setActionType] = useState('custom')
  const [impact, setImpact] = useState<ChangeRequest['impact']>('low')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!title.trim()) return
    setSaving(true)
    setErr('')
    try {
      const cr = await authFetch('/changes', token, {
        method: 'POST',
        body: JSON.stringify({ org_id: orgId, title: title.trim(), description: description.trim() || null, action_type: actionType, impact }),
      })
      onCreated(cr)
      onPush({
        category: 'workspace',
        title: 'Change request submitted',
        body: `"${title.trim()}" is pending review`,
        type: 'info',
      })
      onClose()
    } catch (e) {
      setErr(String(e))
      setSaving(false)
    }
  }

  return (
    <div className="cr-modal-overlay" onClick={onClose}>
      <div className="cr-modal" onClick={e => e.stopPropagation()}>
        <div className="cr-modal-header">
          <span>Submit change request</span>
          <button className="cr-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {orgs.length > 1 && (
          <div className="cr-field">
            <label className="cr-label">Workspace</label>
            <select className="cr-select" value={orgId} onChange={e => setOrgId(e.target.value)}>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}

        <div className="cr-field">
          <label className="cr-label">Title <span className="cr-req">*</span></label>
          <input className="cr-input" placeholder="What are you proposing?" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        </div>

        <div className="cr-field">
          <label className="cr-label">Description <span className="cr-opt">(optional)</span></label>
          <textarea className="cr-textarea" placeholder="Add context, links, or rationale…" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
        </div>

        <div className="cr-field">
          <label className="cr-label">Action type</label>
          <select className="cr-select" value={actionType} onChange={e => setActionType(e.target.value)}>
            <option value="custom">General / other</option>
            <option value="dataset_upload">Dataset upload</option>
            <option value="dataset_delete">Dataset delete</option>
            <option value="pipeline_create">Pipeline create</option>
            <option value="pipeline_run">Pipeline run</option>
            <option value="config_change">Config change</option>
          </select>
        </div>

        <div className="cr-field">
          <label className="cr-label">Impact level</label>
          <div className="cr-impact-grid">
            {IMPACTS.map(imp => {
              const m = IMPACT_META[imp]
              return (
                <button
                  key={imp}
                  type="button"
                  className={`cr-impact-opt${impact === imp ? ' sel' : ''}`}
                  style={impact === imp ? { borderColor: m.color, background: m.dim } : {}}
                  onClick={() => setImpact(imp)}
                >
                  <span style={{ color: m.color }}>{m.icon}</span>
                  {m.label}
                  {imp === 'low' && <span className="cr-auto-hint">auto-approves in 24h</span>}
                </button>
              )
            })}
          </div>
        </div>

        {err && <div className="cr-error">{err}</div>}

        <div className="cr-modal-footer">
          <button className="cr-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="cr-btn-primary" disabled={!title.trim() || saving} onClick={submit}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Submit request
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Approve modal ─────────────────────────────────────────────────────────────

function ApproveModal({ cr, token, onDone, onClose }: { cr: ChangeRequest; token: string; onDone: (updated: ChangeRequest) => void; onClose: () => void }) {
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const updated = await authFetch(`/changes/${cr.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'approve', comment: comment.trim() || null }),
      })
      onDone(updated)
      onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="cr-modal-overlay" onClick={onClose}>
      <div className="cr-modal" onClick={e => e.stopPropagation()}>
        <div className="cr-modal-header">
          <span>Approve change request</span>
          <button className="cr-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <p className="cr-modal-sub">Optionally add a note — it will be visible to the submitter.</p>
        <div className="cr-field">
          <label className="cr-label">Note <span className="cr-opt">(optional)</span></label>
          <textarea className="cr-textarea" placeholder="e.g. Looks good, approved for production…" value={comment} onChange={e => setComment(e.target.value)} rows={3} autoFocus />
        </div>
        <div className="cr-modal-footer">
          <button className="cr-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="cr-btn-approve" disabled={saving} onClick={submit}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Approve
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Reject modal ──────────────────────────────────────────────────────────────

function RejectModal({ cr, token, onDone, onClose }: { cr: ChangeRequest; token: string; onDone: (updated: ChangeRequest) => void; onClose: () => void }) {
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const updated = await authFetch(`/changes/${cr.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reject', comment: comment.trim() || null }),
      })
      onDone(updated)
      onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="cr-modal-overlay" onClick={onClose}>
      <div className="cr-modal" onClick={e => e.stopPropagation()}>
        <div className="cr-modal-header">
          <span>Reject change request</span>
          <button className="cr-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <p className="cr-modal-sub">Optionally explain why — this will be shown to the submitter.</p>
        <div className="cr-field">
          <label className="cr-label">Comment <span className="cr-opt">(optional)</span></label>
          <textarea className="cr-textarea" placeholder="e.g. Please reduce the dataset size first…" value={comment} onChange={e => setComment(e.target.value)} rows={3} autoFocus />
        </div>
        <div className="cr-modal-footer">
          <button className="cr-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="cr-btn-danger" disabled={saving} onClick={submit}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Rollback modal ────────────────────────────────────────────────────────────

function RollbackModal({ cr, token, onDone, onClose }: { cr: ChangeRequest; token: string; onDone: (updated: ChangeRequest) => void; onClose: () => void }) {
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const updated = await authFetch(`/changes/${cr.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'rollback', comment: comment.trim() || null }),
      })
      onDone(updated)
      onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="cr-modal-overlay" onClick={onClose}>
      <div className="cr-modal" onClick={e => e.stopPropagation()}>
        <div className="cr-modal-header">
          <span>Roll back approval</span>
          <button className="cr-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <p className="cr-modal-sub">
          This will un-approve <strong>"{cr.title}"</strong> and notify the submitter. They can then edit and resubmit.
        </p>
        <div className="cr-field">
          <label className="cr-label">Reason <span className="cr-opt">(optional)</span></label>
          <textarea className="cr-textarea" placeholder="e.g. Found a conflict with the upcoming release…" value={comment} onChange={e => setComment(e.target.value)} rows={3} autoFocus />
        </div>
        <div className="cr-modal-footer">
          <button className="cr-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="cr-btn-rollback" disabled={saving} onClick={submit}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
            Roll back
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Resubmit modal ────────────────────────────────────────────────────────────

function ResubmitModal({ cr, token, onDone, onClose }: { cr: ChangeRequest; token: string; onDone: (updated: ChangeRequest) => void; onClose: () => void }) {
  const [title, setTitle] = useState(cr.title)
  const [description, setDescription] = useState(cr.description ?? '')
  const [impact, setImpact] = useState<ChangeRequest['impact']>(cr.impact)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const updated = await authFetch(`/changes/${cr.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'resubmit', title, description: description.trim() || null, impact }),
      })
      onDone(updated)
      onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="cr-modal-overlay" onClick={onClose}>
      <div className="cr-modal" onClick={e => e.stopPropagation()}>
        <div className="cr-modal-header">
          <span>Resubmit change request</span>
          <button className="cr-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        {cr.reviewer_comment && (
          <div className="cr-reviewer-note">
            <strong>Reviewer said:</strong> {cr.reviewer_comment}
          </div>
        )}
        {cr.rollback_comment && (
          <div className="cr-reviewer-note rollback">
            <strong>Rolled back because:</strong> {cr.rollback_comment}
          </div>
        )}
        <div className="cr-field">
          <label className="cr-label">Title</label>
          <input className="cr-input" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="cr-field">
          <label className="cr-label">Description</label>
          <textarea className="cr-textarea" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="cr-field">
          <label className="cr-label">Impact level</label>
          <div className="cr-impact-grid">
            {IMPACTS.map(imp => {
              const m = IMPACT_META[imp]
              return (
                <button key={imp} type="button" className={`cr-impact-opt${impact === imp ? ' sel' : ''}`}
                  style={impact === imp ? { borderColor: m.color, background: m.dim } : {}}
                  onClick={() => setImpact(imp)}>
                  <span style={{ color: m.color }}>{m.icon}</span>{m.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="cr-modal-footer">
          <button className="cr-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="cr-btn-primary" disabled={!title.trim() || saving} onClick={submit}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            Resubmit
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Change request card ───────────────────────────────────────────────────────

interface CardProps {
  cr: ChangeRequest
  myUserId: string
  myRole: string
  token: string
  onUpdate: (updated: ChangeRequest) => void
  highlighted?: boolean
}

function CRCard({ cr, myUserId, myRole, token, onUpdate, highlighted }: CardProps) {
  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showRollback, setShowRollback] = useState(false)
  const [showResubmit, setShowResubmit] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const isReviewer = myRole === 'owner' || myRole === 'reviewer'

  const canApprove =
    cr.status === 'pending' &&
    (myRole === 'owner' || (myRole === 'reviewer' && (cr.impact === 'low' || cr.impact === 'medium')))

  const canRollback =
    (cr.status === 'approved' || cr.status === 'auto_approved') &&
    (myRole === 'owner' || (myRole === 'reviewer' && cr.reviewer_id === myUserId))

  const canResubmit = (cr.status === 'rejected' || cr.status === 'rolled_back') && cr.user_id === myUserId

  return (
    <>
      <div id={`cr-${cr.id}`} className={`cr-card${highlighted ? ' highlighted' : ''}`}>
        <div className="cr-card-top">
          <MemberDot color={cr.user_color} name={cr.user_name} />
          <div className="cr-card-meta">
            <span className="cr-card-author">{cr.user_name ?? 'Unknown'}</span>
            <span className="cr-card-time">{relTime(cr.created_at)}</span>
          </div>
          <ImpactBadge impact={cr.impact} />
          <StatusBadge status={cr.status} />
        </div>

        <div className="cr-card-title" onClick={() => setExpanded(!expanded)}>
          {cr.title}
          {cr.description && <ChevronDown size={13} className={`cr-expand-icon${expanded ? ' open' : ''}`} />}
        </div>

        {expanded && cr.description && (
          <div className="cr-card-desc">{cr.description}</div>
        )}

        {/* Reviewer approval note */}
        {cr.reviewer_comment && cr.status === 'approved' && (
          <div className="cr-reviewer-note approved sm">
            <MemberDot color={null} name={cr.reviewer_name} size={18} />
            <span><strong>{cr.reviewer_name ?? 'Reviewer'}:</strong> {cr.reviewer_comment}</span>
          </div>
        )}

        {/* Reviewer rejection note */}
        {cr.reviewer_comment && cr.status === 'rejected' && (
          <div className="cr-reviewer-note sm">
            <span><strong>Rejected:</strong> {cr.reviewer_comment}</span>
          </div>
        )}

        {/* Rollback note */}
        {cr.rollback_comment && cr.status === 'rolled_back' && (
          <div className="cr-reviewer-note rollback sm">
            <span><strong>Rolled back:</strong> {cr.rollback_comment}</span>
          </div>
        )}

        {cr.auto_approve_at && cr.status === 'pending' && (
          <div className="cr-auto-tag">
            <Clock size={11} /> Auto-approves {relTime(cr.auto_approve_at)} from now
          </div>
        )}

        {cr.resubmit_count > 0 && (
          <div className="cr-resubmit-tag">Resubmitted {cr.resubmit_count}×</div>
        )}

        {(canApprove || canRollback || canResubmit) && (
          <div className="cr-card-actions">
            {canApprove && (
              <>
                <button className="cr-btn-approve" onClick={() => setShowApprove(true)}>
                  <Check size={12} /> Approve
                </button>
                <button className="cr-btn-reject" onClick={() => setShowReject(true)}>
                  <X size={12} /> Reject
                </button>
              </>
            )}
            {canRollback && isReviewer && (
              <button className="cr-btn-rollback" onClick={() => setShowRollback(true)}>
                <Undo2 size={12} /> Roll back
              </button>
            )}
            {canResubmit && (
              <button className="cr-btn-resubmit" onClick={() => setShowResubmit(true)}>
                <RotateCcw size={12} /> Resubmit
              </button>
            )}
          </div>
        )}
      </div>

      {showApprove && (
        <ApproveModal cr={cr} token={token} onDone={onUpdate} onClose={() => setShowApprove(false)} />
      )}
      {showReject && (
        <RejectModal cr={cr} token={token} onDone={onUpdate} onClose={() => setShowReject(false)} />
      )}
      {showRollback && (
        <RollbackModal cr={cr} token={token} onDone={onUpdate} onClose={() => setShowRollback(false)} />
      )}
      {showResubmit && (
        <ResubmitModal cr={cr} token={token} onDone={onUpdate} onClose={() => setShowResubmit(false)} />
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ChangesBoard() {
  const { accessToken, user } = useAuth()
  const { push } = useNotifications()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [orgs, setOrgs] = useState<OrgInfo[]>([])
  const [selectedOrg, setSelectedOrg] = useState<OrgInfo | null>(null)
  const [changes, setChanges] = useState<ChangeRequest[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [loading, setLoading] = useState(true)
  const [showSubmit, setShowSubmit] = useState(false)

  const token = accessToken()!
  const highlightCrId = searchParams.get('cr')
  const scrolledRef = useRef(false)

  const load = useCallback(async (orgId: string, status: string) => {
    setLoading(true)
    scrolledRef.current = false
    try {
      const params = new URLSearchParams({ org_id: orgId })
      if (status !== 'all') params.set('status', status)
      const data = await authFetch(`/changes?${params}`, token)
      setChanges(data)
    } catch {
      setChanges([])
    } finally {
      setLoading(false)
    }
  }, [token])

  // Scroll to & highlight the targeted CR after data loads
  useEffect(() => {
    if (!highlightCrId || loading || scrolledRef.current) return
    const el = document.getElementById(`cr-${highlightCrId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      scrolledRef.current = true
    }
  }, [highlightCrId, loading, changes])

  useEffect(() => {
    authFetch('/orgs', token).then((data: OrgInfo[]) => {
      setOrgs(data)
      const orgIdParam = searchParams.get('org')
      const org = data.find(o => o.id === orgIdParam) ?? data[0] ?? null
      setSelectedOrg(org)
      if (org) load(org.id, statusFilter)
      else setLoading(false)
    }).catch(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOrgChange = (orgId: string) => {
    const org = orgs.find(o => o.id === orgId) ?? null
    setSelectedOrg(org)
    if (org) load(org.id, statusFilter)
  }

  const handleStatusChange = (s: string) => {
    setStatusFilter(s)
    if (selectedOrg) load(selectedOrg.id, s)
  }

  const handleUpdate = (updated: ChangeRequest) => {
    setChanges(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  const handleCreated = (cr: ChangeRequest) => {
    setChanges(prev => [cr, ...prev])
  }

  const myRole = selectedOrg?.role ?? 'member'
  const isReviewer = myRole === 'owner' || myRole === 'reviewer'

  // Kanban: pending view for owners/reviewers only
  const showKanban = statusFilter === 'pending' && isReviewer

  const byImpact = showKanban
    ? Object.fromEntries(IMPACTS.map(imp => [imp, changes.filter(c => c.impact === imp)]))
    : null

  if (!loading && orgs.length === 0) {
    return (
      <div className="changes-page">
        <div className="changes-empty-state">
          <p>You are not a member of any workspace yet.</p>
          <button className="cr-btn-primary" onClick={() => navigate('/orgs')}>Go to Workspaces</button>
        </div>
      </div>
    )
  }

  return (
    <div className="changes-page">
      <div className="changes-header">
        <div>
          <h1 className="changes-title">Change Requests</h1>
          <p className="changes-sub">
            {isReviewer ? 'Review and approve workspace changes.' : 'Track your submitted change requests.'}
          </p>
        </div>
        <div className="changes-header-right">
          {orgs.length > 1 && (
            <select className="cr-select sm" value={selectedOrg?.id ?? ''} onChange={e => handleOrgChange(e.target.value)}>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <button className="cr-btn-primary" onClick={() => setShowSubmit(true)}>
            <Plus size={14} /> New request
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="changes-tabs">
        {['pending', 'approved', 'rejected', 'rolled_back', 'all'].map(s => (
          <button key={s} className={`changes-tab${statusFilter === s ? ' active' : ''}`} onClick={() => handleStatusChange(s)}>
            {s === 'all' ? 'All' : s === 'rolled_back' ? 'Rolled back' : s.charAt(0).toUpperCase() + s.slice(1)}
            {s === 'pending' && changes.filter(c => c.status === 'pending').length > 0 && statusFilter !== 'pending' && (
              <span className="changes-tab-badge">{changes.filter(c => c.status === 'pending').length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="changes-loading">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : showKanban ? (
        /* ── Kanban board ── */
        <div className="kanban-board">
          {IMPACTS.map(imp => {
            const cards = byImpact![imp]
            const m = IMPACT_META[imp]
            return (
              <div key={imp} className="kanban-col">
                <div className="kanban-col-header" style={{ borderTopColor: m.color }}>
                  <span style={{ color: m.color }}>{m.icon}</span>
                  <span>{m.label}</span>
                  <span className="kanban-count">{cards.length}</span>
                </div>
                <div className="kanban-col-body">
                  {cards.length === 0 ? (
                    <div className="kanban-empty">No pending {m.label.toLowerCase()} changes</div>
                  ) : (
                    cards.map(cr => (
                      <CRCard
                        key={cr.id}
                        cr={cr}
                        myUserId={user?.id ?? ''}
                        myRole={myRole}
                        token={token}
                        onUpdate={handleUpdate}
                        highlighted={cr.id === highlightCrId}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── List view ── */
        <div className="changes-list">
          {changes.length === 0 ? (
            <div className="changes-empty">
              No {statusFilter === 'all' ? '' : statusFilter === 'rolled_back' ? 'rolled-back' : statusFilter} change requests yet.
            </div>
          ) : (
            changes.map(cr => (
              <CRCard
                key={cr.id}
                cr={cr}
                myUserId={user?.id ?? ''}
                myRole={myRole}
                token={token}
                onUpdate={handleUpdate}
                highlighted={cr.id === highlightCrId}
              />
            ))
          )}
        </div>
      )}

      {showSubmit && (
        <SubmitModal orgs={orgs} onClose={() => setShowSubmit(false)} onCreated={handleCreated} token={token} onPush={push} />
      )}
    </div>
  )
}
