import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div
        className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center"
        style={{ color: 'var(--text-secondary)' }}
      >
        <p className="text-sm font-medium text-bad mb-1">Something went wrong</p>
        <p className="text-xs text-text-tertiary mb-4 font-mono">
          {this.state.error?.message ?? 'Unknown error'}
        </p>
        <button
          onClick={() => this.setState({ hasError: false, error: null })}
          className="text-xs px-3 py-1.5 rounded border border-border hover:bg-surface-secondary transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }
}
