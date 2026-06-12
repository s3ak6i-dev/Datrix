import { cn } from '@/lib/utils'
import type { IssueSeverity } from '@/types'

const severityStyles: Record<IssueSeverity, string> = {
  critical: 'bg-danger-50 text-danger border border-danger/20',
  warning: 'bg-warning-50 text-warning border border-warning/20',
  info: 'bg-brand-50 text-brand border border-brand/20',
}

interface SeverityBadgeProps {
  severity: IssueSeverity
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide',
        severityStyles[severity],
      )}
    >
      {severity}
    </span>
  )
}

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger'
  className?: string
}

const variantStyles = {
  default: 'bg-surface-tertiary text-text-secondary',
  success: 'bg-success-50 text-success',
  warning: 'bg-warning-50 text-warning',
  danger: 'bg-danger-50 text-danger',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
