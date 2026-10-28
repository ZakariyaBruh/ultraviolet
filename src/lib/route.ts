export type View = 'focus' | 'radio' | 'tv' | 'podcasts' | 'music' | 'news' | 'learn' | 'together' | 'leaders' | 'books' | 'arcade' | 'insights' | 'debrief' | 'settings'
export type Route = 'home' | View

export const VIEWS: View[] = ['focus', 'radio', 'tv', 'podcasts', 'music', 'news', 'learn', 'together', 'leaders', 'books', 'arcade', 'insights', 'debrief', 'settings']

/** Friendly aliases for subdomains and paths: radio.example.com, app.example.com/tv ... */
const HOST_ALIAS: Record<string, View> = { app: 'focus', focus: 'focus', radio: 'radio', tv: 'tv', podcasts: 'podcasts', pods: 'podcasts', music: 'music', songs: 'music', news: 'news', learn: 'learn', together: 'together', room: 'together', leaders: 'leaders', board: 'leaders', books: 'books', arcade: 'arcade', games: 'arcade', insights: 'insights', stats: 'insights', debrief: 'debrief', settings: 'settings' }

/** The landing page is `/`. Every other screen has its own address, or its own subdomain when one is attached. */
export function routeFromLocation(): Route {
  const seg = location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0].toLowerCase()
  if (seg && (VIEWS as string[]).includes(seg)) return seg as View
  if (seg === 'app') return 'focus'
  const parts = location.hostname.split('.')
  if (!seg && parts.length >= 3 && HOST_ALIAS[parts[0]]) return HOST_ALIAS[parts[0]]
  return 'home'
}

export const hrefFor = (r: Route) => (r === 'home' ? '/' : `/${r}`)
