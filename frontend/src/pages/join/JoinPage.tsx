import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, Check, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import './JoinPage.css'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e',
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1',
  '#8b5cf6', '#ec4899', '#64748b', '#14b8a6',
]

interface OrgInfo {
  org_id: string
  org_name: string
  org_slug: string
}

export default function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { loginWithTokens } = useAuth()

  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [loadingInfo, setLoadingInfo] = useState(true)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [color, setColor] = useState(PALETTE[6]) // default blue
  const [joining, setJoining] = useState(false)
  const [joinErr, setJoinErr] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) { setLoadErr('Invalid invite link.'); setLoadingInfo(false); return }
    fetch(`${BASE}/join/${token}`)
      .then(r => r.ok ? r.json() : r.json().then((e: { detail?: string }) => Promise.reject(e.detail ?? 'Link not found')))
      .then(data => { setOrgInfo(data); setLoadingInfo(false) })
      .catch(e => { setLoadErr(String(e)); setLoadingInfo(false) })
  }, [token])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setJoining(true)
    setJoinErr('')
    try {
      const res = await fetch(`${BASE}/join/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name.trim(), email, password, color }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Something went wrong')

      // Store tokens and redirect to home
      loginWithTokens({ access_token: data.access_token, refresh_token: data.refresh_token })
      setDone(true)
      setTimeout(() => navigate('/home', { replace: true }), 1200)
    } catch (err) {
      setJoinErr(err instanceof Error ? err.message : String(err))
      setJoining(false)
    }
  }

  if (loadingInfo) {
    return (
      <div className="join-shell">
        <div className="join-card">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)', margin: '2rem auto', display: 'block' }} />
        </div>
      </div>
    )
  }

  if (loadErr) {
    return (
      <div className="join-shell">
        <div className="join-card">
          <div className="join-brand">Datrix</div>
          <h2 className="join-title">Link unavailable</h2>
          <p className="join-sub" style={{ color: 'var(--bad)' }}>{loadErr}</p>
          <button className="join-btn" onClick={() => navigate('/login')}>Go to login</button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="join-shell">
        <div className="join-card">
          <div className="join-success-icon"><Check size={28} /></div>
          <h2 className="join-title">You're in!</h2>
          <p className="join-sub">Joined <strong>{orgInfo?.org_name}</strong>. Redirecting…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="join-shell">
      <div className="join-card">
        <div className="join-brand">Datrix</div>

        <div className="join-org-badge">
          <span className="join-org-dot" style={{ background: color }} />
          {orgInfo?.org_name}
        </div>

        <h2 className="join-title">You've been invited</h2>
        <p className="join-sub">Create your account to join <strong>{orgInfo?.org_name}</strong> on Datrix.</p>

        <form className="join-form" onSubmit={handleJoin}>
          <div className="join-field">
            <label className="join-label">Your name</label>
            <input className="join-input" placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>

          {/* Color picker */}
          <div className="join-field">
            <label className="join-label">Pick your color</label>
            <p className="join-color-hint">Shows up next to your activity so teammates can tell it's you.</p>
            <div className="join-palette">
              {PALETTE.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`join-swatch${color === c ? ' sel' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={c}
                >
                  {color === c && <Check size={11} color="#fff" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          <div className="join-field">
            <label className="join-label">Email</label>
            <input className="join-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="join-field">
            <label className="join-label">Password</label>
            <div className="join-pw-wrap">
              <input
                className="join-input"
                type={showPw ? 'text' : 'password'}
                placeholder="At least 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required minLength={8}
              />
              <button type="button" className="join-pw-toggle" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {joinErr && <div className="join-error">{joinErr}</div>}

          <button className="join-btn" type="submit" disabled={joining || !name.trim() || !email || password.length < 8}>
            {joining ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {joining ? 'Joining…' : `Join ${orgInfo?.org_name}`}
          </button>
        </form>

        <p className="join-signin">Already have an account? <a onClick={() => navigate('/login')} className="join-link">Sign in</a></p>
      </div>
    </div>
  )
}
