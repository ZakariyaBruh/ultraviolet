import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './themes.css'
import App from './App'
import { preloadScreen } from '@/components/app/screens'
import { routeFromLocation } from '@/lib/route'
import { fontsForRetro, fontsForTheme } from '@/lib/fonts'
import { useStore } from '@/lib/store'
import { eraStage } from '@/lib/theme'
import { startOffline } from '@/lib/offline'

/** If saved data ever breaks the app, say so and offer the way out instead of a blank page. */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#05070c', color: '#f3f1ea', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <div style={{ maxWidth: 420 }}>
          <p style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#ffd23f' }}>friction.sys / fault</p>
          <p style={{ fontSize: 15, lineHeight: 1.5 }}>Something in the saved data could not be read. Your data is only in this browser. You can reload, or clear it and start fresh.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => location.reload()} style={{ height: 44, padding: '0 20px', background: '#ffd23f', color: '#000', border: 0, cursor: 'pointer' }}>Reload</button>
            <button onClick={() => { try { localStorage.removeItem('anti-scroll:v1') } catch { /* blocked */ } location.reload() }} style={{ height: 44, padding: '0 20px', background: 'transparent', color: '#f1eee4', border: '1px solid #f1eee4', cursor: 'pointer' }}>Clear data and reload</button>
          </div>
        </div>
      </div>
    )
  }
}

/**
 * The screen this visit opens on is its own file. The built page asks for it alongside this one (the modulepreload links written by
 * scripts/prerender.mjs), so it is usually here by now; waiting a moment for it means the first thing drawn is the whole screen
 * rather than its frame and then, a beat later, what goes in it. If it is slow, the frame is drawn without it.
 */
const first = preloadScreen(routeFromLocation())
// the saved look's own faces, if it has any, are asked for now rather than after the first paint (lib/fonts.ts)
{ const s = useStore.getState().settings; fontsForTheme(s.theme); fontsForRetro(eraStage(s.era)) }
void Promise.race([first, new Promise((done) => setTimeout(done, 150))]).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Boundary>
        <App />
      </Boundary>
    </StrictMode>,
  )
})

// keep a copy of the app for when there is no connection, and say so when the connection goes (lib/offline.ts)
startOffline()
