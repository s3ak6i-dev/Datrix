interface Props {
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ className, style }: Props) {
  return (
    <div
      className={className}
      style={{
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-3)',
        animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        ...style,
      }}
    />
  )
}

export function DatasetRowSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
      }}
    >
      <Skeleton style={{ width: '40px', height: '40px', borderRadius: '9999px', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Skeleton style={{ height: '16px', width: '192px' }} />
        <Skeleton style={{ height: '12px', width: '288px' }} />
      </div>
    </div>
  )
}

export function StatRowSkeleton() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '16px',
        padding: '20px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton style={{ height: '28px', width: '64px' }} />
          <Skeleton style={{ height: '12px', width: '48px' }} />
        </div>
      ))}
    </div>
  )
}

export function IssueCardSkeleton() {
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
      }}
    >
      <Skeleton style={{ width: '16px', height: '16px', borderRadius: '9999px', flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Skeleton style={{ height: '16px', width: '80px' }} />
        <Skeleton style={{ height: '12px', width: '100%' }} />
      </div>
    </div>
  )
}
