import { useEffect, useRef } from 'react'
import { clearGrid, makeGrid, plot, RAMP, type Shape } from '@/lib/ascii3d'

/**
 * The era dial's main instrument. The further back you turn it, the more of the screen is solids drawn in text:
 * one turning in a corner at Afterglow, a handful and a perspective floor by Arcade, and a whole text world by Full ASCII.
 * It sits behind everything, never takes the pointer, and costs one small canvas.
 */
interface Spec { shape: Shape; x: number; y: number; r: number; sa: number; sb: number; ph: number }
const T = (shape: Shape, x: number, y: number, r: number, sa = 0.5, sb = 0.3, ph = 0): Spec => ({ shape, x, y, r, sa, sb, ph })

const SCENES: Spec[][] = [
  [],
  [T('torus', 0.82, 0.78, 0.13)],
  [T('torus', 0.84, 0.78, 0.14), T('cube', 0.1, 0.8, 0.09, 0.4, 0.5, 1)],
  [T('torus', 0.84, 0.76, 0.15), T('cube', 0.09, 0.78, 0.1, 0.4, 0.5, 1), T('knot', 0.5, 0.88, 0.09, 0.3, 0.45, 2)],
  [T('torus', 0.84, 0.74, 0.16), T('cube', 0.09, 0.76, 0.11, 0.4, 0.5, 1), T('knot', 0.5, 0.88, 0.1, 0.3, 0.45, 2), T('sphere', 0.92, 0.22, 0.07, 0.2, 0.3, 3), T('helix', 0.06, 0.26, 0.09, 0, 0.6, 4)],
  [T('torus', 0.84, 0.72, 0.17), T('cube', 0.09, 0.74, 0.12, 0.4, 0.5, 1), T('knot', 0.5, 0.88, 0.11, 0.3, 0.45, 2), T('sphere', 0.92, 0.2, 0.08, 0.2, 0.3, 3), T('helix', 0.06, 0.24, 0.1, 0, 0.6, 4), T('pyramid', 0.7, 0.14, 0.08, 0.25, 0.5, 5), T('torus', 0.28, 0.12, 0.06, 0.6, 0.2, 6)],
]
/** how strong the whole scene is at each stop */
const GAIN = [0, 0.1, 0.13, 0.17, 0.21, 0.27]

const FONT = 13
const LINE = 15
/** how much of the scene is left behind panels and behind lines of text, so reading never fights it */
const BEHIND_PANEL = 0.55
const BEHIND_TEXT = 0.22
const PANELS = '[data-movable], .material, .glass'

export function AsciiScene({ stage, level }: { stage: number; level: 0 | 1 | 2 }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx || stage < 1) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const still = reduced || level === 0
    let cols = 0, rows = 0, cw = 8
    let g = makeGrid(1, 1)
    let raf = 0, last = 0, t = 0
    let signal = '#ffd23f', ink = '#ffffff', colorAt = 0
    let mask = new Float32Array(0)
    let seen = ''
    let maskAt = 0
    // on a phone the page text fills the screen, so only the lower solids stay and they sit a little quieter
    const narrow = innerWidth < 640
    const specs = narrow ? SCENES[Math.min(5, stage)].slice(0, 3) : SCENES[Math.min(5, stage)]
    const gain = GAIN[Math.min(5, stage)] * (narrow ? 0.75 : 1)
    const stars = Array.from({ length: 70 }, (_, i) => ({ x: ((i * 97) % 100) / 100, y: ((i * 53) % 100) / 100, s: 0.2 + ((i * 31) % 10) / 12, c: '.+*'[i % 3] }))

    const size = () => {
      const dpr = Math.min(2, devicePixelRatio || 1)
      const w = innerWidth, h = innerHeight
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      cv.style.width = `${w}px`; cv.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `${FONT}px "Geist Mono Variable", ui-monospace, Menlo, Consolas, monospace`
      ctx.textBaseline = 'top'
      cw = ctx.measureText('M').width || 8
      cols = Math.ceil(w / cw); rows = Math.ceil(h / LINE)
      g = makeGrid(cols, rows, cw / LINE)
    }
    /** find panels and lines of text on screen and quieten the scene behind them; returns false when nothing moved */
    const panels = () => {
      const boxes: { r: DOMRect; v: number }[] = []
      document.querySelectorAll<HTMLElement>(PANELS).forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.width > 24 && r.height > 12) boxes.push({ r, v: BEHIND_PANEL })
      })
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          if (n.nodeType === 1) {
            const e = n as Element
            const tag = e.tagName.toUpperCase()
            return tag === 'PRE' || tag === 'CANVAS' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG' || e.getAttribute('aria-hidden') === 'true' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP
          }
          return (n.nodeValue ?? '').trim().length > 1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        },
      })
      const range = document.createRange()
      for (let n = walk.nextNode(), i = 0; n && i < 500; n = walk.nextNode(), i++) {
        range.selectNodeContents(n)
        const r = range.getBoundingClientRect()
        if (r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight) boxes.push({ r, v: BEHIND_TEXT })
      }
      const sig = `${cols}x${rows}|${boxes.map(({ r }) => `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`).join(';')}`
      if (sig === seen && mask.length === cols * rows) return false
      seen = sig
      mask = new Float32Array(cols * rows).fill(1)
      // panels first, then text over them, so a line of text always wins the lower value
      for (const pass of [BEHIND_PANEL, BEHIND_TEXT]) {
        for (const { r, v } of boxes) {
          if (v !== pass) continue
          const pad = v === BEHIND_TEXT ? 1 : 0
          const x0 = Math.max(0, Math.floor(r.left / cw) - pad), x1 = Math.min(cols, Math.ceil(r.right / cw) + pad)
          const y0 = Math.max(0, Math.floor(r.top / LINE)), y1 = Math.min(rows, Math.ceil(r.bottom / LINE))
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = x + y * cols; if (mask[o] > v) mask[o] = v }
        }
      }
      return true
    }
    const colours = () => {
      const cs = getComputedStyle(document.documentElement)
      signal = cs.getPropertyValue('--signal').trim() || signal
      ink = cs.getPropertyValue('--ink').trim() || ink
    }

    const draw = () => {
      if (!cols) return
      if (performance.now() - colorAt > 1500) { colours(); colorAt = performance.now() }
      if (performance.now() - maskAt > 600) { maskAt = performance.now(); panels() }
      clearGrid(g)
      const base = Math.min(cols, rows * 2.2)
      for (const s of specs) plot(g, s.shape, s.x * cols, s.y * rows, s.r * base * 0.95, t * s.sa + s.ph, t * s.sb + s.ph * 0.7, t * 0.1, base > 100 ? 1.5 : 1)
      ctx.clearRect(0, 0, cv.width, cv.height)
      // a perspective floor from Arcade on: lines that run to the horizon, scrolling toward you
      const floor = stage >= 3
      const horizon = Math.floor(rows * 0.66)
      const cx = cols / 2
      const scroll = still ? 0 : t * 0.9
      ctx.fillStyle = signal
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const o = x + y * cols
          const lum = g.lum[o]
          let ch = ''
          let a = 0
          if (lum >= 0) { ch = RAMP[Math.min(RAMP.length - 1, Math.floor(lum * RAMP.length))]; a = gain * (0.15 + lum * lum * 3.4) }
          else if (floor && y > horizon) {
            const d = y - horizon
            const depth = 6 / d
            const row = Math.abs(((depth * 2 - scroll) % 1 + 1) % 1) < 0.1
            const u = ((x - cx) / d) * 1.8
            const col = Math.abs(u - Math.round(u / 1.4) * 1.4) < 0.22
            if (row || col) { ch = row && col ? '+' : row ? '-' : x < cx - 1 ? '\\' : x > cx + 1 ? '/' : '|'; a = Math.min(1, d / (rows - horizon)) * gain * 2.4 }
          }
          if (ch && ch !== ' ') { ctx.globalAlpha = Math.min(0.9, a) * mask[o]; ctx.fillText(ch, x * cw, y * LINE) }
        }
      }
      if (stage >= 4) {
        ctx.fillStyle = ink
        for (const s of stars) {
          const y = Math.floor(s.y * rows * (floor ? 0.62 : 1)), x = Math.floor(((s.x + (still ? 0 : t * 0.004 * s.s)) % 1) * cols)
          if (g.lum[x + y * cols] >= 0) continue
          ctx.globalAlpha = gain * (0.9 + 0.8 * Math.sin(t * 2 + s.x * 40)) * s.s * mask[x + y * cols]
          ctx.fillText(s.c, x * cw, y * LINE)
        }
      }
      ctx.globalAlpha = 1
    }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || now - last < 1000 / 18) return
      t += last ? Math.min(0.2, (now - last) / 1000) : 0
      last = now
      draw()
    }
    size(); colours(); panels(); draw()
    if (!still) raf = requestAnimationFrame(loop)
    // a still scene has no loop, so it watches the panels itself and redraws only when they have moved
    const watch = still ? setInterval(() => { if (!document.hidden && panels()) draw() }, 700) : 0
    const onResize = () => { size(); panels(); draw() }
    addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); clearInterval(watch); removeEventListener('resize', onResize) }
  }, [stage, level])
  if (stage < 1) return null
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0" />
}
