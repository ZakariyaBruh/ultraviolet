import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { HoldButton } from '@/components/app/HoldButton'
import { LandingSolids } from '@/components/app/LandingSolids'
import { DotGrid } from '@/components/app/DotGrid'
import { ProductHuntBadge } from '@/components/app/ProductHuntBadge'
import { hrefFor, VIEWS, type View } from '@/lib/route'

const BARS = ['#f3f1ea', '#ffd23f', '#3ee0ff', '#4ade80', '#ff5d8f', '#ff3b3b', '#3b5bff']
const SHORT: Record<View, string> = { focus: 'Focus', radio: 'Radio', tv: 'TV', podcasts: 'Podcasts', music: 'Music', news: 'News', learn: 'Learn', together: 'Together', leaders: 'Leaders', books: 'Books', arcade: 'Arcade', insights: 'Insights', debrief: 'Debrief', support: 'Support', settings: 'Settings' }

/**
 * The front page's terminal. It types itself out a character at a time and says the same few plain things to everyone, and nothing about the
 * person looking at it: no name, no date, no numbers from their sessions. (It was removed once as a gimmick and put back on request, with these words.)
 */
const LINES = [
  'MOVE: LIGHT UP / CLICK: RIPPLE',
  'A focus timer with no feed.',
  'Radio, live TV and lessons to stay with.',
  'AI only where it says so.',
  'Just for you.',
]

/** Retro: the readout types itself out a character at a time, then waits at a prompt. */
function Ident({ still }: { still: boolean }) {
  const lines = LINES
  const total = lines.join('\n').length
  const [n, setN] = useState(still ? total : 0)
  useEffect(() => {
    if (still) return
    const id = setInterval(() => setN((v) => (v >= total ? v : v + 1)), 26)
    return () => clearInterval(id)
  }, [still, total])
  // the characters typed so far, cut into lines
  let left = n
  const shown = lines.map((l) => { const t = l.slice(0, Math.max(0, left)); left -= l.length + 1; return t })
  const last = shown.findLastIndex((t) => t.length > 0)
  return (
    <pre role="img" className="m-0 min-h-[7.2rem] whitespace-pre-wrap break-words font-mono text-[13px] leading-[1.55] tracking-[0.02em]" aria-label={lines.join('. ')}>
      <span aria-hidden>
        {shown.map((t, i) => {
          const at = t.indexOf(': ')
          const prompt = false
          return (
            <div key={i} className={prompt ? 'text-signal' : 'text-ink-2'}>
              {at > 0 ? <>{t.slice(0, at + 2)}<span className="text-ink">{t.slice(at + 2)}</span></> : t}
              {i === Math.max(0, last) && <span className="caret" />}
            </div>
          )
        })}
      </span>
    </pre>
  )
}

/** The front page, and the only page that is always black. A broadcast ident over a field of lines. */
export function Landing({ onEnter, onGo }: { onEnter: () => void; onGo: (v: View) => void }) {
  const reduced = !!useReducedMotion()
  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-y-auto overscroll-contain bg-ground text-ink">
      <div className="flex h-2.5 shrink-0" data-bars aria-hidden>{BARS.map((c) => <i key={c} className="flex-1" style={{ background: c }} />)}</div>
      <div className="land-mid relative min-h-[3.25rem] flex-[1.3]">
        <DotGrid still={reduced} className="absolute inset-0 size-full" />
        <LandingSolids count={1} still={reduced} />
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0, 0, 1], delay: 0.15 }}
          className="land-ident crt crt-flicker absolute bottom-5 left-5 w-[min(23rem,calc(100%-2.5rem))] border border-signal bg-ground sm:bottom-8 sm:left-8"
        >
          <div className="flex items-center justify-between border-b border-signal/60 px-3 py-1.5 font-[family-name:var(--font-cond)] text-sm font-semibold uppercase tracking-[0.12em] text-signal">
            <span>Ch 00 / Friction</span>
            <span aria-hidden data-bars className="flex">{BARS.slice(1).map((c) => <i key={c} className="h-2 w-2.5" style={{ background: c }} />)}</span>
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
            <a href="/blogs" className="inline-flex min-h-8 items-center hover:text-signal">Blog</a>
          </nav>
          <ProductHuntBadge />
          <nav aria-label="About this site" className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-3">
            {[['/about', 'About'], ['/contact', 'Contact'], ['/privacy', 'Privacy'], ['/cookies', 'Cookies'], ['/terms', 'Terms'], ['/support', 'Support']].map(([h, t]) => (
              <a key={h} href={h} className="inline-flex min-h-8 items-center hover:text-signal">{t}</a>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}
