import { ChevronLeft, ChevronRight, Copy, Download, Minus, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Panel } from '@/components/app/shared'
import { fx_say } from '@/lib/actions'
import { dateKey, fmtMinutes, weekdayMon } from '@/lib/dates'
import { addDays, change, DAY_LETTERS, DAY_NAMES, daysSoFar, fmtRange, heldFirst, weekOf, weeksHit, weekStart, weekSummary } from '@/lib/plus'
import { drawWeekCard, saveCard } from '@/lib/shareCard'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const step = 'grid size-11 place-items-center border border-ink/25 text-ink hover:bg-ink/10 disabled:opacity-30 disabled:hover:bg-transparent'
const mins = (m: number) => (m < 1 ? '0m' : fmtMinutes(m))
const rate = (drifts: number, min: number) => (min >= 10 ? `${Math.round((drifts / (min / 60)) * 10) / 10} an hour` : 'too little focus to rate')

/** one week at a time (Monday first): what you held, how it compares with the week before, your weekly goal, and a picture to keep */
export function Week() {
  const focusLog = useStore((s) => s.focusLog)
  const urgeLog = useStore((s) => s.urgeLog)
  const sessions = useStore((s) => s.sessions)
  const goal = useStore((s) => s.settings.weeklyGoalMin)
  const setSettings = useStore((s) => s.setSettings)
  const [off, setOff] = useState(0)
  const [busy, setBusy] = useState(false)
  const data = useMemo(() => ({ focusLog, urgeLog, sessions }), [focusLog, urgeLog, sessions])
  const today = new Date()
  const start = addDays(weekStart(today), -7 * off)
  const w = weekOf(data, start, today)
  const prev = weekOf(data, addDays(start, -7), today)
  const n = off === 0 ? daysSoFar(start, today) : 7
  const then = heldFirst(prev, n)
  const ch = change(w.held, then)
  const hit = weeksHit(data, goal, off === 0 ? today : addDays(start, 6))
  const name = off === 0 ? 'This week' : off === 1 ? 'Last week' : `${off} weeks ago`
  const before = off === 0 ? 'last week' : 'the week before'
  const delta = ch ? `${ch.text} ${n < 7 ? `the same ${n} day${n === 1 ? '' : 's'} of ` : ''}${before}` : ''
  const max = Math.max(30, ...w.days.map((x) => x.min), ...prev.days.map((x) => x.min))
  const isToday = (key: string) => off === 0 && key === dateKey(today)
  const pct = goal ? w.held / goal : 0
  const bestName = w.best ? DAY_NAMES[weekdayMon(w.best.date)] : ''

  const stats: [string, string, string][] = [
    ['Finished', String(w.finished), `of ${w.sessions} session${w.sessions === 1 ? '' : 's'}`],
    ['Clean finishes', String(w.clean), 'finished with no drift'],
    ['Drifts', String(w.drifts), rate(w.drifts, w.held)],
    ['Best day', w.best ? bestName.slice(0, 3) : 'none yet', w.best ? fmtMinutes(w.best.min) : 'no focus this week'],
    ['Longest session', w.longest ? fmtMinutes(w.longest) : 'none yet', 'one lock-in'],
    ['Top project', w.top ? w.top.name : 'none yet', w.top ? fmtMinutes(w.top.min) : 'label sessions on Focus'],
  ]

  const save = async () => {
    setBusy(true)
    try {
      const canvas = await drawWeekCard({
        range: fmtRange(start),
        title: name,
        held: mins(w.held),
        delta: delta ? delta[0].toUpperCase() + delta.slice(1) : '',
        days: w.days.map((x, i) => ({ letter: DAY_LETTERS[i], min: x.min, before: prev.days[i].min, today: isToday(x.key), future: x.future })),
        stats: [['Finished', String(w.finished)], ['Drifts', String(w.drifts)], ['Best day', w.best ? bestName.slice(0, 3) : 'none']],
        goalLine: goal ? `${Math.round(pct * 100)}% of a ${fmtMinutes(goal)} weekly goal` : '',
        goalPct: pct,
      })
      const r = await saveCard(canvas, `friction-week-${dateKey(start)}.png`)
      if (r === 'saved') fx_say({ title: 'Picture saved', description: 'It was made in this browser and sent nowhere.', variant: 'success' })
    } catch { fx_say({ title: 'Could not make the picture', variant: 'danger' }) } finally { setBusy(false) }
  }
  const copy = async () => {
    const t = weekSummary(w, goal)
    try { await navigator.clipboard.writeText(t); fx_say({ title: 'Summary copied', description: t }) } catch { fx_say({ title: 'Copy it by hand', description: t }) }
  }

  return (
    <Panel className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          <button className={step} aria-label="The week before" onClick={() => setOff(Math.min(52, off + 1))}><ChevronLeft className="size-4" /></button>
          <button className={step} aria-label="The week after" disabled={off === 0} onClick={() => setOff(Math.max(0, off - 1))}><ChevronRight className="size-4" /></button>
        </div>
        <p className="hud text-right">{name} · {fmtRange(start)}</p>
      </div>

      <div className="scroll-y grid min-h-0 flex-1 content-start gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]" data-no-drag>
        <div className="grid content-start gap-4">
          <div>
            <p className="hud">Held</p>
            <p className="dot text-[clamp(2.2rem,6vw,3.6rem)] font-bold leading-none">{mins(w.held)}</p>
            <p className="mt-1.5 text-sm text-ink-2">{ch ? `${delta[0].toUpperCase()}${delta.slice(1)} (${fmtMinutes(then)}).` : then >= 1 ? `${fmtMinutes(then)} the ${n < 7 ? 'same days ' : 'week '}before.` : 'Nothing from the week before to compare with.'}</p>
          </div>

          <div role="img" aria-label={`Minutes held each day: ${w.days.map((x, i) => `${DAY_NAMES[i]} ${fmtMinutes(x.min)}`).join(', ')}`}>
            <div className="flex h-32 items-end gap-2 border-b border-ink/20 sm:h-40">
              {w.days.map((x, i) => (
                <div key={x.key} className="relative flex h-full flex-1 items-end justify-center" title={`${DAY_NAMES[i]}: ${fmtMinutes(x.min)}`}>
                  <div className={cn('w-3/5', x.future ? 'bg-ink/10' : 'bg-signal')} style={{ height: x.future ? '3%' : `${x.min > 0 ? Math.max(3, (x.min / max) * 100) : 0}%` }} />
                  {!x.future && prev.days[i].min > 0 && <i className="absolute inset-x-[10%] h-[2px] bg-ice" style={{ bottom: `${(prev.days[i].min / max) * 100}%` }} />}
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-2" aria-hidden>
              {w.days.map((x, i) => <span key={x.key} className={cn('hud flex-1 text-center', isToday(x.key) && '!text-signal')}>{DAY_LETTERS[i]}</span>)}
            </div>
            <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-3"><i className="h-[2px] w-4 bg-ice" aria-hidden />the same day {before}</p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="hud">Weekly goal</p>
              <div className="flex items-center gap-1">
                <button className={step} aria-label="Lower the weekly goal" onClick={() => setSettings({ weeklyGoalMin: Math.max(0, goal - 30) })}><Minus className="size-4" /></button>
                <span className="fig min-w-[4.5rem] text-center text-[15px]">{goal ? fmtMinutes(goal) : 'Off'}</span>
                <button className={step} aria-label="Raise the weekly goal" onClick={() => setSettings({ weeklyGoalMin: Math.min(4800, goal + 30) })}><Plus className="size-4" /></button>
              </div>
            </div>
            {goal > 0 && (
              <>
                <div className="h-2 bg-ink/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(pct * 100))} aria-label="Progress toward the weekly goal"><div className="h-full bg-signal" style={{ width: `${Math.min(100, pct * 100)}%` }} /></div>
                <p className="text-[13px] text-ink-2">{Math.round(pct * 100)}% of the goal{pct >= 1 ? (hit > 1 ? `. ${hit} weeks in a row at or above it.` : '. Reached.') : hit > 0 ? `. The ${hit} week${hit === 1 ? '' : 's'} before ${hit === 1 ? 'was' : 'were'} at or above it.` : '. Not reached yet.'}</p>
              </>
            )}
          </div>
        </div>

        <div className="grid content-start gap-3">
          <div className="grid grid-cols-2 gap-3">
            {stats.map(([k, v, note]) => (
              <div key={k} className="grid min-w-0 content-start gap-1 border border-ink/15 bg-ink/[0.03] p-3">
                <p className="hud">{k}</p>
                <p className="fig truncate text-[clamp(1.1rem,2.4vw,1.5rem)] font-bold leading-tight" title={v}>{v}</p>
                <p className="truncate text-[13px] text-ink-3" title={note}>{note}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={save} disabled={busy} className="inline-flex h-11 flex-1 items-center justify-center gap-2 bg-signal px-4 text-sm font-semibold text-on-signal disabled:opacity-50"><Download className="size-4" />Save as picture</button>
            <button onClick={copy} className="inline-flex h-11 flex-1 items-center justify-center gap-2 border border-ink/30 px-4 text-sm text-ink hover:bg-ink/10"><Copy className="size-4" />Copy summary</button>
          </div>
          <p className="text-[13px] leading-[1.4] text-ink-3">The picture is drawn in this browser from the numbers above, in your theme. Weeks start on Monday.</p>
        </div>
      </div>
    </Panel>
  )
}
