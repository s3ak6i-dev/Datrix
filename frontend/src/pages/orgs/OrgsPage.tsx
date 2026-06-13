import { useState, useEffect } from 'react'
import { Plus, Users, Copy, Check, Loader2, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import './OrgsPage.css'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function authFetch(path: string, token: string, init?: RequestInit) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  }).then(r => r.ok ? r.json() : r.json().then((e: { detail: string }) => Promise.reject(e.detail)))
}

interface Org { id: string; name: string; slug: string; owner_id: string; created_at: string }
interface Member { id: string; user_id: string; role: string; email?: string; created_at: string }

export default function OrgsPage() {
  const { accessToken, user } = useAuth()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [selected, setSelected] = useState<Org | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)

  // Create org
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState('')

  // Invite member
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [copied, setCopied] = useState(false)

  const token = () => accessToken()!

  const loadOrgs = async () => {
    const t = token()
    const data = await authFetch('/orgs', t).catch(() => [])
    setOrgs(data)
    setLoading(false)
  }

  const loadMembers = async (org: Org) => {
    setSelected(org)
    setMembersLoading(true)
    const data = await authFetch(`/orgs/${org.id}/members`, token()).catch(() => [])
    setMembers(data)
    setMembersLoading(false)
  }

  useEffect(() => { loadOrgs() }, [])

  const createOrg = async () => {
    if (!newName.trim()) return
    setCreating(true)
    setCreateErr('')
    try {
      const org = await authFetch('/orgs', token(), {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      })
      setOrgs(prev => [org, ...prev])
      setShowCreate(false)
      setNewName('')
      loadMembers(org)
    } catch (e: unknown) {
      setCreateErr(typeof e === 'string' ? e : 'Failed to create workspace')
    } finally {
      setCreating(false)
    }
  }

  const invite = async () => {
    if (!selected || !inviteEmail.trim()) return
    setInviting(true)
    setInviteMsg(null)
    try {
      await authFetch(`/orgs/${selected.id}/members`, token(), {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      setInviteMsg({ ok: true, text: `Invite sent to ${inviteEmail}` })
      setInviteEmail('')
      loadMembers(selected)
    } catch (e: unknown) {
      setInviteMsg({ ok: false, text: typeof e === 'string' ? e : 'Invite failed' })
    } finally {
      setInviting(false)
    }
  }

  const removeMember = async (userId: string) => {
    if (!selected) return
    await authFetch(`/orgs/${selected.id}/members/${userId}`, token(), { method: 'DELETE' }).catch(() => {})
    setMembers(prev => prev.filter(m => m.user_id !== userId))
  }

  const copySlug = (slug: string) => {
    navigator.clipboard.writeText(slug)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div className="orgs-page">
      <div className="orgs-header">
        <div>
          <h1>Workspaces</h1>
          <p className="orgs-sub">Collaborate with your team in shared workspaces.</p>
        </div>
        <button className="orgs-create-btn" onClick={() => setShowCreate(true)}>
          <Plus size={15} /> New workspace
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="orgs-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="orgs-modal" onClick={e => e.stopPropagation()}>
            <h2>Create workspace</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              A workspace lets you collaborate with teammates on datasets and pipelines.
            </p>
            <label className="orgs-label">Workspace name</label>
            <input
              className="orgs-input"
              placeholder="Acme Data Team"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createOrg()}
              autoFocus
            />
            {createErr && <p className="orgs-err">{createErr}</p>}
            <div className="orgs-modal-actions">
              <button className="orgs-cancel-btn" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="orgs-submit-btn" onClick={createOrg} disabled={creating || !newName.trim()}>
                {creating ? <Loader2 size={13} className="animate-spin" /> : null}
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="orgs-layout">
        {/* Org list */}
        <div className="orgs-list-col">
          {orgs.length === 0 ? (
            <div className="orgs-empty">
              <Users size={28} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
              <p>No workspaces yet</p>
              <button className="orgs-create-btn" style={{ marginTop: 8 }} onClick={() => setShowCreate(true)}>
                <Plus size={13} /> Create one
              </button>
            </div>
          ) : orgs.map(org => (
            <div
              key={org.id}
              className={`orgs-card${selected?.id === org.id ? ' active' : ''}`}
              onClick={() => loadMembers(org)}
            >
              <div className="orgs-card-logo">{org.name[0].toUpperCase()}</div>
              <div className="orgs-card-info">
                <div className="orgs-card-name">{org.name}</div>
                <div className="orgs-card-slug">{org.slug}</div>
              </div>
              {org.owner_id === user?.id && (
                <span className="orgs-owner-badge">Owner</span>
              )}
            </div>
          ))}
        </div>

        {/* Org detail */}
        {selected && (
          <div className="orgs-detail">
            <div className="orgs-detail-header">
              <div>
                <h2>{selected.name}</h2>
                <div className="orgs-slug-row">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{selected.slug}</span>
                  <button className="orgs-copy-btn" onClick={() => copySlug(selected.slug)}>
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="orgs-members-section">
              <p className="orgs-section-label">Members</p>

              {/* Invite */}
              {selected.owner_id === user?.id && (
                <div className="orgs-invite-row">
                  <input
                    className="orgs-input"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && invite()}
                  />
                  <button className="orgs-invite-btn" onClick={invite} disabled={inviting || !inviteEmail.trim()}>
                    {inviting ? <Loader2 size={13} className="animate-spin" /> : 'Invite'}
                  </button>
                </div>
              )}

              {inviteMsg && (
                <p style={{ fontSize: '0.75rem', color: inviteMsg.ok ? 'var(--green)' : 'var(--bad)', marginBottom: 8 }}>
                  {inviteMsg.text}
                </p>
              )}

              {membersLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
                </div>
              ) : (
                <div className="orgs-members-list">
                  {members.map(m => (
                    <div key={m.id} className="orgs-member-row">
                      <div className="orgs-member-avatar">{(m.email ?? m.user_id)[0].toUpperCase()}</div>
                      <div className="orgs-member-info">
                        <div className="orgs-member-name">{m.email ?? m.user_id.slice(0, 12) + '…'}</div>
                        <div className="orgs-member-role">{m.role}</div>
                      </div>
                      {selected.owner_id === user?.id && m.user_id !== user?.id && (
                        <button className="orgs-remove-btn" onClick={() => removeMember(m.user_id)}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
