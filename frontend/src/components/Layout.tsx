import { Outlet } from 'react-router-dom'
import { NavLink } from 'react-router-dom'
import {
  Database, GitBranch, Sparkles, Brain, BarChart3, ShieldCheck,
  ShoppingBag, Settings, HelpCircle, Sun, Moon, Compass,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { TourGuide } from './TourGuide'
import { ErrorBoundary } from './ErrorBoundary'
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
  { to: '/datasets',        icon: Database,    label: 'Datasets' },
  { to: '/pipelines',       icon: GitBranch,   label: 'Pipelines' },
  { to: '/synthetic',       icon: Sparkles,    label: 'Synthetic' },
  { to: '/active-learning', icon: Brain,       label: 'Active Learning' },
  { to: '/benchmark',       icon: BarChart3,   label: 'Benchmark' },
  { to: '/compliance',      icon: ShieldCheck, label: 'Compliance' },
]

const secondary = [
  { to: '/marketplace', icon: ShoppingBag, label: 'Marketplace' },
  { to: '/settings',    icon: Settings,    label: 'Settings' },
  { to: '/docs',        icon: HelpCircle,  label: 'Docs' },
]

export function Layout() {
  const { theme, setTheme } = useTheme()
  const [showTour, setShowTour] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('datrix-tour-done')) setShowTour(true)
    const handler = () => setShowTour(true)
    window.addEventListener('datrix:open-tour', handler)
    return () => window.removeEventListener('datrix:open-tour', handler)
  }, [])

  const sidebarFallback = (
    <aside className="app-sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-brand">Datrix</span>
      </div>
      <div style={{ padding: '1rem 0.75rem' }}>
        <p style={{ fontSize: '0.7rem', color: 'var(--bad)', marginBottom: '0.5rem' }}>
          Sidebar crashed
        </p>
        <button
          style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
      </div>
    </aside>
  )

  return (
    <div className="app-shell">
      <ErrorBoundary fallback={sidebarFallback}>
        <aside className="app-sidebar">

          <div className="sidebar-logo">
            <span className="dot-live" />
            <span className="sidebar-brand">Datrix</span>
            <span className="sidebar-beta">beta</span>
          </div>

          <div className="side-nav">
            {primary.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}>
                <Icon size={16} />
                <span>{label}</span>
              </NavLink>
            ))}
            <div className="nav-divider" />
            {secondary.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}>
                <Icon size={16} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>

          <div className="sidebar-footer">
            <button
              className="sidebar-btn"
              onClick={() => setShowTour(true)}
            >
              <Compass size={15} />
              <span>Platform tour</span>
            </button>
            <button
              className="sidebar-btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>
          </div>

        </aside>
      </ErrorBoundary>

      <main className="app-content">
        <Outlet />
      </main>

      {showTour && <TourGuide onClose={() => setShowTour(false)} />}
    </div>
  )
}
