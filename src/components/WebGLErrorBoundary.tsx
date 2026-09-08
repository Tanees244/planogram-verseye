'use client'

import { Component, type ReactNode } from 'react'

type State = { hasError: boolean }

/** Catches THREE/R3F "Error creating WebGL context" so the editor can retry. */
export class WebGLErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  State
> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('[WebGL] context failed', error)
  }

  reset() {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
