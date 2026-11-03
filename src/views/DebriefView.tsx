import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { PageHeader, Panel } from '@/components/app/shared'
import { dateKey } from '@/lib/dates'
import { attentionScore, blockedPerHour, dayTotal, streak, totals } from '@/lib/stats'
import { useStore } from '@/lib/store'

const hr = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`
const hourSum = (log: Record<string, number[]>, h: number) => Object.values(log).reduce((a, r) => a + (r[h] ?? 0), 0)
const SOURCE: Record<string, string> = { radio: 'radio', tv: 'TV', podcast: 'podcasts', silent: 'silence' }

/** counts up to a number once, then follows it; calm motion and reduced motion show the number at once */
function useCount(to: number, still: boolean) {
  const [n, setN] = useState(still ? to : 0)
  useEffect(() => {
    if (still) { setN(to); return }
    let raf = 0
    const from = performance.now()
    const run = (now: number) => {
      const k = Math.min(1, (now - from) / 700)
      setN(Math.round(to * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(run)
    }
    raf = requestAnimationFrame(run)
    return () => cancelAnimationFrame(raf)
  }, [to, still])
  return n
}

/** one figure on the report: a label, a big number, a line under it */
function Figure({ k, v, unit, note, i, still }: { k: string; v: number; unit?: string; note: string; i: number; still: boolean }) {
  const n = useCount(v, still)
  return (
    <motion.div initial={still ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05, duration: 0.25, ease: [0.2, 0, 0, 1] }} className="grid content-between gap-1 border border-ink/25 bg-ground/60 p-3">
      <span className="hud">{k}</span>
      <span className="fig text-[clamp(1.6rem,3.2vw,2.4rem)] font-semibold leading-none">{n}<span className="ml-1 text-[0.45em] font-normal text-ink-2">{unit}</span></span>
      <span className="text-[12px] leading-[1.3] text-ink-2">{note}</span>
    </motion.div>
  )
}

/** Plain sentences and a picture of the day, computed from your own numbers. Nothing to type, nothing to ask, no model, no network. */
export function DebriefView() {
  const s = useStore()
  const still = s.settings.motion === 0 || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  const today = dateKey()
  const focus = dayTotal(s.focusLog, today)
  const blocked = dayTotal(s.urgeLog, today)
  const t = totals(s)
  const hours = Array.from({ length: 24 }, (_, h) => hourSum(s.urgeLog, h))
  const best = Array.from({ length: 24 }, (_, h) => hourSum(s.focusLog, h))
  const worst = hours.indexOf(Math.max(...hours))
  const bestH = best.indexOf(Math.max(...best))
  const run = streak(s.focusLog)
  const per = blockedPerHour(focus, blocked)
  const left = Math.max(0, Math.ceil(s.settings.dailyGoalMin - focus - 1e-9))
  const score = attentionScore(s)
  const shown = useCount(score, still)

  // today's sessions and credits, from the same saved numbers
  const midnight = new Date().setHours(0, 0, 0, 0)
  const mine = s.sessions.filter((x) => x.end >= midnight)
  const done = mine.filter((x) => x.completed).length
  const longest = mine.reduce((a, x) => Math.max(a, x.focusSec), 0) / 60
  const pull = mine.filter((x) => x.lapses > 0).reduce<Record<string, number>>((a, x) => ({ ...a, [x.source]: (a[x.source] ?? 0) + x.lapses }), {})
  const pulled = Object.entries(pull).sort((a, b) => b[1] - a[1])[0]
  const earned = Math.round(s.credits.log.filter((x) => x.t >= midnight && x.n > 0).reduce((a, x) => a + x.n, 0))

  const day = Array.from({ length: 24 }, (_, h) => ({ f: s.focusLog[today]?.[h] ?? 0, u: s.urgeLog[today]?.[h] ?? 0 }))
  const peak = Math.max(30, ...day.map((d) => d.f))
  const nowH = new Date().getHours()

  const heads: { k: string; v: string }[] = [
    ...(pulled ? [{ k: 'Pulled by', v: `Most of today's drifts (${pulled[1]}) came while the ${SOURCE[pulled[0]] ?? pulled[0]} was on. Try a session with something else, or silence.` }] : []),
    { k: 'Worst hour', v: hours[worst] > 0 ? `You drift most around ${hr(worst)}: ${hours[worst]} time${hours[worst] === 1 ? '' : 's'} in total. Put a session there.` : 'No drifts logged yet.' },
    { k: 'Best hour', v: best[bestH] > 0 ? `Your longest holds land around ${hr(bestH)}. Do the hard thing then.` : 'Not enough focus yet.' },
    { k: 'Tomorrow', v: best[bestH] > 0 ? `Start at ${hr(bestH)}, when your holds are longest${longest >= 1 ? `, and aim a little past ${Math.round(longest)} minutes` : ''}.` : 'Pick a time and keep it. The same hour each day is what makes it easy.' },
    { k: 'Next', v: left === 0 ? `Goal of ${s.settings.dailyGoalMin} min met. Stop when it stops being easy.` : `${left} min to your goal of ${s.settings.dailyGoalMin}. One ${Math.min(45, Math.max(15, left))}-minute block does it.` },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader kicker="Debrief" title="What happened" sub="Worked out from the numbers saved in this browser. No AI, no server, nothing to type." />
      {t.focus === 0 ? (
        <Panel className="grid min-h-[9rem] flex-1 place-items-center p-6 text-center">
          <p className="max-w-[40ch] text-[15px] leading-6 text-ink-2">Nothing to read yet. Lock in for one session, even 15 minutes, and this page turns into the report of your day.</p>
        </Panel>
      ) : (
        <Panel className="scroll-y relative flex min-h-[9rem] flex-1 flex-col gap-3 p-3 sm:p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(12rem,0.8fr)_2fr]">
            <motion.div initial={still ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }} className="grid content-between gap-2 border border-signal bg-signal/10 p-4">
              <span className="hud text-signal">Today's score</span>
              <span className="fig flex items-baseline gap-2 leading-none"><span className="text-[clamp(3.4rem,8vw,5.6rem)] font-bold text-signal">{shown}</span><span className="text-lg text-ink-2">/ 100</span></span>
              <span className="h-2 border border-ink/30" aria-hidden><span className="block h-full bg-signal" style={{ width: `${shown}%` }} /></span>
            </motion.div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Figure i={0} still={still} k="Held" v={Math.round(focus)} unit="min" note={`of your ${s.settings.dailyGoalMin} min goal`} />
              <Figure i={1} still={still} k="Drifts" v={Math.round(blocked)} note={per !== null ? `${per} per focused hour` : 'too little focus to rate'} />
              <Figure i={2} still={still} k="Streak" v={run} unit={run === 1 ? 'day' : 'days'} note={run > 0 ? (focus >= 10 ? 'today keeps it alive' : 'needs 10 min today') : 'one 10-min day starts it'} />
              <Figure i={3} still={still} k="Credits" v={earned} note={mine.length ? `${mine.length} session${mine.length === 1 ? '' : 's'}, ${done} finished${longest >= 1 ? `, longest ${Math.round(longest)} min` : ''}` : 'earned today'} />
            </div>
          </div>

          <div className="border border-ink/25 p-3">
            <div className="mb-2 flex items-center justify-between gap-3"><span className="hud">Your day, hour by hour</span><span className="hud flex items-center gap-3 !text-[11px]"><span className="flex items-center gap-1"><span className="size-2 bg-signal" aria-hidden />held</span><span className="flex items-center gap-1"><span className="size-2 bg-ice" aria-hidden />drift</span></span></div>
            <div className="grid h-24 items-end gap-[2px] sm:h-28" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }} aria-hidden>
              {day.map((d, h) => (
                <div key={h} className={`relative flex h-full flex-col justify-end ${h === nowH ? 'bg-ink/[0.07]' : ''}`}>
                  {d.u > 0 && <span className="mb-0.5 grid gap-[2px]">{Array.from({ length: Math.min(3, d.u) }, (_, i) => <span key={i} className="h-[3px] w-full bg-ice" />)}</span>}
                  <motion.span initial={still ? false : { height: 0 }} animate={{ height: `${Math.max(d.f > 0 ? 4 : 0, (d.f / peak) * 100)}%` }} transition={{ delay: 0.15 + h * 0.012, duration: 0.3, ease: [0.2, 0, 0, 1] }} className={`block w-full ${h === bestH && best[bestH] > 0 ? 'bg-signal' : 'bg-signal/50'}`} />
                </div>
              ))}
            </div>
            <div className="mt-1 grid text-[11px] text-ink-3" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }} aria-hidden>
              {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center">{h % 6 === 0 ? hr(h) : ''}</span>)}
            </div>
            <div className="sr-only">Hours with time held today: {day.map((d, h) => (d.f > 0 || d.u > 0 ? `${hr(h)} ${Math.round(d.f)} minutes, ${d.u} drifts` : null)).filter(Boolean).join('; ') || 'none'}.</div>
          </div>

          <ul className="grid content-start gap-x-6 lg:grid-cols-2">
            {heads.map((r, i) => (
              <motion.li key={r.k} initial={still ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05, duration: 0.2, ease: [0.2, 0, 0, 1] }} className="grid grid-cols-[6.5rem_1fr] items-baseline gap-3 border-b border-ink/15 py-2.5">
                <span className="hud">{r.k}</span>
                <span className="text-[14px] leading-[1.45] text-ink">{r.v}</span>
              </motion.li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
