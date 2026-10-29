/**
 * The cloud browser in a tab of its own. A page that is heavy or stuck cannot freeze Friction when it runs in a tab (a process) of
 * its own, which an iframe cannot promise on an iPad, and captchas and logins behave better with first-party storage. The cost is
 * that Friction is then in the background, so the tab (relay/public/go.html) tells Friction when it is being looked at; time spent
 * there is not counted as wandering off (the session timer still waits, as it does for any hidden tab).
 */
const RELAY = 'https://friction-relay.vercel.app'
type Ev = { t: number; v: boolean }
let events: Ev[] = []
let installed = false

/** a beat says "being looked at" for this long; the tab beats every 5 seconds */
const FRESH = 12_000

export function listenCloudTab() {
  if (installed || typeof addEventListener !== 'function') return
  installed = true
  addEventListener('message', (e: MessageEvent) => {
    if (e.origin !== RELAY) return
    const d = e.data as { frictionCloud?: number; v?: unknown; t?: unknown } | null
    if (!d || d.frictionCloud !== 1 || typeof d.v !== 'boolean' || typeof d.t !== 'number') return
    events = [...events.slice(-200), { t: d.t, v: d.v }].sort((a, b) => a.t - b.t)
  })
}

/** opens the page in a new tab, as the answer to a press (it has to be one, or the browser blocks it); null when it was blocked */
export function openCloudTab(url: string): Window | null {
  const w = window.open(url, '_blank')
  if (w) events = [...events.slice(-200), { t: Date.now(), v: true }].sort((a, b) => a.t - b.t)
  return w
}

/** how many milliseconds of [from, to] the cloud tab was being looked at */
export function coveredMs(from: number, to: number): number {
  let on = false
  let last = 0
  let lastTrue = 0
  let cover = 0
  const add = (a: number, b: number) => { const lo = Math.max(a, from); const hi = Math.min(b, to); if (hi > lo) cover += hi - lo }
  for (const e of events) {
    if (on) add(last, Math.min(e.t, lastTrue + FRESH))
    if (e.v) { on = true; lastTrue = e.t } else on = false
    last = e.t
  }
  if (on) add(last, Math.min(to, lastTrue + FRESH))
  return cover
}

/** iPhones and iPads (an iPad can say it is a Mac): one thread for a page and the frames inside it */
export const sharesThread = () => typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
