import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Database, GitBranch, Sparkles, Brain, BarChart3,
  ShieldCheck, ShoppingBag, Settings, HelpCircle,
  Sun, Moon, LogOut,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

// ── Theme toggle ───────────────────────────────────────────────────────────────

function useTheme() {
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark'
    return (localStorage.getItem('datrix-theme') as 'dark' | 'light') || 'dark'
  })

  const setTheme = (t: 'dark' | 'light') => {
    document.documentElement.dataset.theme = t
    localStorage.setItem('datrix-theme', t)
    setThemeState(t)
  }

  useEffect(() => {
    const stored = localStorage.getItem('datrix-theme') as 'dark' | 'light' | null
    if (stored && stored !== theme) setThemeState(stored)
  }, [])

  return { theme, setTheme }
}

// ── Nav items ─────────────────────────────────────────────────────────────────

const navItems = [
  { to: '/datasets',        icon: Database,    label: 'Datasets' },
  { to: '/pipelines',       icon: GitBranch,   label: 'Pipelines' },
  { to: '/synthetic',       icon: Sparkles,    label: 'Synthetic' },
  { to: '/active-learning', icon: Brain,       label: 'Active Learning' },
  { to: '/benchmark',       icon: BarChart3,   label: 'Benchmark' },
  { to: '/compliance',      icon: ShieldCheck, label: 'Compliance' },
]

const bottomItems = [
  { to: '/marketplace', icon: ShoppingBag, label: 'Marketplace' },
  { to: '/settings',    icon: Settings,    label: 'Settings' },
  { to: '/docs',        icon: HelpCircle,  label: 'Docs' },
]

// ── NavItem ────────────────────────────────────────────────────────────────────

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => isActive ? 'active' : ''}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

export function Sidebar() {
  const { theme, setTheme } = useTheme()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="sidebar-inner">
      {/* Logo */}
      <div
        style={{
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          borderBottom: '1px solid var(--border)',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <span
          className="dot-live"
          style={{ width: '7px', height: '7px', flexShrink: 0, borderRadius: '50%' }}
        />
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '15px',
            fontWeight: 300,
            letterSpacing: '-0.03em',
            color: 'var(--text-primary)',
          }}
        >
          Datrix
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            fontWeight: 400,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            padding: '2px 6px',
            background: 'var(--bg-3)',
            borderRadius: 'var(--radius-xs)',
            border: '1px solid var(--border)',
          }}
        >
          beta
        </span>
      </div>

      {/* Primary nav */}
      <nav className="side-nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavItem key={to} to={to} icon={<Icon size={15} />} label={label} />
          ))}
          <div style={{ margin: '10px 12px', borderTop: '1px solid var(--border)' }} />
          {bottomItems.map(({ to, icon: Icon, label }) => (
            <NavItem key={to} to={to} icon={<Icon size={15} />} label={label} />
          ))}

        {/* Footer controls */}
        <div
          style={{
            padding: '10px 8px',
            borderTop: '1px solid var(--border)',
            marginTop: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {user && (
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.08em',
                color: 'var(--text-tertiary)',
                padding: '4px 12px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                margin: 0,
              }}
            >
              {user.email}
            </p>
          )}
          <SidebarButton
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </SidebarButton>
          <SidebarButton onClick={handleLogout} danger>
            <LogOut size={15} />
            <span>Sign out</span>
          </SidebarButton>
        </div>
      </nav>
    </div>
  )
}

// ── SidebarButton (utility) ────────────────────────────────────────────────────

function SidebarButton({
  children,
  danger,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        borderRadius: 'var(--radius-md)',
        fontSize: '13.5px',
        color: hovered ? (danger ? 'var(--bad)' : 'var(--text-secondary)') : 'var(--text-tertiary)',
        background: hovered ? 'var(--bg-3)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background-color 0.15s, color 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...props}
    >
      {children}
    </button>
  )
}
