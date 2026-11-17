import { CalendarDays, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { between, CAL_BYTES, parseIcs, type Occ } from '@/lib/ical'
import { cn } from '@/lib/utils'

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const dayName = (ms: number, now: number) => {
  const d = new Date(ms), t = new Date(now)
  const n = Math.round((+new Date(d.getFullYear(), d.getMonth(), d.getDate()) - +new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5)
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })
}

/** An imported calendar, shown as what is coming up. The file is read here and kept in this browser. */
export function Calendar() {
  const cal = useStore((s) => s.widgets.cal)
  const input = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState('')
  const now = Date.now()
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const occ = useMemo(() => (cal ? between(cal.events, +start, +start + 7 * 864e5, 120).filter((o) => o.e > now || o.day) : []), [cal, now]) // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => {
    const g: { label: string; items: Occ[] }[] = []
    for (const o of occ) { const label = dayName(Math.max(o.s, +start), now); const last = g[g.length - 1]; if (last?.label === label) last.items.push(o); else g.push({ label, items: [o] }) }
    return g
  }, [occ]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (f: File | undefined) => {
    if (!f) return
    if (f.size > CAL_BYTES) { setNote('That file is over 2 MB. Export a shorter range.'); return }
    const { name, events, skipped } = parseIcs(await f.text())
    if (!events.length) { setNote('No events found. It should be an .ics file.'); return }
    useStore.getState().setCalendar(name || f.name.replace(/\.ics$/i, ''), events)
    setNote(`${events.length} event${events.length === 1 ? '' : 's'} read${skipped ? `, ${skipped} skipped` : ''}.`)
  }
  const btn = 'inline-flex h-11 items-center gap-2 border border-ink/30 px-4 text-sm text-ink hover:bg-ink/10'
  return (
    <div className="grid gap-2">
      <input ref={input} type="file" accept=".ics,text/calendar" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
      {!cal ? (
        <div className="grid justify-items-start gap-2 py-1">
          <p className="text-[13px] leading-[1.4] text-ink-2">Import a calendar file (.ics) from Google, Apple or Outlook Calendar. It is read here and stays in this browser. Nothing is sent anywhere.</p>
          <button onClick={() => input.current?.click()} className="inline-flex h-11 items-center gap-2 bg-signal px-4 text-sm font-semibold text-on-signal"><Upload className="size-4" />Import a calendar</button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="hud flex items-center gap-1.5"><CalendarDays className="size-3.5" />{cal.name || 'Calendar'}</p>
            <div className="flex gap-1">
              <button onClick={() => input.current?.click()} className={cn(btn, 'h-9 px-3 text-[13px]')}>Replace</button>
              <button onClick={() => { useStore.getState().clearCalendar(); setNote('') }} className={cn(btn, 'h-9 px-3 text-[13px]')}>Remove</button>
            </div>
          </div>
          {groups.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-ink-2">Nothing in the next seven days. {cal.events.length} events in the file.</p>
          ) : (
            <div data-no-drag className="scroll-y grid max-h-64 content-start gap-3">
              {groups.map((g) => (
                <section key={g.label}>
                  <h3 className="hud mb-1">{g.label}</h3>
                  <ul className="grid">
                    {g.items.map((o) => (
                      <li key={o.id} className="flex min-h-11 items-baseline gap-3 border-b border-ink/10 py-1.5 last:border-b-0">
                        <span className="fig w-[5.5rem] shrink-0 text-[12px] text-signal">{o.day ? 'All day' : `${time(o.s)}`}</span>
                        <span className="min-w-0 text-[15px] leading-[1.3]"><span className="break-words">{o.t}</span>{o.loc && <span className="block truncate text-[12px] text-ink-3">{o.loc}</span>}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
      {note && <p role="status" className="text-[12px] text-ink-2">{note}</p>}
    </div>
  )
}
