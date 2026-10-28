import { useEffect, useRef, useState } from 'react'
import { clearGrid, makeGrid, plot, RAMP, SHAPES, type Shape } from '@/lib/ascii3d'

/** a fresh order of the solids every visit, so the front page is never the same one twice in a row */
const shuffled = (): Shape[] => {
  const a = [...SHAPES]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/** where each one lives (fractions of the picture), how big (a share of the largest), how far it wanders and how fast it turns */
const SPOTS = [
  { x: 0.8, y: 0.6, s: 1, ax: 0.04, ay: 0.05, w: 0.3 },
  { x: 0.6, y: 0.74, s: 0.5, ax: 0.05, ay: 0.04, w: 0.42 },
  { x: 0.93, y: 0.26, s: 0.4, ax: 0.03, ay: 0.06, w: 0.5 },
  { x: 0.56, y: 0.34, s: 0.34, ax: 0.05, ay: 0.05, w: 0.36 },
]

const FONT = 9
const LINE = 10

/**
 * The solids on the front page, drawn in text and sitting behind the dot matrix: the dots pass in front of them. They are the
 * ice colour, not the signal yellow the lit dots turn, so the two never merge. Which solids, and which is the big one, is picked
 * at random each time the page opens.
 */
export function LandingSolids({ count, still }: { count: number; still: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [order] = useState(shuffled)
  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    let cols = 0, rows = 0, cw = 5.4, raf = 0, last = 0, t = 0, spin = 0, w = 0
    let g = makeGrid(1, 1)
    let tone = '#7fd3ff'
    const list = SPOTS.slice(0, Math.max(1, Math.min(SPOTS.length, count)))
    const runs = [0.45, 0.75, 1].map(() => [] as string[])
    const lo = [1e9, 1e9, 1e9], hi = [-1, -1, -1]

    const size = () => {
      const dpr = Math.min(2, devicePixelRatio || 1)
      w = cv.clientWidth
      const h = cv.clientHeight
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `700 ${FONT}px "Geist Mono Variable", ui-monospace, Menlo, Consolas, monospace`
      ctx.textBaseline = 'top'
      cw = ctx.measureText('M').width || 5.4
      cols = Math.ceil(w / cw); rows = Math.ceil(h / LINE)
      g = makeGrid(cols, rows, cw / LINE)
      for (const r of runs) { r.length = cols; r.fill(' ') }
      lo.fill(1e9); hi.fill(-1)
    }
    const draw = () => {
      if (!cols || !w) return
      tone = getComputedStyle(document.documentElement).getPropertyValue('--ice').trim() || tone
      clearGrid(g)
      const big = Math.min(rows * 0.5, cols * 0.2)
      list.forEach((s, i) => {
        const px = (s.x + s.ax * Math.sin(s.w * t + i * 2)) * cols
        const py = (s.y + s.ay * Math.cos(s.w * 0.8 * t + i * 1.3)) * rows
        plot(g, order[i % order.length], px, py, big * s.s, spin * (0.7 + i * 0.2) + i, spin * 0.4 + i * 0.9, spin * 0.12)
      })
      ctx.clearRect(0, 0, w, rows * LINE)
      ctx.fillStyle = tone
      for (let y = 0; y < rows; y++) {
        let used = 0
        for (let x = 0; x < cols; x++) {
          const lum = g.lum[x + y * cols]
          if (lum < 0) continue
          const l = Math.pow(lum, 2.3) // a steep curve: the middle tones get their own marks, so a solid shows its form and not just its outline
          const b = l < 0.14 ? 0 : l < 0.4 ? 1 : 2
          runs[b][x] = RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(l * (RAMP.length - 1)))] // never a blank inside the solid
          used |= 1 << b; if (x < lo[b]) lo[b] = x; if (x > hi[b]) hi[b] = x
        }
        for (let b = 0; b < 3; b++) {
          if (!(used & (1 << b))) continue
          ctx.globalAlpha = [0.4, 0.7, 1][b]
          ctx.fillText(runs[b].slice(lo[b], hi[b] + 1).join(''), lo[b] * cw, y * LINE)
          runs[b].fill(' ', lo[b], hi[b] + 1); lo[b] = 1e9; hi[b] = -1
        }
      }
      ctx.globalAlpha = 1
    }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || now - last < 1000 / 24) return
      const dt = last ? Math.min(0.2, (now - last) / 1000) : 0
      last = now; t += dt; spin += dt * 0.9
      draw()
    }
    size(); draw()
    if (!still) raf = requestAnimationFrame(loop)
    const ro = new ResizeObserver(() => { size(); draw() })
    ro.observe(cv)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [count, still, order])
  return <canvas ref={ref} aria-hidden className="land-solids pointer-events-none absolute inset-0 size-full" />
}
