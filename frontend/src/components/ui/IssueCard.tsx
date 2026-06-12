import { AlertCircle, AlertTriangle, Info, Wrench, CheckCircle2 } from 'lucide-react'
import { SeverityBadge } from './Badge'
import { cn } from '@/lib/utils'
import type { QualityIssue } from '@/types'

const icons = {
  critical: <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />,
  info: <Info className="w-4 h-4 text-brand flex-shrink-0" />,
}

interface Props {
  issue: QualityIssue
  onFix?: (issue: QualityIssue) => void
  compact?: boolean
}

export function IssueCard({ issue, onFix, compact }: Props) {
  const isResolved = issue.status === 'resolved'

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border border-border bg-surface-primary transition-opacity',
        !isResolved && issue.severity === 'critical' && 'border-l-2 border-l-danger',
        !isResolved && issue.severity === 'warning' && 'border-l-2 border-l-warning',
        isResolved && 'opacity-50',
      )}
    >
      {isResolved
        ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
        : icons[issue.severity]
      }
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {isResolved
            ? <span className="text-xs font-medium text-success">Fixed</span>
            : <SeverityBadge severity={issue.severity} />
          }
          {issue.column_name && (
            <span className="text-xs font-mono text-text-secondary bg-surface-tertiary px-1.5 py-0.5 rounded">
              {issue.column_name}
            </span>
          )}
        </div>
        <p className={cn('text-sm text-text-primary mt-1', compact && 'line-clamp-1')}>
          {issue.description}
        </p>
        {!compact && !isResolved && (
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs text-text-tertiary">
              {issue.affected_pct.toFixed(1)}% affected
            </span>
            {issue.impact_score > 0 && (
              <span className="text-xs text-success font-medium">
                +{issue.impact_score.toFixed(1)}% est. gain
              </span>
            )}
          </div>
        )}
      </div>
      {!isResolved && issue.fix_available && onFix && (
        <button
          onClick={() => onFix(issue)}
          className="flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-700 flex-shrink-0 px-2 py-1 rounded hover:bg-brand-50 transition-colors"
        >
          <Wrench className="w-3 h-3" />
          Fix
        </button>
      )}
    </div>
  )
}
