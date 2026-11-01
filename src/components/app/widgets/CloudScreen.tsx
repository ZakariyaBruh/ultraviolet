import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import Hyperbeam, { type HyperbeamEmbed } from '@hyperbeam/web'
import { verdict } from '@/lib/blocklist'
import { CloudOverlay, StartCard } from './CloudStart'

/**
 * The cloud browser on screen: a Chromium on Hyperbeam streamed into the window (api/cloud.ts starts, meters and ends it). It runs in kiosk mode,
 * so the stream has no address bar of its own: the window's address bar (Browser.tsx) drives it through `CloudControl`. While it starts, the
 * Friction mark draws itself and stays up until the first page is on the stream, so the service's own loading screen is never shown. The
 * session is a paid minute-by-minute resource, so this component is strict about ending it: when the window is closed or the page is left,
 * when the tab has been away for AWAY_MS, and when the lease runs out.
 */
const AWAY_MS = 20_000
const BEAT_MS = 15_000

type Problem = 'limit' | 'full' | 'down' | 'busy'
type Sess = { sid: string; ticket: string; exp: number; left: number }

const post = (body: unknown, keepalive = false) =>
  fetch('/api/cloud', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive, signal: keepalive ? undefined : AbortSignal.timeout(25000) })

/** what the window's address bar and buttons can ask of the live browser; `depth` is how many pages back there are */
export type CloudControl = { go: (url: string) => Promise<void>; reload: () => Promise<void>; back: () => Promise<boolean> }

/** the stream is shown once the live tab is on the real page (see `real`), and at the latest after this long, so a page that never settles is still seen */
const SHOW_MS = 20_000
/** a tab that has been on the real page this long is shown even if it has not finished loading (a page that never stops loading) */
const SETTLE_MS = 2500
/** the splash is never lifted sooner than this after the stream connects: the service shows its own logo over the first frames */
const MIN_MS = 4500
/** the service's own start page, a blank tab and our blocked page are not the page: only an ordinary web address that is not the service's counts */
const real = (u?: string) => { try { const x = new URL(u ?? ''); return /^https?:$/.test(x.protocol) && !/hyperbeam/i.test(x.hostname) && x.pathname !== '/blocked.html' } catch { return false } }
/** where a tab that reached a blocked address is sent: a page of ours (a blank tab shows the service's own start screen); a local run cannot be reached from the server's browser */
const blockedPage = () => (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'about:blank' : `${location.origin}/blocked.html`)

export function CloudScreen({ url, onClock, onProblem, onNote, bind, onAt }: { url: string; onClock: (left: number | null) => void; onProblem: (why: Problem) => void; onNote: (t: string) => void; bind: (c: CloudControl | null) => void; onAt: (url: string, depth: number) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const sess = useRef<Sess | null>(null)
  const hb = useRef<HyperbeamEmbed | null>(null)
  const alive = useRef(true)
  const starting = useRef(false)
  const nowUrl = useRef(url)
  const [phase, setPhase] = useState<'starting' | 'live' | 'away'>('starting')
  const [shown, setShown] = useState(false)
  const depth = useRef(0)
  const watch = useRef<{ poll?: ReturnType<typeof setInterval>; cap?: ReturnType<typeof setTimeout>; show?: ReturnType<typeof setTimeout> }>({})
  const clearWatch = () => { clearInterval(watch.current.poll); clearTimeout(watch.current.cap); clearTimeout(watch.current.show); watch.current = {} }
  const lastAt = useRef('')

  /** ends the session at our end and at Hyperbeam's, and takes the picture down */
  const stop = (keepalive = false) => {
    const s = sess.current
    sess.current = null
    try { hb.current?.destroy() } catch { /* already gone */ }
    hb.current = null
    clearWatch()
    bind(null)
    if (s) void post({ a: 'end', sid: s.sid, ticket: s.ticket }, keepalive).catch(() => {})
    onClock(null)
  }

  const begin = async () => {
    if (starting.current) return
    starting.current = true
    setPhase('starting'); setShown(false); depth.current = 0; lastAt.current = ''
    try {
      const r = await post({ a: 'start', u: nowUrl.current })
      const d = (await r.json().catch(() => null)) as { error?: string; sid?: string; ticket?: string; embed?: string; admin?: string; exp?: number; left?: number } | null
      if (!alive.current) { if (d?.sid && d.ticket) void post({ a: 'end', sid: d.sid, ticket: d.ticket }).catch(() => {}); return }
      if (!r.ok || !d?.sid || !d.ticket || !d.embed || !d.exp) return onProblem(d?.error === 'limit' ? 'limit' : d?.error === 'full' ? 'full' : d?.error === 'busy' ? 'busy' : 'down')
      sess.current = { sid: d.sid, ticket: d.ticket, exp: d.exp, left: d.left ?? 0 }
      const h = await Hyperbeam(box.current!, d.embed, { adminToken: d.admin, onDisconnect: () => { if (sess.current) onProblem('down') } })
      if (!alive.current || !sess.current) { try { h.destroy() } catch { /* gone */ } return }
      hb.current = h
      setPhase('live')
      // the splash stays until the live tab is on the real page and has loaded (or been there SETTLE_MS), so the service's own start screen, a blank
      // tab and anything else it shows on the way are never seen; SHOW_MS is only the last resort. Events can be missed, so the tab is asked too.
      const reveal = () => { clearInterval(watch.current.poll); clearTimeout(watch.current.cap); watch.current.show ??= setTimeout(() => { if (alive.current) setShown(true) }, Math.max(350, MIN_MS - (Date.now() - connected))) }
      let onSite = 0
      const connected = Date.now()
      watch.current.cap = setTimeout(reveal, SHOW_MS)
      watch.current.poll = setInterval(() => {
        void h.tabs.query({ active: true }).then((tabs) => {
          const t = tabs?.[0]
          if (!t || !real(t.url)) { onSite = 0; return }
          onSite ||= Date.now()
          if (t.status === 'complete' || Date.now() - onSite > SETTLE_MS) reveal()
        }).catch(() => {})
      }, 400)
      // the window's address bar and buttons drive the one live tab (the stream has no bar of its own)
      bind({
        go: async (u) => { await h.tabs.update({ url: u }) },
        reload: async () => { await h.tabs.reload() },
        back: async () => { if (depth.current < 1) return false; try { await h.tabs.goBack(); depth.current = Math.max(0, depth.current - 1); onAt(lastAt.current, depth.current); return true } catch { return false } },
      })
      // the blocklist cannot see inside a streamed browser, so the tabs are watched: a tab that goes to a blocked address is sent to our own blocked page
      const guard = (id: number | undefined, u: string | undefined) => {
        if (!u || id == null || /^(about|chrome|chrome-extension):/i.test(u) || (u.startsWith(location.origin) && u.endsWith('/blocked.html'))) return
        nowUrl.current = u
        if (u !== lastAt.current) { if (lastAt.current) depth.current++; lastAt.current = u; onAt(u, depth.current) }
        const v = verdict(u)
        if (!v.ok) { void h.tabs.update(id, { url: blockedPage() }).catch(() => {}); onNote(`That page is on the blocked list (${v.why}), so it was closed.`) }
      }
      void h.tabs.onUpdated.addListener((id, info, tab) => guard(id, info.url ?? tab.url)).catch(() => {})
      void h.tabs.onCreated.addListener((tab) => guard(tab.id, tab.pendingUrl ?? tab.url)).catch(() => {})
    } catch (e) {
      if (alive.current) onProblem('down')
      void e
    } finally { starting.current = false }
  }

  useEffect(() => {
    alive.current = true
    nowUrl.current = url
    void begin()
    // closing the window, leaving the screen or closing the whole page ends the session now (the cron is only the backstop)
    const bye = () => stop(true)
    addEventListener('pagehide', bye)
    addEventListener('beforeunload', bye)
    return () => { removeEventListener('pagehide', bye); removeEventListener('beforeunload', bye); alive.current = false; stop(true) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // the clock, the next chunk of time, and the switch-off when the tab is away
  useEffect(() => {
    let since = 0
    let last = 0
    const t = setInterval(() => {
      const s = sess.current
      // a window tucked into the tray counts as away: nothing is used while it cannot be seen
      if (document.hidden || !document.hasFocus() || useStore.getState().widgets.min?.includes('browser')) {
        since ||= Date.now()
        if (s && Date.now() - since > AWAY_MS) {
          // away: the picture is closed, nothing is used, and it starts again on the page it was on
          try { void hb.current?.tabs.query({ active: true }).then((tabs) => { const u = tabs?.[0]?.url; if (u && !/^(about|chrome):/i.test(u)) nowUrl.current = u }) } catch { /* keep the last address */ }
          stop(); setPhase('away')
        }
        return
      }
      since = 0
      if (phase === 'away' && !starting.current && !sess.current) { void begin(); return }
      if (!s) return
      onClock(Math.max(0, s.left + (s.exp - Math.floor(Date.now() / 1000))))
      if (Date.now() - last >= BEAT_MS || s.exp - Date.now() / 1000 <= 20) {
        last = Date.now()
        void post({ a: 'beat', sid: s.sid, ticket: s.ticket }).then(async (r) => {
          const d = (await r.json().catch(() => null)) as { exp?: number; left?: number } | null
          if (r.status === 410) { stop(); onProblem('limit'); return }
          if (d?.exp && sess.current) { sess.current.exp = d.exp; sess.current.left = d.left ?? sess.current.left }
          if (sess.current && sess.current.exp - Date.now() / 1000 <= 0) { stop(); onProblem('limit') }
        }).catch(() => {})
      }
    }, 1000)
    return () => clearInterval(t)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const away = phase === 'away'
  return (
    <div className="relative size-full bg-ground">
      <div ref={box} className="size-full" data-no-drag />
      <CloudOverlay gone={phase === 'live' && shown}>
        {away
          ? <p className="max-w-[30ch] text-sm text-ink-2">The cloud browser is off while you are away, so it is not using your time. It starts again on the same page when you come back.</p>
          : <StartCard />}
      </CloudOverlay>
    </div>
  )
}
