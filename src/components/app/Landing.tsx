import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { LineImage } from '@/components/app/LineImage'
import { useMedia } from '@/lib/hooks'
import { hrefFor, VIEWS, type View } from '@/lib/route'

const BARS = ['#f3f1ea', '#ffd23f', '#3ee0ff', '#4ade80', '#ff5d8f', '#ff3b3b', '#3b5bff']
const SHORT: Record<View, string> = { focus: 'Focus', radio: 'Radio', tv: 'TV', insights: 'Insights', debrief: 'Debrief', lab: 'Lab', settings: 'Settings' }

const LOG = ['STATION  FRICTION', 'FEED ........ OFF', 'SCROLLING ... NOT REQUIRED', 'STORAGE ..... THIS BROWSER', 'SERVER ...... NONE', 'AI .......... NONE', 'STANDBY']

/** Retro: the station ident types itself out, one stepped character at a time. */
function Ident({ still }: { still: boolean }) {
  const text = LOG.join('\n')
  const [n, setN] = useState(still ? text.length : 0)
  useEffect(() => {
    if (still) return
    const id = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), 24)
    return () => clearInterval(id)
  }, [still, text.length])
  return (
    <pre role="img" className="m-0 min-h-[8.6rem] whitespace-pre-wrap font-[family-name:var(--font-cond)] text-[17px] font-semibold leading-[1.35] tracking-[0.06em] text-[#ffd23f]" aria-label={LOG.join('. ')}>
      <span aria-hidden>{text.slice(0, n)}</span>
      <span aria-hidden className="caret" />
    </pre>
  )
}

/** Going in takes a deliberate act: hold the button. Letting go early drains it back out. */
function HoldToEnter({ onEnter, still }: { onEnter: () => void; still: boolean }) {
  const [p, setP] = useState(0)
  const raf = useRef(0)
  const holding = useRef(false)
  const last = useRef(0)
  const done = useRef(false)
  const HOLD = still ? 1 : 900
  const loop = (now: number) => {
    const dt = now - last.current
    last.current = now
    setP((v) => {
      const next = holding.current ? Math.min(1, v + dt / HOLD) : Math.max(0, v - (dt / HOLD) * 2)
      if (next >= 1 && !done.current) { done.current = true; setTimeout(onEnter, 120) }
      return next
    })
    if (holding.current || p > 0) raf.current = requestAnimationFrame(loop)
  }
  const start = () => {
    if (holding.current || done.current) return
    holding.current = true
    last.current = performance.now()
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(loop)
  }
  const stop = () => { holding.current = false; last.current = performance.now(); cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(loop) }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  return (
    <button
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); start() }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); start() } }}
      onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') stop() }}
      onBlur={stop}
      onContextMenu={(e) => e.preventDefault()}
      autoFocus
      className="relative h-14 w-full touch-none select-none overflow-hidden border border-[#ffd23f] bg-transparent text-left sm:w-[19rem]"
      aria-label="Hold to tune in"
    >
      <span className="absolute inset-y-0 left-0 bg-[#ffd23f]" style={{ width: `${p * 100}%` }} aria-hidden />
      <span className="relative flex h-full items-center justify-between px-5 font-[family-name:var(--font-cond)] text-[19px] font-bold uppercase tracking-[0.1em] mix-blend-difference text-[#ffd23f]">
        <span>{p > 0.02 && p < 1 ? 'Keep holding' : 'Hold to tune in'}</span>
        <span aria-hidden>{Math.round(p * 100).toString().padStart(2, '0')}</span>
      </span>
    </button>
  )
}

/** The front page, and the only page that is always black. A broadcast ident over a field of lines. */
export function Landing({ onEnter, onGo }: { onEnter: () => void; onGo: (v: View) => void }) {
  const reduced = !!useReducedMotion()
  const wide = useMedia('(min-width: 900px)')
  const readout = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (readout.current) readout.current.textContent = `X ${(e.clientX / innerWidth).toFixed(3)}  Y ${(e.clientY / innerHeight).toFixed(3)}`
    }
    addEventListener('pointermove', move, { passive: true })
    return () => removeEventListener('pointermove', move)
  }, [])
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#05070c] text-[#f3f1ea]">
      <div className="flex h-2.5 shrink-0" aria-hidden>{BARS.map((c) => <i key={c} className="flex-1" style={{ background: c }} />)}</div>
      <div className="relative min-h-0 flex-[1.3]">
        <LineImage still={reduced} focus={wide ? [0.68, 0.46] : [0.5, 0.36]} className="absolute inset-0 size-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-5 pt-4 font-[family-name:var(--font-cond)] text-sm font-semibold uppercase tracking-[0.12em] sm:px-8">
          <span className="bg-[#05070c] px-2 py-1">Ch 00 / Friction</span>
          <span ref={readout} className="hidden bg-[#05070c] px-2 py-1 sm:block" aria-hidden>X 0.500  Y 0.500</span>
        </div>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0, 0, 1], delay: 0.15 }}
          className="crt crt-flicker absolute bottom-5 left-5 w-[min(21rem,calc(100%-2.5rem))] border border-[#ffd23f] bg-[#05070c] sm:bottom-8 sm:left-8"
        >
          <div className="flex items-center justify-between border-b border-[#ffd23f]/60 px-3 py-1.5 font-[family-name:var(--font-cond)] text-sm font-semibold uppercase tracking-[0.12em] text-[#ffd23f]">
            <span>Station ident</span>
            <span aria-hidden className="flex">{BARS.slice(1).map((c) => <i key={c} className="h-2 w-2.5" style={{ background: c }} />)}</span>
          </div>
          <div className="px-3 py-3"><Ident still={reduced} /></div>
        </motion.div>
      </div>

      <div className="grid shrink-0 gap-4 border-t border-[#f3f1ea]/30 bg-[#05070c] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-end">
        <motion.h1
          className="dot m-0 text-[clamp(2.4rem,11vw,3.4rem)] uppercase text-[#f3f1ea] sm:text-[clamp(3rem,8.4vw,8.5rem)]"
          initial={reduced ? false : { fontWeight: 200, opacity: 0 }}
          animate={{ fontWeight: 800, opacity: 1 }}
          transition={{ duration: 1.4, ease: [0.2, 0, 0, 1], delay: 0.2 }}
        >
          Friction
        </motion.h1>
        <div className="flex min-w-0 flex-col gap-3">
          <p className="max-w-[44ch] text-[16px] leading-[23px]">
            Scrolling has no friction. That is the whole problem. Stay on one radio station or one live channel and every time you drift away gets counted. This site never scrolls. You hold, drag and tune.
          </p>
          <HoldToEnter onEnter={onEnter} still={reduced} />
          <nav aria-label="Go straight to" className="flex flex-wrap gap-x-4 gap-y-1 font-[family-name:var(--font-cond)] text-[15px] font-semibold uppercase tracking-[0.1em] text-[#c3c2bb]">
            {VIEWS.map((v) => (
              <a key={v} href={hrefFor(v)} onClick={(e) => { e.preventDefault(); onGo(v) }} className="inline-flex min-h-8 items-center hover:text-[#ffd23f]">{SHORT[v]}</a>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}
