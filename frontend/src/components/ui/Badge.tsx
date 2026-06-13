import type { IssueSeverity } from '@/types'

const baseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 10px',
  borderRadius: 'var(--radius-btn)',
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  fontWeight: 400,
  lineHeight: 1,
}

const severityStyles: Record<IssueSeverity, React.CSSProperties> = {
  critical: {
    background: 'var(--bad-dim)',
    color: 'var(--bad)',
    border: '1px solid rgba(248,113,113,.28)',
  },
  warning: {
    background: 'var(--warn-dim)',
    color: 'var(--warn)',
    border: '1px solid rgba(251,191,36,.28)',
  },
  info: {
    background: 'var(--blue-tint)',
    color: 'var(--accent)',
    border: '1px solid rgba(99,179,255,.22)',
  },
}

interface SeverityBadgeProps {
  severity: IssueSeverity
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span style={{ ...baseStyle, ...severityStyles[severity] }}>
      {severity}
    </span>
  )
}

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger'
  className?: string
}

const variantStyles: Record<NonNullable<BadgeProps['variant']>, React.CSSProperties> = {
  default: {
    background: 'var(--bg-3)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  },
  success: {
    background: 'var(--green-dim)',
    color: 'var(--green)',
    border: '1px solid rgba(52,211,153,.22)',
  },
  warning: {
    background: 'var(--warn-dim)',
    color: 'var(--warn)',
    border: '1px solid rgba(251,191,36,.28)',
  },
  danger: {
    background: 'var(--bad-dim)',
    color: 'var(--bad)',
    border: '1px solid rgba(248,113,113,.28)',
  },
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={className}
      style={{ ...baseStyle, ...variantStyles[variant] }}
    >
      {children}
    </span>
  )
}
