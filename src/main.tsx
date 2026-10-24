import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

/** If saved data ever breaks the app, say so and offer the way out instead of a blank page. */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#000', color: '#f1eee4', fontFamily: 'ui-monospace, monospace', padding: 24 }}>
        <div style={{ maxWidth: 420 }}>
          <p style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#ff7a45' }}>friction.sys / fault</p>
          <p style={{ fontSize: 15, lineHeight: 1.5 }}>Something in the saved data could not be read. Your data is only in this browser. You can reload, or clear it and start fresh.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => location.reload()} style={{ height: 44, padding: '0 20px', background: '#eaf6ff', color: '#000', border: 0, cursor: 'pointer' }}>Reload</button>
            <button onClick={() => { try { localStorage.removeItem('anti-scroll:v1') } catch { /* blocked */ } location.reload() }} style={{ height: 44, padding: '0 20px', background: 'transparent', color: '#f1eee4', border: '1px solid #f1eee4', cursor: 'pointer' }}>Clear data and reload</button>
          </div>
        </div>
      </div>
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </StrictMode>,
)
