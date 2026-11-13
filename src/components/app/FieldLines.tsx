import { useEffect } from 'react'
import { usePerf } from '@/lib/perf'
import type { Stage } from '@/lib/stage'

/** Marching-squares segments for each case, as pairs of cell edges: 0 top, 1 right, 2 bottom, 3 left. */
const SEG: number[][] = [[], [3, 2], [2, 1], [3, 1], [0, 1], [0, 3, 2, 1], [0, 2], [0, 3], [0, 3], [0, 2], [0, 1, 2, 3], [0, 1], [3, 1], [2, 1], [3, 2], []]
/** the nine contour heights, and which of them are drawn stronger */
const LEVELS = [-1.6, -1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2, 1.6]
const MAJOR = [false, true, false, false, true, false, false, true, false]

/**
 * The futuristic ground: a slowly flowing topography drawn as smooth contour lines. The pointer is a well in the surface.
 * Level 0 draws one still frame; 1 flows; 2 flows faster and the well is deeper.
 *
 * It is a layer on the shared backdrop canvas (lib/stage.ts), not a canvas of its own. Each frame walks the grid once and sorts
 * every line it finds into one of two paths (strong and faint), so the canvas strokes twice instead of nine times and nothing is
 * allocated per point. At light detail (lib/perf.ts) it is drawn half as often; at still, once.
 */
export function FieldLines({ stage, level }: { stage: Stage; level: 0 | 1 | 2 }) {
  const tier = usePerf((s) => s.tier)
  useEffect(() => {
    const still = level === 0 || tier === 0
    let w = 0, h = 0, last = 0
    let cell = 22, nx = 0, ny = 0
    let grid = new Float32Array(0)
    let ice = '143,216,255'
    const ptr = { x: -9999, y: -9999, tx: -9999, ty: -9999 }
    const colours = () => {
      const m = getComputedStyle(document.documentElement).getPropertyValue('--ice').trim().match(/^#([0-9a-f]{6})$/i)
      if (m) ice = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(',')
    }
    const field = (x: number, y: number, t: number) => {
      let v = Math.sin(x * 0.0042 + t * 0.16 + Math.sin(y * 0.003 - t * 0.1) * 2) + Math.sin(y * 0.0062 - t * 0.12 + Math.sin(x * 0.005) * 1.5) + 0.6 * Math.sin((x + y) * 0.003 + t * 0.07)
      const dx = x - ptr.x, dy = y - ptr.y
      v -= (level === 2 ? 1.9 : 1.3) * Math.exp(-(dx * dx + dy * dy) / (2 * 150 * 150))
      return v
    }
    const resize = (W: number, H: number) => {
      w = W; h = H
      cell = w < 640 ? 28 : 22
      nx = Math.ceil(w / cell) + 1; ny = Math.ceil(h / cell) + 1
      grid = new Float32Array(nx * ny)
    }
    const draw = (ctx: CanvasRenderingContext2D, now: number) => {
      if (!nx) return
      // the well follows the pointer with a little weight, the same whatever the frame rate
      if (!still) {
        const k = last ? 1 - Math.pow(0.88, Math.min(250, now - last) / 50) : 1
        ptr.x += (ptr.tx - ptr.x) * k; ptr.y += (ptr.ty - ptr.y) * k
        last = now
      }
      const t = still ? 4 : (now / 1000) * (level === 2 ? 1.8 : 1)
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) grid[j * nx + i] = field(i * cell, j * cell, t)
      const strong = new Path2D(), faint = new Path2D()
      for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
          const a = grid[j * nx + i], b = grid[j * nx + i + 1], c = grid[(j + 1) * nx + i + 1], d = grid[(j + 1) * nx + i]
          const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d)
          const x0 = i * cell, y0 = j * cell
          for (let n = 0; n < LEVELS.length; n++) {
            const L = LEVELS[n]
            // a contour only passes through a cell whose corners are on both sides of it
            if (L < lo || L >= hi) continue
            const s = SEG[(a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0)]
            const path = MAJOR[n] ? strong : faint
            for (let q = 0; q < s.length; q += 2) {
              for (let end = 0; end < 2; end++) {
                const e = s[q + end]
                const x = e === 0 ? x0 + cell * ((L - a) / (b - a)) : e === 1 ? x0 + cell : e === 2 ? x0 + cell * ((L - d) / (c - d)) : x0
                const y = e === 0 ? y0 : e === 1 ? y0 + cell * ((L - b) / (c - b)) : e === 2 ? y0 + cell : y0 + cell * ((L - a) / (d - a))
                if (end === 0) path.moveTo(x, y); else path.lineTo(x, y)
              }
            }
          }
        }
      }
      ctx.lineWidth = 1
      ctx.strokeStyle = `rgba(${ice},0.24)`; ctx.stroke(faint)
      ctx.strokeStyle = `rgba(${ice},0.5)`; ctx.stroke(strong)
    }
    const onMove = (e: PointerEvent) => { if (ptr.tx < -999) { ptr.x = e.clientX; ptr.y = e.clientY } ptr.tx = e.clientX; ptr.ty = e.clientY }
    colours()
    const off = stage.add({ z: 0, step: () => (still ? 0 : tier === 2 ? 3 : 6), resize, draw })
    // the theme changed: take its colour, and a still field has to be drawn again to show it
    const mo = new MutationObserver(() => { colours(); stage.redraw() })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    if (!still) addEventListener('pointermove', onMove, { passive: true })
    return () => { off(); mo.disconnect(); removeEventListener('pointermove', onMove) }
  }, [stage, level, tier])
  return null
}
