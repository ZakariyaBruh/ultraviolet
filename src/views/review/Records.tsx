import { Panel } from '@/components/app/shared'
import { dateKey, daysAgo, fmtMinutes, parseKey } from '@/lib/dates'
import { dayTotal } from '@/lib/stats'
import { useStore } from '@/lib/store'

/** personal records worked out from the saved log and sessions. Nothing here is estimated. */
export function Records() {
  const focusLog = useStore((s) => s.focusLog)
  const sessions = useStore((s) => s.sessions)
  const keys = Object.keys(focusLog).filter((k) => dayTotal(focusLog, k) > 0).sort()
  const total = keys.reduce((a, k) => a + dayTotal(focusLog, k), 0)
  const best = keys.reduce<{ k: string; m: number } | null>((b, k) => { const m = dayTotal(focusLog, k); return !b || m > b.m ? { k, m } : b }, null)
  // longest run of days in a row, and the run you are on now
  let run = 0, longest = 0, prev = 0
  for (const k of keys) { const t = parseKey(k).getTime(); run = prev && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1; longest = Math.max(longest, run); prev = t }
  const today = dateKey(), yest = dateKey(daysAgo(1))
  let now = 0
  if (keys.includes(today) || keys.includes(yest)) { for (let i = keys.includes(today) ? 0 : 1; keys.includes(dateKey(daysAgo(i))); i++) now++ }
  const longestSession = sessions.reduce((m, x) => Math.max(m, x.focusSec), 0) / 60
  const clean = sessions.filter((x) => x.completed && x.lapses === 0).length
  const hours = new Array(24).fill(0)
  for (const k of keys) for (let h = 0; h < 24; h++) hours[h] += focusLog[k][h] ?? 0
  const bestHour = hours.some((v) => v > 0) ? hours.indexOf(Math.max(...hours)) : -1
  const figs: [string, string, string][] = [
    ['All time', fmtMinutes(total), `${keys.length} days with focus`],
    ['Best day', best ? fmtMinutes(best.m) : 'none yet', best ? parseKey(best.k).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Focus to set one'],
    ['Longest run', `${longest} day${longest === 1 ? '' : 's'}`, `${now} in a row right now`],
    ['Longest session', longestSession ? fmtMinutes(longestSession) : 'none yet', 'one lock-in'],
    ['Clean finishes', String(clean), 'finished with no drift'],
    ['Best hour', bestHour < 0 ? 'none yet' : `${String(bestHour).padStart(2, '0')}:00`, 'when you hold the most'],
  ]
  return (
    <Panel className="flex h-full min-h-[16rem] flex-col gap-3 p-4">
      <p className="hud">Your records</p>
      <div className="scroll-y grid min-h-0 flex-1 content-start gap-3 sm:grid-cols-2 lg:grid-cols-3" data-no-drag tabIndex={0} role="region" aria-label="Your records">
        {figs.map(([k, v, note]) => (
          <div key={k} className="grid content-start gap-1 border border-ink/15 bg-ink/[0.03] p-4">
            <p className="hud">{k}</p>
            <p className="dot text-[clamp(1.5rem,3vw,2.2rem)] font-bold leading-none">{v}</p>
            <p className="text-[13px] text-ink-2">{note}</p>
          </div>
        ))}
      </div>
    </Panel>
  )
}
