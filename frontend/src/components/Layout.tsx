import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  Database, GitBranch, Sparkles, Brain, BarChart3, ShieldCheck,
  ShoppingBag, Settings, HelpCircle, Sun, Moon, Compass, Home,
  Users, CreditCard, UserCircle, Bell, X, LogOut, Menu,
  CheckCircle2, AlertCircle, Info, GitPullRequest,
} from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { TourGuide } from './TourGuide'
import { ErrorBoundary } from './ErrorBoundary'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationContext'
import type { AppNotification } from '@/contexts/NotificationContext'
import './Layout.css'

const TOKENS = {
  dark: {
    '--accent': '#63b3ff', '--accent-hover': '#7cc0ff', '--accent-active': '#4f9fef',
    '--bg': '#050810', '--bg-2': '#090d1a', '--bg-3': '#11172a', '--bg-card': '#0d1220', '--bg-inset': '#070b15',
    '--border': 'rgba(255,255,255,.07)', '--border-strong': 'rgba(255,255,255,.15)', '--border-accent': 'rgba(99,179,255,.28)',
    '--text-primary': '#f0f4ff', '--text-secondary': '#7a8aaa', '--text-tertiary': '#3d4d6a', '--text-on-accent': '#050810',
    '--green': '#34d399', '--green-dim': 'rgba(52,211,153,.12)',
    '--warn': '#fbbf24', '--warn-dim': 'rgba(251,191,36,.12)',
    '--bad': '#f87171', '--bad-dim': 'rgba(248,113,113,.12)',
    '--blue-tint': 'rgba(99,179,255,.08)', '--blue-glow': 'rgba(99,179,255,.22)',
    '--glow': '1', '--grid-opacity': '0.03',
  },
  light: {
    '--accent': '#2f6fe4', '--accent-hover': '#2560cc', '--accent-active': '#2257bf',
    '--bg': '#ffffff', '--bg-2': '#f4f7fc', '--bg-3': '#eaeff8', '--bg-card': '#ffffff', '--bg-inset': '#f8fafd',
    '--border': 'rgba(13,27,51,.10)', '--border-strong': 'rgba(13,27,51,.22)', '--border-accent': 'rgba(47,111,228,.32)',
    '--text-primary': '#0d1b33', '--text-secondary': '#4a5878', '--text-tertiary': '#8a96ad', '--text-on-accent': '#ffffff',
    '--green': '#059669', '--green-dim': 'rgba(5,150,105,.10)',
    '--warn': '#d97706', '--warn-dim': 'rgba(217,119,6,.10)',
    '--bad': '#dc2626', '--bad-dim': 'rgba(220,38,38,.10)',
    '--blue-tint': 'rgba(47,111,228,.06)', '--blue-glow': 'rgba(47,111,228,.14)',
    '--glow': '0.4', '--grid-opacity': '0.05',
  },
}

function applyTokens(t: 'dark' | 'light') {
  const el = document.documentElement
  el.dataset.theme = t
  Object.entries(TOKENS[t]).forEach(([k, v]) => el.style.setProperty(k, v))
}

function useTheme() {
  const [theme, setThemeState] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('datrix-theme') as 'dark' | 'light') || 'dark'
  )
  const setTheme = (t: 'dark' | 'light') => {
    applyTokens(t)
    localStorage.setItem('datrix-theme', t)
    setThemeState(t)
  }
  useEffect(() => {
    const stored = (localStorage.getItem('datrix-theme') as 'dark' | 'light') || 'dark'
    applyTokens(stored)
  }, [])
  return { theme, setTheme }
}

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function usePendingChanges(accessToken: () => string | null) {
  const [count, setCount] = useState(0)

  const poll = useCallback(async () => {
    const token = accessToken()
    if (!token) return
    try {
      const orgs: { id: string; role: string }[] = await fetch(`${API}/orgs`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.ok ? r.json() : [])

      const reviewableOrgs = orgs.filter(o => o.role === 'owner' || o.role === 'reviewer')
      if (reviewableOrgs.length === 0) { setCount(0); return }

      let total = 0
      for (const org of reviewableOrgs) {
        const items: unknown[] = await fetch(
          `${API}/changes?org_id=${org.id}&status=pending`,
          { headers: { Authorization: `Bearer ${token}` } },
        ).then(r => r.ok ? r.json() : [])
        total += Array.isArray(items) ? items.length : 0
      }
      setCount(total)
    } catch {
      // silently ignore — badge just stays as-is
    }
  }, [accessToken])

  useEffect(() => {
    poll()
    const id = setInterval(poll, 30_000) // re-check every 30 s
    return () => clearInterval(id)
  }, [poll])

  return count
}

const primary = [
  { to: '/home',            icon: Home,        label: 'Home' },
  { to: '/datasets',        icon: Database,    label: 'Datasets' },
  { to: '/pipelines',       icon: GitBranch,   label: 'Pipelines' },
  { to: '/synthetic',       icon: Sparkles,    label: 'Synthetic' },
  { to: '/active-learning', icon: Brain,       label: 'Active Learning' },
  { to: '/benchmark',       icon: BarChart3,   label: 'Benchmark' },
  { to: '/compliance',      icon: ShieldCheck, label: 'Compliance' },
]

const secondary = [
  { to: '/orgs',        icon: Users,           label: 'Workspaces' },
  { to: '/changes',     icon: GitPullRequest,  label: 'Changes' },
  { to: '/marketplace', icon: ShoppingBag,     label: 'Marketplace' },
  { to: '/billing',     icon: CreditCard,      label: 'Billing' },
  { to: '/settings',   icon: Settings,         label: 'Settings' },
  { to: '/docs',        icon: HelpCircle,       label: 'Docs' },
]

function relTime(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function NotifIcon({ n }: { n: AppNotification }) {
  // Workspace notifications: show the member's color dot instead of an icon
  if (n.category === 'workspace' && n.color) {
    return (
      <div style={{
        width: 22, height: 22, borderRadius: '50%', background: n.color,
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.55rem', fontWeight: 700, color: '#fff',
      }}>
        {(n.title.split(' ')[0]?.[0] ?? '?').toUpperCase()}
      </div>
    )
  }
  if (n.type === 'success') return <CheckCircle2 size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
  if (n.type === 'error')   return <AlertCircle  size={14} style={{ color: 'var(--bad)',   flexShrink: 0 }} />
  return <Info size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
}

function NotifItem({ n, navigate, dismiss }: { n: AppNotification; navigate: (p: string) => void; dismiss: (id: string) => void }) {
  return (
    <div
      className={`notif-item${n.link ? ' clickable' : ''}`}
      onClick={() => n.link && navigate(n.link)}
    >
      <NotifIcon n={n} />
      <div className="notif-body">
        <div className="notif-title">{n.title}</div>
        <div className="notif-text">{n.body}</div>
        <div className="notif-time">{relTime(n.ts)}</div>
      </div>
      <button className="notif-dismiss" onClick={e => { e.stopPropagation(); dismiss(n.id) }}>
        <X size={11} />
      </button>
    </div>
  )
}

function NotificationBell() {
  const { notifications, unreadCount, markAllRead, dismiss } = useNotifications()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const workspaceNotifs = notifications.filter(n => n.category === 'workspace')
  const allJobNotifs    = notifications.filter(n => !n.category || n.category === 'job')

  const clearAll = () => notifications.forEach(n => dismiss(n.id))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="sidebar-btn"
        onClick={() => { setOpen(!open); if (!open) markAllRead() }}
        style={{ position: 'relative' }}
      >
        <Bell size={15} />
        <span>Notifications</span>
        {unreadCount > 0 && (
          <span className="notif-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span>Notifications</span>
            {notifications.length > 0 && (
              <button className="notif-clear" onClick={clearAll}>Clear all</button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="notif-empty">No notifications yet</div>
          ) : (
            <>
              {/* ── Workspace section ── */}
              {workspaceNotifs.length > 0 && (
                <div className="notif-section">
                  <div className="notif-section-label">
                    <GitPullRequest size={11} />
                    Workspace
                  </div>
                  {workspaceNotifs.slice(0, 6).map(n => (
                    <NotifItem key={n.id} n={n} navigate={navigate} dismiss={dismiss} />
                  ))}
                </div>
              )}

              {/* ── Jobs section ── */}
              {allJobNotifs.length > 0 && (
                <div className="notif-section">
                  <div className="notif-section-label">
                    <Info size={11} />
                    Jobs
                  </div>
                  {allJobNotifs.slice(0, 6).map(n => (
                    <NotifItem key={n.id} n={n} navigate={navigate} dismiss={dismiss} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function Layout() {
  const { theme, setTheme } = useTheme()
  const { user, logout, accessToken } = useAuth()
  const navigate = useNavigate()
  const pendingChanges = usePendingChanges(accessToken)
  const [showTour, setShowTour] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('datrix-tour-done')) setShowTour(true)
    const handler = () => setShowTour(true)
    window.addEventListener('datrix:open-tour', handler)
    return () => window.removeEventListener('datrix:open-tour', handler)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const sidebarFallback = (
    <aside className="app-sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-brand">Datrix</span>
      </div>
    </aside>
  )

  const sidebarContent = (
    <aside className={`app-sidebar${sidebarOpen ? ' mobile-open' : ''}`}>
      <div className="sidebar-logo">
        <span className="dot-live" />
        <span className="sidebar-brand">Datrix</span>
        <span className="sidebar-beta">beta</span>
        <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}><X size={16} /></button>
      </div>

      <div className="side-nav">
        {primary.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setSidebarOpen(false)}>
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
        <div className="nav-divider" />
        {secondary.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setSidebarOpen(false)}>
            <Icon size={16} />
            <span>{label}</span>
            {to === '/changes' && pendingChanges > 0 && (
              <span className="nav-pending-badge">
                {pendingChanges > 9 ? '9+' : pendingChanges}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      <div className="sidebar-footer">
        <NavLink to="/profile" className={({ isActive }) => `sidebar-btn profile-link${isActive ? ' active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <UserCircle size={15} />
          <span className="sidebar-email">{user?.email ?? 'Profile'}</span>
        </NavLink>
        <NotificationBell />
        <button className="sidebar-btn" onClick={() => setShowTour(true)}>
          <Compass size={15} />
          <span>Platform tour</span>
        </button>
        <button className="sidebar-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
        <button className="sidebar-btn danger" onClick={handleLogout}>
          <LogOut size={15} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <ErrorBoundary fallback={sidebarFallback}>
        {sidebarContent}
      </ErrorBoundary>

      <main className="app-content">
        {/* Mobile top bar */}
        <div className="mobile-topbar">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <span className="mobile-brand">Datrix</span>
        </div>

        <Outlet />
      </main>

      {showTour && <TourGuide onClose={() => setShowTour(false)} />}
    </div>
  )
}
