import { useState, useEffect } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import './ProfilePage.css'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const ROLES = [
  'Data Engineer', 'ML Engineer', 'Data Scientist', 'Data Analyst',
  'Product Manager', 'Researcher', 'Developer', 'Other',
]

const USE_CASES = [
  { id: 'clean',      label: 'Clean & validate data' },
  { id: 'synthetic',  label: 'Generate synthetic data' },
  { id: 'benchmark',  label: 'Benchmark ML models' },
  { id: 'label',      label: 'Label & annotate data' },
  { id: 'compliance', label: 'Compliance & privacy' },
  { id: 'pipeline',   label: 'Build data pipelines' },
]

interface Profile {
  full_name: string | null
  role: string | null
  company: string | null
  use_cases: string[]
  avatar_url: string | null
}

interface UserInfo {
  email: string
  email_verified: boolean
}

function authGet(path: string, token: string) {
  return fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
}

function authPut(path: string, token: string, body: unknown) {
  return fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).then(r => { if (!r.ok) throw new Error('Save failed'); return r.json() })
}

export default function ProfilePage() {
  const { accessToken } = useAuth()

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [useCases, setUseCases] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [resendSent, setResendSent] = useState(false)

  // Password change fields
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    const token = accessToken()
    if (!token) return
    Promise.all([
      authGet('/auth/me', token),
      authGet('/profile/me', token),
    ]).then(([user, profile]: [UserInfo, Profile]) => {
      setUserInfo(user)
      setFullName(profile.full_name ?? '')
      setCompany(profile.company ?? '')
      setRole(profile.role ?? '')
      setAvatarUrl(profile.avatar_url ?? '')
      setUseCases(profile.use_cases ?? [])
    }).finally(() => setLoading(false))
  }, [accessToken])

  const save = async () => {
    const token = accessToken()
    if (!token) return
    setSaving(true)
    try {
      await authPut('/profile/me', token, {
        full_name: fullName.trim() || null,
        role: role || null,
        company: company.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        use_cases: useCases,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const resendVerification = async () => {
    const token = accessToken()
    if (!token) return
    await fetch(`${BASE}/auth/resend-verification`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    setResendSent(true)
  }

  const savePassword = async () => {
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: "Passwords don't match" }); return }
    if (newPw.length < 8) { setPwMsg({ ok: false, text: 'Minimum 8 characters' }); return }
    const token = accessToken()
    if (!token) return
    setPwSaving(true)
    setPwMsg(null)
    try {
      const r = await fetch(`${BASE}/profile/me/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: newPw }),
      })
      if (r.ok) {
        setPwMsg({ ok: true, text: 'Password updated' })
        setNewPw(''); setConfirmPw('')
      } else {
        const e = await r.json()
        setPwMsg({ ok: false, text: e.detail ?? 'Failed' })
      }
    } finally {
      setPwSaving(false)
    }
  }

  const toggleUseCase = (id: string) =>
    setUseCases(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const initials = fullName.trim()
    ? fullName.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : userInfo?.email?.[0]?.toUpperCase() ?? '?'

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div className="profile-page">
      <h1>Your profile</h1>
      <p className="profile-sub">Manage your personal information and preferences.</p>

      {/* Account info */}
      <div className="profile-section">
        <p className="profile-section-title">Account</p>

        <div className="profile-avatar-row">
          <div className="profile-avatar">
            {avatarUrl ? <img src={avatarUrl} alt="avatar" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} /> : initials}
          </div>
          <div className="profile-avatar-info">
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {fullName || userInfo?.email?.split('@')[0] || 'You'}
            </div>
            <div className="profile-avatar-email">
              {userInfo?.email}
              {userInfo?.email_verified
                ? <span className="profile-verified-badge">Verified</span>
                : <span className="profile-unverified-badge">Unverified</span>
              }
            </div>
            {!userInfo?.email_verified && (
              <button className="profile-resend-btn" style={{ marginTop: 6 }} onClick={resendVerification} disabled={resendSent}>
                {resendSent ? 'Sent!' : 'Resend verification email'}
              </button>
            )}
          </div>
        </div>

        <div className="profile-field">
          <label className="profile-label">Full name</label>
          <input className="profile-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" />
        </div>

        <div className="profile-field">
          <label className="profile-label">Company / team <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
          <input className="profile-input" value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Corp" />
        </div>

        <div className="profile-field">
          <label className="profile-label">Avatar URL <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
          <input className="profile-input" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." />
        </div>
      </div>

      {/* Role */}
      <div className="profile-section">
        <p className="profile-section-title">Role</p>
        <div className="profile-role-grid">
          {ROLES.map(r => (
            <button key={r} type="button" className={`profile-role-btn${role === r ? ' sel' : ''}`} onClick={() => setRole(r)}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', border: '1.5px solid currentColor', flexShrink: 0, background: role === r ? 'currentColor' : 'transparent' }} />
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Use cases */}
      <div className="profile-section">
        <p className="profile-section-title">What I use Datrix for</p>
        <div className="profile-use-chips">
          {USE_CASES.map(uc => (
            <button key={uc.id} type="button" className={`profile-use-chip${useCases.includes(uc.id) ? ' sel' : ''}`} onClick={() => toggleUseCase(uc.id)}>
              {useCases.includes(uc.id) && <Check size={11} />}
              {uc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="profile-actions">
        <button className="profile-save-btn" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && (
          <span className="profile-saved-msg"><Check size={13} /> Saved</span>
        )}
      </div>

      {/* Change password */}
      {userInfo && (
        <div className="profile-section" style={{ marginTop: '1.25rem' }}>
          <p className="profile-section-title">Security</p>
          <div className="profile-change-pw">
            <p className="profile-change-pw-title">Change password</p>
            <div className="profile-field">
              <label className="profile-label">New password</label>
              <input className="profile-input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="8+ characters" autoComplete="new-password" />
            </div>
            <div className="profile-field">
              <label className="profile-label">Confirm password</label>
              <input className="profile-input" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Same as above" autoComplete="new-password" />
            </div>
            {pwMsg && (
              <p style={{ fontSize: '0.78rem', color: pwMsg.ok ? 'var(--green)' : 'var(--bad)', marginBottom: 8 }}>
                {pwMsg.text}
              </p>
            )}
            <button className="profile-save-btn" onClick={savePassword} disabled={pwSaving || !newPw}>
              {pwSaving ? <Loader2 size={14} className="animate-spin" /> : null}
              {pwSaving ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
