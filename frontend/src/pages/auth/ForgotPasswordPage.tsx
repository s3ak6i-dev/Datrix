import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Check } from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await fetch(`${BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '1rem',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '2.25rem 2rem',
        boxShadow: '0 8px 48px rgba(0,0,0,.18)',
      }}>
        <Link to="/login" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: '0.78rem', color: 'var(--text-tertiary)', textDecoration: 'none',
          marginBottom: '1.5rem',
        }}>
          <ArrowLeft size={13} /> Back to sign in
        </Link>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--green-dim)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
            }}>
              <Check size={22} style={{ color: 'var(--green)' }} />
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
              Check your email
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
              If an account exists for <strong>{email}</strong>, we've sent a password reset link. Check your inbox (and spam folder).
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              The link expires in 1 hour.
            </p>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.3rem' }}>
              Reset your password
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem' }}>
              Enter your email and we'll send you a reset link.
            </p>

            <form onSubmit={submit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoFocus
                  style={{
                    width: '100%', background: 'var(--bg-inset)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '0.62rem 0.8rem', fontSize: '0.875rem',
                    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {error && <p style={{ fontSize: '0.78rem', color: 'var(--bad)', marginBottom: 8 }}>{error}</p>}

              <button
                type="submit"
                disabled={loading || !email}
                style={{
                  width: '100%', padding: '0.7rem', background: 'var(--accent)',
                  color: 'var(--text-on-accent)', border: 'none', borderRadius: 8,
                  fontSize: '0.875rem', fontWeight: 600, cursor: loading || !email ? 'not-allowed' : 'pointer',
                  opacity: loading || !email ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
