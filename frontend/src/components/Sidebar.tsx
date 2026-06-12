import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Database, GitBranch, Sparkles, Brain, BarChart3,
  ShieldCheck, ShoppingBag, Settings, HelpCircle,
  Sun, Moon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

  // Sync in case index.html script already set it
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

// ── Component ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const { theme, setTheme } = useTheme()

  return (
    <aside className="w-52 flex-shrink-0 bg-surface-primary border-r border-border flex flex-col h-full">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border gap-2.5">
        {/* Live-signal dot */}
        <span className="dot-live w-[7px] h-[7px] flex-shrink-0" />
        <span
          className="text-[15px] font-light tracking-[-0.03em] text-text-primary"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          Datrix
        </span>
        <span className="ml-auto mono-micro text-[9px] px-1.5 py-0.5 bg-surface-tertiary rounded-[var(--radius-xs)]">
          beta
        </span>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 py-3 overflow-y-auto flex flex-col">
        <div className="flex-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavItem key={to} to={to} icon={<Icon className="w-4 h-4" />} label={label} />
          ))}
          <div className="my-3 mx-3 border-t border-border" />
          {bottomItems.map(({ to, icon: Icon, label }) => (
            <NavItem key={to} to={to} icon={<Icon className="w-4 h-4" />} label={label} />
          ))}
        </div>

        {/* Theme toggle — bottom of sidebar */}
        <div className="px-3 pb-3 pt-1 border-t border-border mt-3">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors btn-lift',
              'text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary',
            )}
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4 flex-shrink-0" />
              : <Moon className="w-4 h-4 flex-shrink-0" />
            }
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
        </div>
      </nav>
    </aside>
  )
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-sm transition-colors btn-lift',
          isActive
            ? 'bg-brand-50 text-brand font-medium'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary',
        )
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}
