import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { gpa, LETTERS, needed, standing, type Course, type Grades as G, type Part } from '@/lib/grades'
import { cn } from '@/lib/utils'
import { field, key } from './Window'

const START: G = { parts: [{ id: 'a', name: 'Coursework', weight: 40, score: null }, { id: 'b', name: 'Exam', weight: 60, score: null }], target: 70, courses: [{ id: 'c', name: 'Course 1', credits: 3, grade: 'A' }] }
const id = () => Math.random().toString(36).slice(2, 9)
const pct = (n: number) => `${Math.round(n * 10) / 10}%`
const numIn = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))

/** Where a course stands from its weighted parts, what the rest needs for a target, and a grade point average. All worked out here. */
export function Grades() {
  const saved = useStore((s) => s.widgets.grades)
  const setGrades = useStore((s) => s.setGrades)
  const g = saved ?? START
  const [tab, setTab] = useState<'course' | 'gpa'>('course')
  const put = (next: Partial<G>) => setGrades({ ...g, ...next })
  const part = (i: number, p: Partial<Part>) => put({ parts: g.parts.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const course = (i: number, c: Partial<Course>) => put({ courses: g.courses.map((x, j) => (j === i ? { ...x, ...c } : x)) })
  const s = standing(g.parts)
  const need = needed(g.parts, g.target)
  const avg = gpa(g.courses)
  const small = cn(field, 'h-11 w-full px-2 text-[14px] md:h-9')
  const seg = 'h-11 border px-3 text-[13px] md:h-9'
  return (
    <div className="grid gap-2">
      <div role="tablist" aria-label="What to work out" className="flex">
        <button role="tab" aria-selected={tab === 'course'} onClick={() => setTab('course')} className={cn(seg, tab === 'course' ? 'border-signal bg-signal text-on-signal' : 'border-ink/25 text-ink-2')}>A course</button>
        <button role="tab" aria-selected={tab === 'gpa'} onClick={() => setTab('gpa')} className={cn(seg, '-ml-px', tab === 'gpa' ? 'border-signal bg-signal text-on-signal' : 'border-ink/25 text-ink-2')}>GPA</button>
      </div>

      {tab === 'course' ? (
        <>
          <div data-no-drag className="scroll-y grid max-h-56 gap-1">
            <div className="grid grid-cols-[1fr_4.5rem_4.5rem_2.75rem] gap-1 text-[11px] text-ink-3 md:grid-cols-[1fr_4.5rem_4.5rem_2.25rem]"><span>Part</span><span>Weight %</span><span>Score %</span><span /></div>
            {g.parts.map((p, i) => (
              <div key={p.id} className="grid grid-cols-[1fr_4.5rem_4.5rem_2.75rem] gap-1 md:grid-cols-[1fr_4.5rem_4.5rem_2.25rem]">
                <input value={p.name} onChange={(e) => part(i, { name: e.target.value.slice(0, 60) })} aria-label={`Name of part ${i + 1}`} className={small} />
                <input value={p.weight || ''} inputMode="decimal" onChange={(e) => part(i, { weight: Number(e.target.value.replace(',', '.')) || 0 })} aria-label={`Weight of ${p.name || `part ${i + 1}`} in percent`} className={cn(small, 'fig')} />
                <input value={p.score ?? ''} inputMode="decimal" placeholder="—" onChange={(e) => { const v = numIn(e.target.value); part(i, { score: v === null || Number.isNaN(v) ? null : v }) }} aria-label={`Score for ${p.name || `part ${i + 1}`} in percent, empty if not marked yet`} className={cn(small, 'fig')} />
                <button onClick={() => put({ parts: g.parts.filter((_, j) => j !== i) })} aria-label={`Remove ${p.name || `part ${i + 1}`}`} className="grid size-11 place-items-center text-ink-3 hover:text-ink md:size-9"><X className="size-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={() => put({ parts: [...g.parts, { id: id(), name: '', weight: 0, score: null }] })} disabled={g.parts.length >= 40} className={cn(key, 'h-11 justify-self-start gap-1.5 px-3 text-[13px] md:h-9')}><Plus className="size-4" />Add a part</button>
          <div className="grid gap-1 border border-ink/15 p-2 text-[14px] leading-[1.45]" aria-live="polite">
            <p className="text-ink">{s.avg === null ? 'Nothing marked yet.' : <>So far <b className="fig">{pct(s.avg)}</b> on the {pct(s.total ? (s.done / s.total) * 100 : 0)} of the course that is marked.</>}{s.total !== 100 && s.total > 0 ? <span className="text-ink-3"> (The weights add to {pct(s.total)}.)</span> : null}</p>
            <label className="flex flex-wrap items-center gap-2 text-ink-2">To finish with
              <input value={g.target} inputMode="decimal" onChange={(e) => put({ target: Math.min(100, Math.max(0, Number(e.target.value.replace(',', '.')) || 0)) })} aria-label="Target overall percent" className={cn(field, 'fig h-11 w-20 px-2 md:h-9')} />%
            </label>
            <p className="text-ink">
              {need === null ? 'Everything is marked.'
                : need <= 0 ? <>You are there already, even with 0% on the rest.</>
                  : need > 100 ? <>Out of reach: it would need <b className="fig">{pct(need)}</b> on the {pct(s.total - s.done)} left.</>
                    : <>You need <b className="fig">{pct(need)}</b> on average over the {pct(s.total - s.done)} left.</>}
            </p>
          </div>
        </>
      ) : (
        <>
          <div data-no-drag className="scroll-y grid max-h-56 gap-1">
            <div className="grid grid-cols-[1fr_4.5rem_5rem_2.75rem] gap-1 text-[11px] text-ink-3 md:grid-cols-[1fr_4.5rem_5rem_2.25rem]"><span>Course</span><span>Credits</span><span>Grade</span><span /></div>
            {g.courses.map((c, i) => (
              <div key={c.id} className="grid grid-cols-[1fr_4.5rem_5rem_2.75rem] gap-1 md:grid-cols-[1fr_4.5rem_5rem_2.25rem]">
                <input value={c.name} onChange={(e) => course(i, { name: e.target.value.slice(0, 60) })} aria-label={`Name of course ${i + 1}`} className={small} />
                <input value={c.credits || ''} inputMode="decimal" onChange={(e) => course(i, { credits: Number(e.target.value.replace(',', '.')) || 0 })} aria-label={`Credits for ${c.name || `course ${i + 1}`}`} className={cn(small, 'fig')} />
                <select value={c.grade} onChange={(e) => course(i, { grade: e.target.value })} aria-label={`Grade for ${c.name || `course ${i + 1}`}`} className={small}>{LETTERS.map(([l, pts]) => <option key={l} value={l} className="bg-surface text-ink">{l} ({pts})</option>)}</select>
                <button onClick={() => put({ courses: g.courses.filter((_, j) => j !== i) })} aria-label={`Remove ${c.name || `course ${i + 1}`}`} className="grid size-11 place-items-center text-ink-3 hover:text-ink md:size-9"><X className="size-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={() => put({ courses: [...g.courses, { id: id(), name: '', credits: 3, grade: 'A' }] })} disabled={g.courses.length >= 40} className={cn(key, 'h-11 justify-self-start gap-1.5 px-3 text-[13px] md:h-9')}><Plus className="size-4" />Add a course</button>
          <p className="border border-ink/15 p-2 text-[14px] text-ink" aria-live="polite">{avg === null ? 'Add a course with credits.' : <>GPA <b className="fig text-[18px]">{avg.toFixed(2)}</b> on a 4.0 scale, over {g.courses.reduce((n, c) => n + (c.credits > 0 ? c.credits : 0), 0)} credits.</>}</p>
        </>
      )}
      <p className="text-[12px] text-ink-3">Kept in this browser.</p>
    </div>
  )
}
