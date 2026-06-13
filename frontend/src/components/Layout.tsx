import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  Database, GitBranch, Sparkles, Brain, BarChart3, ShieldCheck,
  ShoppingBag, Settings, HelpCircle, Sun, Moon, Compass, Home,
  Users, CreditCard, UserCircle, Bell, X, LogOut, Menu,
  CheckCircle2, AlertCircle, Info,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { TourGuide } from './TourGuide'
import { ErrorBoundary } from './ErrorBoundary'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications, AppNotification } from '@/contexts/NotificationContext'
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
  { to: '/orgs',        icon: Users,       label: 'Workspaces' },
  { to: '/marketplace', icon: ShoppingBag, label: 'Marketplace' },
  { to: '/billing',     icon: CreditCard,  label: 'Billing' },
  { to: '/settings',   icon: Settings,    label: 'Settings' },
  { to: '/docs',        icon: HelpCircle,  label: 'Docs' },
]

function NotifIcon({ type }: { type: AppNotification['type'] }) {
  if (type === 'success') return <CheckCircle2 size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
  if (type === 'error') return <AlertCircle size={14} style={{ color: 'var(--bad)', flexShrink: 0 }} />
  return <Info size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
}

function relTime(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function NotificationBell() {
  const { notifications, unreadCount, markAllRead, dismiss } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
          <span style={{
            marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9,
            background: 'var(--bad)', color: '#fff', fontSize: '0.6rem',
            fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span>Notifications</span>
            {notifications.length > 0 && (
              <button className="notif-clear" onClick={() => { notifications.forEach(n => dismiss(n.id)) }}>
                Clear all
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="notif-empty">No notifications yet</div>
          ) : (
            notifications.slice(0, 10).map(n => (
              <div key={n.id} className="notif-item">
                <NotifIcon type={n.type} />
                <div className="notif-body">
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-text">{n.body}</div>
                  <div className="notif-time">{relTime(n.ts)}</div>
                </div>
                <button className="notif-dismiss" onClick={() => dismiss(n.id)}><X size={11} /></button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function Layout() {
  const { theme, setTheme } = useTheme()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
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
