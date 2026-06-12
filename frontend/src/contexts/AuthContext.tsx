import { createContext, useContext, useEffect, useState, useCallback } from 'react'

interface User {
  id: string
  email: string
  created_at: string
}

interface TokenPair {
  access_token: string
  refresh_token: string
}

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  accessToken: () => string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function saveTokens(tokens: TokenPair) {
  localStorage.setItem('datrix_access', tokens.access_token)
  localStorage.setItem('datrix_refresh', tokens.refresh_token)
}

function clearTokens() {
  localStorage.removeItem('datrix_access')
  localStorage.removeItem('datrix_refresh')
}

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Request failed')
  }
  return res.json()
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const accessToken = useCallback(() => localStorage.getItem('datrix_access'), [])

  const fetchMe = useCallback(async (token: string): Promise<User | null> => {
    try {
      return await apiFetch('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      return null
    }
  }, [])

  // On mount: try to restore session from stored tokens
  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('datrix_access')
      if (!stored) { setIsLoading(false); return }

      let me = await fetchMe(stored)

      // Access token expired — try refresh
      if (!me) {
        const refreshToken = localStorage.getItem('datrix_refresh')
        if (refreshToken) {
          try {
            const tokens: TokenPair = await apiFetch('/auth/refresh', {
              method: 'POST',
              body: JSON.stringify({ refresh_token: refreshToken }),
            })
            saveTokens(tokens)
            me = await fetchMe(tokens.access_token)
          } catch {
            clearTokens()
          }
        } else {
          clearTokens()
        }
      }

      setUser(me)
      setIsLoading(false)
    }
    init()
  }, [fetchMe])

  const login = async (email: string, password: string) => {
    const tokens: TokenPair = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    saveTokens(tokens)
    const me = await fetchMe(tokens.access_token)
    setUser(me)
  }

  const register = async (email: string, password: string) => {
    const tokens: TokenPair = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    saveTokens(tokens)
    const me = await fetchMe(tokens.access_token)
    setUser(me)
  }

  const logout = async () => {
    const rt = localStorage.getItem('datrix_refresh')
    if (rt) {
      apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: rt }),
      }).catch(() => {})
    }
    clearTokens()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, accessToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
