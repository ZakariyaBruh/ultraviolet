/** Google Analytics 4, page visits only. The script is added after an explicit Allow, never before. */

const ID = 'G-CZ1GG7FPZ1'
const KEY = 'friction:analytics'
const EVENT = 'friction-analytics'

export type AnalyticsConsent = 'granted' | 'denied' | 'unknown'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let booted = false
let wanted = '/'

function installGtag() {
  window.dataLayer = window.dataLayer ?? []
  if (window.gtag) return
  // Google's snippet pushes the arguments object. A plain array is not read the same way.
  window.gtag = function gtag() {
    window.dataLayer?.push(arguments)
  } as Window['gtag']
}

export function analyticsConsent(): AnalyticsConsent {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'granted' || v === 'denied') return v
  } catch { /* private mode: treat as undecided, and do not load anything */ }
  return 'unknown'
}

function clearGaCookies() {
  const host = location.hostname
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim()
    if (!name?.startsWith('_ga')) continue
    const expire = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
    document.cookie = expire
    document.cookie = `${expire};domain=${host}`
    document.cookie = `${expire};domain=.${host}`
  }
}

/** Record the page the person is on. No request is made until they have allowed it and the script is in. */
export function trackPage(path: string) {
  wanted = path || '/'
  if (!booted || analyticsConsent() !== 'granted') return
  window.gtag?.('event', 'page_view', { page_path: wanted, page_location: `${location.origin}${wanted}` })
}

export function loadAnalytics() {
  if (analyticsConsent() !== 'granted') return
  ;(window as unknown as Record<string, unknown>)[`ga-disable-${ID}`] = false
  if (!document.getElementById('ga-script')) {
    installGtag()
    window.gtag?.('js', new Date())
    window.gtag?.('config', ID, { send_page_view: false })
    const s = document.createElement('script')
    s.id = 'ga-script'
    s.async = true
    s.src = `https://www.googletagmanager.com/gtag/js?id=${ID}`
    document.head.appendChild(s)
  }
  booted = true
  trackPage(wanted)
}

export function bootAnalytics() {
  if (analyticsConsent() === 'granted') loadAnalytics()
}

export function setAnalyticsConsent(v: 'granted' | 'denied') {
  try { localStorage.setItem(KEY, v) } catch { /* private mode: the choice lasts for this page only */ }
  if (v === 'granted') loadAnalytics()
  else {
    ;(window as unknown as Record<string, unknown>)[`ga-disable-${ID}`] = true
    booted = false
    clearGaCookies()
  }
  dispatchEvent(new Event(EVENT))
}

export const analyticsEvent = EVENT
