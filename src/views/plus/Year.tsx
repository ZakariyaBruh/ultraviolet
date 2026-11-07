import { Panel } from '@/components/app/shared'
import { dateKey, fmtMinutes, parseKey } from '@/lib/dates'
import { useStore } from '@/lib/store'
import { dayTotal, lastDays } from '@/lib/stats'

/** every day of the last 52 weeks, brighter the more you held. Honest numbers from the saved log. */
export function Year() {
  const focusLog = useStore((s) => s.focusLog)
  const days = lastDays(371)
  const first = parseKey(days[0]).getDay()
  const mins = days.map((d) => Math.round(dayTotal(focusLog, d)))
  const max = Math.max(1, ...mins)
  const total = mins.reduce((a, b) => a + b, 0)
  const active = mins.filter((m) => m > 0).length
  const today = dateKey()
  return (
    <Panel className="flex h-full min-h-[14rem] flex-col gap-3 p-4">
      <p className="hud">The last 52 weeks</p>
      <div className="grid min-h-0 flex-1 content-center">
        <div className="grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: 'repeat(7, 1fr)', aspectRatio: '53 / 7' }} role="img" aria-label={`${active} days with focus in the last 52 weeks, ${fmtMinutes(total)} in all`}>
          {Array.from({ length: first }, (_, i) => <span key={`p${i}`} />)}
          {days.map((d, i) => (
            <span key={d} title={`${d}: ${mins[i]} min`} className={`min-h-0 min-w-0 bg-signal ${d === today ? 'outline outline-1 outline-ink/60' : ''}`} style={{ opacity: mins[i] ? 0.2 + 0.8 * (mins[i] / max) : 0.06 }} />
          ))}
        </div>
      </div>
      <p className="text-[13px] text-ink-2">{active} days with focus, {fmtMinutes(total)} held in all. The brightest day was {fmtMinutes(max)}.</p>
    </Panel>
  )
}
