import { CalendarDays, Plus, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useStore } from '@/lib/store'
import { between, CAL_BYTES, parseIcs, type CalEvent, type Occ } from '@/lib/ical'
import { field } from './Window'
import { cn } from '@/lib/utils'

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const dayName = (ms: number, now: number) => {
  const d = new Date(ms), t = new Date(now)
  const n = Math.round((+new Date(d.getFullYear(), d.getMonth(), d.getDate()) - +new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5)
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** whole days from today to the day of `ms` */
export const daysTo = (ms: number, now = Date.now()) => { const a = new Date(now), b = new Date(ms); return Math.round((+new Date(b.getFullYear(), b.getMonth(), b.getDate()) - +new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5) }

/** Typing in an event or a date to count down to (an exam, a deadline). Kept with the window, not with an imported file. */
function AddEvent({ done }: { done: () => void }) {
  const [t, setT] = useState('')
  const [date, setDate] = useState(() => ymd(new Date()))
  const [at, setAt] = useState('')
  const [len, setLen] = useState(60)
  const save = (e: FormEvent) => {
    e.preventDefault()
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
    if (!t.trim() || !m) return
    const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
    const tm = /^(\d{2}):(\d{2})$/.exec(at)
    const s = tm ? new Date(y, mo, d, Number(tm[1]), Number(tm[2])).getTime() : new Date(y, mo, d).getTime()
    const ev: CalEvent = { id: `o${Date.now().toString(36)}`, t: t.trim(), s, e: tm ? s + len * 6e4 : new Date(y, mo, d + 1).getTime(), ...(tm ? {} : { day: true }) }
    useStore.getState().addOwnEvent(ev)
    done()
  }
  return (
    <form onSubmit={save} className="grid gap-1.5 border border-ink/20 p-2">
      <input autoFocus value={t} onChange={(e) => setT(e.target.value)} maxLength={120} aria-label="What it is" placeholder="What: Biology exam, essay due, standup" className={field} />
      <div className="flex flex-wrap gap-1.5">
        <label className="grid flex-1 gap-0.5 text-[12px] text-ink-2">Day<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={cn(field, 'w-full min-w-[9rem]')} /></label>
        <label className="grid flex-1 gap-0.5 text-[12px] text-ink-2">Time (blank: all day)<input type="time" value={at} onChange={(e) => setAt(e.target.value)} className={cn(field, 'w-full min-w-[7rem]')} /></label>
        {at && <label className="grid gap-0.5 text-[12px] text-ink-2">Length<select value={len} onChange={(e) => setLen(Number(e.target.value))} className={cn(field, 'w-full')}>{[15, 30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m} className="bg-surface text-ink">{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}</select></label>}
      </div>
      <div className="flex justify-end gap-1">
        <button type="button" onClick={done} className="h-11 border border-ink/30 px-4 text-sm text-ink hover:bg-ink/10">Cancel</button>
        <button type="submit" disabled={!t.trim()} className="h-11 bg-signal px-4 text-sm font-semibold text-on-signal disabled:opacity-40">Add</button>
      </div>
    </form>
  )
}

/** An imported calendar and the events you typed in, shown as what is coming up, with countdowns to dates further off. Kept in this browser. */
export function Calendar() {
  const cal = useStore((s) => s.widgets.cal)
  const own = useStore((s) => s.widgets.own)
  const input = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState('')
  const [adding, setAdding] = useState(false)
  const events = useMemo(() => [...(cal?.events ?? []), ...(own ?? [])], [cal, own])
  const mine = useMemo(() => new Set((own ?? []).map((e) => e.id)), [own])
  const now = Date.now()
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const occ = useMemo(() => between(events, +start, +start + 7 * 864e5, 120).filter((o) => o.e > now || o.day), [events, now]) // eslint-disable-line react-hooks/exhaustive-deps
  // your own dates past the coming week: countdowns
  const later = (own ?? []).filter((e) => daysTo(e.s, now) >= 7).slice(0, 8)
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
  const btn = 'inline-flex h-11 items-center gap-1.5 border border-ink/30 px-3 text-[13px] text-ink hover:bg-ink/10 md:h-9'
  const idOf = (o: Occ) => o.id.slice(0, o.id.lastIndexOf(':'))
  const remove = (id: string, t: string) => <button onClick={() => useStore.getState().removeOwnEvent(id)} aria-label={`Remove “${t}”`} className="grid size-11 shrink-0 place-items-center self-center text-ink-3 hover:text-ink md:size-9"><X className="size-4" /></button>
  const any = !!cal || !!own?.length
  return (
    <div className="grid gap-2">
      <input ref={input} type="file" accept=".ics,text/calendar" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="hud flex min-w-0 items-center gap-1.5"><CalendarDays className="size-3.5 shrink-0" /><span className="truncate">{cal?.name || 'Coming up'}</span></p>
        <div className="flex gap-1">
          <button onClick={() => setAdding((a) => !a)} aria-expanded={adding} className={cn(btn, adding && 'border-signal')}><Plus className="size-4" />Add</button>
          {cal ? (
            <>
              <button onClick={() => input.current?.click()} className={btn}>Replace</button>
              <button onClick={() => { useStore.getState().clearCalendar(); setNote('') }} className={btn}>Remove</button>
            </>
          ) : (
            <button onClick={() => input.current?.click()} className={btn}><Upload className="size-4" />Import</button>
          )}
        </div>
      </div>
      {adding && <AddEvent done={() => setAdding(false)} />}
      {!any && !adding && <p className="text-[13px] leading-[1.4] text-ink-2">Add events and dates to count down to, or import a calendar file (.ics) from Google, Apple or Outlook. It stays in this browser.</p>}
      {any && (groups.length === 0 ? (
        <p className="py-3 text-center text-[13px] text-ink-2">Nothing in the next seven days.{cal ? ` ${cal.events.length} events in the file.` : ''}</p>
      ) : (
        <div data-no-drag className="scroll-y grid max-h-64 content-start gap-3">
          {groups.map((g) => (
            <section key={g.label}>
              <h3 className="hud mb-1">{g.label}</h3>
              <ul className="grid">
                {g.items.map((o) => (
                  <li key={o.id} className="flex min-h-11 items-baseline gap-3 border-b border-ink/10 py-1.5 last:border-b-0">
                    <span className="fig w-[5.5rem] shrink-0 text-[12px] text-signal">{o.day ? 'All day' : `${time(o.s)}`}</span>
                    <span className="min-w-0 flex-1 text-[15px] leading-[1.3]"><span className="break-words">{o.t}</span>{o.loc && <span className="block truncate text-[12px] text-ink-3">{o.loc}</span>}</span>
                    {mine.has(idOf(o)) && remove(idOf(o), o.t)}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ))}
      {later.length > 0 && (
        <section>
          <h3 className="hud mb-1">Counting down</h3>
          <ul className="grid">
            {later.map((e) => (
              <li key={e.id} className="flex min-h-11 items-baseline gap-3 border-b border-ink/10 py-1.5 last:border-b-0">
                <span className="fig w-[5.5rem] shrink-0 text-[12px] text-signal">in {daysTo(e.s, now)} days</span>
                <span className="min-w-0 flex-1 text-[15px] leading-[1.3]"><span className="break-words">{e.t}</span><span className="block text-[12px] text-ink-3">{new Date(e.s).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span></span>
                {remove(e.id, e.t)}
              </li>
            ))}
          </ul>
        </section>
      )}
      {note && <p role="status" className="text-[12px] text-ink-2">{note}</p>}
    </div>
  )
}
