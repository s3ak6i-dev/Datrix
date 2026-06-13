import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Check, X, Loader2 } from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Missing verification token.'); return }
    fetch(`${BASE}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(async r => {
      if (r.ok) {
        setStatus('ok')
      } else {
        const e = await r.json()
        setStatus('error')
        setMessage(e.detail ?? 'Verification failed.')
      }
    }).catch(() => {
      setStatus('error')
      setMessage('Something went wrong. Please try again.')
    })
  }, [token])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '2.5rem 2rem', textAlign: 'center', boxShadow: '0 8px 48px rgba(0,0,0,.18)' }}>
        {status === 'loading' && (
          <>
            <Loader2 size={36} className="animate-spin" style={{ color: 'var(--accent)', marginBottom: 16 }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.4rem' }}>Verifying your email…</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>Just a moment.</p>
          </>
        )}

        {status === 'ok' && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Check size={26} style={{ color: 'var(--green)' }} />
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.4rem' }}>Email verified!</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
              Your email address has been confirmed. You're all set.
            </p>
            <Link to="/home" style={{ display: 'inline-block', padding: '0.6rem 1.5rem', background: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
              Go to dashboard
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bad-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <X size={26} style={{ color: 'var(--bad)' }} />
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.4rem' }}>Verification failed</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
              {message}
            </p>
            <Link to="/login" style={{ color: 'var(--accent)', fontSize: '0.82rem' }}>Back to sign in</Link>
          </>
        )}
      </div>
    </div>
  )
}
