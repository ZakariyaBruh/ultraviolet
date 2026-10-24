import { useEffect, useRef } from 'react'

/** Marching-squares segments for each case, as pairs of cell edges: 0 top, 1 right, 2 bottom, 3 left. */
const SEG: number[][] = [[], [3, 2], [2, 1], [3, 1], [0, 1], [0, 3, 2, 1], [0, 2], [0, 3], [0, 3], [0, 2], [0, 1, 2, 3], [0, 1], [3, 1], [2, 1], [3, 2], []]

/**
 * The futuristic ground: a slowly flowing topography drawn as smooth contour lines. The pointer is a well in the surface.
 * Level 0 draws one still frame; 1 flows; 2 flows faster and the well is deeper.
 */
export function FieldLines({ level }: { level: 0 | 1 | 2 }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    let w = 0, h = 0, raf = 0, last = 0
    let ice = '143,216,255'
    const ptr = { x: -9999, y: -9999, tx: -9999, ty: -9999 }
    const resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1)
      w = c.clientWidth; h = c.clientHeight
      c.width = w * dpr; c.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
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
    const draw = (now: number) => {
      const t = (now / 1000) * (level === 2 ? 1.8 : 1)
      const step = w < 640 ? 28 : 22
      const nx = Math.ceil(w / step) + 1, ny = Math.ceil(h / step) + 1
      const grid = new Float32Array(nx * ny)
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) grid[j * nx + i] = field(i * step, j * step, t)
      ctx.clearRect(0, 0, w, h)
      ctx.lineWidth = 1
      for (let L = -1.6; L <= 1.61; L += 0.4) {
        const major = Math.abs(L) < 0.01 || Math.abs(Math.abs(L) - 1.2) < 0.01
        ctx.strokeStyle = `rgba(${ice},${major ? 0.5 : 0.24})`
        ctx.beginPath()
        for (let j = 0; j < ny - 1; j++) {
          for (let i = 0; i < nx - 1; i++) {
            const a = grid[j * nx + i], b = grid[j * nx + i + 1], cc = grid[(j + 1) * nx + i + 1], d = grid[(j + 1) * nx + i]
            const k = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (cc > L ? 2 : 0) | (d > L ? 1 : 0)
            const s = SEG[k]
            if (!s.length) continue
            const x0 = i * step, y0 = j * step
            const pt = (e: number): [number, number] => {
              if (e === 0) return [x0 + step * ((L - a) / (b - a)), y0]
              if (e === 1) return [x0 + step, y0 + step * ((L - b) / (cc - b))]
              if (e === 2) return [x0 + step * ((L - d) / (cc - d)), y0 + step]
              return [x0, y0 + step * ((L - a) / (d - a))]
            }
            for (let q = 0; q < s.length; q += 2) {
              const p = pt(s[q]), r = pt(s[q + 1])
              ctx.moveTo(p[0], p[1]); ctx.lineTo(r[0], r[1])
            }
          }
        }
        ctx.stroke()
      }
    }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < 1000 / 24) return
      last = now
      ptr.x += (ptr.tx - ptr.x) * 0.12; ptr.y += (ptr.ty - ptr.y) * 0.12
      draw(now)
    }
    const onMove = (e: PointerEvent) => { if (ptr.tx < -999) { ptr.x = e.clientX; ptr.y = e.clientY } ptr.tx = e.clientX; ptr.ty = e.clientY }
    resize(); colours()
    const ro = new ResizeObserver(() => { resize(); if (level === 0) draw(4000) })
    ro.observe(c)
    const mo = new MutationObserver(colours)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    if (level > 0) addEventListener('pointermove', onMove, { passive: true })
    if (level === 0) draw(4000)
    else raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); removeEventListener('pointermove', onMove) }
  }, [level])
  return <canvas ref={ref} aria-hidden className="absolute inset-0 size-full" />
}
