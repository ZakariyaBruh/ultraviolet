import { useEffect, useRef } from 'react'
import { clearGrid, makeGrid, plot, RAMP, type Shape } from '@/lib/ascii3d'
import { useUI } from '@/lib/ui'

/**
 * The ASCII dial's main instrument. Solids drawn in text roam the whole screen, turning as they go: one drifting at Drift,
 * nine of them, stars and a perspective floor at World. It sits behind everything, never takes the pointer, and costs one
 * small canvas. When something is finished (the celebration card) they all speed up and swell for a few seconds.
 */
interface Spec { shape: Shape; x: number; y: number; r: number; ph: number; ax: number; ay: number; w: number; sa: number; sb: number }
/** a solid: where it lives (x, y as fractions of the screen), how big, how far it wanders and how fast it turns */
const T = (shape: Shape, x: number, y: number, r: number, ph: number, ax = 0.2, ay = 0.16, w = 0.17, sa = 0.7, sb = 0.4): Spec => ({ shape, x, y, r, ph, ax, ay, w, sa, sb })

/** every solid, in the order they join as the dial turns up */
const ALL: Spec[] = [
  T('torus', 0.78, 0.66, 0.15, 0, 0.2, 0.18, 0.15),
  T('cube', 0.16, 0.62, 0.1, 1, 0.14, 0.2, 0.2, 0.6, 0.75),
  T('knot', 0.5, 0.24, 0.1, 2, 0.28, 0.12, 0.13, 0.5, 0.55),
  T('sphere', 0.9, 0.22, 0.08, 3, 0.1, 0.22, 0.24, 0.3, 0.4),
  T('helix', 0.3, 0.84, 0.1, 4, 0.24, 0.1, 0.18, 0.2, 0.8),
  T('pyramid', 0.66, 0.14, 0.09, 5, 0.2, 0.16, 0.21, 0.55, 0.9),
  T('torus', 0.1, 0.2, 0.07, 6, 0.1, 0.24, 0.26, 0.9, 0.3),
  T('cube', 0.55, 0.88, 0.08, 7, 0.3, 0.08, 0.16, 0.8, 0.5),
  T('knot', 0.92, 0.56, 0.07, 8, 0.08, 0.26, 0.22, 0.4, 0.7),
]
/** how many solids at each stop, how big they are, and how strong the whole scene is */
const COUNT = [0, 1, 3, 5, 7, 9]
const GROW = [0, 0.9, 0.9, 0.92, 0.95, 0.98]
const GAIN = [0, 0.2, 0.24, 0.28, 0.33, 0.38]
/** how long the burst after a finish lasts */
const BURST_MS = 4800

const FONT = 13
const LINE = 15
/** how much of the scene is left behind panels and behind lines of text, so reading never fights it */
const BEHIND_PANEL = 0.6
const BEHIND_TEXT = 0.28
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
    let raf = 0, last = 0, t = 0, spin = 0
    let signal = '#ffd23f', ink = '#ffffff', colorAt = 0
    let mask = new Float32Array(0)
    let seen = ''
    let maskAt = 0
    // on a phone the page text fills the screen, so only the lower solids stay and they sit a little quieter
    const narrow = innerWidth < 640
    const st = Math.min(5, stage)
    const specs = ALL.slice(0, narrow ? Math.min(3, COUNT[st]) : COUNT[st])
    const gain = GAIN[st] * (narrow ? 0.8 : 1)
    const grow = GROW[st]
    // a finish (the celebration card) sets the shapes off: they speed up, swing wider and swell, then settle over a few seconds
    let burstAt = -1e9
    const unsub = useUI.subscribe((u, prev) => { if (u.celebrate && !prev.celebrate) burstAt = performance.now() })
    const energy = () => Math.max(0, 1 - (performance.now() - burstAt) / BURST_MS)
    const stars = Array.from({ length: 70 }, (_, i) => ({ x: ((i * 97) % 100) / 100, y: ((i * 53) % 100) / 100, s: 0.2 + ((i * 31) % 10) / 12, c: '.+*'[i % 3] }))

    const size = () => {
      const dpr = Math.min(2, devicePixelRatio || 1)
      const w = innerWidth, h = innerHeight
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      cv.style.width = `${w}px`; cv.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `600 ${FONT}px "Geist Mono Variable", ui-monospace, Menlo, Consolas, monospace`
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
      if (performance.now() - colorAt > 400) { colours(); colorAt = performance.now() }
      if (performance.now() - maskAt > 600) { maskAt = performance.now(); panels() }
      clearGrid(g)
      const base = Math.min(cols, rows * 2.2)
      const e = still ? 0 : energy()
      const swing = 1 + 0.8 * e
      for (const s of specs) {
        // each solid wanders on its own slow loop (two waves, so it never retraces itself), and breathes a little as it goes
        const wx = Math.sin(s.w * t + s.ph * 2.1) + 0.35 * Math.sin(s.w * 2.3 * t + s.ph)
        const wy = Math.sin(s.w * 0.8 * t + s.ph * 1.3 + 1) + 0.35 * Math.cos(s.w * 1.9 * t + s.ph * 0.6)
        const px = Math.min(0.94, Math.max(0.06, s.x + s.ax * swing * wx))
        const py = Math.min(0.9, Math.max(0.1, s.y + s.ay * swing * wy))
        const breathe = 1 + 0.1 * Math.sin(s.w * 1.7 * t + s.ph) + 0.22 * e * Math.sin(spin * 3 + s.ph)
        plot(g, s.shape, px * cols, py * rows, s.r * grow * breathe * base * 0.95, spin * s.sa + s.ph, spin * s.sb + s.ph * 0.7, spin * 0.15, base > 100 ? 1.5 : 1)
      }
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
          if (lum >= 0) {
            // a curve on the light so the lit side, the shaded side and the edge read as different characters: the shape shows up, not a block
            const l = Math.pow(lum, 1.8)
            ch = RAMP[Math.min(RAMP.length - 1, Math.floor(l * RAMP.length))]
            a = gain * (0.2 + l * 3.2)
          }
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
      if (document.hidden || now - last < 1000 / 24) return
      const dt = last ? Math.min(0.2, (now - last) / 1000) : 0
      const e = energy()
      t += dt * (1 + 3 * e)
      spin += dt * (1 + 5 * e)
      last = now
      draw()
    }
    size(); colours(); panels(); draw()
    if (!still) raf = requestAnimationFrame(loop)
    // a still scene has no loop, so it watches the panels itself and redraws only when they have moved
    const watch = still ? setInterval(() => { if (!document.hidden && panels()) draw() }, 700) : 0
    const onResize = () => { size(); panels(); draw() }
    addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); clearInterval(watch); unsub(); removeEventListener('resize', onResize) }
  }, [stage, level])
  if (stage < 1) return null
  return <canvas ref={ref} data-scene aria-hidden className="pointer-events-none absolute inset-0" />
}
