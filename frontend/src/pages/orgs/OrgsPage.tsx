import { useState, useEffect } from 'react'
import { Plus, Users, Copy, Check, Loader2, X, Link, RefreshCw, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import './OrgsPage.css'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL ?? window.location.origin

function authFetch(path: string, token: string, init?: RequestInit) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  }).then(r => r.ok ? r.json() : r.json().then((e: { detail?: string }) => Promise.reject(e.detail ?? 'Request failed')))
}

interface Org { id: string; name: string; slug: string; role: string; member_count: number; created_at: string }
interface Member { user_id: string; email: string; role: string; joined_at: string }
interface InviteLink { id: string; token: string; expires_at: string; disabled: boolean; created_at: string }

export default function OrgsPage() {
  const { accessToken, user } = useAuth()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [selected, setSelected] = useState<Org | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [inviteLink, setInviteLink] = useState<InviteLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)

  // Create org
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState('')

  // Invite by email
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'reviewer'>('member')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Link state
  const [linkCopied, setLinkCopied] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)

  const tok = () => accessToken()!

  const loadOrgs = async () => {
    const data = await authFetch('/orgs', tok()).catch(() => [])
    setOrgs(data)
    setLoading(false)
  }

  const loadDetail = async (org: Org) => {
    setSelected(org)
    setMembersLoading(true)
    setInviteLink(null)
    const [mems, link] = await Promise.all([
      authFetch(`/orgs/${org.id}/members`, tok()).catch(() => []),
      org.role === 'owner'
        ? authFetch(`/orgs/${org.id}/invite-link`, tok()).catch(() => null)
        : Promise.resolve(null),
    ])
    setMembers(mems)
    setInviteLink(link)
    setMembersLoading(false)
  }

  useEffect(() => { loadOrgs() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toSlug = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 24)

  const createOrg = async () => {
    if (!newName.trim() || !newSlug.trim()) return
    setCreating(true)
    setCreateErr('')
    try {
      const org = await authFetch('/orgs', tok(), {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), slug: newSlug.trim() }),
      })
      setOrgs(prev => [org, ...prev])
      setShowCreate(false)
      setNewName('')
      setNewSlug('')
      loadDetail(org)
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
      await authFetch(`/orgs/${selected.id}/members`, tok(), {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      setInviteMsg({ ok: true, text: `${inviteEmail} added as ${inviteRole}` })
      setInviteEmail('')
      const mems = await authFetch(`/orgs/${selected.id}/members`, tok()).catch(() => [])
      setMembers(mems)
    } catch (e: unknown) {
      setInviteMsg({ ok: false, text: typeof e === 'string' ? e : 'Invite failed' })
    } finally {
      setInviting(false)
    }
  }

  const removeMember = async (userId: string) => {
    if (!selected) return
    await authFetch(`/orgs/${selected.id}/members/${userId}`, tok(), { method: 'DELETE' }).catch(() => {})
    setMembers(prev => prev.filter(m => m.user_id !== userId))
  }

  const generateLink = async () => {
    if (!selected) return
    setGeneratingLink(true)
    try {
      const link = await authFetch(`/orgs/${selected.id}/invite-link`, tok(), { method: 'POST' })
      setInviteLink(link)
    } finally {
      setGeneratingLink(false)
    }
  }

  const disableLink = async () => {
    if (!selected) return
    await authFetch(`/orgs/${selected.id}/invite-link`, tok(), { method: 'DELETE' }).catch(() => {})
    setInviteLink(null)
  }

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${FRONTEND_URL}/join/${token}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const isOwner = selected?.role === 'owner'

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
          <p className="orgs-sub">Collaborate with your team. Invite members and manage approvals.</p>
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
              A workspace lets you collaborate with teammates and manage change approvals.
            </p>
            <label className="orgs-label">Workspace name</label>
            <input
              className="orgs-input"
              placeholder="Acme Data Team"
              value={newName}
              onChange={e => { setNewName(e.target.value); setNewSlug(toSlug(e.target.value)) }}
              autoFocus
            />
            <label className="orgs-label" style={{ marginTop: '0.75rem' }}>URL slug</label>
            <input
              className="orgs-input"
              placeholder="acme-data-team"
              value={newSlug}
              onChange={e => setNewSlug(toSlug(e.target.value))}
            />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
              datrix.ai/orgs/{newSlug || 'your-slug'}
            </p>
            {createErr && <p className="orgs-err">{createErr}</p>}
            <div className="orgs-modal-actions">
              <button className="orgs-cancel-btn" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="orgs-submit-btn" onClick={createOrg} disabled={creating || !newName.trim() || !newSlug.trim()}>
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
              onClick={() => loadDetail(org)}
            >
              <div className="orgs-card-logo">{org.name[0].toUpperCase()}</div>
              <div className="orgs-card-info">
                <div className="orgs-card-name">{org.name}</div>
                <div className="orgs-card-slug">{org.member_count} member{org.member_count !== 1 ? 's' : ''}</div>
              </div>
              <span className={`orgs-role-badge ${org.role}`}>{org.role}</span>
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
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>/{selected.slug}</span>
                </div>
              </div>
            </div>

            {/* ── Invite link section (owner only) ── */}
            {isOwner && (
              <div className="orgs-link-section">
                <div className="orgs-section-header">
                  <div className="orgs-section-label-row">
                    <Link size={14} style={{ color: 'var(--accent)' }} />
                    <span className="orgs-section-label">Invite link</span>
                  </div>
                  <p className="orgs-section-desc">Share a link so anyone can join this workspace directly. Valid for 7 days.</p>
                </div>

                {inviteLink ? (
                  <div className="orgs-link-box">
                    <span className="orgs-link-url">{FRONTEND_URL}/join/{inviteLink.token}</span>
                    <div className="orgs-link-actions">
                      <button className="orgs-link-btn" onClick={() => copyLink(inviteLink.token)}>
                        {linkCopied ? <Check size={13} /> : <Copy size={13} />}
                        {linkCopied ? 'Copied!' : 'Copy'}
                      </button>
                      <button className="orgs-link-btn" onClick={generateLink} disabled={generatingLink}>
                        <RefreshCw size={13} /> New link
                      </button>
                      <button className="orgs-link-btn danger" onClick={disableLink}>
                        <X size={13} /> Disable
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="orgs-gen-link-btn" onClick={generateLink} disabled={generatingLink}>
                    {generatingLink ? <Loader2 size={13} className="animate-spin" /> : <Link size={13} />}
                    Generate invite link
                  </button>
                )}
              </div>
            )}

            {/* ── Members ── */}
            <div className="orgs-members-section">
              <div className="orgs-section-header">
                <div className="orgs-section-label-row">
                  <Users size={14} style={{ color: 'var(--accent)' }} />
                  <span className="orgs-section-label">Members</span>
                </div>
              </div>

              {/* Invite by email (owner only) */}
              {isOwner && (
                <div className="orgs-invite-block">
                  <div className="orgs-invite-row">
                    <input
                      className="orgs-input"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && invite()}
                    />
                    <select
                      className="orgs-role-select"
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as 'member' | 'reviewer')}
                    >
                      <option value="member">Member</option>
                      <option value="reviewer">Reviewer</option>
                    </select>
                    <button className="orgs-invite-btn" onClick={invite} disabled={inviting || !inviteEmail.trim()}>
                      {inviting ? <Loader2 size={13} className="animate-spin" /> : 'Add'}
                    </button>
                  </div>
                  {inviteMsg && (
                    <p style={{ fontSize: '0.75rem', color: inviteMsg.ok ? 'var(--green)' : 'var(--bad)', margin: '0.35rem 0 0' }}>
                      {inviteMsg.text}
                    </p>
                  )}
                </div>
              )}

              {membersLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
                </div>
              ) : (
                <div className="orgs-members-list">
                  {members.map(m => (
                    <div key={m.user_id} className="orgs-member-row">
                      <div className="orgs-member-avatar">{m.email[0].toUpperCase()}</div>
                      <div className="orgs-member-info">
                        <div className="orgs-member-name">{m.email}</div>
                        <div className="orgs-member-role-row">
                          {m.role === 'reviewer' && <ShieldCheck size={11} style={{ color: 'var(--accent)' }} />}
                          <span className={`orgs-member-role-badge ${m.role}`}>{m.role}</span>
                        </div>
                      </div>
                      {isOwner && m.user_id !== user?.id && (
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
