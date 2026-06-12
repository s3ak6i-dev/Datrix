import { cn } from '@/lib/utils'

interface Props {
  score: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showLabel?: boolean
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs font-medium',
  md: 'w-10 h-10 text-sm font-medium',
  lg: 'w-14 h-14 text-lg font-semibold',
  xl: 'w-20 h-20 text-2xl font-semibold',
}

function scoreColor(score: number) {
  if (score >= 80) return { ring: 'ring-success', bg: 'bg-success-50', text: 'text-success' }
  if (score >= 60) return { ring: 'ring-warning', bg: 'bg-warning-50', text: 'text-warning' }
  return { ring: 'ring-danger', bg: 'bg-danger-50', text: 'text-danger' }
}

export function QualityBadge({ score, size = 'md', showLabel }: Props) {
  const colors = scoreColor(score)
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          'flex items-center justify-center rounded-full ring-2 font-mono',
          sizeClasses[size],
          colors.ring,
          colors.bg,
          colors.text,
        )}
      >
        {Math.round(score)}
      </div>
      {showLabel && (
        <span className={cn('text-xs font-medium', colors.text)}>
          {score >= 80 ? 'Good' : score >= 60 ? 'Fair' : 'Needs work'}
        </span>
      )}
    </div>
  )
}
