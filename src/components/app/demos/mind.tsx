import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointer } from 'react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Chips, clamp, fmt, Frame, ghost, Slide, solid, type DemoProps } from './kit'

/* ───────── cryptography: a cipher with 25 keys is a lock with 25 combinations ───────── */

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const shiftText = (t: string, k: number) => t.replace(/[A-Z]/gi, (c) => { const up = c === c.toUpperCase(); const l = ABC[(ABC.indexOf(c.toUpperCase()) + k + 26) % 26]; return up ? l : l.toLowerCase() })
/** messages to crack, each locked with its own shift, so a second try is not the same puzzle */
const PUZZLES: [string, number][] = [['MEET ME AT THE LIBRARY AT NOON', 7], ['ATTACK AT DAWN', 3], ['BRING MORE COFFEE', 11], ['THE KEY IS UNDER THE MAT', 19], ['VENI VIDI VICI', 14]]

export function Cipher({ played }: DemoProps) {
  const [mode, setMode] = useState<'crack' | 'write'>('crack')
  const [puzzle, setPuzzle] = useState(0)
  const [back, setBack] = useState(0)
  const [say, setSay] = useState('HELLO WORLD')
  const [fwd, setFwd] = useState(3)
  const [secret, key] = PUZZLES[puzzle]
  const cipher = useMemo(() => shiftText(secret, key), [secret, key])
  const crack = mode === 'crack'
  const k = crack ? -back : fwd
  const out = crack ? shiftText(cipher, -back) : shiftText(say, fwd)
  const solved = crack && out === secret
  const next = () => { setPuzzle((puzzle + 1) % PUZZLES.length); setBack(0); played() }
  return (
    <Frame kicker="Caesar cipher" task={crack ? 'This message was locked by sliding every letter along the alphabet. Slide them back until it reads as English.' : 'Type a message and choose how far to slide each letter. This is the cipher Julius Caesar is said to have used.'} note={solved ? `Cracked. There are only 25 shifts to try, so a person (or a computer, instantly) can test every one. Modern ciphers use keys of 128 bits or more: over 10³⁸ possibilities, far too many to try.` : crack ? 'The weakness is the small number of keys: 25. Better ciphers make guessing the key hopeless, not just hidden.' : fwd === 0 ? 'A shift of 0 changes nothing, so it hides nothing. Every other shift from 1 to 25 is a different lock.' : 'Whoever knows the shift can slide the letters back. Someone who does not has only 25 shifts to try.'}>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Chips label="Mode" value={mode} onChange={setMode} items={[{ id: 'crack', label: 'Crack a message' }, { id: 'write', label: 'Write your own' }]} />
        {crack && <button onClick={next} className={ghost}>{solved ? 'Next message' : 'Try another'}</button>}
        {!crack && <input value={say} maxLength={20} onChange={(e) => { setSay(e.target.value.toUpperCase()); played() }} aria-label="Your message" autoCapitalize="characters" spellCheck={false} className="h-11 min-w-0 flex-1 basis-40 border border-ink/30 bg-transparent px-3 text-base tracking-[0.14em] text-ink focus:border-signal" />}
      </div>
      <div className="grid shrink-0 gap-0.5" aria-hidden>
        <div className="grid text-center text-[11px] text-ink-2 md:text-[13px]" style={{ gridTemplateColumns: 'repeat(26, minmax(0, 1fr))' }}>{[...ABC].map((l) => <span key={l}>{l}</span>)}</div>
        <div className="grid text-center text-[11px] font-semibold md:text-[13px]" style={{ gridTemplateColumns: 'repeat(26, minmax(0, 1fr))' }}>{[...shiftText(ABC, k)].map((l, i) => <span key={i} className={cn(l !== ABC[i] && 'text-signal')}>{l}</span>)}</div>
      </div>
      <Slide label={crack ? 'Slide back by' : 'Slide forward by'} value={crack ? back : fwd} min={0} max={25} onChange={(v) => { if (crack) setBack(v); else setFwd(v); played() }} />
      <div className={cn('flex min-h-[64px] shrink-0 flex-col justify-center border px-3 py-2', solved ? 'border-signal bg-signal/10' : 'border-ink/25')}>
        <p className="hud mb-1">{crack ? (solved ? 'Cracked' : back === 0 ? 'Still locked' : 'What it says now') : 'Locked message'}</p>
        <p className="text-base font-semibold tracking-[0.14em] break-words md:text-lg" aria-live="polite">{out || '…'}</p>
      </div>
    </Frame>
  )
}

/* ───────── game theory: be kind first, answer in kind ───────── */

type Move = 'C' | 'D'
const PAY: Record<string, [number, number]> = { CC: [3, 3], CD: [0, 5], DC: [5, 0], DD: [1, 1] }
const OPP = { copy: 'Copycat', never: 'Never trusts', coin: 'Coin flip' } as const
const ROUNDS = 8

export function Dilemma({ played }: DemoProps) {
  const [opp, setOpp] = useState<keyof typeof OPP>('copy')
  const [log, setLog] = useState<{ me: Move; them: Move }[]>([])
  const reply = (): Move => (opp === 'copy' ? (log.length ? log[log.length - 1].me : 'C') : opp === 'never' ? 'D' : Math.random() < 0.5 ? 'C' : 'D')
  const play = (me: Move) => { played(); setLog((l) => [...l, { me, them: reply() }]) }
  const you = log.reduce((a, r) => a + PAY[r.me + r.them][0], 0)
  const them = log.reduce((a, r) => a + PAY[r.me + r.them][1], 0)
  const over = log.length >= ROUNDS
  return (
    <Frame kicker="The prisoner’s dilemma" task={`Eight rounds, both choose at once. Both cooperate: 3 each. Both defect: 1 each. Defect on a cooperator: 5 for you, 0 for them. Try to finish ahead.`} note={over ? (you >= them && opp !== 'copy' ? 'You can finish ahead of a fixed opponent, but nobody gets rich that way. Against a copycat, steady cooperation is worth 24, and every betrayal costs more than the 5 it earns.' : 'Cooperating every round against a copycat pays 24. A single early betrayal earns 5, then both of you drop to 1 or 0 for the rounds that follow.') : 'Copycat starts kind and then does whatever you did last round.'}>
      <Chips label="Opponent" value={opp} onChange={(v) => { setOpp(v); setLog([]) }} items={Object.entries(OPP).map(([id, label]) => ({ id: id as keyof typeof OPP, label }))} />
      <div className="grid min-h-0 flex-1 [align-content:safe_center] gap-1" role="table" aria-label="Rounds so far">
        {(['me', 'them'] as const).map((who) => (
          <div key={who} role="row" className="grid items-center gap-1" style={{ gridTemplateColumns: `4.5rem repeat(${ROUNDS}, minmax(0, 1fr))` }}>
            <span role="rowheader" className="hud">{who === 'me' ? 'You' : 'Them'}</span>
            {Array.from({ length: ROUNDS }, (_, i) => { const m = log[i]?.[who]; return <span key={i} role="cell" aria-label={m ? (m === 'C' ? 'cooperated' : 'defected') : 'not played'} className={cn('grid h-9 place-items-center border text-sm font-semibold', m === 'D' ? 'border-ink bg-ink text-ground' : m === 'C' ? 'border-signal text-signal' : 'border-ink/20 text-ink-3')}>{m ?? '·'}</span> })}
          </div>
        ))}
      </div>
      <p className="fig shrink-0 text-lg" aria-live="polite">You <strong>{you}</strong> · {OPP[opp]} <strong>{them}</strong>{over && <span className="text-ink-2"> · round {ROUNDS} of {ROUNDS}</span>}</p>
      <div className="flex shrink-0 flex-wrap gap-2">
        {!over ? (<><button onClick={() => play('C')} className={solid}>Cooperate</button><button onClick={() => play('D')} className={ghost}>Defect</button></>) : <button onClick={() => setLog([])} className={solid}>Play again</button>}
      </div>
    </Frame>
  )
}

/* ───────── stoicism: sort what is yours to steer from what is not ───────── */

const CARDS = [
  { t: 'How hard you prepare', mine: true, why: 'Effort is a decision you make each day.' },
  { t: 'What other people think of you', mine: false, why: 'Opinions live in other people’s heads.' },
  { t: 'The weather on the day', mine: false, why: 'You can bring a coat, but you cannot change the sky.' },
  { t: 'How you answer a setback', mine: true, why: 'The event is handed to you. Your response is not.' },
  { t: 'Whether you win', mine: false, why: 'Others are competing too. You control the attempt, not the result.' },
  { t: 'What you decide is worth caring about', mine: true, why: 'Your judgements are the one thing that is wholly yours.' },
]
export function Control({ played }: DemoProps) {
  const [at, setAt] = useState(0)
  const [pick, setPick] = useState<boolean | null>(null)
  const [right, setRight] = useState(0)
  const c = CARDS[at]
  const done = at >= CARDS.length
  const answer = (mine: boolean) => { if (pick !== null) return; played(); setPick(mine); if (mine === c.mine) setRight((r) => r + 1) }
  return (
    <Frame kicker="The dichotomy of control" task="Epictetus opens his handbook with a split: some things are up to us, others are not. Sort each one." note="The Stoic move is not to stop caring about the second kind, but to put effort only where effort can change something.">
      {done ? (
        <div className="grid min-h-0 flex-1 [align-content:safe_center] justify-items-start gap-3">
          <p className="dot text-[clamp(1.6rem,5vw,2.4rem)] leading-[1.4]">{right} of {CARDS.length}</p>
          <p className="text-[15px] text-ink-2">{right === CARDS.length ? 'Every one in the right place.' : 'Most people find the “whether you win” cards the hardest to sort.'}</p>
          <button onClick={() => { setAt(0); setPick(null); setRight(0) }} className={ghost}>Again</button>
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 border border-ink/25 p-4">
            <p className="hud">{at + 1} of {CARDS.length}</p>
            <p className="text-[clamp(1.2rem,3.2vw,1.8rem)] font-semibold leading-[1.25]">{c.t}</p>
            {pick !== null && <p role="status" className="text-[14px] text-ink-2"><strong className="text-ink">{pick === c.mine ? 'Yes. ' : 'Not quite. '}</strong>It is {c.mine ? 'up to you' : 'not up to you'}. {c.why}</p>}
          </div>
          {pick === null ? (
            <div className="grid shrink-0 grid-cols-2 gap-2"><button onClick={() => answer(true)} className={solid}>Up to me</button><button onClick={() => answer(false)} className={ghost}>Not up to me</button></div>
          ) : <button onClick={() => { setAt(at + 1); setPick(null) }} className={cn(solid, 'self-start')}>{at === CARDS.length - 1 ? 'See how you did' : 'Next'}</button>}
        </>
      )}
    </Frame>
  )
}

/* ───────── neuroscience: how long a signal takes, measured on you ───────── */

export function Reaction({ played }: DemoProps) {
  const [st, setSt] = useState<'idle' | 'wait' | 'go' | 'early' | 'done'>('idle')
  const [log, setLog] = useState<number[]>([])
  const t0 = useRef(0)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const press = () => {
    if (st === 'wait') { clearTimeout(timer.current); setSt('early'); return }
    if (st === 'go') { const ms = Math.round(performance.now() - t0.current); setLog((l) => [...l, ms].slice(-5)); setSt('done'); played(); return }
    setSt('wait')
    timer.current = window.setTimeout(() => { t0.current = performance.now(); setSt('go') }, 1200 + Math.random() * 2800)
  }
  const avg = log.length ? Math.round(log.reduce((a, b) => a + b, 0) / log.length) : 0
  const last = log[log.length - 1]
  const LABEL = { idle: 'Press to begin', wait: 'Wait for it…', go: 'NOW', early: 'Too soon. Press to try again', done: `${last} ms. Press to go again` } as const
  return (
    <Frame kicker="Reaction time" task="When the box turns yellow, press it as fast as you can. A signal has to travel from your eye through the brain to your finger." note="Your result includes your screen and input delay, often 30 to 60 ms, so treat it as a comparison with yourself. People commonly land between 200 and 300 ms.">
      <button onPointerDown={(e) => { if (e.pointerType !== 'mouse' || e.button === 0) { e.preventDefault(); press() } }} onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); press() } }} className={cn('grid min-h-[140px] flex-1 touch-none select-none place-items-center border-2 text-[clamp(1.4rem,5vw,2.2rem)] font-bold', st === 'go' ? 'border-signal bg-signal text-on-signal' : st === 'wait' ? 'border-ink/40 bg-ink/[0.08]' : st === 'early' ? 'border-ink bg-ink/15' : 'border-ink/30 hover:bg-ink/[0.06]')} aria-live="assertive">{LABEL[st]}</button>
      <p className="fig shrink-0 text-sm" aria-live="polite">{log.length ? <>Last {log.length}: {log.map((m) => `${m} ms`).join(', ')} · average <strong>{avg} ms</strong></> : 'No tries yet.'}</p>
    </Frame>
  )
}

/* ───────── roman empire: a number system that subtracts ───────── */

const TABLE: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
const toRoman = (n: number) => { const out: [string, number][] = []; for (const [v, s] of TABLE) while (n >= v) { out.push([s, v]); n -= v } return out }

export function Roman({ played }: DemoProps) {
  const [n, setN] = useState(1994)
  const parts = toRoman(n)
  const set = (v: number) => { setN(clamp(v, 1, 3999)); played() }
  return (
    <Frame kicker="Roman numerals" task="Build any number from 1 to 3,999. Watch where a smaller symbol sits in front of a larger one." note="A symbol in front of a bigger one is taken away: IV is 5 minus 1. There is no zero and no place value, which is part of why Roman arithmetic was done on a counting board.">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="my-auto grid min-w-0 gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <p className="break-all text-[clamp(1.3rem,5.6vw,3rem)] font-bold leading-tight tracking-[0.04em]" aria-label={`${n} in Roman numerals`}>{parts.map((p) => p[0]).join('')}</p>
            <p className="fig text-lg text-ink-2">= {fmt(n)}</p>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Parts">{parts.map(([s, v], i) => <span key={i} className="inline-flex items-baseline gap-1.5 border border-ink/25 px-2 py-0.5 text-sm"><strong>{s}</strong><span className="fig text-ink-2">{v}</span></span>)}</div>
        </div>
      </div>
      <Slide label="Number" value={n} min={1} max={3999} onChange={set} show={fmt} />
      <div className="flex shrink-0 flex-wrap gap-2">
        {[1, 10, 100, 1000].map((d) => <button key={d} onClick={() => set(n + d > 3999 ? 1 : n + d)} className={ghost}>+{fmt(d)}</button>)}
        <button onClick={() => set(new Date().getFullYear())} className={ghost}>This year</button>
      </div>
    </Frame>
  )
}

/* ───────── ancient egypt: multiply with nothing but doubling and adding ───────── */

export function Doubling({ played }: DemoProps) {
  const [a, setA] = useState(13)
  const [b, setB] = useState(21)
  const rows = useMemo(() => {
    const r: { p: number; v: number; use: boolean }[] = []
    for (let p = 1; p <= a; p *= 2) r.push({ p, v: p * b, use: false })
    let rest = a
    for (let i = r.length - 1; i >= 0; i--) if (r[i].p <= rest) { r[i].use = true; rest -= r[i].p }
    return r
  }, [a, b])
  return (
    <Frame kicker="Egyptian multiplication" task="Multiply two numbers using only doubling and adding. Double the second number down the table, then add the rows whose left numbers make up the first." note="How scribes multiplied in the Rhind papyrus, around 1550 BC: only doubling and adding. Every number is a sum of doublings, so it always works. It is the binary system in disguise.">
      <div className="grid shrink-0 grid-cols-2 gap-x-4"><Slide label="Multiply" value={a} min={1} max={63} onChange={(v) => { setA(v); played() }} /><Slide label="By" value={b} min={1} max={99} onChange={(v) => { setB(v); played() }} /></div>
      <div className="grid min-h-0 flex-1 content-start gap-0.5 md:grid-cols-2 md:gap-x-3" role="table" aria-label="Doubling table">
        {rows.map((r) => (
          <div key={r.p} role="row" className={cn('grid h-7 items-center border px-3 text-sm', r.use ? 'border-signal bg-signal/15 font-semibold' : 'border-ink/20 text-ink-2')} style={{ gridTemplateColumns: '3.5rem 1fr auto' }}>
            <span role="cell" className="fig">{r.p}</span><span role="cell" className="fig">{fmt(r.v)}</span><span role="cell" className="text-[12px]">{r.use ? 'add' : <span aria-hidden>·</span>}{!r.use && <span className="sr-only">skip</span>}</span>
          </div>
        ))}
      </div>
      <p className="fig shrink-0 text-base" aria-live="polite">Marked rows add to <strong>{fmt(a * b)}</strong> = {a} × {b}</p>
    </Frame>
  )
}

/* ───────── industrial revolution: steady growth compounds ───────── */

export function Growth({ played }: DemoProps) {
  const [rate, setRate] = useState(1.5)
  const [years, setYears] = useState(150)
  const mult = Math.pow(1 + rate / 100, years)
  const double = rate > 0 ? Math.log(2) / Math.log(1 + rate / 100) : Infinity
  const d = useMemo(() => Array.from({ length: 61 }, (_, i) => { const y = (i / 60) * years; const m = Math.pow(1 + rate / 100, y); return `${(8 + (i / 60) * 384).toFixed(1)},${(112 - ((m - 1) / Math.max(0.0001, mult - 1)) * 100).toFixed(1)}` }).join(' '), [rate, years, mult])
  return (
    <Frame kicker="Compounding" task="Income that grows a little every year multiplies far more than it seems. Set a yearly growth rate and a span of years." note="For most of history the average person’s income barely grew. In the leading economies after the Industrial Revolution, 1 to 2 percent a year became common, and over generations that is the difference between farming and a modern life.">
      <svg viewBox="0 0 400 120" role="img" aria-label={`Growth of ${Math.round(mult * 10) / 10} times over ${years} years`} className="min-h-[64px] w-full flex-1 border border-ink/20">
        <line x1={8} x2={392} y1={112} y2={112} className="stroke-ink/40" />
        <polyline points={d} fill="none" className="stroke-signal" strokeWidth={2} />
      </svg>
      <p className="fig shrink-0 text-lg" aria-live="polite"><strong className="dot text-[clamp(1.4rem,5vw,2rem)]">×{mult < 10 ? mult.toFixed(2) : fmt(Math.round(mult))}</strong> after {years} years{isFinite(double) && <span className="text-ink-2"> · doubles every {double < 10 ? double.toFixed(1) : Math.round(double)} years</span>}</p>
      <div className="grid shrink-0 gap-x-4 sm:grid-cols-2"><Slide label="Growth a year" value={rate} min={0} max={4} step={0.1} onChange={(v) => { setRate(v); played() }} show={(v) => `${v.toFixed(1)}%`} /><Slide label="Years" value={years} min={10} max={250} step={10} onChange={(v) => { setYears(v); played() }} /></div>
    </Frame>
  )
}

/* ───────── renaissance: lines that meet at one point ───────── */

export function Perspective({ played }: DemoProps) {
  const [vp, setVp] = useState({ x: 200, y: 92 })
  const drag = useRef(false)
  const box = useRef<SVGSVGElement>(null)
  const at = (e: RPointer<SVGSVGElement>) => {
    const r = box.current!.getBoundingClientRect()
    const s = Math.min(r.width / 400, r.height / 240)
    setVp({ x: clamp((e.clientX - r.left - (r.width - 400 * s) / 2) / s, 40, 360), y: clamp((e.clientY - r.top - (r.height - 240 * s) / 2) / s, 40, 170) })
    played()
  }
  const yb = 240
  const rows = Array.from({ length: 10 }, (_, k) => vp.y + (yb - vp.y) * Math.pow(0.68, k))
  const pillar = (px: number, k: number) => { const s = Math.pow(0.68, k); const x = vp.x + (px - vp.x) * s; const y = vp.y + (yb - vp.y) * s; return <rect key={`${px}-${k}`} x={x - 9 * s} y={y - 110 * s} width={18 * s} height={110 * s} className="fill-ground stroke-ink" strokeWidth={1.2} /> }
  return (
    <Frame kicker="Linear perspective" task="Drag the dot. Every line that runs away from you heads for the same point on the horizon, and things shrink by the same rule as they go." note="Brunelleschi worked this out in Florence in the early 1400s and Alberti wrote the method down soon after. Painters could now make a flat wall look like a hall.">
      <svg ref={box} data-no-drag viewBox="0 0 400 240" tabIndex={0} role="img" aria-label={`A colonnade in perspective. The vanishing point is at ${Math.round(vp.x)}, ${Math.round(vp.y)}. Drag the dot or use the arrow keys to move it.`} className="min-h-[90px] w-full flex-1 touch-none select-none border border-ink/20"
        onPointerDown={(e) => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); at(e) }} onPointerMove={(e) => drag.current && at(e)} onPointerUp={() => { drag.current = false }} onPointerCancel={() => { drag.current = false }}
        onKeyDown={(e) => { const d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key]; if (d) { e.preventDefault(); setVp((v) => ({ x: clamp(v.x + d[0], 40, 360), y: clamp(v.y + d[1], 40, 170) })); played() } }}>
        <line x1={0} x2={400} y1={vp.y} y2={vp.y} className="stroke-ink/40" strokeDasharray="4 4" />
        {Array.from({ length: 13 }, (_, i) => <line key={i} x1={vp.x} y1={vp.y} x2={200 + (i - 6) * 70} y2={yb} className="stroke-ink/30" />)}
        {rows.map((y, k) => <line key={k} x1={0} x2={400} y1={y} y2={y} className="stroke-ink/30" />)}
        {[8, 7, 6, 5, 4, 3, 2, 1].flatMap((k) => [pillar(60, k), pillar(340, k)])}
        <circle cx={vp.x} cy={vp.y} r={20} fill="transparent" />
        <circle cx={vp.x} cy={vp.y} r={6} className="fill-signal stroke-ink" />
      </svg>
    </Frame>
  )
}

/* ───────── music theory: a scale is a pattern of steps ───────── */

let audio: AudioContext | null = null
const tone = (f: number) => {
  const vol = useStore.getState().settings.volume
  if (!vol) return
  try {
    audio ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (audio.state === 'suspended') void audio.resume()
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime
    o.type = 'triangle'; o.frequency.value = f
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 0.75)
  } catch { /* no sound here */ }
}
const NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B', 'C']
const MODES = {
  major: { label: 'Major', steps: [0, 2, 4, 5, 7, 9, 11, 12], mood: 'bright and settled' },
  minor: { label: 'Minor', steps: [0, 2, 3, 5, 7, 8, 10, 12], mood: 'darker, more inward' },
  pent: { label: 'Pentatonic', steps: [0, 2, 4, 7, 9, 12], mood: 'five notes that cannot clash' },
  blues: { label: 'Blues', steps: [0, 3, 5, 6, 7, 10, 12], mood: 'the “blue note” is the flat fifth' },
} as const
const WHITE = [0, 2, 4, 5, 7, 9, 11]
const BLACK = [{ s: 1, at: 1 }, { s: 3, at: 2 }, { s: 6, at: 4 }, { s: 8, at: 5 }, { s: 10, at: 6 }]

export function Scales({ played }: DemoProps) {
  const [mode, setMode] = useState<keyof typeof MODES>('major')
  const [now, setNow] = useState<number | null>(null)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const m = MODES[mode]
  const hz = (semi: number) => 261.63 * Math.pow(2, semi / 12)
  const hit = (semi: number) => { played(); tone(hz(semi)); setNow(semi); timers.current.push(window.setTimeout(() => setNow(null), 380)) }
  const run = () => { timers.current.forEach(clearTimeout); timers.current = m.steps.map((s, i) => window.setTimeout(() => hit(s), i * 340)) }
  const words = m.steps.slice(1).map((s, i) => { const d = s - m.steps[i]; return d === 1 ? 'H' : d === 2 ? 'W' : 'W+H' })
  const lit = new Set<number>(m.steps.map((s) => s % 12))
  return (
    <Frame kicker="Scales" task="Pick a scale and play its notes from C. Notice that the only difference between major and minor is which steps are small." note={`${m.label} is ${m.mood}. W is a whole step (two keys along), H a half step (one key). Pattern: ${words.join(' ')}.`}>
      <Chips label="Scale" value={mode} onChange={(v) => { setMode(v); setNow(null) }} items={(Object.keys(MODES) as (keyof typeof MODES)[]).map((id) => ({ id, label: MODES[id].label }))} />
      <div className="relative h-20 shrink-0 border border-ink/30 md:h-24" aria-hidden>
        <div className="absolute inset-0 grid grid-cols-7">{WHITE.map((s) => <i key={s} className={cn('border-r border-ink/25 last:border-r-0', now !== null && now % 12 === s ? 'bg-ink' : lit.has(s) ? 'bg-signal' : 'bg-ink/10')} />)}</div>
        {BLACK.map((k) => <i key={k.s} className={cn('absolute top-0 h-[58%] w-[9%] -translate-x-1/2 border border-ink/70', now !== null && now % 12 === k.s ? 'bg-ink' : lit.has(k.s) ? 'bg-signal' : 'bg-ground')} style={{ left: `${(k.at / 7) * 100}%` }} />)}
      </div>
      <div role="group" aria-label="Notes in the scale" className="grid min-h-0 flex-1 [align-content:safe_center] gap-2" style={{ gridTemplateColumns: `repeat(${m.steps.length}, minmax(0, 1fr))` }}>
        {m.steps.map((s, i) => <button key={i} onClick={() => hit(s)} className={cn('min-h-12 border text-base font-semibold hover:border-signal/70', now === s ? 'border-signal bg-signal text-on-signal' : 'border-ink/30 bg-ink/[0.05]')}>{NAMES[s]}</button>)}
      </div>
      <div className="flex shrink-0 gap-2"><button onClick={run} className={solid}>Play the scale</button></div>
    </Frame>
  )
}
