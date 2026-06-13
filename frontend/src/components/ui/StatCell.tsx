interface Props {
  value: string | number
  label: string
  mono?: boolean
  className?: string
}

export function StatCell({ value, label, mono, className }: Props) {
  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
    >
      <span
        style={{
          fontSize: '24px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
          lineHeight: 1.2,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </span>
    </div>
  )
}
