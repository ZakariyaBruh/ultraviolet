export type View = 'focus' | 'radio' | 'tv' | 'podcasts' | 'music' | 'news' | 'learn' | 'together' | 'leaders' | 'books' | 'arcade' | 'insights' | 'debrief' | 'settings'
export type Route = 'home' | 'privacy' | 'missing' | View

export const VIEWS: View[] = ['focus', 'radio', 'tv', 'podcasts', 'music', 'news', 'learn', 'together', 'leaders', 'books', 'arcade', 'insights', 'debrief', 'settings']

/** Friendly aliases for subdomains and paths: radio.example.com, app.example.com/tv ... */
const HOST_ALIAS: Record<string, View> = { app: 'focus', focus: 'focus', radio: 'radio', tv: 'tv', podcasts: 'podcasts', pods: 'podcasts', music: 'music', songs: 'music', news: 'news', learn: 'learn', together: 'together', room: 'together', leaders: 'leaders', board: 'leaders', books: 'books', arcade: 'arcade', games: 'arcade', insights: 'insights', stats: 'insights', debrief: 'debrief', settings: 'settings' }

/**
 * The landing page is `/`. Every other screen has its own address, or its own subdomain when one is attached.
 * An address that is not one of those screens is `missing` (the not-found page), not the front page.
 */
export function routeFromLocation(): Route {
  const path = location.pathname.replace(/\/+$/, '') || '/'
  if (path !== '/') {
    let seg = path.slice(1)
    try { seg = decodeURIComponent(seg) } catch { /* keep the raw segment */ }
    if (seg.includes('/')) return 'missing'
    const key = seg.toLowerCase()
    if (key === 'app') return 'focus'
    if (key === 'privacy') return 'privacy'
    if ((VIEWS as string[]).includes(key)) return key as View
    return 'missing'
  }
  const parts = location.hostname.split('.')
  if (parts.length >= 3 && HOST_ALIAS[parts[0]]) return HOST_ALIAS[parts[0]]
  return 'home'
}

export const hrefFor = (r: Route) => (r === 'home' || r === 'missing' ? '/' : `/${r}`)
