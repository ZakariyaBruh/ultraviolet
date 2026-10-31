import { useEffect, useRef, useState } from 'react'
import { LoadingBlock } from '@/components/app/LoadingBlock'

/**
 * The BACKUP cloud browser: Scramjet 2 (alpha) in the separate friction-relay project, used only when the main one (Hyperbeam, CloudScreen) is
 * down or has no free session. The page runs in this browser, in the relay's own frame, and the relay only fetches its files over one Wisp socket,
 * so it shares the device's thread and it is more likely to break. Time is leased 3 minutes at a time (api/relay.ts) and the frame is taken down
 * when the tab is away, so nothing is spent while it is not in use.
 */
const FRESH = 60
const RENEW = 2
const AWAY_MS = 20_000
type Pass = { base: string; token: string; exp: number; left: number }

async function lease(): Promise<{ pass: Pass } | { error: 'limit' | 'full' | 'down' }> {
  try {
    const r = await fetch('/api/relay', { signal: AbortSignal.timeout(15000) })
    const d = (await r.json().catch(() => null)) as { base?: string; token?: string; exp?: number; left?: number; error?: string } | null
    if (r.status === 429) return { error: d?.error === 'full' ? 'full' : 'limit' }
    if (!r.ok || !d?.token || !d.base || !d.exp) return { error: 'down' }
    return { pass: { base: d.base, token: d.token, exp: d.exp, left: typeof d.left === 'number' ? d.left : 0 } }
  } catch { return { error: 'down' } }
}

export function RelayScreen({ url, onClock, onProblem }: { url: string; onClock: (left: number | null) => void; onProblem: (why: 'limit' | 'full' | 'down') => void }) {
  const pass = useRef<Pass | null>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const busy = useRef(false)
  const loads = useRef(0)
  const [src, setSrc] = useState('')
  const [ready, setReady] = useState(false)
  const [away, setAway] = useState(false)
  const awayRef = useRef(false)
  const frozen = useRef(0)

  const left = () => (pass.current ? Math.max(0, pass.current.left + Math.max(0, pass.current.exp - Math.floor(Date.now() / 1000))) : 0)
  const aim = (p: Pass) => `${p.base}/go.html?u=${encodeURIComponent(url)}&t=${p.token}`

  useEffect(() => {
    let dead = false
    void lease().then((g) => {
      if (dead) return
      if ('error' in g) return onProblem(g.error)
      pass.current = g.pass
      try { localStorage.setItem('friction:relay', '1') } catch { /* storage blocked */ }
      setSrc(aim(g.pass))
    })
    return () => { dead = true; onClock(null) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 9000)
    return () => clearTimeout(t)
  }, [src])

  // the clock, the next lease before this one ends, and the switch-off when the tab is away
  useEffect(() => {
    let since = 0
    const run = async () => {
      const p = pass.current
      if (!p) return
      onClock(awayRef.current ? frozen.current : left())
      if (document.hidden || !document.hasFocus()) {
        since ||= Date.now()
        if (!awayRef.current && Date.now() - since > AWAY_MS) { frozen.current = left(); awayRef.current = true; setAway(true) }
        return
      }
      since = 0
      if (busy.current) return
      if (awayRef.current) {
        busy.current = true
        let next = p
        if (p.exp < Date.now() / 1000 + FRESH) { const g = await lease(); if ('error' in g) { busy.current = false; return onProblem(g.error) } next = g.pass; pass.current = next }
        busy.current = false
        awayRef.current = false; setAway(false); setReady(false); loads.current = 0
        setSrc(aim(next))
        return
      }
      if (p.exp - Date.now() / 1000 <= RENEW) {
        busy.current = true
        const g = await lease()
        busy.current = false
        if ('error' in g) return onProblem(g.error === 'down' ? 'down' : g.error)
        pass.current = g.pass
        frame.current?.contentWindow?.postMessage({ frictionPass: g.pass.token }, g.pass.base)
      }
    }
    const t = setInterval(() => void run(), 1000)
    return () => clearInterval(t)
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative size-full bg-ground">
      {!ready && <div className="absolute inset-0 z-10 grid place-items-center bg-ground"><LoadingBlock label="Starting the backup browser" size={56} /></div>}
      {away
        ? <div className="grid size-full place-items-center bg-ground p-4 text-center"><p className="max-w-[28ch] text-sm text-ink-2" role="status">The cloud browser is off while you are away, so it is not using your time. It starts again when you come back.</p></div>
        : src && <iframe ref={frame} key={src} title={`Backup cloud browser page: ${url}`} src={src} sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-storage-access-by-user-activation" allow="clipboard-read; clipboard-write; fullscreen; autoplay; encrypted-media; picture-in-picture; publickey-credentials-get; storage-access" referrerPolicy="no-referrer" onLoad={() => { if (++loads.current > 1) setReady(true) }} className="size-full border-0 bg-white" />}
    </div>
  )
}
