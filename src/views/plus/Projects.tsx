import { Tag } from 'lucide-react'
import { useState } from 'react'
import { Panel, Seg } from '@/components/app/shared'
import { daysAgo, fmtMinutes } from '@/lib/dates'
import { NO_PROJECT, projectTotals, weekStart } from '@/lib/plus'
import { goTo } from '@/lib/supporter'
import { sum } from '@/lib/stats'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const RANGES = [{ id: 'week', label: 'This week' }, { id: 'month', label: '30 days' }, { id: 'all', label: 'All time' }]

/** where the hours went, by the project each session was labelled with */
export function Projects() {
  const sessions = useStore((s) => s.sessions)
  const [range, setRange] = useState('week')
  const since = range === 'week' ? weekStart().getTime() : range === 'month' ? daysAgo(29).setHours(0, 0, 0, 0) : 0
  const rows = projectTotals(sessions, since)
  const named = rows.filter((r) => r.name !== NO_PROJECT)
  const total = sum(rows.map((r) => r.min))
  const top = Math.max(1, ...rows.map((r) => r.min))
  return (
    <Panel className="flex h-full min-h-[15rem] flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="hud">Time by project</p>
        <Seg id="proj" value={range} onChange={setRange} tabs={RANGES} />
      </div>
      {named.length === 0 ? (
        <div className="grid min-h-0 flex-1 content-center justify-items-start gap-3 p-2">
          <Tag className="size-6 text-signal" aria-hidden />
          <h2 className="text-lg font-semibold">{rows.length ? 'No labelled sessions in this period' : 'No sessions in this period'}</h2>
          <p className="max-w-[52ch] text-[14px] leading-[1.45] text-ink-2">Choose Add a project under Lock in on the Focus screen, name it (Maths, Thesis, a client) and lock in as usual. Each session then counts toward its project here, and in the CSV and calendar exports.</p>
          <button className="h-11 bg-signal px-5 text-sm font-semibold text-on-signal" onClick={() => goTo('/focus')}>Go to Focus</button>
        </div>
      ) : (
        <ul className="scroll-y grid min-h-0 flex-1 content-start gap-3" data-no-drag tabIndex={0} aria-label="Time by project">
          {rows.map((r) => (
            <li key={r.name} className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className={cn('min-w-0 truncate text-[15px] font-semibold', r.name === NO_PROJECT && 'font-normal text-ink-2')}>{r.name}</span>
                <span className="fig shrink-0 text-[15px]">{fmtMinutes(r.min)}<span className="ml-2 text-[13px] text-ink-3">{total ? `${Math.round((r.min / total) * 100)}%` : ''}</span></span>
              </div>
              <div className="h-2 bg-ink/10" role="img" aria-label={`${r.name}: ${fmtMinutes(r.min)} in ${r.n} session${r.n === 1 ? '' : 's'}`}>
                <div className={cn('h-full', r.name === NO_PROJECT ? 'bg-ink/35' : 'bg-signal')} style={{ width: `${Math.max(2, (r.min / top) * 100)}%` }} />
              </div>
              <span className="text-[13px] text-ink-3">{r.n} session{r.n === 1 ? '' : 's'}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
