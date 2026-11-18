import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { INFO, MEMORY_MAX, SUMS_SECONDS, digitsOn, factsOn, reflexDelays, scoreGuess, scoreMemory, scoreReflex, scoreSums, sumsOn, type GameId } from '@/lib/daily'
import { RARE_MAX, countryOf, startsWith } from '@/lib/dailyshared'
import { cn } from '@/lib/utils'

/** What a game hands back: a score, or for the rarity game the answers (the server scores those against everyone else's). */
export type Result = { score: number } | { answers: string[] }

const input = 'h-11 min-w-0 flex-1 border border-ink/30 bg-transparent px-3 text-[16px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-signal'
const primary = 'inline-flex h-11 items-center justify-center bg-signal px-5 text-sm font-semibold text-on-signal disabled:opacity-40'

/** counts down from `seconds` and calls `end` once; `left` is what is left, in seconds */
function useClock(seconds: number, running: boolean, end: () => void) {
  const [left, setLeft] = useState(seconds)
  const endRef = useRef(end)
  endRef.current = end
  useEffect(() => {
    if (!running) return
    const t0 = Date.now()
    const id = window.setInterval(() => {
      const l = Math.max(0, seconds - (Date.now() - t0) / 1000)
      setLeft(l)
      if (l <= 0) { window.clearInterval(id); endRef.current() }
    }, 200)
    return () => window.clearInterval(id)
  }, [seconds, running])
  return left
}

function Sums({ day, done }: { day: number; done: (r: Result) => void }) {
  const qs = useMemo(() => sumsOn(day), [day])
  const [i, setI] = useState(0)
  const [v, setV] = useState('')
  const finished = useRef(false)
  const rightRef = useRef(0)
  const left = useClock(SUMS_SECONDS, true, () => finish(rightRef.current, false, 0))
  function finish(correct: number, all: boolean, secs: number) {
    if (finished.current) return
    finished.current = true
    done({ score: scoreSums(correct, all, secs) })
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (v.trim() === '' || finished.current) return
    const ok = Number(v.replace(',', '.')) === qs[i].a
    if (ok) rightRef.current += 1
    setV('')
    if (i + 1 >= qs.length) finish(rightRef.current, true, left)
    else setI(i + 1)
  }
  return (
    <div className="grid content-start gap-3">
      <div className="flex items-center justify-between"><span className="hud">{i + 1} of {qs.length}</span><span className="fig text-[15px]">{Math.ceil(left)} s</span></div>
      <div className="dot text-[clamp(2rem,6vw,3.2rem)] font-bold leading-none">{qs[i].q}</div>
      <form onSubmit={submit} className="flex gap-2">
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} inputMode="decimal" aria-label="Answer" autoComplete="off" className={input} />
        <button type="submit" className={primary}>Enter</button>
      </form>
    </div>
  )
}

function Reflex({ day, done }: { day: number; done: (r: Result) => void }) {
  const delays = useMemo(() => reflexDelays(day), [day])
  const [round, setRound] = useState(0)
  const [phase, setPhase] = useState<'wait' | 'go' | 'early' | 'hit'>('wait')
  const [last, setLast] = useState(0)
  const times = useRef<number[]>([])
  const at = useRef(0)
  const timer = useRef(0)
  useEffect(() => {
    setPhase('wait')
    timer.current = window.setTimeout(() => { at.current = performance.now(); setPhase('go') }, delays[round])
    return () => window.clearTimeout(timer.current)
  }, [round, delays])
  const next = (ms: number) => {
    times.current.push(ms)
    setLast(ms)
    window.setTimeout(() => {
      if (times.current.length >= 5) done({ score: scoreReflex(times.current) })
      else setRound((r) => r + 1)
    }, 900)
  }
  const tap = () => {
    if (phase === 'wait') { window.clearTimeout(timer.current); setPhase('early'); next(600) }
    else if (phase === 'go') { const ms = Math.round(performance.now() - at.current); setPhase('hit'); next(Math.min(600, ms)) }
  }
  const say = phase === 'wait' ? 'Wait for it' : phase === 'go' ? 'Tap' : phase === 'early' ? 'Too early' : `${last} ms`
  return (
    <div className="grid content-start gap-3">
      <div className="flex items-center justify-between"><span className="hud">Round {Math.min(round + 1, 5)} of 5</span></div>
      <button
        type="button" onPointerDown={(e) => { e.preventDefault(); tap() }} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tap() } }}
        className={cn('grid h-40 w-full select-none place-items-center border text-2xl font-bold', phase === 'go' ? 'border-signal bg-signal text-on-signal' : phase === 'early' ? 'border-bad bg-bad/20 text-ink' : 'border-ink/30 bg-ink/[0.05] text-ink')}
        style={{ touchAction: 'manipulation' }}
      >
        {say}
      </button>
    </div>
  )
}

function Rare({ letter, done }: { letter: string; done: (r: Result) => void }) {
  const [got, setGot] = useState<string[]>([])
  const [v, setV] = useState('')
  const [msg, setMsg] = useState('')
  const finished = useRef(false)
  const gotRef = useRef<string[]>([])
  const end = () => { if (!finished.current) { finished.current = true; done({ answers: gotRef.current }) } }
  const left = useClock(30, true, end)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const c = countryOf(v)
    if (!c || !startsWith(c, letter)) { setMsg(`Not a country that starts with ${letter}.`); return }
    if (gotRef.current.includes(c)) { setMsg('You gave that one.'); return }
    gotRef.current = [...gotRef.current, c]; setGot(gotRef.current); setV(''); setMsg('')
    if (gotRef.current.length >= RARE_MAX) end()
  }
  return (
    <div className="grid content-start gap-3">
      <div className="flex items-center justify-between"><span className="hud">{got.length} of {RARE_MAX}</span><span className="fig text-[15px]">{Math.ceil(left)} s</span></div>
      <div className="dot text-[clamp(1.4rem,4vw,2rem)] font-bold leading-tight">Countries starting with <span className="text-signal">{letter}</span></div>
      <form onSubmit={submit} className="flex gap-2">
        <input autoFocus value={v} onChange={(e) => { setV(e.target.value); setMsg('') }} aria-label="A country" autoComplete="off" autoCapitalize="words" className={input} />
        <button type="submit" className={primary}>Add</button>
      </form>
      <p role="status" className="min-h-5 text-[13px] text-ink-2">{msg}</p>
      <ul className="flex flex-wrap gap-1.5">{got.map((g) => <li key={g} className="border border-ink/25 px-2 py-1 text-sm">{g}</li>)}</ul>
      <button type="button" onClick={end} className="h-11 w-fit border border-ink/30 px-4 text-sm hover:bg-ink/10">I am done</button>
    </div>
  )
}

function Memory({ day, done }: { day: number; done: (r: Result) => void }) {
  const digits = useMemo(() => digitsOn(day), [day])
  const [len, setLen] = useState(3)
  const [shown, setShown] = useState<number | null>(null)
  const [typing, setTyping] = useState(false)
  const [v, setV] = useState('')
  const [flash, setFlash] = useState('')
  const box = useRef<HTMLInputElement>(null)
  useEffect(() => { if (typing) box.current?.focus() }, [typing])
  useEffect(() => {
    setTyping(false); setV(''); setShown(null)
    let i = 0
    const ids: number[] = []
    const step = () => {
      if (i < len) { setShown(digits[i]); ids.push(window.setTimeout(() => { setShown(null); i += 1; ids.push(window.setTimeout(step, 250)) }, 650)) }
      else setTyping(true)
    }
    ids.push(window.setTimeout(step, 700))
    return () => ids.forEach((t) => window.clearTimeout(t))
  }, [len, digits])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!typing) return
    const want = digits.slice(0, len).join('')
    if (v.replace(/\D/g, '') === want) {
      if (len >= MEMORY_MAX) done({ score: scoreMemory(len) })
      else { setFlash('Right'); setTyping(false); window.setTimeout(() => { setFlash(''); setLen(len + 1) }, 500) }
    } else done({ score: scoreMemory(len - 1) })
  }
  return (
    <div className="grid content-start gap-3">
      <div className="flex items-center justify-between"><span className="hud">{len} digits</span></div>
      <div className="dot grid h-24 place-items-center text-[4rem] font-bold leading-none" aria-live="polite">{typing ? '?' : flash || (shown ?? '')}</div>
      <form onSubmit={submit} className="flex gap-2">
        <input ref={box} value={v} onChange={(e) => setV(e.target.value)} readOnly={!typing} inputMode="numeric" aria-label="The digits" autoComplete="off" className={input} />
        <button type="submit" disabled={!typing} className={primary}>Enter</button>
      </form>
    </div>
  )
}

function Guess({ day, done }: { day: number; done: (r: Result) => void }) {
  const facts = useMemo(() => factsOn(day), [day])
  const [i, setI] = useState(0)
  const [v, setV] = useState('')
  const [got, setGot] = useState<number | null>(null)
  const total = useRef(0)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (got !== null) {
      if (i + 1 >= facts.length) done({ score: total.current })
      else { setI(i + 1); setV(''); setGot(null) }
      return
    }
    const pts = scoreGuess(facts[i], Number(v.replace(/,/g, '')))
    total.current += pts; setGot(pts)
  }
  const f = facts[i]
  return (
    <div className="grid content-start gap-3">
      <div className="flex items-center justify-between"><span className="hud">{i + 1} of {facts.length}</span></div>
      <p className="text-[17px] font-semibold leading-6">{f.q}</p>
      <form onSubmit={submit} className="flex gap-2">
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} readOnly={got !== null} inputMode="decimal" aria-label="Your guess" autoComplete="off" className={input} />
        <button type="submit" className={primary}>{got === null ? 'Guess' : i + 1 >= facts.length ? 'Finish' : 'Next'}</button>
      </form>
      {got !== null && <p role="status" className="text-sm text-ink-2">It is <b className="text-ink">{f.a.toLocaleString()}{f.unit ? ` ${f.unit}` : ''}</b>. You get {got}.</p>}
    </div>
  )
}

export function DailyGame({ game, day, letter, done }: { game: GameId; day: number; letter: string; done: (r: Result) => void }) {
  return game === 'sums' ? <Sums day={day} done={done} /> : game === 'reflex' ? <Reflex day={day} done={done} /> : game === 'rare' ? <Rare letter={letter} done={done} /> : game === 'memory' ? <Memory day={day} done={done} /> : <Guess day={day} done={done} />
}
export { INFO }
