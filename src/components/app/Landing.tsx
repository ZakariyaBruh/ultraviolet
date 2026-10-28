import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { HoldButton } from '@/components/app/HoldButton'
import { LandingSolids } from '@/components/app/LandingSolids'
import { asciiStage } from '@/lib/theme'
import { DotGrid } from '@/components/app/DotGrid'
import { hrefFor, VIEWS, type View } from '@/lib/route'
import { useStore } from '@/lib/store'
import { dateKey } from '@/lib/dates'
import { dayTotal, sum } from '@/lib/stats'

const BARS = ['#f3f1ea', '#ffd23f', '#3ee0ff', '#4ade80', '#ff5d8f', '#ff3b3b', '#3b5bff']
const SHORT: Record<View, string> = { focus: 'Focus', radio: 'Radio', tv: 'TV', podcasts: 'Podcasts', news: 'News', learn: 'Learn', together: 'Together', leaders: 'Leaders', books: 'Books', arcade: 'Arcade', insights: 'Insights', debrief: 'Debrief', settings: 'Settings' }

type Line = { cmd: boolean; text: string }

/** What the terminal shows: a short real session. The date and today's numbers are this person's, read when the page opens. */
function session(held: number, drifts: number): Line[] {
  const now = new Date()
  return [
    { cmd: true, text: 'date' },
    { cmd: false, text: `${now.toDateString()}, ${now.toTimeString().slice(0, 5)}` },
    { cmd: true, text: 'ls feeds' },
    { cmd: false, text: 'ls: feeds: No such file or directory' },
    { cmd: true, text: 'sessions --today' },
    { cmd: false, text: `${Math.round(held)} min held, ${drifts} ${drifts === 1 ? 'drift' : 'drifts'}` },
    { cmd: true, text: 'tune --hold' },
  ]
}

/** Retro: a terminal. The prompt is there at once, a command is typed a character at a time, and its answer is printed whole. */
function Ident({ still }: { still: boolean }) {
  const name = useStore((s) => (s.profile?.name ?? 'guest').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'guest')
  const focusLog = useStore((s) => s.focusLog)
  const urgeLog = useStore((s) => s.urgeLog)
  const today = dateKey()
  const lines = useMemo(() => session(dayTotal(focusLog, today), Math.round(sum(urgeLog[today] ?? []))), [focusLog, urgeLog, today])
  const [at, setAt] = useState(still ? lines.length : 0)
  const [n, setN] = useState(0)
  useEffect(() => {
    if (still || at >= lines.length) return
    const l = lines[at]
    const id = setTimeout(() => { if (l.cmd && n < l.text.length) setN(n + 1); else { setAt(at + 1); setN(0) } }, l.cmd ? (n === 0 ? 300 : 55) : 220)
    return () => clearTimeout(id)
  }, [still, at, n, lines])
  const prompt = `${name}@friction:~$ `
  const done = at >= lines.length
  // every line that is finished, then the one being typed; the cursor sits at the end of the last
  const rows = [...lines.slice(0, at), ...(done ? [] : [{ ...lines[at], text: lines[at].cmd ? lines[at].text.slice(0, n) : '' }])]
  return (
    <pre role="img" className="m-0 min-h-[8.6rem] whitespace-pre-wrap break-words font-mono text-[13px] leading-[1.5]" aria-label="A terminal. It prints the date, finds no feeds folder, counts today's sessions, and waits at a prompt to tune in.">
      <span aria-hidden>
        {rows.map((l, i) => (
          <div key={i} className={l.cmd ? 'text-ink' : 'text-ink-2'}>
            {l.cmd && <span className="text-signal">{prompt}</span>}{l.text}{i === rows.length - 1 && <span className="caret" />}
          </div>
        ))}
      </span>
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
        <LandingSolids count={1 + Math.ceil(stage / 2)} still={reduced} />
        <DotGrid still={reduced} className="absolute inset-0 size-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-5 pt-4 font-[family-name:var(--font-cond)] text-sm font-semibold uppercase tracking-[0.12em] sm:px-8">
          <span className="bg-ground px-2 py-1">Ch 00 / Friction</span>
          <span className="flex gap-3">
            <span className="hidden bg-ground px-2 py-1 sm:block" aria-hidden>Move: light up / Click: ripple</span>
            <span ref={readout} className="hidden bg-ground px-2 py-1 sm:block" aria-hidden>X 0.500  Y 0.500</span>
          </span>
        </div>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0, 0, 1], delay: 0.15 }}
          className="land-ident crt crt-flicker absolute bottom-5 left-5 w-[min(23rem,calc(100%-2.5rem))] border border-signal bg-ground sm:bottom-8 sm:left-8"
        >
          <div className="flex items-center justify-between border-b border-signal/60 px-3 py-1.5 font-[family-name:var(--font-cond)] text-sm font-semibold uppercase tracking-[0.12em] text-signal">
            <span>tty1 · friction</span>
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
