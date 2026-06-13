import { useState } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Check } from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const inputStyle = {
  width: '100%', background: 'var(--bg-inset)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '0.62rem 0.8rem', fontSize: '0.875rem',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' as const,
}

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError("Passwords don't match"); return }
    if (password.length < 8) { setError('Minimum 8 characters'); return }

    setLoading(true)
    setError('')
    try {
      const r = await fetch(`${BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      if (r.ok) {
        setDone(true)
        setTimeout(() => navigate('/login', { replace: true }), 3000)
      } else {
        const e = await r.json()
        setError(e.detail ?? 'Reset failed. The link may have expired.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const shell = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }
  const card = { width: '100%', maxWidth: 400, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '2.25rem 2rem', boxShadow: '0 8px 48px rgba(0,0,0,.18)' }

  if (!token) {
    return (
      <div style={shell}>
        <div style={card}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>Invalid link</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem' }}>This reset link is missing a token.</p>
          <Link to="/forgot-password" style={{ color: 'var(--accent)', fontSize: '0.82rem' }}>Request a new one</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={shell}>
      <div style={card}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Check size={22} style={{ color: 'var(--green)' }} />
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>Password updated!</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Redirecting you to sign in…</p>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.3rem' }}>Set new password</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem' }}>Choose a strong password for your account.</p>

            <form onSubmit={submit}>
              <div style={{ marginBottom: '0.9rem' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>New password</label>
                <div style={{ position: 'relative' }}>
                  <input type={show ? 'text' : 'password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="8+ characters" autoFocus style={{ ...inputStyle, paddingRight: 40 }} />
                  <button type="button" onClick={() => setShow(!show)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Confirm password</label>
                <input type={show ? 'text' : 'password'} required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Same as above" style={inputStyle} />
              </div>

              {error && <p style={{ fontSize: '0.78rem', color: 'var(--bad)', marginBottom: 8 }}>{error}</p>}

              <button type="submit" disabled={loading || !password || !confirm} style={{ width: '100%', padding: '0.7rem', background: 'var(--accent)', color: 'var(--text-on-accent)', border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: loading || !password || !confirm ? 'not-allowed' : 'pointer', opacity: loading || !password || !confirm ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {loading && <Loader2 size={15} className="animate-spin" />}
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
