import { Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { dateKey } from '@/lib/dates'
import { EXAMS_MAX, TOPICS_MAX, minutesEach, planOf, todayOf, validKey, type Exam, type Kind } from '@/lib/plan'
import { fx_say } from '@/lib/actions'
import { cn } from '@/lib/utils'
import { field, key } from './Window'

/** Exam dates turned into a spaced daily plan by fixed rules (lib/plan.ts); today's list, and one press sets the timer for it. */
const KIND: Record<Kind, string> = { learn: 'Learn', review: 'Review', final: 'Final review' }
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

export function Planner() {
  const exams = useStore((s) => s.widgets.exams) ?? []
  const setExams = useStore((s) => s.setExams)
  const setSettings = useStore((s) => s.setSettings)
  const today = dateKey()
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [f, setF] = useState({ subject: '', date: '', mins: 45, topics: '' })
  const todo = useMemo(() => todayOf(exams, today), [exams, today])
  const past = exams.filter((e) => !todo.some((t) => t.exam.id === e.id))
  const topics = f.topics.split('\n').map((t) => t.trim()).filter(Boolean)
  const bad = !f.subject.trim() ? 'Name the subject.' : !validKey(f.date) ? 'Pick the exam date.' : f.date <= today ? 'The exam date has to be after today.' : ''
  const add = () => {
    if (bad || exams.length >= EXAMS_MAX) return
    setExams([...exams, { id: Math.random().toString(36).slice(2, 10), subject: f.subject.trim(), date: f.date, mins: f.mins, topics: topics.slice(0, TOPICS_MAX) }])
    setF({ subject: '', date: '', mins: 45, topics: '' }); setAdding(false)
  }
  const start = (e: Exam, n: number) => {
    const m = Math.min(90, Math.max(10, Math.round(minutesEach(e, n) * n / 5) * 5))
    setSettings({ sessionMin: m })
    fx_say({ title: `Timer set to ${m} min`, description: `${e.subject}. Press Lock in on the Focus screen.`, variant: 'success' })
  }
  const lab = 'grid gap-0.5 text-[11px] text-ink-3'
  const input = cn(field, 'h-11 w-full px-2 text-[14px] md:h-9')
  return (
    <div className="grid gap-2">
      {todo.length === 0 && !adding && <p className="py-3 text-center text-[13px] text-ink-2">{exams.length ? 'Nothing planned for today.' : 'Add an exam and it makes a plan.'}</p>}
      {todo.map(({ exam, items, left }) => (
        <section key={exam.id} className="grid gap-1 border border-ink/20 p-2" aria-label={exam.subject}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0"><h3 className="truncate text-[15px] font-semibold text-ink">{exam.subject}</h3><p className="fig text-[12px] text-ink-3">{plural(left, 'day')} to go · {exam.date}</p></div>
            <button onClick={() => setExams(exams.filter((x) => x.id !== exam.id))} aria-label={`Remove ${exam.subject}`} className="grid size-11 shrink-0 place-items-center text-ink-3 hover:text-ink md:size-9"><X className="size-4" /></button>
          </div>
          <ul className="grid">
            {items.map((it, i) => <li key={i} className="flex items-baseline justify-between gap-2 border-b border-ink/10 py-1 text-[14px] last:border-b-0"><span className="min-w-0 break-words text-ink">{it.topic}</span><span className="shrink-0 text-[11px] text-ink-3">{KIND[it.kind]}</span></li>)}
          </ul>
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => start(exam, items.length)} className="h-11 bg-signal px-3 text-[13px] font-semibold text-on-signal md:h-9">Set the timer for today</button>
            <button onClick={() => setOpen(open === exam.id ? null : exam.id)} aria-expanded={open === exam.id} className={cn(key, 'h-11 px-3 text-[13px] md:h-9')}>{open === exam.id ? 'Hide the plan' : 'Whole plan'}</button>
          </div>
          {open === exam.id && (
            <div data-no-drag tabIndex={0} role="region" aria-label={`Plan for ${exam.subject}`} className="scroll-y max-h-44">
              {planOf(exam, today).map((d) => <p key={d.date} className="border-b border-ink/10 py-1 text-[12.5px] leading-snug"><span className="fig text-ink-3">{d.date.slice(5)}</span> <span className="text-ink-2">{d.items.map((i) => (i.kind === 'learn' ? i.topic : `${i.topic} (${i.kind === 'final' ? 'final' : 'again'})`)).join(', ')}</span></p>)}
            </div>
          )}
        </section>
      ))}
      {past.length > 0 && <p className="text-[12px] text-ink-3">Done or past: {past.map((e) => e.subject).join(', ')}. <button onClick={() => setExams(exams.filter((e) => !past.includes(e)))} className="underline">Clear them</button></p>}
      {adding ? (
        <div className="grid gap-1.5 border border-ink/20 p-2">
          <label className={lab}>Subject<input value={f.subject} maxLength={60} onChange={(e) => setF({ ...f, subject: e.target.value })} className={input} /></label>
          <div className="grid grid-cols-2 gap-1.5">
            <label className={lab}>Exam date<input type="date" value={f.date} min={today} onChange={(e) => setF({ ...f, date: e.target.value })} className={input} /></label>
            <label className={lab}>Minutes a day<select value={f.mins} onChange={(e) => setF({ ...f, mins: Number(e.target.value) })} className={input}>{[20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m} className="bg-surface text-ink">{m}</option>)}</select></label>
          </div>
          <label className={lab}>Topics, one a line ({topics.length} of {TOPICS_MAX})<textarea value={f.topics} onChange={(e) => setF({ ...f, topics: e.target.value })} rows={4} className={cn(field, 'h-auto w-full resize-y px-2 py-1.5 text-[14px]')} /></label>
          {bad && f.subject + f.date + f.topics !== '' && <p role="status" className="text-[12px] text-ink-2">{bad}</p>}
          <div className="flex gap-1.5"><button onClick={add} disabled={!!bad} className="h-11 bg-signal px-4 text-[13px] font-semibold text-on-signal disabled:opacity-40 md:h-9">Make the plan</button><button onClick={() => setAdding(false)} className={cn(key, 'h-11 px-3 text-[13px] md:h-9')}>Cancel</button></div>
        </div>
      ) : <button onClick={() => setAdding(true)} disabled={exams.length >= EXAMS_MAX} className={cn(key, 'h-11 justify-self-start gap-1.5 px-3 text-[13px] disabled:opacity-40 md:h-9')}><Plus className="size-4" />{exams.length >= EXAMS_MAX ? 'The list is full' : 'Add an exam'}</button>}
      <p className="text-[12px] text-ink-3">Each topic is learnt once, then comes back after 1, 3 and 7 days; the last two days review everything. Kept in this browser.</p>
    </div>
  )
}
