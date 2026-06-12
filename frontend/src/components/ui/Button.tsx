import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

// Per design spec:
// primary  — accent fill, -1px lift on hover, blue glow
// secondary — hairline border, no fill, escalates border on hover
// ghost    — accent border, accent text, blue-tint fill on hover
// danger   — bad/red fill, same lift/glow pattern

const base =
  'inline-flex items-center justify-center gap-2 font-medium cursor-pointer ' +
  'whitespace-nowrap select-none ' +
  'disabled:opacity-45 disabled:pointer-events-none disabled:shadow-none disabled:transform-none ' +
  'btn-lift'

const variants: Record<NonNullable<Props['variant']>, string> = {
  primary:
    'bg-brand text-[var(--text-on-accent)] border-0 rounded-[var(--radius-btn)] ' +
    'hover:bg-brand-700 btn-primary-glow',

  secondary:
    'bg-transparent text-text-secondary border border-border rounded-[var(--radius-btn)] ' +
    'hover:text-text-primary hover:border-[var(--border-strong)]',

  ghost:
    'bg-transparent text-text-primary border border-[var(--border-accent)] rounded-[var(--radius-btn)] ' +
    'hover:bg-[var(--blue-tint)] hover:border-brand',

  danger:
    'bg-danger text-white border-0 rounded-[var(--radius-btn)] ' +
    'hover:bg-red-600 btn-primary-glow',
}

const sizes: Record<NonNullable<Props['size']>, string> = {
  sm: 'px-3 py-[7px] text-[13px] leading-none',
  md: 'px-[18px] py-[11px] text-sm leading-none',
  lg: 'px-[22px] py-[14px] text-[15px] leading-none',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  children,
  className,
  disabled,
  ...props
}: Props) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading ?? undefined}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  )
}
