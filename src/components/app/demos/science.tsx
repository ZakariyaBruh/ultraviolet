import { useEffect, useMemo, useRef, useState } from 'react'
import { calm, Chips, clamp, fmt, Frame, ghost, Meter, Slide, solid, type DemoProps } from './kit'
import { cn } from '@/lib/utils'

/* ───────── black hole: launch something and see which of three things happens ───────── */

const R0 = 90
const VC = 1.1
const GM = VC * VC * R0
const HORIZON = 9

type Outcome = 'idle' | 'running' | 'fell' | 'escaped' | 'orbit'
const SAYS: Record<Outcome, string> = {
  idle: 'Pick a speed and launch.',
  running: 'Flying…',
  fell: 'Too slow. It swung in below the horizon and was gone.',
  escaped: 'Fast enough to leave for good. Escape speed is about 1.41 times the speed of a circular orbit.',
  orbit: 'Bound. It keeps coming back round.',
}

export function Orbit({ played }: DemoProps) {
  const [speed, setSpeed] = useState(1)
  const [pts, setPts] = useState<[number, number][]>([])
  const [out, setOut] = useState<Outcome>('idle')
  const raf = useRef(0)
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const launch = () => {
    cancelAnimationFrame(raf.current)
    played()
    let x = R0, y = 0, vx = 0, vy = -speed * VC, frame = 0, swept = 0
    let path: [number, number][] = [[x, y]]
    const frameStep = (): Outcome => {
      for (let s = 0; s < 3; s++) {
        const r = Math.hypot(x, y)
        const k = GM / (r * r * r) / 3
        vx -= x * k; vy -= y * k
        const px = x, py = y
        x += vx / 3; y += vy / 3
        swept += Math.abs(Math.atan2(px * y - py * x, px * x + py * y))
      }
      path.push([x, y])
      if (path.length > 900) path = path.slice(-900)
      const r = Math.hypot(x, y)
      if (r < HORIZON) return 'fell'
      if (r > 230) return 'escaped'
      frame++
      if (frame > 1400) return (vx * vx + vy * vy) / 2 - GM / r >= 0 ? 'escaped' : 'orbit'
      return swept > Math.PI * 2 * 1.02 ? 'orbit' : 'running'
    }
    if (calm()) {
      let o: Outcome = 'running'
      while (o === 'running') o = frameStep()
      setPts(path); setOut(o)
      return
    }
    setOut('running')
    const tick = () => {
      const o = frameStep()
      setPts(path.slice())
      if (o === 'fell' || o === 'escaped') { setOut(o); return }
      if (o === 'orbit') setOut('orbit')
      if (frame > 1400) return
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  const d = pts.map(([px, py]) => `${(200 + px).toFixed(1)},${(120 + py).toFixed(1)}`).join(' ')
  return (
    <Frame kicker="Orbits" task="Launch a probe sideways from a circle around the hole. Too slow and it falls in, too fast and it leaves. Find the speeds in between." note="A Newtonian sketch. Close to a real black hole, general relativity changes the orbits, and nothing that crosses the event horizon comes back, not even light.">
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row md:gap-6">
      <svg viewBox="0 0 400 240" role="img" aria-label="A probe on an orbit around a black hole" className="min-h-[110px] min-w-0 w-full flex-1 border border-ink/20 md:w-auto">
        <circle cx={200} cy={120} r={R0} fill="none" className="stroke-ink/25" strokeDasharray="3 5" />
        {d && <polyline points={d} fill="none" className="stroke-signal" strokeWidth={1.6} />}
        <circle cx={200} cy={120} r={HORIZON} className="fill-ink" />
        <circle cx={200} cy={120} r={HORIZON + 3} fill="none" className="stroke-ink/50" />
        <circle cx={200 + R0} cy={120} r={4} className="fill-signal" />
        <line x1={200 + R0} y1={120} x2={200 + R0} y2={120 - speed * 34} className="stroke-signal" strokeWidth={2} />
      </svg>
        <div className="flex shrink-0 flex-col gap-2 md:w-[300px] md:justify-center">

          <p role="status" className="shrink-0 text-[14px] text-ink-2">{SAYS[out]}</p>
          <Slide label="Launch speed" value={speed} min={0.3} max={1.8} step={0.01} onChange={setSpeed} show={(v) => `${v.toFixed(2)} × orbit speed`} marks={[{ at: 1, label: 'orbit' }, { at: 1.41, label: 'escape' }]} />
          <div className="mt-1 flex shrink-0 gap-2"><button onClick={launch} className={solid}>Launch</button><button onClick={() => { cancelAnimationFrame(raf.current); setPts([]); setOut('idle') }} disabled={out === 'idle'} className={ghost}>Clear</button></div>
        </div>
      </div>
    </Frame>
  )
}

/* ───────── evolution: nobody chooses, the bark does ───────── */

const N = 48
const gray = (s: number) => { const l = Math.round(14 + s * 78); return `rgb(${l},${l - 2},${l - 6})` }
const first = () => Array.from({ length: N }, () => 0.25 + Math.random() * 0.5)
const evolve = (pop: number[], bark: number) => {
  const live = pop.filter((s) => Math.random() < 1 - 0.8 * Math.abs(s - bark))
  const from = live.length ? live : pop.slice(0, 4)
  return { next: Array.from({ length: N }, () => clamp(from[Math.floor(Math.random() * from.length)] + (Math.random() - 0.5) * 0.12, 0, 1)), eaten: N - live.length }
}

export function Selection({ played }: DemoProps) {
  const [bark, setBark] = useState<'pale' | 'dark'>('pale')
  const [pop, setPop] = useState(first)
  const [gen, setGen] = useState(0)
  const [eaten, setEaten] = useState<number | null>(null)
  const b = bark === 'pale' ? 0.9 : 0.1
  const go = (times: number) => {
    played()
    let p = pop, e = 0
    for (let i = 0; i < times; i++) { const r = evolve(p, b); p = r.next; e = r.eaten }
    setPop(p); setGen((g) => g + times); setEaten(e)
  }
  const mean = pop.reduce((a, s) => a + s, 0) / N
  const bins = useMemo(() => { const c = Array(8).fill(0); pop.forEach((s) => c[Math.min(7, Math.floor(s * 8))]++); return c as number[] }, [pop])
  return (
    <Frame kicker="Natural selection" task="Moths of every shade rest on the bark. Birds see the ones that stand out. Run some generations, then change the tree." note="Nothing here decides to change. The moths that match leave more young, so the average shade drifts. The same thing happened to peppered moths in sooty English cities.">
      <Chips label="Tree bark" value={bark} onChange={(v) => setBark(v)} items={[{ id: 'pale', label: 'Pale birch' }, { id: 'dark', label: 'Sooty bark' }]} />
      <div className="grid min-h-0 flex-1 grid-cols-12 content-center gap-1.5 border border-ink/20 p-2 md:grid-cols-[repeat(24,minmax(0,1fr))]" style={{ background: gray(b) }} role="img" aria-label={`${N} moths on ${bark} bark, average shade ${Math.round(mean * 100)} percent pale`}>
        {pop.map((s, i) => <i key={i} className="aspect-square max-h-7 w-full justify-self-center border border-black/30" style={{ background: gray(s), maxWidth: 28 }} />)}
      </div>
      <div className="flex shrink-0 items-end gap-3">
        <div className="flex h-10 flex-1 items-end gap-0.5" aria-hidden>{bins.map((c, i) => <i key={i} className="flex-1 border border-ink/30" style={{ height: `${Math.max(4, (c / N) * 100 * 1.6)}%`, background: gray((i + 0.5) / 8) }} />)}</div>
        <p className="fig text-sm" aria-live="polite">Generation <strong>{gen}</strong> · average <strong>{Math.round(mean * 100)}%</strong> pale{eaten !== null && <> · {eaten} eaten</>}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button onClick={() => go(1)} className={solid}>Next generation</button>
        <button onClick={() => go(10)} className={ghost}>Run 10</button>
        <button onClick={() => { setPop(first()); setGen(0); setEaten(null) }} className={ghost}>Reset</button>
      </div>
    </Frame>
  )
}

/* ───────── probability: the more flips, the closer to even ───────── */

export function Coin({ played }: DemoProps) {
  const [run, setRun] = useState<{ h: number; line: number[] }>({ h: 0, line: [] })
  const flip = (k: number) => {
    played()
    setRun((r) => {
      let h = r.h
      const line = r.line.slice()
      for (let i = 0; i < k && line.length < 5000; i++) { if (Math.random() < 0.5) h++; line.push(h / (line.length + 1)) }
      return { h, line }
    })
  }
  const n = run.line.length
  const d = run.line.map((p, i) => `${(14 + (Math.log(i + 1) / Math.log(5000)) * 372).toFixed(1)},${(150 - p * 140).toFixed(1)}`).join(' ')
  return (
    <Frame kicker="The law of large numbers" task="Flip a fair coin and watch the share of heads. A few flips wander. Keep going." note="The line is the running share of heads, with the number of flips on a log scale. Past 1,000 flips it rarely strays more than 3 points from half.">
      <svg viewBox="0 0 400 160" role="img" aria-label={n ? `${run.h} heads in ${n} flips, ${Math.round((run.h / n) * 100)} percent` : 'No flips yet'} className="min-h-[80px] w-full flex-1 border border-ink/20">
        <line x1={14} x2={386} y1={80} y2={80} className="stroke-ink/40" strokeDasharray="3 4" />
        <text x={18} y={76} className="fill-ink-2" fontSize={10}>50%</text>
        {[10, 100, 1000].map((t) => <g key={t}><line x1={14 + (Math.log(t) / Math.log(5000)) * 372} x2={14 + (Math.log(t) / Math.log(5000)) * 372} y1={10} y2={150} className="stroke-ink/15" /><text x={16 + (Math.log(t) / Math.log(5000)) * 372} y={158} className="fill-ink-2" fontSize={9}>{fmt(t)}</text></g>)}
        {d && <polyline points={d} fill="none" className="stroke-signal" strokeWidth={1.6} />}
      </svg>
      <p className="fig shrink-0 text-lg" aria-live="polite">{n ? <><strong>{run.h}</strong> heads in {fmt(n)} · <strong>{Math.round((run.h / n) * 1000) / 10}%</strong></> : 'Press a button to start.'}</p>
      <div className="flex shrink-0 flex-wrap gap-2">
        {[1, 10, 100, 1000].map((k) => <button key={k} onClick={() => flip(k)} disabled={n >= 5000} className={k === 1 ? solid : ghost}>Flip {fmt(k)}</button>)}
        <button onClick={() => setRun({ h: 0, line: [] })} disabled={!n} className={ghost}>Reset</button>
      </div>
    </Frame>
  )
}

/* ───────── photosynthesis: the scarcer input sets the pace ───────── */

const sat = (x: number) => (100 * x) / (x + 30)
export function Light({ played }: DemoProps) {
  const [light, setLight] = useState(15)
  const [co2, setCo2] = useState(85)
  const a = sat(light), b = sat(co2), rate = Math.min(a, b)
  const says = a < b - 5 ? 'Light is the limit. Adding CO₂ would change nothing.' : b < a - 5 ? 'CO₂ is the limit. Adding light would change nothing.' : rate < 60 ? 'Both are holding it back about equally. Raise both to go faster.' : 'Both are plentiful. Now temperature, water or the leaf itself sets the pace.'
  return (
    <Frame kicker="Limiting factors" task="A leaf needs light and carbon dioxide to make sugar. Move the sliders and see which one is the bottleneck." note="A simplified model in arbitrary units. Real curves differ between plants and with temperature, but the rule holds: the scarcest ingredient sets the rate.">
      <div className="grid min-h-0 flex-1 [align-content:safe_center] gap-4 md:grid-cols-2 md:gap-x-8">
        <div className="grid content-center gap-3">
          <Slide label="Light" value={light} min={0} max={100} onChange={(v) => { setLight(v); played() }} show={(v) => `${v}%`} />
          <Slide label="Carbon dioxide" value={co2} min={0} max={100} onChange={(v) => { setCo2(v); played() }} show={(v) => `${v}%`} />
        </div>
        <div className="grid content-center gap-2 border-t border-ink/20 pt-3 md:border-l md:border-t-0 md:pl-8 md:pt-0">
          <Meter label="Light alone allows" value={a} max={100} text={`${Math.round(a)}`} />
          <Meter label="CO₂ alone allows" value={b} max={100} text={`${Math.round(b)}`} />
          <Meter label="Sugar made" value={rate} max={100} text={`${Math.round(rate)}`} strong />
        </div>
      </div>
      <p role="status" className="shrink-0 text-[14px] font-medium">{says}</p>
    </Frame>
  )
}

/* ───────── quantum mechanics: stripes appear in the crowd, not in any one electron ───────── */

const BINS = 48
const open = (x: number) => Math.exp(-(x * x) / 0.16) * Math.cos(12 * x) ** 2
const watched = (x: number) => 0.5 * (Math.exp(-((x - 0.28) ** 2) / 0.04) + Math.exp(-((x + 0.28) ** 2) / 0.04))
const land = (look: boolean) => { for (;;) { const x = Math.random() * 2 - 1; if (Math.random() < (look ? watched(x) : open(x))) return x } }

export function Slit({ played }: DemoProps) {
  const [look, setLook] = useState(false)
  const [hits, setHits] = useState<number[]>(() => Array(BINS).fill(0))
  const total = hits.reduce((a, c) => a + c, 0)
  const fire = (k: number) => {
    played()
    setHits((h) => { const c = h.slice(); for (let i = 0; i < k; i++) c[Math.min(BINS - 1, Math.floor(((land(look) + 1) / 2) * BINS))]++; return c })
  }
  const top = Math.max(6, ...hits)
  return (
    <Frame kicker="The double slit" task="Fire electrons one at a time at two slits. Each lands in one place. Fire enough and see the pattern, then switch on a detector at the slits." note="Each electron arrives as a single dot. The stripes only show up in the crowd, as if every electron went through both slits. Measure which slit and the stripes vanish.">
      <Chips label="Detector" value={look ? 'on' : 'off'} onChange={(v) => { setLook(v === 'on'); setHits(Array(BINS).fill(0)) }} items={[{ id: 'off', label: 'Not looking' }, { id: 'on', label: 'Watch the slits' }]} />
      <svg viewBox="0 0 400 130" role="img" aria-label={`${fmt(total)} electrons landed. ${look ? 'Two bands, no stripes.' : 'A striped pattern builds up.'}`} className="min-h-[80px] w-full flex-1 border border-ink/20">
        {hits.map((c, i) => <rect key={i} x={8 + (i * 384) / BINS} y={122 - (c / top) * 110} width={384 / BINS - 1} height={(c / top) * 110} className="fill-signal" />)}
        <line x1={8} x2={392} y1={122.5} y2={122.5} className="stroke-ink/40" />
      </svg>
      <p className="fig shrink-0 text-sm" aria-live="polite"><strong>{fmt(total)}</strong> electrons landed</p>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button onClick={() => fire(1)} className={solid}>Fire 1</button>
        <button onClick={() => fire(20)} className={ghost}>Fire 20</button>
        <button onClick={() => fire(200)} className={ghost}>Fire 200</button>
        <button onClick={() => setHits(Array(BINS).fill(0))} disabled={!total} className={ghost}>Clear</button>
      </div>
    </Frame>
  )
}

/* ───────── immune system: protect enough neighbours and the outbreak runs out of road ───────── */

type Cell = 's' | 'v' | 'i' | 'r'
const W = 10
export function Herd({ played }: DemoProps) {
  const [pct, setPct] = useState(30)
  const [cells, setCells] = useState<Cell[]>(() => Array(W * W).fill('s'))
  const [live, setLive] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearInterval(timer.current), [])

  const advance = (c: Cell[]): Cell[] => {
    const nx = c.slice()
    c.forEach((s, i) => {
      if (s !== 'i') return
      nx[i] = 'r'
      const x = i % W, y = Math.floor(i / W)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy
        if (X < 0 || Y < 0 || X >= W || Y >= W) continue
        if (c[Y * W + X] === 's' && Math.random() < 0.7) nx[Y * W + X] = 'i'
      }
    })
    return nx
  }
  const start = () => {
    clearInterval(timer.current)
    played()
    const order = Array.from({ length: W * W }, (_, i) => i).filter((i) => i !== 45).sort(() => Math.random() - 0.5)
    let c: Cell[] = Array(W * W).fill('s')
    order.slice(0, Math.round((pct / 100) * (W * W - 1))).forEach((i) => { c[i] = 'v' })
    c[45] = 'i'
    if (calm()) { while (c.includes('i')) c = advance(c); setCells(c); return }
    setCells(c); setLive(true)
    timer.current = window.setInterval(() => {
      c = advance(c)
      setCells(c)
      if (!c.includes('i')) { clearInterval(timer.current); setLive(false) }
    }, 160)
  }
  const sick = cells.filter((s) => s === 'r' || s === 'i').length
  const prot = cells.filter((s) => s === 'v').length
  const GLYPH: Record<Cell, string> = { s: '', v: '+', i: '●', r: '×' }
  return (
    <Frame kicker="Herd immunity" task="One cell catches a disease and passes it to its neighbours. Protect a share of the others first, then start the outbreak." note="A toy grid, not a forecast: how far it spreads depends on how catching the disease is. Measles, among the most contagious, is usually said to need about 95% protected.">
      <div className="flex min-h-0 flex-1 flex-col items-start gap-3 md:flex-row md:gap-4">
        <div className="grid w-[min(100%,22vh)] shrink-0 gap-px border border-ink/30 bg-ink/20 md:w-[min(100%,31vh,320px)]" style={{ gridTemplateColumns: `repeat(${W}, 1fr)` }} role="img" aria-label={`Grid of ${W * W} people. ${prot} protected, ${sick} caught it.`}>
          {cells.map((s, i) => <i key={i} className={cn('grid aspect-square place-items-center text-[11px] not-italic leading-none', s === 'i' ? 'bg-signal text-on-signal' : s === 'v' ? 'bg-ink/55 text-ground' : s === 'r' ? 'bg-ink/20 text-ink' : 'bg-ground')}>{GLYPH[s]}</i>)}
        </div>
        <div className="grid w-full min-w-0 flex-1 content-start gap-2">
          <div className="flex items-end gap-3"><div className="min-w-0 flex-1"><Slide label="Protected" value={pct} min={0} max={95} step={5} onChange={setPct} show={(v) => `${v}%`} /></div><button onClick={start} disabled={live} className={cn(solid, 'shrink-0')}>{cells.includes('r') ? 'Run again' : 'Start outbreak'}</button></div>
          <p className="fig text-sm" aria-live="polite">{cells.includes('r') || live ? <>● × <strong>{sick}</strong> caught it · + <strong>{prot}</strong> protected</> : 'The middle cell is where it starts. + is protected.'}</p>
        </div>
      </div>
    </Frame>
  )
}

/* ───────── climate: each doubling of CO₂ warms about the same ───────── */

export function Climate({ played }: DemoProps) {
  const [ppm, setPpm] = useState(425)
  const doubling = Math.log2(ppm / 280)
  const t = (s: number) => (s * doubling).toFixed(1)
  return (
    <Frame kicker="Climate sensitivity" task="Move the carbon dioxide level and see how much the planet warms once it settles. Warming follows each doubling, not each added part per million." note="Simplified: 3 °C per doubling, the IPCC’s best estimate (likely 2.5 to 4). Oceans lag by decades, so this is where it settles, not a forecast.">
      <div className="grid min-h-0 flex-1 [align-content:safe_center] gap-3">
        <Slide label="Carbon dioxide in the air" value={ppm} min={280} max={1120} step={5} onChange={(v) => { setPpm(v); played() }} show={(v) => `${v} ppm`} marks={[{ at: 280, label: '1750' }, { at: 425, label: 'now' }, { at: 560, label: '2×' }, { at: 1120, label: '4×' }]} />
        <div className="mt-1 flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-t border-ink/20 pt-3">
          <div><p className="hud">Eventual warming above 1750</p><p className="dot fig text-[clamp(1.8rem,7vw,3rem)] leading-[1.4]">+{t(3)} °C</p></div>
          <p className="fig text-sm text-ink-2">Likely +{t(2.5)} to +{t(4)} °C · {doubling.toFixed(2)} doublings</p>
        </div>
        <Meter label="Warming" value={doubling * 3} max={12} text={`+${t(3)} °C`} strong />
      </div>
    </Frame>
  )
}
