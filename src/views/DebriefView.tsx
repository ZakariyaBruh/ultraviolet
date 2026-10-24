import { motion } from 'motion/react'
import { AsciiSolid } from '@/components/app/AsciiSolid'
import { PageHeader, Panel } from '@/components/app/shared'
import { useMedia } from '@/lib/hooks'
import { dateKey } from '@/lib/dates'
import { attentionScore, blockedPerHour, dayTotal, streak, totals } from '@/lib/stats'
import { useStore } from '@/lib/store'

const hr = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`
const hourSum = (log: Record<string, number[]>, h: number) => Object.values(log).reduce((a, r) => a + (r[h] ?? 0), 0)

/** Plain sentences computed from your own numbers. Nothing to type, nothing to ask, no model, no network. */
export function DebriefView() {
  const s = useStore()
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
  const left = Math.max(0, s.settings.dailyGoalMin - focus)

  const wide = useMedia('(min-width: 1100px)')
  const rows: { k: string; v: string }[] =
    t.focus === 0
      ? [{ k: 'Status', v: 'Nothing to read yet. Lock in for one session, even 15 minutes, and this page fills in with what actually happened.' }]
      : [
          { k: 'Score', v: `${attentionScore(s)} of 100 today.` },
          { k: 'Today', v: `${Math.round(focus)} min held, ${Math.round(blocked)} drifts${per !== null ? `, ${per} per focused hour` : ''}.` },
          { k: 'Worst hour', v: hours[worst] > 0 ? `You drift most around ${hr(worst)}: ${hours[worst]} times in total. Put a session there.` : 'No drifts logged yet.' },
          { k: 'Best hour', v: best[bestH] > 0 ? `Your longest holds land around ${hr(bestH)}. Do the hard thing then.` : 'Not enough focus yet.' },
          { k: 'Streak', v: run > 0 ? `${run} day${run === 1 ? '' : 's'} of 10+ minutes. ${focus >= 10 ? 'Today keeps it alive.' : 'Today needs 10 minutes to keep it.'}` : 'No streak yet. One day of 10+ minutes starts it.' },
          { k: 'Next', v: left === 0 ? `Goal of ${s.settings.dailyGoalMin} min met. Stop when it stops being easy.` : `${left} min to your goal of ${s.settings.dailyGoalMin}. One ${Math.min(45, Math.max(15, left))}-minute block does it.` },
        ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader kicker="Debrief" title="What happened" sub="Worked out from the numbers saved in this browser. No AI, no server, nothing to type." />
      <Panel className="relative min-h-0 flex-1 overflow-hidden p-0">
        {wide && <div className="pointer-events-none absolute bottom-3 right-4 text-signal opacity-70" aria-hidden><AsciiSolid cols={64} rows={30} speed={0.7} className="text-[9px]" /></div>}
        <ul className="grid h-full content-start">
          {rows.map((r, i) => (
            <motion.li key={r.k} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.2, ease: [0.2, 0, 0, 1] }} className="grid grid-cols-[7rem_1fr] items-baseline gap-4 border-b border-ink/15 px-5 py-3.5 last:border-b-0 sm:grid-cols-[10rem_1fr]">
              <span className="hud">{r.k}</span>
              <span className="text-[15px] leading-6 text-ink">{r.v}</span>
            </motion.li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
