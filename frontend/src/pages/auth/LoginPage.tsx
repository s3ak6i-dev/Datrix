import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
      }
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-sm rounded-xl border p-8 shadow-lg"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <span className="dot-live w-[7px] h-[7px] flex-shrink-0" />
          <span
            className="text-[18px] font-light tracking-[-0.03em] text-text-primary"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Datrix
          </span>
        </div>

        <h1 className="text-text-primary text-xl font-semibold mb-1">
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h1>
        <p className="text-text-secondary text-sm mb-6">
          {mode === 'login'
            ? 'Enter your credentials to continue.'
            : 'Start your free workspace.'}
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2"
              style={{
                background: 'var(--bg-2)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2"
              style={{
                background: 'var(--bg-2)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
              placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <p className="text-sm text-bad">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-lg text-sm font-medium transition-all btn-lift btn-primary-glow disabled:opacity-50"
            style={{
              background: 'var(--accent)',
              color: 'var(--text-on-accent)',
            }}
          >
            {loading
              ? mode === 'login' ? 'Signing in…' : 'Creating account…'
              : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            className="text-brand hover:underline"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
