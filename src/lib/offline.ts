import { fx_say } from './actions'

/**
 * Working without a connection. The service worker (scripts/sw.js, written to /sw.js by the build) keeps a copy of the app's own
 * files, so after one visit Friction opens offline and repeat visits start from the device. This file starts it, tells it which
 * files this visit has already fetched (the first visit is over before the worker is in charge), and says in words when the
 * connection goes and comes back, once each, so nobody wonders why a station stopped.
 */
export function startOffline() {
  if (typeof window === 'undefined') return
  // a development server has no worker: its files change under it
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const begin = () => {
      navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then((reg) => {
        const mine = `${location.origin}/assets/`
        const fetched = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(mine)).map((u) => new URL(u).pathname)
        reg.active?.postMessage({ keep: [location.pathname, ...new Set(fetched)] })
      }).catch(() => undefined) // no worker (private mode, an old browser): the app works as it always did, online
    }
    if (document.readyState === 'complete') begin(); else addEventListener('load', begin, { once: true })
  }
  let told = false
  addEventListener('offline', () => {
    if (told) return
    told = true
    fx_say({ title: 'You are offline', description: 'The timer, your windows and everything you have saved keep working. Stations, lessons and the board need a connection.', variant: 'warning' })
  })
  addEventListener('online', () => {
    if (!told) return
    told = false
    fx_say({ title: 'Back online' })
  })
}
