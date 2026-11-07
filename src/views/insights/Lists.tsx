import { useMemo, useState } from 'react'
import { Panel } from '@/components/app/shared'
import { dateKey, fmtMinutes, parseKey } from '@/lib/dates'
import { driftWords, sessionTotals } from '@/lib/insights'
import { useStore, type EventKind, type SessionRec } from '@/lib/store'

/** a small row of choices, one of which is on */
function Chips<T extends string>({ label, value, onChange, items }: { label: string; value: T; onChange: (v: T) => void; items: { id: T; label: string }[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap self-start border border-ink/20" data-no-drag>
      {items.map((it) => (
        <button key={it.id} role="radio" aria-checked={value === it.id} onClick={() => onChange(it.id)} className={`h-11 px-3.5 text-sm md:h-9 ${value === it.id ? 'bg-signal text-on-signal' : 'text-ink-2 hover:bg-ink/10'}`}>{it.label}</button>
      ))}
    </div>
  )
}

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const clock = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
const dayName = (key: string) => parseKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
const source = (x: SessionRec) => (x.source === 'silent' ? 'Silence' : x.source === 'tv' ? 'TV' : 'Radio')
const SESSION_CAP = 300

type Filter = 'all' | 'finished' | 'early'

/* ───────────── Sessions ───────────── */

export function SessionsTab() {
  const sessions = useStore((s) => s.sessions)
  const [view, setView] = useState<'table' | 'days'>('table')
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const all = useMemo(() => sessionTotals(sessions), [sessions])
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return sessions.filter((x) => (filter === 'all' || (filter === 'finished' ? x.completed : !x.completed)) && (!needle || `${x.title} ${x.project ?? ''} ${source(x)}`.toLowerCase().includes(needle)))
  }, [sessions, filter, q])
  const days = useMemo(() => {
    const m = new Map<string, SessionRec[]>()
    for (const x of rows) { const k = dateKey(new Date(x.start)); m.set(k, [...(m.get(k) ?? []), x]) }
    return [...m]
  }, [rows])
  if (sessions.length === 0) return <Panel className="grid min-h-[16rem] place-items-center p-6 text-center text-sm text-ink-2">No sessions yet. Lock in on the Focus screen and your first one lands here.</Panel>
  return (
    <Panel className="flex h-full min-h-[24rem] flex-col gap-3 p-4">
      <p className="text-[13px] text-ink-2">
        {all.count} session{all.count === 1 ? '' : 's'} kept{all.count >= SESSION_CAP ? ` (the latest ${SESSION_CAP})` : ''} · {all.finished} finished · {fmtMinutes(all.minutes)} held · {all.drifts} drift{all.drifts === 1 ? '' : 's'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Chips label="View" value={view} onChange={setView} items={[{ id: 'table', label: 'Table' }, { id: 'days', label: 'By day' }]} />
        <Chips label="Show" value={filter} onChange={setFilter} items={[{ id: 'all', label: 'All' }, { id: 'finished', label: 'Finished' }, { id: 'early', label: 'Ended early' }]} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or project" aria-label="Search sessions" data-no-drag className="h-11 min-w-0 flex-1 basis-44 border border-ink/25 bg-transparent px-3 text-[15px] text-ink placeholder:text-ink-3 focus:border-signal md:h-9" />
      </div>
      <div className="scroll-y min-h-0 flex-1 border-t border-[var(--rule)]" data-no-drag tabIndex={0} role="region" aria-label="Sessions list">
        {rows.length === 0 ? <p className="p-4 text-sm text-ink-2">No session matches.</p> : view === 'table' ? (
          <table className="w-full text-left text-[14px]">
            <thead className="sticky top-0 z-[1] bg-[var(--surface)] hud">
              <tr>
                <th scope="col" className="py-2 pr-3 font-normal">Started</th><th scope="col" className="py-2 pr-3 font-normal">Session</th>
                <th scope="col" className="hidden py-2 pr-3 font-normal sm:table-cell">Project</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Held</th><th scope="col" className="hidden py-2 pr-3 text-right font-normal sm:table-cell">Goal</th>
                <th scope="col" className="hidden py-2 pr-3 text-right font-normal sm:table-cell">Drifts</th><th scope="col" className="hidden py-2 font-normal sm:table-cell">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} className="border-t border-[var(--rule)]">
                  <td className="fig whitespace-nowrap py-2.5 pr-3 text-ink-2">{when(x.start)}</td>
                  <td className="py-2.5 pr-3 text-ink">{source(x)}<span className="block text-[12px] text-ink-3">{x.title}</span><span className="block text-[12px] text-ink-2 sm:hidden">{x.project ? `${x.project} · ` : ''}{x.completed ? 'Finished' : 'Ended early'}</span></td>
                  <td className="hidden py-2.5 pr-3 text-ink-2 sm:table-cell">{x.project || '–'}</td>
                  <td className="fig py-2.5 pr-3 text-right text-ink">{fmtMinutes(x.focusSec / 60)}<span className="block text-[12px] text-ink-2 sm:hidden">{x.lapses} drift{x.lapses === 1 ? '' : 's'}</span></td>
                  <td className="fig hidden py-2.5 pr-3 text-right text-ink-2 sm:table-cell">{x.goalMin} min</td>
                  <td className="fig hidden py-2.5 pr-3 text-right text-ink sm:table-cell">{x.lapses}</td>
                  <td className="hidden whitespace-nowrap py-2.5 text-ink sm:table-cell">{x.completed ? 'Finished' : 'Ended early'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="grid gap-4 pb-2 pt-3">
            {days.map(([k, list]) => {
              const t = sessionTotals(list)
              return (
                <section key={k} aria-label={dayName(k)}>
                  <h3 className="flex flex-wrap items-baseline justify-between gap-x-3 text-[14px] font-semibold text-ink">{dayName(k)}<span className="fig text-[13px] font-normal text-ink-2">{t.count} session{t.count === 1 ? '' : 's'} · {fmtMinutes(t.minutes)} held · {t.drifts} drift{t.drifts === 1 ? '' : 's'}</span></h3>
                  <ul className="mt-1.5">
                    {list.map((x) => (
                      <li key={x.id} className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-[var(--rule)] py-2 text-[14px]">
                        <span className="min-w-0 text-ink"><span className="fig text-ink-2">{clock(x.start)}</span> · {source(x)}{x.project ? <span className="text-ink-2"> · {x.project}</span> : null}</span>
                        <span className="fig text-ink-2">{fmtMinutes(x.focusSec / 60)} of {x.goalMin} min · {x.lapses} drift{x.lapses === 1 ? '' : 's'} · <span className="text-ink">{x.completed ? 'Finished' : 'Ended early'}</span></span>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </Panel>
  )
}

/* ───────────── Log ───────────── */

type LogFilter = 'all' | 'drifts' | 'sessions' | 'tuning' | 'other'
const KIND: Record<EventKind, { group: Exclude<LogFilter, 'all'>; label: string }> = {
  blocked: { group: 'drifts', label: 'Drift' }, wander: { group: 'drifts', label: 'Drift' },
  session: { group: 'sessions', label: 'Session' }, tune: { group: 'tuning', label: 'Tuned in' },
  system: { group: 'other', label: 'Note' }, goal: { group: 'other', label: 'Goal' }, learn: { group: 'other', label: 'Learn' }, board: { group: 'other', label: 'Board' }, together: { group: 'other', label: 'Together' },
}

export function LogTab() {
  const events = useStore((s) => s.events)
  const [f, setF] = useState<LogFilter>('all')
  const count = (g: LogFilter) => (g === 'all' ? events.length : events.filter((e) => KIND[e.kind]?.group === g).length)
  const shown = useMemo(() => events.filter((e) => f === 'all' || KIND[e.kind]?.group === f), [events, f])
  const days = useMemo(() => {
    const m = new Map<string, typeof events>()
    for (const e of shown) { const k = dateKey(new Date(e.t)); m.set(k, [...(m.get(k) ?? []), e]) }
    return [...m]
  }, [shown])
  const items: { id: LogFilter; label: string }[] = [{ id: 'all', label: `All ${count('all')}` }, { id: 'drifts', label: `Drifts ${count('drifts')}` }, { id: 'sessions', label: `Sessions ${count('sessions')}` }, { id: 'tuning', label: `Tuning ${count('tuning')}` }, { id: 'other', label: `Other ${count('other')}` }]
  if (events.length === 0) return <Panel className="grid min-h-[16rem] place-items-center p-6 text-center text-sm text-ink-2">Events appear here as you use the app: sessions, drifts and what you tuned in.</Panel>
  return (
    <Panel className="flex h-full min-h-[24rem] flex-col gap-3 p-4">
      <p className="text-[13px] text-ink-2">The latest {events.length} thing{events.length === 1 ? '' : 's'} that happened, newest first. Kept in this browser only.</p>
      <Chips label="Show" value={f} onChange={setF} items={items} />
      <div className="scroll-y min-h-0 flex-1 border-t border-[var(--rule)]" data-no-drag tabIndex={0} role="region" aria-label="Event log">
        {shown.length === 0 ? <p className="p-4 text-sm text-ink-2">Nothing of that kind yet.</p> : (
          <div className="grid gap-4 pb-2 pt-3">
            {days.map(([k, list]) => (
              <section key={k} aria-label={dayName(k)}>
                <h3 className="text-[14px] font-semibold text-ink">{dayName(k)}</h3>
                <ul className="mt-1.5">
                  {list.map((e) => (
                    <li key={e.id} className="grid grid-cols-[4.5rem_5.5rem_minmax(0,1fr)] items-baseline gap-x-3 border-t border-[var(--rule)] py-2 text-[14px]">
                      <span className="fig text-ink-2">{clock(e.t)}</span>
                      <span className="hud !text-[12px]">{KIND[e.kind]?.label ?? 'Note'}</span>
                      <span className="min-w-0 text-ink">{driftWords(e.text)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}
