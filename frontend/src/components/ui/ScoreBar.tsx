interface Props {
  label: string
  score: number
  className?: string
}

function scoreTokens(score: number): { fill: string; text: string } {
  if (score >= 80) return { fill: 'var(--green)', text: 'var(--green)' }
  if (score >= 60) return { fill: 'var(--warn)', text: 'var(--warn)' }
  return { fill: 'var(--bad)', text: 'var(--bad)' }
}

export function ScoreBar({ label, score, className }: Props) {
  const tokens = scoreTokens(score)
  const qualLabel = score >= 80 ? 'Good' : score >= 60 ? 'Fair' : 'Needs work'

  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
    >
      <span
        style={{
          width: '112px',
          fontSize: '14px',
          color: 'var(--text-secondary)',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          width: '32px',
          fontSize: '14px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 500,
          flexShrink: 0,
          color: tokens.text,
        }}
      >
        {Math.round(score)}
      </span>
      <div
        style={{
          flex: 1,
          height: '6px',
          background: 'var(--bg-3)',
          borderRadius: 'var(--radius-pill)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 'var(--radius-pill)',
            background: tokens.fill,
            width: `${score}%`,
            transition: 'width 0.5s ease',
          }}
        />
      </div>
      <span
        style={{
          width: '80px',
          fontSize: '12px',
          flexShrink: 0,
          color: tokens.text,
        }}
      >
        {qualLabel}
      </span>
    </div>
  )
}
