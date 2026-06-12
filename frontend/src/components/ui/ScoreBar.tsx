import { cn } from '@/lib/utils'

interface Props {
  label: string
  score: number
  className?: string
}

export function ScoreBar({ label, score, className }: Props) {
  const color =
    score >= 80 ? 'bg-success' : score >= 60 ? 'bg-warning' : 'bg-danger'
  const textColor =
    score >= 80 ? 'text-success' : score >= 60 ? 'text-warning' : 'text-danger'
  const qualLabel =
    score >= 80 ? 'Good' : score >= 60 ? 'Fair' : 'Needs work'

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="w-28 text-sm text-text-secondary flex-shrink-0">{label}</span>
      <span className={cn('w-8 text-sm font-mono font-medium flex-shrink-0', textColor)}>
        {Math.round(score)}
      </span>
      <div className="flex-1 h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn('w-20 text-xs flex-shrink-0', textColor)}>{qualLabel}</span>
    </div>
  )
}
