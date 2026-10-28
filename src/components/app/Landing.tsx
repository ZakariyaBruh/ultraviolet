import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { HoldButton } from '@/components/app/HoldButton'
import { LandingSolids } from '@/components/app/LandingSolids'
import { asciiStage } from '@/lib/theme'
import { DotGrid } from '@/components/app/DotGrid'
import { hrefFor, VIEWS, type View } from '@/lib/route'
import { useStore } from '@/lib/store'

const BARS = ['#f3f1ea', '#ffd23f', '#3ee0ff', '#4ade80', '#ff5d8f', '#ff3b3b', '#3b5bff']
const SHORT: Record<View, string> = { focus: 'Focus', radio: 'Radio', tv: 'TV', podcasts: 'Podcasts', news: 'News', learn: 'Learn', together: 'Together', leaders: 'Leaders', books: 'Books', arcade: 'Arcade', insights: 'Insights', debrief: 'Debrief', settings: 'Settings' }

const LOG = ['Friction, channel 00.', 'A timer, a radio and a TV.', 'It counts when you leave.', 'Hold the button to begin.']

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
    <pre role="img" className="m-0 min-h-[5.6rem] whitespace-pre-wrap font-[family-name:var(--font-cond)] text-[19px] font-semibold leading-[1.35] tracking-[0.02em] text-signal" aria-label={LOG.join(' ')}>
      <span aria-hidden>{text.slice(0, n)}</span>
      <span aria-hidden className="caret" />
    </pre>
  )
}

/** The front page, and the only page that is always black. A broadcast ident over a field of lines. */
export function Landing({ onEnter, onGo }: { onEnter: () => void; onGo: (v: View) => void }) {
  const reduced = !!useReducedMotion()
  const stage = useStore((s) => asciiStage(s.settings.ascii))
  const readout = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (readout.current) readout.current.textContent = `X ${(e.clientX / innerWidth).toFixed(3)}  Y ${(e.clientY / innerHeight).toFixed(3)}`
    }
    addEventListener('pointermove', move, { passive: true })
    return () => removeEventListener('pointermove', move)
  }, [])
  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-y-auto overscroll-contain bg-ground text-ink">
      <div className="flex h-2.5 shrink-0" aria-hidden>{BARS.map((c) => <i key={c} className="flex-1" style={{ background: c }} />)}</div>
      <div className="land-mid relative min-h-[3.25rem] flex-[1.3]">
        <DotGrid still={reduced} className="absolute inset-0 size-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-5 pt-4 font-[family-name:var(--font-cond)] text-sm font-semibold uppercase tracking-[0.12em] sm:px-8">
          <span className="bg-ground px-2 py-1">Ch 00 / Friction</span>
          <span className="flex gap-3">
            <span className="hidden bg-ground px-2 py-1 sm:block" aria-hidden>Move: light up / Click: ripple</span>
            <span ref={readout} className="hidden bg-ground px-2 py-1 sm:block" aria-hidden>X 0.500  Y 0.500</span>
          </span>
        </div>
        <LandingSolids count={1 + Math.ceil(stage / 2)} still={reduced} />
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0, 0, 1], delay: 0.15 }}
          className="land-ident crt crt-flicker absolute bottom-5 left-5 w-[min(21rem,calc(100%-2.5rem))] border border-signal bg-ground sm:bottom-8 sm:left-8"
        >
          <div className="flex items-center justify-between border-b border-signal/60 px-3 py-1.5 font-[family-name:var(--font-cond)] text-sm font-semibold uppercase tracking-[0.12em] text-signal">
            <span>Station ident</span>
            <span aria-hidden className="flex">{BARS.slice(1).map((c) => <i key={c} className="h-2 w-2.5" style={{ background: c }} />)}</span>
          </div>
          <div className="px-3 py-3"><Ident still={reduced} /></div>
        </motion.div>
      </div>

      <div className="grid shrink-0 gap-4 border-t border-ink/30 bg-ground px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-end">
        <motion.h1
          className="dot m-0 min-w-0 text-[clamp(2.4rem,11vw,3.4rem)] uppercase text-ink sm:text-[clamp(3rem,9vw,8.5rem)] lg:text-[clamp(3rem,calc((100vw-30rem)/10),8.5rem)]"
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
          <HoldButton label="Hold to tune in" onDone={onEnter} still={reduced} autoFocus className="sm:w-[19rem]" />
          <nav aria-label="Go straight to" className="flex flex-wrap gap-x-4 gap-y-1 font-[family-name:var(--font-cond)] text-[15px] font-semibold uppercase tracking-[0.1em] text-ink-2">
            {VIEWS.map((v) => (
              <a key={v} href={hrefFor(v)} onClick={(e) => { e.preventDefault(); onGo(v) }} className="inline-flex min-h-8 items-center hover:text-signal">{SHORT[v]}</a>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}
