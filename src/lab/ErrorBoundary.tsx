import { Component, type ReactNode } from 'react'

export class StageBoundary extends Component<{ children: ReactNode; name: string }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
  componentDidCatch(e: unknown) {
    console.warn(`[lab] ${this.props.name} failed to render`, e)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="grid h-full place-items-center p-4 text-center text-sm text-ink-2">
          <div>
            <div className="font-medium text-ink">Could not render {this.props.name}</div>
            <div className="mt-1 text-xs">{this.state.error.slice(0, 140)}</div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
