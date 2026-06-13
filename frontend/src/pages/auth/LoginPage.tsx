import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Mail, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

type Mode = 'login' | 'register'

const ANIM = `
  @keyframes stepIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes stepOut {
    from { opacity: 1; transform: translateY(0); }
    to   { opacity: 0; transform: translateY(-10px); }
  }
`

export default function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'register' ? 'register' : 'login')
  const [step, setStep] = useState<1 | 2>(1)
  const [animKey, setAnimKey] = useState(0)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 1) emailRef.current?.focus()
    else passwordRef.current?.focus()
  }, [step])

  const goStep2 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    setAnimKey(k => k + 1)
    setStep(2)
  }

  const goBack = () => {
    setError('')
    setAnimKey(k => k + 1)
    setStep(1)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login')
    setError('')
    setAnimKey(k => k + 1)
    setStep(1)
    setPassword('')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-strong)',
    background: 'var(--bg-2)',
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'var(--accent)'
    e.currentTarget.style.boxShadow = 'var(--focus-ring)'
  }
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'var(--border-strong)'
    e.currentTarget.style.boxShadow = 'none'
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'var(--bg)',
        backgroundImage: `
          radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,179,255,0.10) 0%, transparent 70%),
          radial-gradient(ellipse 60% 40% at 50% 110%, rgba(99,179,255,0.04) 0%, transparent 70%)
        `,
      }}
    >
      <style>{ANIM}</style>

      {/* Grid overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          backgroundImage: `
            linear-gradient(rgba(99,179,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,179,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Card */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 440,
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-card), 0 0 0 1px rgba(99,179,255,0.06)',
          overflow: 'hidden',
        }}
      >
        {/* Top accent bar */}
        <div style={{
          height: 2,
          background: 'linear-gradient(90deg, transparent 0%, var(--accent) 40%, var(--accent-hover) 60%, transparent 100%)',
          opacity: 0.75,
        }} />

        {/* Logo row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 32px 18px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="dot-live" style={{ width: 7, height: 7, flexShrink: 0 }} />
            <span style={{
              fontSize: 17,
              fontWeight: 300,
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
            }}>
              Datrix
            </span>
          </div>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[1, 2].map(n => (
              <span key={n} style={{
                width: 6, height: 6,
                borderRadius: '50%',
                background: step >= n ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
                transition: 'background 0.3s ease',
              }} />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '0 32px' }} />

        {/* Step content */}
        <div
          key={animKey}
          style={{
            padding: '32px 32px 36px',
            animation: 'stepIn 0.25s cubic-bezier(.2,.7,.2,1) both',
          }}
        >
          {step === 1 ? (
            <form onSubmit={goStep2}>
              <h1 style={{
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: '-0.025em',
                color: 'var(--text-primary)',
                marginBottom: 8,
              }}>
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h1>
              <p style={{
                fontSize: 14,
                color: 'var(--text-secondary)',
                marginBottom: 28,
                lineHeight: 1.5,
              }}>
                {mode === 'login'
                  ? 'Enter your email address to continue.'
                  : 'Start your free Datrix workspace.'}
              </p>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Email address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{
                  position: 'absolute', left: 13, top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)', pointerEvents: 'none',
                }} />
                <input
                  ref={emailRef}
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  style={{ ...inputStyle, paddingLeft: 36 }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              <button
                type="submit"
                className="btn-lift btn-primary-glow"
                style={{
                  width: '100%',
                  marginTop: 20,
                  padding: '13px 0',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent)',
                  color: 'var(--text-on-accent)',
                  fontSize: 14,
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Continue
              </button>

              <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  type="button"
                  onClick={switchMode}
                  style={{
                    color: 'var(--accent)', background: 'none',
                    border: 'none', cursor: 'pointer', fontSize: 13,
                    textDecoration: 'underline',
                  }}
                >
                  {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={submit}>
              {/* Back row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <button
                  type="button"
                  onClick={goBack}
                  aria-label="Back"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 30, height: 30, flexShrink: 0,
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid var(--border-strong)',
                    background: 'var(--bg-2)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <ArrowLeft size={13} />
                </button>
                <button
                  type="button"
                  onClick={goBack}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid var(--border-strong)',
                    background: 'var(--bg-2)',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                    cursor: 'pointer',
                    maxWidth: 260,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Mail size={12} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</span>
                </button>
              </div>

              <h1 style={{
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: '-0.025em',
                color: 'var(--text-primary)',
                marginBottom: 8,
              }}>
                {mode === 'login' ? 'Enter your password' : 'Choose a password'}
              </h1>
              <p style={{
                fontSize: 14,
                color: 'var(--text-secondary)',
                marginBottom: 28,
                lineHeight: 1.5,
              }}>
                {mode === 'login'
                  ? 'Use the password for this account.'
                  : 'Minimum 8 characters.'}
              </p>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Password
              </label>
              <input
                ref={passwordRef}
                type="password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'login' ? '••••••••' : 'At least 8 characters'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />

              {error && (
                <p style={{ marginTop: 12, fontSize: 13, color: 'var(--bad)' }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-lift btn-primary-glow"
                style={{
                  width: '100%',
                  marginTop: 20,
                  padding: '13px 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent)',
                  color: 'var(--text-on-accent)',
                  fontSize: 14,
                  fontWeight: 500,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading
                  ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                  : (mode === 'login' ? 'Sign in' : 'Create account')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
