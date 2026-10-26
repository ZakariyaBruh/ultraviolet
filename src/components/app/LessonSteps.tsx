import { Check, Eye, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { FitText } from '@/components/app/shared'
import { hideYear, sameAnswer, type Step } from '@/lib/learn'
import { cn } from '@/lib/utils'

type Of<K extends Step['kind']> = Extract<Step, { kind: K }>
interface Common { result: boolean | null; onResult: (ok: boolean) => void }

const ghost = 'inline-flex h-11 items-center justify-center gap-2 border border-ink/30 px-4 text-sm hover:bg-ink/10 disabled:opacity-40'
const solid = 'inline-flex h-11 items-center justify-center gap-2 bg-signal px-5 text-sm font-semibold text-on-signal disabled:opacity-40'
const tile = (state: 'idle' | 'right' | 'wrong' | 'picked') => cn('border transition-colors disabled:cursor-default', state === 'right' ? 'border-signal bg-signal/15' : state === 'wrong' ? 'border-ink/60 bg-ink/10' : state === 'picked' ? 'border-signal/70 bg-ink/[0.06]' : 'border-ink/25 hover:border-signal/70 hover:bg-ink/[0.06]')

const Kicker = ({ children }: { children: ReactNode }) => <p className="hud mb-2 shrink-0">{children}</p>
export const Verdict = ({ ok, children }: { ok: boolean; children?: ReactNode }) => (
  <p role="status" className="shrink-0 text-[14px] leading-[1.4] text-ink-2"><strong className="text-ink">{ok ? 'Right. ' : 'Not quite. '}</strong>{children}</p>
)
const Mark = ({ state, children }: { state: 'idle' | 'right' | 'wrong' | 'picked'; children: ReactNode }) => (
  <span className={cn('grid size-7 shrink-0 place-items-center border text-[13px] font-semibold', state === 'right' ? 'border-signal bg-signal text-on-signal' : state === 'picked' ? 'border-signal text-signal' : 'border-ink/30')}>
    {state === 'right' ? <Check className="size-4" /> : state === 'wrong' ? <X className="size-4" /> : children}
  </span>
)

/** a shuffle that never comes back sorted, so there is always something to do */
const jumble = (n: number, seed: number) => {
  const a = Array.from({ length: n }, (_, i) => i)
  let s = seed || 1
  const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  if (a.every((v, i) => v === i)) a.push(a.shift()!)
  return a
}
const seedOf = (t: string) => { let h = 7; for (const c of t) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }

/* ───────── true or false ───────── */

export function TrueFalse({ step, result, onResult }: Common & { step: Of<'tf'> }) {
  const [pick, setPick] = useState<boolean | null>(null)
  const choose = (v: boolean) => { if (pick !== null) return; setPick(v); onResult(v === step.truth) }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (pick !== null || (e.target as Element).closest('input,textarea') || e.metaKey || e.ctrlKey) return
      const key = e.key.toLowerCase()
      if (key === 't' || key === '1') choose(true)
      if (key === 'f' || key === '2') choose(false)
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  })
  return (
    <>
      <div className="flex flex-1 flex-col"><Kicker>Check · true or false?</Kicker><FitText max={24} floor className="max-w-[52ch] leading-[1.45]">{step.statement}</FitText></div>
      <div role="group" aria-label="Answer" className="grid shrink-0 grid-cols-2 gap-2">
        {[true, false].map((v) => {
          const right = pick !== null && v === step.truth
          const wrong = pick === v && v !== step.truth
          return (
            <button key={String(v)} disabled={pick !== null} onClick={() => choose(v)} className={cn('flex min-h-[52px] items-center justify-center gap-2 px-3 py-2 text-[15px] font-semibold', tile(right ? 'right' : wrong ? 'wrong' : 'idle'), wrong && 'line-through decoration-1', pick !== null && !right && !wrong && 'opacity-60')}>
              {right && <Check className="size-4" />}{wrong && <X className="size-4" />}{v ? 'True' : 'False'}
              {right && <span className="sr-only"> (correct)</span>}{wrong && <span className="sr-only"> (your answer, not correct)</span>}
            </button>
          )
        })}
      </div>
      {result !== null && <Verdict ok={result}>{step.truth ? 'That is what the article says.' : <>The article says: {step.explain}</>}</Verdict>}
    </>
  )
}

/* ───────── type the missing word ───────── */

export function TypeIt({ step, result, onResult }: Common & { step: Of<'type'> }) {
  const [val, setVal] = useState('')
  const [miss, setMiss] = useState(0)
  const done = result !== null
  const letters = step.answer.replace(/[^\p{L}\p{N}]/gu, '').length
  const submit = () => {
    if (done || !val.trim()) return
    if (sameAnswer(val, step.answer)) onResult(true)
    else if (miss >= 1) onResult(false)
    else setMiss(1)
  }
  const fine = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches
  return (
    <>
      <div className="flex flex-1 flex-col"><Kicker>Check · type the missing word</Kicker><FitText max={22} floor className="max-w-[52ch] leading-[1.45]">{done ? step.explain : step.prompt}</FitText></div>
      <form onSubmit={(e) => { e.preventDefault(); submit() }} className="flex shrink-0 flex-wrap gap-2">
        <input value={val} onChange={(e) => setVal(e.target.value)} disabled={done} autoFocus={fine} autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="done" aria-label="Your answer" placeholder="Type it here" className={cn('h-11 min-w-0 flex-1 basis-40 border bg-transparent px-3 text-base text-ink placeholder:text-ink-3', done ? (result ? 'border-signal' : 'border-ink/60') : 'border-ink/30 focus:border-signal')} />
        <button type="submit" disabled={done || !val.trim()} className={solid}>Check</button>
        <button type="button" disabled={done} onClick={() => onResult(false)} className={ghost}><Eye className="size-4" />Show me</button>
      </form>
      {miss === 1 && !done && <p role="status" className="shrink-0 text-[14px] text-ink-2">Not that one. Hint: {letters} letters, starting with “{step.answer[0]}”. One more try.</p>}
      {done && <Verdict ok={result!}>{result ? 'The answer is ' : 'The answer was '}<strong className="text-ink">{step.answer}</strong>.</Verdict>}
    </>
  )
}

/* ───────── guess a number on a slider ───────── */

const fmtNum = (v: number, year: boolean) => (year ? String(Math.round(v)) : v >= 1000 ? Math.round(v).toLocaleString('en-US') : String(Number(v.toPrecision(3))))

export function Estimate({ step, result, onResult }: Common & { step: Of<'estimate'> }) {
  const [p, setP] = useState(500)
  const done = result !== null
  const raw = (t: number) => (step.log ? step.lo * Math.pow(step.hi / step.lo, t) : step.lo + t * (step.hi - step.lo))
  const snap = (v: number) => (step.year || step.unit === 'percent' ? Math.round(v) : step.log ? Number(v.toPrecision(2)) : step.value < 20 ? Math.round(v * 10) / 10 : Math.round(v))
  const guess = snap(raw(p / 1000))
  const at = (v: number) => Math.max(0, Math.min(1, step.log ? Math.log(v / step.lo) / Math.log(step.hi / step.lo) : (v - step.lo) / (step.hi - step.lo)))
  const close = step.log ? Math.abs(Math.log(guess / step.value)) <= step.tol : Math.abs(guess - step.value) <= step.tol
  const unit = step.unit ? ` ${step.unit}` : ''
  const lock = () => { if (!done) onResult(close) }
  return (
    <>
      <div className="flex flex-1 flex-col"><Kicker>Check · how close can you get?</Kicker><FitText max={22} floor className="max-w-[52ch] leading-[1.45]">{done ? step.explain : step.prompt}</FitText></div>
      <div className="shrink-0">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <span className="fig dot text-[clamp(1.5rem,5vw,2.2rem)] leading-[1.4]" aria-live="polite">{fmtNum(guess, step.year)}{unit}</span>
          {done && <span className="hud">Answer {fmtNum(step.value, step.year)}{unit}</span>}
        </div>
        <div className="relative">
          <input type="range" min={0} max={1000} value={p} disabled={done} onChange={(e) => setP(Number(e.target.value))} aria-label="Your estimate" aria-valuetext={`${fmtNum(guess, step.year)}${unit}`} className="block h-11 w-full accent-signal" />
          {done && <span aria-hidden className="pointer-events-none absolute top-0 h-11 w-0.5 bg-ink" style={{ left: `calc(${at(step.value) * 100}% + ${(0.5 - at(step.value)) * 16}px)` }} />}
        </div>
        <div className="hud flex justify-between"><span>{fmtNum(step.lo, step.year)}</span><span>{fmtNum(step.hi, step.year)}</span></div>
      </div>
      {!done ? <div className="flex shrink-0 flex-wrap gap-2"><button onClick={lock} className={solid}>Lock it in</button></div> : <Verdict ok={result!}>{result ? 'Close enough.' : 'Off by '}{!result && <strong className="text-ink">{fmtNum(Math.abs(guess - step.value), step.year)}{unit}</strong>}{!result && '.'}</Verdict>}
    </>
  )
}

/* ───────── put events in order ───────── */

export function Sequence({ step, result, onResult }: Common & { step: Of<'sequence'> }) {
  const order = useMemo(() => jumble(step.items.length, seedOf(step.items[0].text)), [step])
  const [picks, setPicks] = useState<number[]>([])
  const done = result !== null
  const n = step.items.length
  const toggle = (i: number) => { if (!done) setPicks((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i])) }
  const rows = done ? Array.from({ length: n }, (_, i) => i) : order
  return (
    <>
      <div className="shrink-0"><Kicker>{n === 2 ? 'Check · which came first?' : 'Check · earliest first'}</Kicker><p className="text-[14px] text-ink-2">{done ? 'Here they are in order.' : n === 2 ? 'Tap the one that came first, then the other.' : 'Tap them in the order they happened. Tap one again to take it back.'}</p></div>
      <div className="flex flex-1 flex-col gap-2">
        {rows.map((i) => {
          const rank = picks.indexOf(i)
          const state = done ? (rank === i ? 'right' : 'wrong') : rank >= 0 ? 'picked' : 'idle'
          return (
            <button key={i} disabled={done} onClick={() => toggle(i)} aria-pressed={rank >= 0} className={cn('flex min-h-[48px] max-h-[150px] flex-1 items-stretch gap-3 overflow-hidden px-3 py-2 text-left', tile(state))}>
              <span className="grid shrink-0 place-items-center"><Mark state={state}>{rank >= 0 ? rank + 1 : ''}</Mark></span>
              <FitText max={16} min={11} className="leading-[1.35]">{done ? step.items[i].text : hideYear(step.items[i].text)}</FitText>
              {done && <span className="fig hud shrink-0 self-center text-ink">{step.items[i].year}</span>}
              {done && rank !== i && <span className="sr-only">You put this {rank >= 0 ? `number ${rank + 1}` : 'nowhere'}.</span>}
            </button>
          )
        })}
      </div>
      {!done ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          <button onClick={() => onResult(picks.length === n && picks.every((v, i) => v === i))} disabled={picks.length < n} className={solid}>Check order</button>
          <button onClick={() => setPicks([])} disabled={!picks.length} className={ghost}><RotateCcw className="size-4" />Clear</button>
          <button onClick={() => onResult(false)} className={ghost}><Eye className="size-4" />Show me</button>
        </div>
      ) : <Verdict ok={result!}>{result ? 'You had them all in order.' : 'The order is '}{!result && step.explain}</Verdict>}
    </>
  )
}

/* ───────── match sections to their opening lines ───────── */

const LETTER = 'ABCD'
export function Match({ step, result, onResult }: Common & { step: Of<'match'> }) {
  // a phone has room for three pairs, not four
  const wide = useMemo(() => typeof matchMedia === 'function' && matchMedia('(min-width: 768px)').matches, [])
  const pairs = useMemo(() => (wide ? step.pairs : step.pairs.slice(0, 3)), [step, wide])
  const n = pairs.length
  const order = useMemo(() => jumble(n, seedOf(pairs[0].left + pairs[0].right)), [pairs, n])
  const [asg, setAsg] = useState<(number | null)[]>(() => Array(n).fill(null))
  const [sel, setSel] = useState<number | null>(0)
  const done = result !== null
  const nextFree = (a: (number | null)[]) => { for (let i = 0; i < n; i++) if (!a.includes(i)) return i; return null }
  const pickLeft = (i: number) => {
    if (done) return
    const at = asg.indexOf(i)
    if (at >= 0) setAsg(asg.map((v, p) => (p === at ? null : v)))
    setSel(i)
  }
  const pickRight = (p: number) => {
    if (done) return
    if (sel === null) { if (asg[p] !== null) { setSel(asg[p]); setAsg(asg.map((v, q) => (q === p ? null : v))) } return }
    const a = asg.map((v, q) => (q === p ? sel : v === sel ? null : v))
    setAsg(a); setSel(nextFree(a))
  }
  const right = order.filter((p, pos) => asg[pos] === p).length
  return (
    <>
      <div className="shrink-0"><Kicker>Check · match them up</Kicker><p className="text-[14px] text-ink-2">{done ? `${right} of ${n} matched.` : 'Pick a heading, then the opening line it belongs to.'}</p></div>
      <div className="flex flex-1 flex-col gap-2 md:flex-row md:gap-4">
        <div role="group" aria-label="Headings" className="grid shrink-0 gap-2 md:flex md:w-[34%] md:flex-col" style={wide ? undefined : { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {pairs.map((pr, i) => {
            const used = asg.includes(i)
            return (
              <button key={pr.left} disabled={done} onClick={() => pickLeft(i)} aria-pressed={sel === i} title={pr.left} className={cn('flex min-h-11 gap-2 px-2 py-1.5 text-left text-[13px] leading-[1.25] max-md:flex-col max-md:items-start md:max-h-[88px] md:flex-1 md:items-center', tile(sel === i ? 'picked' : 'idle'), used && sel !== i && 'opacity-60')}>
                <span className="max-md:hidden"><Mark state={sel === i ? 'picked' : 'idle'}>{LETTER[i]}</Mark></span>
                <span className={cn('hud md:hidden', sel === i && 'text-signal')}>{LETTER[i]}</span>
                <span className="line-clamp-2 min-w-0">{pr.left}</span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          {order.map((p, pos) => {
            const got = asg[pos]
            const state = done ? (got === p ? 'right' : 'wrong') : got !== null ? 'picked' : 'idle'
            return (
              <button key={p} disabled={done} onClick={() => pickRight(pos)} className={cn('flex min-h-[44px] max-h-[130px] flex-1 items-stretch gap-3 overflow-hidden px-3 py-1.5 text-left', tile(state))}>
                <span className="grid shrink-0 place-items-center"><Mark state={state}>{got !== null ? LETTER[got] : ''}</Mark></span>
                <FitText max={15} min={11} className="leading-[1.3]">{pairs[p].right}</FitText>
                {done && got !== p && <span className="hud shrink-0 self-center text-ink">{LETTER[p]}<span className="sr-only"> was the right heading</span></span>}
              </button>
            )
          })}
        </div>
      </div>
      {!done ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          <button onClick={() => onResult(order.every((p, pos) => asg[pos] === p))} disabled={asg.includes(null)} className={solid}>Check matches</button>
          <button onClick={() => { setAsg(Array(n).fill(null)); setSel(0) }} disabled={asg.every((v) => v === null)} className={ghost}><RotateCcw className="size-4" />Clear</button>
          <button onClick={() => onResult(false)} className={ghost}><Eye className="size-4" />Show me</button>
        </div>
      ) : <Verdict ok={result!}>{result ? 'Every heading is with its line.' : 'The right letters are shown on the lines.'}</Verdict>}
    </>
  )
}

/* ───────── build a sentence from pieces ───────── */

export function Build({ step, result, onResult }: Common & { step: Of<'build'> }) {
  const order = useMemo(() => jumble(step.chunks.length, seedOf(step.chunks.join(' '))), [step])
  const [placed, setPlaced] = useState<number[]>([])
  const done = result !== null
  const left = order.filter((i) => !placed.includes(i))
  const built = placed.map((i) => step.chunks[i]).join(' ')
  return (
    <>
      <div className="shrink-0"><Kicker>Check · put the sentence back together</Kicker><p className="text-[14px] text-ink-2">{done ? 'The sentence, as it was written:' : 'Tap the pieces in order. Tap a placed piece to take it back.'}</p></div>
      <div className="flex flex-1 flex-col justify-center gap-4">
        <div aria-label="Your sentence" className={cn('flex min-h-[64px] flex-wrap content-start gap-2 border border-dashed p-2', done ? (result ? 'border-signal' : 'border-ink/60') : 'border-ink/30')}>
          {done ? <p className="p-1 text-[16px] leading-[1.4]">{step.explain}</p> : placed.length === 0 ? <span className="p-2 text-[14px] text-ink-3">Your sentence goes here.</span> : placed.map((i) => <button key={i} onClick={() => setPlaced((p) => p.filter((x) => x !== i))} className="min-h-11 border border-signal/70 bg-signal/10 px-3 text-[15px]">{step.chunks[i]}</button>)}
        </div>
        {!done && <div role="group" aria-label="Pieces" className="flex flex-wrap gap-2">{left.map((i) => <button key={i} onClick={() => setPlaced((p) => [...p, i])} className="min-h-11 border border-ink/30 px-3 text-[15px] hover:border-signal/70 hover:bg-ink/[0.06]">{step.chunks[i]}</button>)}</div>}
      </div>
      {!done ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          <button onClick={() => onResult(built === step.chunks.join(' '))} disabled={left.length > 0} className={solid}>Check sentence</button>
          <button onClick={() => setPlaced([])} disabled={!placed.length} className={ghost}><RotateCcw className="size-4" />Clear</button>
          <button onClick={() => onResult(false)} className={ghost}><Eye className="size-4" />Show me</button>
        </div>
      ) : <Verdict ok={result!}>{result ? 'Word for word.' : 'That one is worth reading twice.'}</Verdict>}
    </>
  )
}

/* ───────── a timeline you can walk along ───────── */

export function Timeline({ step }: { step: Of<'timeline'> }) {
  const [i, setI] = useState(0)
  const ev = step.events
  const lo = ev[0].year
  const span = Math.max(1, ev[ev.length - 1].year - lo)
  return (
    <>
      <div className="shrink-0"><Kicker>On the clock · {lo} to {ev[ev.length - 1].year}</Kicker><p className="text-[14px] text-ink-2">Tap a year to read what happened. The line is drawn to scale.</p></div>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="relative h-5 shrink-0" aria-hidden>
          <i className="absolute inset-x-0 top-1/2 h-px bg-ink/30" />
          {ev.map((e, k) => <i key={k} className={cn('absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 border', k === i ? 'scale-125 border-signal bg-signal' : 'border-ink/60 bg-ground')} style={{ left: `${3 + ((e.year - lo) / span) * 94}%` }} />)}
        </div>
        <div role="tablist" aria-label="Events" className="flex shrink-0 gap-1.5">
          {ev.map((e, k) => <button key={k} role="tab" aria-selected={k === i} onClick={() => setI(k)} className={cn('fig min-h-11 min-w-0 flex-1 border px-0.5 text-[13px] font-semibold', k === i ? 'border-signal bg-signal text-on-signal' : 'border-ink/25 hover:border-signal/70 hover:bg-ink/[0.06]')}>{e.year}</button>)}
        </div>
        <div className="flex flex-1 flex-col" role="tabpanel"><FitText max={24} floor className="max-w-[52ch] leading-[1.45]">{ev[i].text}</FitText></div>
      </div>
    </>
  )
}
