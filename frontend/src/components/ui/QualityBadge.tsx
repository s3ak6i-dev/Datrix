interface Props {
  score: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showLabel?: boolean
}

const sizeDimensions: Record<NonNullable<Props['size']>, { wh: string; fontSize: string; fontWeight: number }> = {
  sm: { wh: '32px', fontSize: '12px', fontWeight: 500 },
  md: { wh: '40px', fontSize: '14px', fontWeight: 500 },
  lg: { wh: '56px', fontSize: '18px', fontWeight: 600 },
  xl: { wh: '80px', fontSize: '24px', fontWeight: 600 },
}

function scoreTokens(score: number): { ring: string; bg: string; text: string } {
  if (score >= 80) return { ring: 'var(--green)', bg: 'var(--green-dim)', text: 'var(--green)' }
  if (score >= 60) return { ring: 'var(--warn)', bg: 'var(--warn-dim)', text: 'var(--warn)' }
  return { ring: 'var(--bad)', bg: 'var(--bad-dim)', text: 'var(--bad)' }
}

export function QualityBadge({ score, size = 'md', showLabel }: Props) {
  const tokens = scoreTokens(score)
  const dims = sizeDimensions[size]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: dims.wh,
          height: dims.wh,
          borderRadius: '9999px',
          outline: `2px solid ${tokens.ring}`,
          outlineOffset: '0px',
          background: tokens.bg,
          color: tokens.text,
          fontFamily: 'var(--font-mono)',
          fontSize: dims.fontSize,
          fontWeight: dims.fontWeight,
        }}
      >
        {Math.round(score)}
      </div>
      {showLabel && (
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: tokens.text,
          }}
        >
          {score >= 80 ? 'Good' : score >= 60 ? 'Fair' : 'Needs work'}
        </span>
      )}
    </div>
  )
}
