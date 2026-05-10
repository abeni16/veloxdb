import * as React from 'react'
import { notifyError } from '@/lib/error-notifier'

type ErrorBoundaryProps = {
  children: React.ReactNode
  fallback?: React.ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  error: unknown
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error }
  }

  componentDidCatch(error: unknown) {
    console.error('ErrorBoundary caught an error:', error)
    notifyError(error, {
      category: "internal",
      title: "Unexpected render error",
    })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    if (this.props.fallback) {
      return this.props.fallback
    }

    const message =
      this.state.error instanceof Error ? this.state.error.message : 'Something went wrong.'

    return (
      <div className="p-4 text-xs text-destructive">
        {message}
      </div>
    )
  }
}

