import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Eye, EyeOff, ArrowLeft, ChevronRight, Lock, Mail, Plus, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import './AuthPage.css'

// ── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | 'signin' | 'sso' | '2fa' | 'workspace'
  | 'forgot' | 'forgot-sent' | 'reset'
  | 'signup-account' | 'signup-verify' | 'signup-profile' | 'signup-company' | 'success'

const SIGNUP_STEPS: Screen[] = ['signup-account', 'signup-profile', 'signup-company']

// ── Password strength ─────────────────────────────────────────────────────────

function pwStrength(v: string): number {
  if (!v) return 0
  let s = 0
  if (v.length >= 8) s++
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++
  if (/\d/.test(v)) s++
  if (/[^A-Za-z0-9]/.test(v)) s++
  if (v.length >= 14 && s >= 3) s = 4
  return Math.min(s, 4)
}

const STRENGTH_COPY  = ['', 'Too weak', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLOR = ['', '#ff6b7d', '#ff6b7d', '#ffbd2e', '#63b3ff', '#4fffb0']

// ── OTP Input component ───────────────────────────────────────────────────────

function OTPInput({ onComplete, shake }: { onComplete: (v: string) => void; shake: boolean }) {
  const [vals, setVals] = useState(Array(6).fill(''))
  const refs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null))

  const update = (i: number, digit: string) => {
    const next = [...vals]
    next[i] = digit.replace(/\D/g, '').slice(-1)
    setVals(next)
    if (next[i] && i < 5) refs.current[i + 1]?.focus()
    if (next.every(Boolean)) onComplete(next.join(''))
  }

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !vals[i] && i > 0) {
      refs.current[i - 1]?.focus()
      const next = [...vals]; next[i - 1] = ''; setVals(next)
    }
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus()
  }

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('')
    const next = Array(6).fill('').map((_, k) => digits[k] ?? '')
    setVals(next)
    const last = Math.min(digits.length, 5)
    refs.current[last]?.focus()
    if (next.every(Boolean)) onComplete(next.join(''))
  }

  return (
    <div className={`auth-otp${shake ? ' shake' : ''}`}>
      {vals.map((v, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          inputMode="numeric"
          maxLength={1}
          value={v}
          className={v ? 'filled' : ''}
          onChange={e => update(i, e.target.value)}
          onKeyDown={e => onKeyDown(i, e)}
          onPaste={onPaste}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
        />
      ))}
    </div>
  )
}

// ── SVG icons (inline, avoids extra imports) ──────────────────────────────────

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/>
  </svg>
)

const GitHubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="currentColor" d="M12 1a11 11 0 0 0-3.48 21.44c.55.1.75-.24.75-.53v-1.87c-3.06.67-3.71-1.47-3.71-1.47-.5-1.28-1.22-1.62-1.22-1.62-1-.68.08-.67.08-.67 1.1.08 1.69 1.14 1.69 1.14.98 1.68 2.58 1.2 3.21.92.1-.71.39-1.2.7-1.47-2.44-.28-5.01-1.22-5.01-5.43 0-1.2.43-2.18 1.13-2.95-.11-.28-.49-1.4.11-2.92 0 0 .92-.3 3.02 1.13a10.4 10.4 0 0 1 5.5 0c2.1-1.43 3.02-1.13 3.02-1.13.6 1.52.22 2.64.11 2.92.7.77 1.13 1.75 1.13 2.95 0 4.22-2.58 5.15-5.03 5.42.4.34.75 1.01.75 2.04v3.03c0 .3.2.64.76.53A11 11 0 0 0 12 1Z"/>
  </svg>
)

// ── Main component ────────────────────────────────────────────────────────────

export default function AuthPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [screen, setScreen]       = useState<Screen>(params.get('mode') === 'register' ? 'signup-account' : 'signin')
  const [animKey, setAnimKey]     = useState(0)
  const [, setHistory]            = useState<Screen[]>([])

  // form data
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [fullName, setFullName]   = useState('')
  const [role, setRole]           = useState('')
  const [company, setCompany]     = useState('')
  const [slug, setSlug]           = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [teamSize, setTeamSize]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [otpShake, setOtpShake]   = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)


  // auto-fill slug from company name
  useEffect(() => {
    if (!slugTouched) {
      setSlug(company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24))
    }
  }, [company, slugTouched])

  // resend timer
  useEffect(() => {
    if (resendSeconds <= 0) return
    const t = setTimeout(() => setResendSeconds(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendSeconds])

  const go = useCallback((next: Screen) => {
    setHistory(h => [...h, screen])
    setError('')
    setAnimKey(k => k + 1)
    setScreen(next)
    if (next === '2fa' || next === 'signup-verify') setResendSeconds(30)
  }, [screen])

  const goBack = useCallback(() => {
    setError('')
    setAnimKey(k => k + 1)
    setHistory(h => {
      const prev = h[h.length - 1]
      if (prev) { setScreen(prev); return h.slice(0, -1) }
      setScreen('signin')
      return []
    })
  }, [])

  // ── Submit handlers ───────────────────────────────────────────────────────

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(email, password)
      go('signup-profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const fakeSubmit = (next: Screen) => async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    setLoading(false)
    go(next)
  }

  const handleOTP = (val: string, next: Screen) => {
    if (val.length === 6) {
      setLoading(true)
      setTimeout(() => { setLoading(false); go(next) }, 700)
    }
  }

  const handleOTPSubmit = (_next: Screen) => (e: React.FormEvent) => {
    e.preventDefault()
    setOtpShake(true)
    setTimeout(() => setOtpShake(false), 500)
  }

  const handleSocial = (inSignup: boolean) => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      go(inSignup ? 'signup-profile' : 'workspace')
    }, 1100)
  }

  // ── Stepper helpers ───────────────────────────────────────────────────────

  const isSignupFlow = SIGNUP_STEPS.includes(screen)
  const stepIdx = SIGNUP_STEPS.indexOf(screen)

  // ── Password field helper ─────────────────────────────────────────────────

  const PwField = ({
    id, label, value, onChange, show, onToggle, placeholder, autoComplete, showStrength,
    extra,
  }: {
    id: string; label: string; value: string; onChange: (v: string) => void
    show: boolean; onToggle: () => void; placeholder: string; autoComplete: string
    showStrength?: boolean; extra?: React.ReactNode
  }) => {
    const s = showStrength ? pwStrength(value) : 0
    return (
      <div className="auth-field">
        <label className="auth-label" htmlFor={id}>{label}{extra}</label>
        <div className="auth-input-wrap">
          <input
            id={id}
            type={show ? 'text' : 'password'}
            required
            minLength={8}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete={autoComplete}
            className="auth-input"
            style={{ paddingRight: 46 }}
          />
          <button type="button" className="auth-pw-toggle" onClick={onToggle} aria-label="Toggle password">
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {showStrength && value && (
          <>
            <div className="auth-strength">
              {[1, 2, 3, 4].map(i => (
                <i key={i} style={{ background: i <= s ? STRENGTH_COLOR[s] : undefined }} />
              ))}
            </div>
            <div className="auth-strength-label" style={{ color: s ? STRENGTH_COLOR[s] : undefined }}>
              {s ? STRENGTH_COPY[s] : 'Use 8+ chars with letters, numbers & symbols'}
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="auth-page">
      <div className="auth-terrain" aria-hidden="true" />
      <div className="auth-ambient" aria-hidden="true" />
      <div className="auth-grid"    aria-hidden="true" />

      <div className="auth-shell">
        {/* Brand */}
        <button className="auth-brand" onClick={() => navigate('/')}>
          <span className="auth-brand-dot" />
          <span>Datrix</span>
        </button>

        {/* Card */}
        <div className="auth-card">
          {/* Sign-up stepper */}
          {isSignupFlow && (
            <div className="auth-stepper">
              {SIGNUP_STEPS.map((s, i) => {
                const state = i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''
                return (
                  <div key={s} className="auth-step-node" data-state={state}>
                    <span className="auth-step-bead">
                      {i < stepIdx ? <Check size={11} /> : i + 1}
                    </span>
                    {i < SIGNUP_STEPS.length - 1 && (
                      <span className="auth-step-line" style={{ background: i < stepIdx ? 'var(--accent)' : undefined }} />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="auth-card-body">
            <div key={animKey} className="auth-screen">

              {/* ══ SIGN IN ══════════════════════════════════════════════════ */}
              {screen === 'signin' && (
                <form onSubmit={handleSignIn}>
                  <h1 className="auth-title">Sign in to Datrix</h1>
                  <p className="auth-subtitle">Welcome back. Access your data infrastructure.</p>

                  <div className="auth-social">
                    <button type="button" className="auth-btn-social" onClick={() => handleSocial(false)}>
                      <GoogleIcon /> Continue with Google
                    </button>
                    <button type="button" className="auth-btn-social" onClick={() => handleSocial(false)}>
                      <GitHubIcon /> Continue with GitHub
                    </button>
                  </div>
                  <div className="auth-divider">or</div>

                  <div className="auth-field">
                    <label className="auth-label" htmlFor="si-email">Work email</label>
                    <input id="si-email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com" autoComplete="email" className="auth-input" />
                  </div>

                  <PwField
                    id="si-pw" label="Password" value={password} onChange={setPassword}
                    show={showPw} onToggle={() => setShowPw(v => !v)}
                    placeholder="••••••••" autoComplete="current-password"
                    extra={<button type="button" className="auth-label-btn" onClick={() => go('forgot')}>Forgot?</button>}
                  />

                  {error && <p className="auth-field-error">{error}</p>}

                  <button type="submit" disabled={loading} className="auth-btn-primary">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loading ? 'Signing in…' : 'Sign in'}
                  </button>

                  <div className="auth-sso-row">
                    <span>Enterprise?</span>
                    <button type="button" className="auth-link" onClick={() => go('sso')}>Sign in with SSO</button>
                  </div>
                  <p className="auth-alt-link">
                    New to Datrix?{' '}
                    <button type="button" className="auth-link" onClick={() => go('signup-account')}>Create an account</button>
                  </p>
                </form>
              )}

              {/* ══ SSO ══════════════════════════════════════════════════════ */}
              {screen === 'sso' && (
                <form onSubmit={fakeSubmit('workspace')}>
                  <button type="button" className="auth-back" onClick={goBack}>
                    <ArrowLeft size={14} /> Back
                  </button>
                  <h1 className="auth-title">Single sign-on</h1>
                  <p className="auth-subtitle">Enter your work email or company domain and we'll route you to your identity provider.</p>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="sso-email">Work email or domain</label>
                    <input id="sso-email" type="text" required placeholder="you@company.com" className="auth-input" />
                  </div>
                  <button type="submit" disabled={loading} className="auth-btn-primary">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loading ? 'Connecting…' : 'Continue with SSO'}
                  </button>
                  <p className="auth-alt-link">
                    <button type="button" className="auth-link" onClick={() => go('signin')}>Use password instead</button>
                  </p>
                </form>
              )}

              {/* ══ 2FA ══════════════════════════════════════════════════════ */}
              {screen === '2fa' && (
                <form onSubmit={handleOTPSubmit('workspace')}>
                  <button type="button" className="auth-back" onClick={goBack}>
                    <ArrowLeft size={14} /> Back
                  </button>
                  <div className="auth-eyebrow">Two-factor authentication</div>
                  <h1 className="auth-title">Enter your code</h1>
                  <p className="auth-subtitle">We sent a 6-digit code to your authenticator app. It expires in 10 minutes.</p>
                  <OTPInput onComplete={val => handleOTP(val, 'workspace')} shake={otpShake} />
                  {error && <p className="auth-field-error" style={{ marginBottom: 6 }}>{error}</p>}
                  <p className="auth-resend">
                    Didn't get it?{' '}
                    {resendSeconds > 0
                      ? <span>Resend in <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{resendSeconds}s</span></span>
                      : <button type="button" className="auth-link" onClick={() => setResendSeconds(30)}>Resend code</button>
                    }
                  </p>
                  <button type="submit" disabled={loading} className="auth-btn-primary">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loading ? 'Verifying…' : 'Verify'}
                  </button>
                  <p className="auth-alt-link">
                    <button type="button" className="auth-link" onClick={() => go('signin')}>Use a different method</button>
                  </p>
                </form>
              )}

              {/* ══ WORKSPACE PICKER ═════════════════════════════════════════ */}
              {screen === 'workspace' && (
                <div>
                  <h1 className="auth-title">Choose a workspace</h1>
                  <p className="auth-subtitle">You're a member of a few Datrix workspaces. Pick one to continue.</p>
                  <div className="auth-ws-list">
                    {[
                      { letter: 'N', label: 'Northwind AI', sub: '42 members · acme-ai', bg: 'linear-gradient(135deg,#63b3ff,#3a7fd0)' },
                      { letter: 'V', label: 'Vantage Labs', sub: '8 members · vantage', bg: 'linear-gradient(135deg,#4fffb0,#2bbd84)' },
                      { letter: 'P', label: 'Polaris Data Co.', sub: '120 members · polaris', bg: 'linear-gradient(135deg,#b18cff,#7b54e0)' },
                    ].map(ws => (
                      <button key={ws.label} type="button" className="auth-ws-item" onClick={() => navigate('/', { replace: true })}>
                        <span className="auth-ws-logo" style={{ background: ws.bg }}>{ws.letter}</span>
                        <span className="auth-ws-meta">
                          <span className="auth-ws-name">{ws.label}</span>
                          <span className="auth-ws-sub">{ws.sub}</span>
                        </span>
                        <span className="auth-ws-arrow"><ChevronRight size={16} /></span>
                      </button>
                    ))}
                  </div>
                  <button type="button" className="auth-ws-new" onClick={() => go('signup-company')}>
                    <Plus size={15} /> Create a new workspace
                  </button>
                </div>
              )}

              {/* ══ FORGOT PASSWORD ══════════════════════════════════════════ */}
              {screen === 'forgot' && (
                <form onSubmit={fakeSubmit('forgot-sent')}>
                  <button type="button" className="auth-back" onClick={() => go('signin')}>
                    <ArrowLeft size={14} /> Back to sign in
                  </button>
                  <h1 className="auth-title">Reset your password</h1>
                  <p className="auth-subtitle">Enter the email tied to your account and we'll send a reset link.</p>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="fg-email">Work email</label>
                    <input id="fg-email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com" autoComplete="email" className="auth-input" />
                  </div>
                  <button type="submit" disabled={loading} className="auth-btn-primary">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loading ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>
              )}

              {/* ══ FORGOT SENT ══════════════════════════════════════════════ */}
              {screen === 'forgot-sent' && (
                <div>
                  <div className="auth-badge">
                    <Mail size={28} />
                  </div>
                  <h1 className="auth-title">Check your email</h1>
                  <p className="auth-subtitle">
                    We sent a password reset link to{' '}
                    <b>{email || 'your inbox'}</b>. The link is valid for 1 hour.
                  </p>
                  <button type="button" className="auth-btn-primary" onClick={() => go('reset')}>
                    I've got the link
                  </button>
                  <button type="button" className="auth-btn-ghost" onClick={() => go('forgot')}>
                    Use a different email
                  </button>
                  <p className="auth-resend">
                    Didn't receive it?{' '}
                    <button type="button" className="auth-link" onClick={() => go('forgot-sent')}>Resend email</button>
                  </p>
                </div>
              )}

              {/* ══ RESET PASSWORD ═══════════════════════════════════════════ */}
              {screen === 'reset' && (
                <form onSubmit={fakeSubmit('signin')}>
                  <h1 className="auth-title">Set a new password</h1>
                  <p className="auth-subtitle">Choose a strong password you haven't used before.</p>
                  <PwField
                    id="rs-pw" label="New password" value={newPw} onChange={setNewPw}
                    show={showNewPw} onToggle={() => setShowNewPw(v => !v)}
                    placeholder="••••••••" autoComplete="new-password" showStrength
                  />
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="rs-pw2">Confirm password</label>
                    <div className="auth-input-wrap">
                      <input id="rs-pw2" type={showNewPw ? 'text' : 'password'} required
                        value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                        placeholder="••••••••" autoComplete="new-password"
                        className={`auth-input${confirmPw && confirmPw !== newPw ? ' error' : ''}`}
                        style={{ paddingRight: 46 }}
                      />
                      <button type="button" className="auth-pw-toggle" onClick={() => setShowNewPw(v => !v)}>
                        {showNewPw ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    {confirmPw && confirmPw !== newPw && (
                      <p className="auth-field-error">Passwords don't match</p>
                    )}
                  </div>
                  <button type="submit" disabled={loading || (!!confirmPw && confirmPw !== newPw)} className="auth-btn-primary">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loading ? 'Updating…' : 'Update password'}
                  </button>
                </form>
              )}

              {/* ══ SIGN UP · ACCOUNT ════════════════════════════════════════ */}
              {screen === 'signup-account' && (
                <form onSubmit={handleSignUp}>
                  <h1 className="auth-title">Create your account</h1>
                  <p className="auth-subtitle">Start your 14-day trial. No credit card required.</p>

                  <div className="auth-social">
                    <button type="button" className="auth-btn-social" onClick={() => handleSocial(true)}>
                      <GoogleIcon /> Sign up with Google
                    </button>
                    <button type="button" className="auth-btn-social" onClick={() => handleSocial(true)}>
                      <GitHubIcon /> Sign up with GitHub
                    </button>
                  </div>
                  <div className="auth-divider">or</div>

                  <div className="auth-field">
                    <label className="auth-label" htmlFor="su-email">Work email</label>
                    <input id="su-email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com" autoComplete="email" className="auth-input" />
                  </div>

                  <PwField
                    id="su-pw" label="Password" value={password} onChange={setPassword}
                    show={showPw} onToggle={() => setShowPw(v => !v)}
                    placeholder="Create a password" autoComplete="new-password" showStrength
                  />

                  {error && <p className="auth-field-error">{error}</p>}

                  <button type="submit" disabled={loading} className="auth-btn-primary">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loading ? 'Creating account…' : 'Create account'}
                  </button>
                  <p className="auth-alt-link">
                    Already have an account?{' '}
                    <button type="button" className="auth-link" onClick={() => go('signin')}>Sign in</button>
                  </p>
                </form>
              )}

              {/* ══ SIGN UP · VERIFY (stub — reachable via back nav) ═════════ */}
              {screen === 'signup-verify' && (
                <form onSubmit={handleOTPSubmit('signup-profile')}>
                  <button type="button" className="auth-back" onClick={goBack}>
                    <ArrowLeft size={14} /> Back
                  </button>
                  <h1 className="auth-title">Verify your email</h1>
                  <p className="auth-subtitle">
                    Enter the 6-digit code we sent to <b>{email || 'your email'}</b>.
                  </p>
                  <OTPInput onComplete={val => handleOTP(val, 'signup-profile')} shake={otpShake} />
                  <p className="auth-resend">
                    Didn't get it?{' '}
                    {resendSeconds > 0
                      ? <span>Resend in <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{resendSeconds}s</span></span>
                      : <button type="button" className="auth-link" onClick={() => setResendSeconds(30)}>Resend code</button>
                    }
                  </p>
                  <button type="submit" disabled={loading} className="auth-btn-primary">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loading ? 'Verifying…' : 'Verify email'}
                  </button>
                </form>
              )}

              {/* ══ SIGN UP · PROFILE ════════════════════════════════════════ */}
              {screen === 'signup-profile' && (
                <form onSubmit={e => { e.preventDefault(); if (fullName && role) go('signup-company') }}>
                  <h1 className="auth-title">Tell us about you</h1>
                  <p className="auth-subtitle">This personalizes your Datrix workspace.</p>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="pf-name">Full name</label>
                    <input id="pf-name" type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                      placeholder="Alex Rivera" autoComplete="name" className="auth-input" />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label">Your role</label>
                    <div className="auth-role-grid">
                      {['ML / AI Engineer', 'Data Engineer', 'Data Scientist', 'Analytics / BI', 'Leadership', 'Something else'].map(r => (
                        <button key={r} type="button" className={`auth-role-opt${role === r ? ' sel' : ''}`} onClick={() => setRole(r)}>
                          <span className="auth-role-dot" />
                          {r}
                        </button>
                      ))}
                    </div>
                    {!role && fullName && <p className="auth-field-error">Pick the closest role</p>}
                  </div>
                  <button type="submit" disabled={!fullName || !role} className="auth-btn-primary" style={{ marginTop: 10 }}>
                    Continue
                  </button>
                </form>
              )}

              {/* ══ SIGN UP · COMPANY ════════════════════════════════════════ */}
              {screen === 'signup-company' && (
                <form onSubmit={e => { e.preventDefault(); go('success') }}>
                  <h1 className="auth-title">Set up your workspace</h1>
                  <p className="auth-subtitle">Your team will live here. You can change this later.</p>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="co-name">Company name</label>
                    <input id="co-name" type="text" required value={company} onChange={e => setCompany(e.target.value)}
                      placeholder="Northwind AI" className="auth-input" />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="co-slug">Workspace URL</label>
                    <div className="auth-input-wrap">
                      <input id="co-slug" type="text" required value={slug}
                        onChange={e => { setSlug(e.target.value); setSlugTouched(true) }}
                        placeholder="northwind" className="auth-input" style={{ paddingRight: 96 }} />
                      <span className="auth-slug-addon">.datrix.io</span>
                    </div>
                  </div>
                  <div className="auth-field">
                    <label className="auth-label">Team size</label>
                    <div className="auth-size-grid">
                      {['1–10', '11–50', '51–200', '200+'].map(s => (
                        <button key={s} type="button"
                          className={`auth-size-opt${teamSize === s ? ' sel' : ''}`}
                          onClick={() => setTeamSize(s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="submit" disabled={!company || !slug} className="auth-btn-primary" style={{ marginTop: 10 }}>
                    Create workspace
                  </button>
                </form>
              )}

              {/* ══ SUCCESS ══════════════════════════════════════════════════ */}
              {screen === 'success' && (
                <div style={{ textAlign: 'center' }}>
                  <div className="auth-success-ring">
                    <Check size={34} strokeWidth={2.2} />
                  </div>
                  <h1 className="auth-title">You're all set</h1>
                  <p className="auth-subtitle">
                    Your Datrix workspace is ready. Let's get your first dataset scanned.
                  </p>
                  <div className="auth-checklist" style={{ textAlign: 'left' }}>
                    {['Account verified', 'Workspace created', 'Security & encryption enabled'].map(item => (
                      <div key={item} className="auth-check-item">
                        <span className="auth-check-tick"><Check size={12} strokeWidth={2} /></span>
                        {item}
                      </div>
                    ))}
                  </div>
                  <button type="button" className="auth-btn-primary" style={{ marginTop: 20 }}
                    onClick={() => navigate('/', { replace: true })}>
                    Go to dashboard
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="auth-foot">
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Lock size={12} /> SOC 2 · AES-256
          </span>
          <span className="auth-foot-sep" />
          <a href="#">Help</a>
          <span className="auth-foot-sep" />
          <a href="#">Privacy</a>
        </div>
      </div>
    </div>
  )
}
