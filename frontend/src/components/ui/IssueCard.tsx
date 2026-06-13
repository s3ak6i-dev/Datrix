import { useState } from 'react'
import { AlertCircle, AlertTriangle, Info, Wrench, CheckCircle2 } from 'lucide-react'
import { SeverityBadge } from './Badge'
import type { QualityIssue } from '@/types'

const severityIconColor: Record<string, string> = {
  critical: 'var(--bad)',
  warning: 'var(--warn)',
  info: 'var(--accent)',
}

const icons = {
  critical: <AlertCircle style={{ width: '16px', height: '16px', color: 'var(--bad)', flexShrink: 0 }} />,
  warning: <AlertTriangle style={{ width: '16px', height: '16px', color: 'var(--warn)', flexShrink: 0 }} />,
  info: <Info style={{ width: '16px', height: '16px', color: 'var(--accent)', flexShrink: 0 }} />,
}

interface Props {
  issue: QualityIssue
  onFix?: (issue: QualityIssue) => void
  compact?: boolean
}

export function IssueCard({ issue, onFix, compact }: Props) {
  const isResolved = issue.status === 'resolved'
  const [fixHovered, setFixHovered] = useState(false)

  const leftBorderStyle: React.CSSProperties =
    !isResolved && issue.severity === 'critical'
      ? { borderLeft: '2px solid var(--bad)' }
      : !isResolved && issue.severity === 'warning'
      ? { borderLeft: '2px solid var(--warn)' }
      : {}

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        transition: 'opacity 0.2s',
        opacity: isResolved ? 0.5 : 1,
        ...leftBorderStyle,
      }}
    >
      {isResolved
        ? <CheckCircle2 style={{ width: '16px', height: '16px', color: 'var(--green)', flexShrink: 0 }} />
        : icons[issue.severity]
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {isResolved
            ? (
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--green)' }}>
                Fixed
              </span>
            )
            : <SeverityBadge severity={issue.severity} />
          }
          {issue.column_name && (
            <span
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                background: 'var(--bg-inset)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              {issue.column_name}
            </span>
          )}
        </div>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-primary)',
            marginTop: '4px',
            marginBottom: 0,
            overflow: compact ? 'hidden' : undefined,
            display: compact ? '-webkit-box' : undefined,
            WebkitLineClamp: compact ? 1 : undefined,
            WebkitBoxOrient: compact ? 'vertical' : undefined,
          } as React.CSSProperties}
        >
          {issue.description}
        </p>
        {!compact && !isResolved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {issue.affected_pct.toFixed(1)}% affected
            </span>
            {issue.impact_score > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 500 }}>
                +{issue.impact_score.toFixed(1)}% est. gain
              </span>
            )}
          </div>
        )}
      </div>
      {!isResolved && issue.fix_available && onFix && (
        <button
          onClick={() => onFix(issue)}
          onMouseEnter={() => setFixHovered(true)}
          onMouseLeave={() => setFixHovered(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 500,
            color: fixHovered ? 'var(--accent-hover)' : 'var(--accent)',
            flexShrink: 0,
            padding: '4px 8px',
            borderRadius: 'var(--radius-btn)',
            background: fixHovered ? 'var(--blue-tint)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          <Wrench style={{ width: '12px', height: '12px' }} />
          Fix
        </button>
      )}
    </div>
  )
}
