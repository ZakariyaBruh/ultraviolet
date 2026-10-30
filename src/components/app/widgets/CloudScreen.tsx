import { useEffect, useRef, useState } from 'react'
import Hyperbeam, { type HyperbeamEmbed } from '@hyperbeam/web'
import { motion, useReducedMotion } from 'motion/react'
import { verdict } from '@/lib/blocklist'

/**
 * The cloud browser on screen: a Chromium on Hyperbeam streamed into the window (api/cloud.ts starts, meters and ends it). While it starts, the
 * Friction mark draws itself. The session is a paid minute-by-minute resource, so this component is strict about ending it: when the window is
 * closed or the page is left, when the tab has been away for AWAY_MS, and when the lease runs out.
 */
const AWAY_MS = 20_000
const BEAT_MS = 15_000

type Problem = 'limit' | 'full' | 'down' | 'busy'
type Sess = { sid: string; ticket: string; exp: number; left: number }

const post = (body: unknown, keepalive = false) =>
  fetch('/api/cloud', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive, signal: keepalive ? undefined : AbortSignal.timeout(25000) })

/** the Friction mark, drawn on as the browser starts */
function StartMark() {
  const calm = useReducedMotion()
  return (
    <svg width="132" height="132" viewBox="0 0 64 64" role="img" aria-label="Friction" className="text-ink">
      <motion.circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="butt" style={{ rotate: -100, transformOrigin: '32px 32px' }} initial={{ pathLength: calm ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: calm ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }} />
      <motion.rect x="40" y="10" width="16" height="16" fill="var(--signal)" style={{ transformOrigin: '48px 18px' }} initial={{ scale: calm ? 1 : 0 }} animate={{ scale: [0, 1.25, 1] }} transition={{ delay: calm ? 0 : 0.9, duration: calm ? 0 : 0.28, ease: 'easeOut' }} />
    </svg>
  )
}

const STAGES = ['Finding a free browser', 'Starting Chromium', 'Almost there']

export function CloudScreen({ url, onClock, onProblem, onNote }: { url: string; onClock: (left: number | null) => void; onProblem: (why: Problem) => void; onNote: (t: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const sess = useRef<Sess | null>(null)
  const hb = useRef<HyperbeamEmbed | null>(null)
  const alive = useRef(true)
  const starting = useRef(false)
  const nowUrl = useRef(url)
  const [phase, setPhase] = useState<'starting' | 'live' | 'away'>('starting')
  const [stage, setStage] = useState(0)

  /** ends the session at our end and at Hyperbeam's, and takes the picture down */
  const stop = (keepalive = false) => {
    const s = sess.current
    sess.current = null
    try { hb.current?.destroy() } catch { /* already gone */ }
    hb.current = null
    if (s) void post({ a: 'end', sid: s.sid, ticket: s.ticket }, keepalive).catch(() => {})
    onClock(null)
  }

  const begin = async () => {
    if (starting.current) return
    starting.current = true
    setPhase('starting'); setStage(0)
    const st = setInterval(() => setStage((n) => Math.min(STAGES.length - 1, n + 1)), 2600)
    try {
      const r = await post({ a: 'start', u: nowUrl.current })
      const d = (await r.json().catch(() => null)) as { error?: string; sid?: string; ticket?: string; embed?: string; admin?: string; exp?: number; left?: number } | null
      if (!alive.current) { if (d?.sid && d.ticket) void post({ a: 'end', sid: d.sid, ticket: d.ticket }).catch(() => {}); return }
      if (!r.ok || !d?.sid || !d.ticket || !d.embed || !d.exp) return onProblem(d?.error === 'limit' ? 'limit' : d?.error === 'full' ? 'full' : d?.error === 'busy' ? 'busy' : 'down')
      sess.current = { sid: d.sid, ticket: d.ticket, exp: d.exp, left: d.left ?? 0 }
      setStage(2)
      const h = await Hyperbeam(box.current!, d.embed, { adminToken: d.admin, onDisconnect: () => { if (sess.current) onProblem('down') } })
      if (!alive.current || !sess.current) { try { h.destroy() } catch { /* gone */ } return }
      hb.current = h
      setPhase('live')
      // the blocklist cannot see inside a streamed browser, so the tabs are watched: a tab that goes to a blocked address is sent to a blank page
      const guard = (id: number | undefined, u: string | undefined) => {
        if (!u || id == null || /^(about|chrome|chrome-extension):/i.test(u)) return
        nowUrl.current = u
        const v = verdict(u)
        if (!v.ok) { void h.tabs.update(id, { url: 'about:blank' }).catch(() => {}); onNote(`That page is on the blocked list (${v.why}), so it was closed.`) }
      }
      void h.tabs.onUpdated.addListener((id, info, tab) => guard(id, info.url ?? tab.url)).catch(() => {})
      void h.tabs.onCreated.addListener((tab) => guard(tab.id, tab.pendingUrl ?? tab.url)).catch(() => {})
    } catch (e) {
      if (alive.current) onProblem('down')
      void e
    } finally { clearInterval(st); starting.current = false }
  }

  useEffect(() => {
    alive.current = true
    nowUrl.current = url
    void begin()
    return () => { alive.current = false; stop(true) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // the clock, the next chunk of time, and the switch-off when the tab is away
  useEffect(() => {
    let since = 0
    let last = 0
    const t = setInterval(() => {
      const s = sess.current
      if (document.hidden || !document.hasFocus()) {
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

  return (
    <div className="relative size-full bg-ground">
      <div ref={box} className="size-full" data-no-drag />
      {phase !== 'live' && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-ground p-4 text-center" role="status" aria-live="polite">
          {phase === 'away'
            ? <p className="max-w-[30ch] text-sm text-ink-2">The cloud browser is off while you are away, so it is not using your time. It starts again on the same page when you come back.</p>
            : (
              <div className="grid justify-items-center gap-5">
                <StartMark />
                <p className="hud">Cloud browser · experimental</p>
                <p className="text-[15px] text-ink">{STAGES[stage]}…</p>
                <p className="max-w-[34ch] text-[12px] leading-[1.4] text-ink-3">A real browser, running on a server and streamed to you. It can take up to half a minute to start.</p>
              </div>
            )}
        </div>
      )}
    </div>
  )
}
