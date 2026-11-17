import { Eye, EyeOff, Minus, Plus, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react'
import { useStore } from '@/lib/store'
import { compile, MathError, parse, show, usesX, zeros } from '@/lib/mathexpr'
import { cn } from '@/lib/utils'
import { field, key } from './Window'

const SLOTS = 3
const COLOUR = ['--signal', '--ice', '--ok'] // tokens, read when drawing, so every theme recolours the curves
const START = { cx: 0, cy: 0, ppu: 0 } // ppu 0: fit x from -10 to 10 on the first draw
type Fn = (x: number) => number
interface Line { src: string; fn: Fn | null; hasX: boolean; err: string; value: string }

/** grid spacing that reads well: 1, 2 or 5 times a power of ten */
function nice(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const m = raw / p
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p
}
const label = (v: number, step: number) => show(Math.abs(v) < step / 1e6 ? 0 : Number(v.toFixed(Math.max(0, -Math.floor(Math.log10(step)) + 1))))

/** Plot up to three formulas of x, or work out one with no x. Read by `lib/mathexpr.ts` (no eval); tested against known answers. */
export function Graph() {
  const saved = useStore((s) => s.widgets.graph)
  const setGraph = useStore((s) => s.setGraph)
  const [srcs, setSrcs] = useState<string[]>(() => Array.from({ length: SLOTS }, (_, i) => saved?.f[i] ?? (i === 0 ? 'x^2 - 2' : i === 1 ? 'sin x' : '')))
  const [hidden, setHidden] = useState<boolean[]>([false, false, false])
  const [deg, setDeg] = useState(!!saved?.deg)
  const [trace, setTrace] = useState<number | null>(null)
  const [, redraw] = useState(0)
  const cv = useRef<HTMLCanvasElement>(null)
  const view = useRef({ ...START })
  const size = useRef({ w: 0, h: 0 })
  const ptrs = useRef(new Map<number, { x: number; y: number }>())
  const moved = useRef(false)
  const saveTimer = useRef(0)

  useEffect(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => setGraph({ f: srcs, deg }), 400)
    return () => clearTimeout(saveTimer.current)
  }, [srcs, deg, setGraph])

  const lines: Line[] = useMemo(() => srcs.map((src) => {
    if (!src.trim()) return { src, fn: null, hasX: false, err: '', value: '' }
    try {
      const tree = parse(src)
      const fn = compile(tree, deg ? 'deg' : 'rad')
      const hasX = usesX(tree)
      return { src, fn, hasX, err: '', value: hasX ? '' : show(fn(0)) }
    } catch (e) {
      return { src, fn: null, hasX: false, err: e instanceof MathError ? e.message : 'Not understood', value: '' }
    }
  }), [srcs, deg])
  const plotted = lines.map((l, i) => (l.fn && l.hasX && !hidden[i] ? l.fn : null))

  // the x range on screen, for zeros and the screen-reader summary
  const range = () => { const { w } = size.current; const v = view.current; return v.ppu ? [v.cx - w / 2 / v.ppu, v.cx + w / 2 / v.ppu] : [-10, 10] }

  const draw = () => {
    const c = cv.current
    if (!c) return
    const g = c.getContext('2d')
    if (!g) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = c.clientWidth, h = c.clientHeight
    if (!w || !h) return
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr) }
    size.current = { w, h }
    const v = view.current
    if (!v.ppu) v.ppu = w / 20
    const cs = getComputedStyle(c)
    const tok = (n: string) => cs.getPropertyValue(n).trim()
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    const X = (x: number) => w / 2 + (x - v.cx) * v.ppu
    const Y = (y: number) => h / 2 - (y - v.cy) * v.ppu
    const x0 = v.cx - w / 2 / v.ppu, x1 = v.cx + w / 2 / v.ppu
    const y0 = v.cy - h / 2 / v.ppu, y1 = v.cy + h / 2 / v.ppu
    const step = nice(80 / v.ppu)
    // grid
    g.lineWidth = 1
    g.strokeStyle = tok('--rule') || 'rgba(128,128,128,.2)'
    g.beginPath()
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { const px = Math.round(X(x)) + 0.5; g.moveTo(px, 0); g.lineTo(px, h) }
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) { const py = Math.round(Y(y)) + 0.5; g.moveTo(0, py); g.lineTo(w, py) }
    g.stroke()
    // axes, with numbers that stay on screen when an axis is off it
    const ink3 = tok('--ink-3') || '#999'
    g.strokeStyle = ink3
    g.beginPath()
    const ax = Math.round(Y(0)) + 0.5, ay = Math.round(X(0)) + 0.5
    if (ax >= 0 && ax <= h) { g.moveTo(0, ax); g.lineTo(w, ax) }
    if (ay >= 0 && ay <= w) { g.moveTo(ay, 0); g.lineTo(ay, h) }
    g.stroke()
    g.fillStyle = ink3
    g.font = `11px ${getComputedStyle(document.body).fontFamily}`
    g.textBaseline = 'top'; g.textAlign = 'center'
    const ly = Math.min(h - 14, Math.max(2, ax + 3))
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) if (Math.abs(x) > step / 2) g.fillText(label(x, step), X(x), ly)
    g.textBaseline = 'middle'; g.textAlign = 'left'
    const lx = Math.min(w - 30, Math.max(3, ay + 4))
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) if (Math.abs(y) > step / 2) g.fillText(label(y, step), lx, Y(y))
    // curves: one sample per pixel; a jump of more than the screen's height is a break (an asymptote), not a line
    g.lineWidth = 2.25
    g.lineJoin = 'round'
    plotted.forEach((f, i) => {
      if (!f) return
      g.strokeStyle = tok(COLOUR[i]) || '#fc0'
      g.beginPath()
      let pen = false, last = 0
      for (let px = 0; px <= w; px += 1) {
        const y = f(x0 + px / v.ppu)
        const py = Y(y)
        if (!Number.isFinite(py) || Math.abs(py) > h * 20) { pen = false; continue }
        if (pen && Math.abs(py - last) > h) pen = false
        if (pen) g.lineTo(px, py); else g.moveTo(px, py)
        pen = true; last = py
      }
      g.stroke()
    })
    // the trace: a line at x and a dot on each curve
    if (trace !== null) {
      const px = X(trace)
      g.strokeStyle = ink3
      g.setLineDash([3, 3]); g.beginPath(); g.moveTo(px, 0); g.lineTo(px, h); g.stroke(); g.setLineDash([])
      plotted.forEach((f, i) => {
        if (!f) return
        const y = f(trace)
        if (!Number.isFinite(y)) return
        g.fillStyle = tok(COLOUR[i]) || '#fc0'
        g.beginPath(); g.arc(px, Y(y), 4, 0, Math.PI * 2); g.fill()
      })
    }
  }

  const drawNow = useRef(draw)
  drawNow.current = draw
  useEffect(() => { draw() })
  useEffect(() => {
    const c = cv.current
    if (!c) return
    const ro = new ResizeObserver(() => drawNow.current())
    ro.observe(c)
    return () => ro.disconnect()
  }, [])

  const at = (e: { clientX: number; clientY: number }) => {
    const r = cv.current!.getBoundingClientRect()
    const v = view.current
    return { px: e.clientX - r.left, py: e.clientY - r.top, x: v.cx + (e.clientX - r.left - r.width / 2) / v.ppu }
  }
  const zoom = (k: number, px?: number, py?: number) => {
    const v = view.current
    const { w, h } = size.current
    const ax = px ?? w / 2, ay = py ?? h / 2
    // keep the point under the pointer where it is
    const wx = v.cx + (ax - w / 2) / v.ppu, wy = v.cy - (ay - h / 2) / v.ppu
    v.ppu = Math.min(1e7, Math.max(1e-4, v.ppu * k))
    v.cx = wx - (ax - w / 2) / v.ppu
    v.cy = wy + (ay - h / 2) / v.ppu
    redraw((n) => n + 1)
  }
  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    moved.current = false
  }
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    const old = ptrs.current.get(e.pointerId)
    if (!old) { if (e.pointerType === 'mouse') setTrace(at(e).x); return }
    const v = view.current
    if (ptrs.current.size === 2) {
      // pinch: zoom by the change in distance between the two fingers, about their middle
      const [a, b] = [...ptrs.current.entries()].map(([id, p]) => (id === e.pointerId ? { x: e.clientX, y: e.clientY } : p))
      const [pa, pb] = [...ptrs.current.values()]
      const d0 = Math.hypot(pa.x - pb.x, pa.y - pb.y), d1 = Math.hypot(a.x - b.x, a.y - b.y)
      ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (d0 > 0) { const m = at({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }); zoom(d1 / d0, m.px, m.py) }
      moved.current = true
      return
    }
    const dx = e.clientX - old.x, dy = e.clientY - old.y
    if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    v.cx -= dx / v.ppu
    v.cy += dy / v.ppu
    if (e.pointerType === 'mouse') setTrace(at(e).x)
    redraw((n) => n + 1)
  }
  const up = (e: PointerEvent<HTMLCanvasElement>) => {
    ptrs.current.delete(e.pointerId)
    if (!moved.current) setTrace(at(e).x) // a tap traces where it lands
  }
  const wheel = (e: WheelEvent<HTMLCanvasElement>) => { const p = at(e); zoom(Math.exp(-e.deltaY * 0.0015), p.px, p.py) }
  const keys = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const v = view.current
    const stepPx = 40
    const k = e.key
    if (k === 'ArrowLeft') v.cx -= stepPx / v.ppu
    else if (k === 'ArrowRight') v.cx += stepPx / v.ppu
    else if (k === 'ArrowUp') v.cy += stepPx / v.ppu
    else if (k === 'ArrowDown') v.cy -= stepPx / v.ppu
    else if (k === '+' || k === '=') { e.preventDefault(); zoom(1.25); return }
    else if (k === '-' || k === '_') { e.preventDefault(); zoom(0.8); return }
    else if (k === '0') { reset(); return }
    else return
    e.preventDefault()
    redraw((n) => n + 1)
  }
  const reset = () => { view.current = { ...START }; setTrace(null); redraw((n) => n + 1) }
  // the canvas is wheel-zoomed, so the page must not scroll under it (React's wheel handler is passive)
  useEffect(() => {
    const c = cv.current
    if (!c) return
    const stop = (e: Event) => e.preventDefault()
    c.addEventListener('wheel', stop, { passive: false })
    return () => c.removeEventListener('wheel', stop)
  }, [])

  const [a, b] = range()
  const found = plotted.map((f) => (f ? zeros(f, a, b, 800, 5) : []))
  const list = (z: number[]) => (z.length > 4 ? `${z.slice(0, 4).map(show).join(', ')} and more` : z.map(show).join(', '))
  const shown = plotted.map((f, i) => (f ? i : -1)).filter((i) => i >= 0)
  const summary = shown.length
    ? shown.map((i) => `f${i + 1}(x) = ${srcs[i]}${found[i].length ? `, zero at ${list(found[i])}` : ', no zero on screen'}`).join('. ') + `. x from ${show(+a.toFixed(3))} to ${show(+b.toFixed(3))}.`
    : 'Nothing plotted yet.'
  const icon = cn(key, 'size-11 md:size-9')

  return (
    <div className="grid gap-2">
      <div className="grid gap-1">
        {srcs.map((src, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span aria-hidden className="h-6 w-1.5 shrink-0" style={{ background: `var(${COLOUR[i]})` }} />
            <label className="sr-only" htmlFor={`graph-f${i}`}>Formula {i + 1}</label>
            <input
              id={`graph-f${i}`} value={src} onChange={(e) => setSrcs((s) => s.map((x, j) => (j === i ? e.target.value.slice(0, 200) : x)))}
              placeholder={i === 0 ? 'A formula of x, like x^2 - 2' : i === 1 ? 'Another, like sin x' : 'Or a sum to work out, like sqrt(2) * pi'}
              spellCheck={false} autoCapitalize="off" autoCorrect="off" inputMode="text" aria-invalid={!!lines[i].err}
              aria-describedby={lines[i].err || lines[i].value ? `graph-v${i}` : undefined}
              className={cn(field, 'fig flex-1 md:h-9', lines[i].err && 'border-danger')}
            />
            <span id={`graph-v${i}`} className={cn('fig min-w-0 max-w-[40%] shrink truncate text-[13px]', lines[i].err ? 'text-danger' : 'text-ink')} title={lines[i].err || lines[i].value}>
              {lines[i].err ? lines[i].err : lines[i].value ? `= ${lines[i].value}` : ''}
            </span>
            {lines[i].hasX && (
              <button onClick={() => setHidden((h) => h.map((x, j) => (j === i ? !x : x)))} aria-pressed={!hidden[i]} aria-label={hidden[i] ? `Show formula ${i + 1} on the graph` : `Hide formula ${i + 1} from the graph`} className={cn(icon, 'shrink-0')}>
                {hidden[i] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            )}
          </div>
        ))}
      </div>

      <canvas
        ref={cv} data-no-drag data-fill style={{ '--fill': '17rem', touchAction: 'none' } as React.CSSProperties}
        tabIndex={0} role="img" aria-label={`Graph. ${summary} Arrow keys move it, plus and minus zoom, 0 resets.`}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={(e) => ptrs.current.delete(e.pointerId)} onPointerLeave={(e) => { if (e.pointerType === 'mouse' && !ptrs.current.size) setTrace(null) }}
        onWheel={wheel} onKeyDown={keys}
        className="block h-[min(44vh,20rem)] min-h-[9rem] w-full cursor-crosshair border border-ink/25 focus-visible:border-signal"
      />

      <div className="flex flex-wrap items-center gap-1">
        <p className="fig min-w-0 flex-1 text-[12px] leading-[1.4] text-ink-2" aria-live="polite">
          {trace !== null && shown.length
            ? <>x = {show(+trace.toPrecision(6))}{shown.map((i) => <span key={i}> · <span style={{ color: `var(${COLOUR[i]})` }}>f{i + 1}</span> = {show(plotted[i]!(trace))}</span>)}</>
            : shown.some((i) => found[i].length)
              ? shown.filter((i) => found[i].length).map((i, n) => <span key={i}>{n > 0 && ' · '}<span style={{ color: `var(${COLOUR[i]})` }}>f{i + 1}</span> is 0 at {list(found[i])}</span>)
              : 'Drag to move, scroll or pinch to zoom, tap to read a point.'}
        </p>
        <div className="flex gap-1">
          <button onClick={() => setDeg((d) => !d)} aria-label={deg ? 'Angles in degrees. Switch to radians' : 'Angles in radians. Switch to degrees'} className={cn(key, 'h-11 px-3 text-[13px] md:h-9')}>{deg ? 'Deg' : 'Rad'}</button>
          <button onClick={() => zoom(0.8)} aria-label="Zoom out" className={icon}><Minus className="size-4" /></button>
          <button onClick={() => zoom(1.25)} aria-label="Zoom in" className={icon}><Plus className="size-4" /></button>
          <button onClick={reset} aria-label="Back to the start view" className={icon}><RotateCcw className="size-4" /></button>
        </div>
      </div>
    </div>
  )
}
