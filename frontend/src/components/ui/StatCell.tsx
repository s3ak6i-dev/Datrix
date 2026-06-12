import { cn } from '@/lib/utils'

interface Props {
  value: string | number
  label: string
  mono?: boolean
  className?: string
}

export function StatCell({ value, label, mono, className }: Props) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span
        className={cn(
          'text-2xl font-semibold text-text-primary',
          mono && 'font-mono',
        )}
      >
        {value}
      </span>
      <span className="text-xs text-text-secondary uppercase tracking-wide">{label}</span>
    </div>
  )
}
