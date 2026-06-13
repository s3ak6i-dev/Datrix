import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: 'Google sign-in is not configured on this server.',
  github_not_configured: 'GitHub sign-in is not configured on this server.',
  google_exchange_failed: 'Could not complete Google sign-in. Please try again.',
  github_exchange_failed: 'Could not complete GitHub sign-in. Please try again.',
  github_no_token: 'GitHub did not return an access token. Please try again.',
  invalid_state: 'Sign-in request expired or was tampered with. Please try again.',
  no_email: 'Your account has no verified email address. Please add one and try again.',
}

export default function OAuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { loginWithTokens } = useAuth()

  useEffect(() => {
    const access = params.get('access_token')
    const refresh = params.get('refresh_token')
    const error = params.get('error')

    if (error) {
      const msg = ERROR_MESSAGES[error] ?? 'Sign-in failed. Please try again.'
      navigate(`/login?oauthError=${encodeURIComponent(msg)}`, { replace: true })
      return
    }

    if (access && refresh) {
      loginWithTokens({ access_token: access, refresh_token: refresh })
      navigate('/home', { replace: true })
    } else {
      navigate('/login', { replace: true })
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: '0.75rem',
      background: 'var(--bg)', color: 'var(--text-secondary)',
    }}>
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
      <span style={{ fontSize: '0.875rem' }}>Completing sign-in…</span>
    </div>
  )
}
