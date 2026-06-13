import { useState } from 'react'
import { Loader2 } from 'lucide-react'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

const sizeStyles: Record<NonNullable<Props['size']>, React.CSSProperties> = {
  sm: { padding: '7px 12px', fontSize: '13px' },
  md: { padding: '10px 18px', fontSize: '14px' },
  lg: { padding: '13px 22px', fontSize: '15px' },
}

const baseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  lineHeight: 1,
  transition: 'background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s, transform 0.15s',
  borderRadius: 'var(--radius-btn)',
  fontFamily: 'var(--font-sans)',
}

type VariantKey = NonNullable<Props['variant']>

function getVariantStyle(variant: VariantKey, hovered: boolean): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return {
        background: hovered ? 'var(--accent-hover)' : 'var(--accent)',
        color: 'var(--text-on-accent)',
        border: 'none',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: hovered ? '0 8px 30px var(--blue-glow)' : 'none',
      }
    case 'secondary':
      return {
        background: 'transparent',
        border: `1px solid ${hovered ? 'var(--border-strong)' : 'var(--border)'}`,
        color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
      }
    case 'ghost':
      return {
        background: hovered ? 'var(--blue-tint)' : 'transparent',
        border: `1px solid ${hovered ? 'var(--accent)' : 'var(--border-accent)'}`,
        color: 'var(--text-primary)',
      }
    case 'danger':
      return {
        background: 'var(--bad)',
        color: 'white',
        border: 'none',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: hovered ? '0 8px 30px rgba(248,113,113,.35)' : 'none',
      }
  }
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  children,
  style,
  disabled,
  ...props
}: Props) {
  const [hovered, setHovered] = useState(false)
  const isDisabled = disabled || loading

  const computedStyle: React.CSSProperties = {
    ...baseStyle,
    ...sizeStyles[size],
    ...getVariantStyle(variant, hovered && !isDisabled),
    ...(isDisabled ? { opacity: 0.45, pointerEvents: 'none' } : {}),
    ...(loading ? { opacity: 0.75 } : {}),
    ...style,
  }

  return (
    <button
      {...props}
      disabled={isDisabled}
      aria-busy={loading ?? undefined}
      style={computedStyle}
      onMouseEnter={(e) => { setHovered(true); props.onMouseEnter?.(e) }}
      onMouseLeave={(e) => { setHovered(false); props.onMouseLeave?.(e) }}
    >
      {loading && (
        <Loader2
          style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }}
        />
      )}
      {children}
    </button>
  )
}
