import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

export function Skeleton({ className }: Props) {
  return (
    <div
      className={cn(
        'rounded-md bg-surface-tertiary animate-pulse',
        className,
      )}
    />
  )
}

export function DatasetRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-surface-primary">
      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-72" />
      </div>
    </div>
  )
}

export function StatRowSkeleton() {
  return (
    <div className="grid grid-cols-5 gap-4 p-5 bg-surface-primary border border-border rounded-xl">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  )
}

export function IssueCardSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-surface-primary">
      <Skeleton className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  )
}
