import { useEffect, useRef } from 'react'

const TAU = Math.PI * 2
const smooth = (t: number) => t * t * (3 - 2 * t)

/** Four fields of dots that morph into one another: rings, a diagonal wave, a pulsing disc, a lattice. */
function field(k: number, x: number, y: number, w: number, h: number, t: number): number {
  const cx = x - w / 2
  const cy = y - h / 2
  const d = Math.hypot(cx, cy)
  switch (k) {
    case 0:
      return 0.5 + 0.5 * Math.sin(d * 0.05 - t * 1.6)
    case 1:
      return 0.5 + 0.5 * Math.sin((x + y) * 0.022 + t * 1.2 + Math.sin(x * 0.01) * 2)
    case 2: {
      const R = Math.min(w, h) * (0.3 + 0.03 * Math.sin(t * 1.4))
      return Math.max(0, 1 - Math.abs(d - R) / 46)
    }
    default:
      return (Math.sin(x * 0.07 + t) * Math.sin(y * 0.07 - t) > 0.1 ? 0.9 : 0.12) * (0.6 + 0.4 * Math.sin(d * 0.01 - t))
  }
}

/** Full-screen dot-matrix ground. Level 0 draws one still frame; 1 morphs; 2 morphs faster and swells under the pointer. */
export function DotMorph({ level }: { level: 0 | 1 | 2 }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    let w = 0
    let h = 0
    let raf = 0
    let last = 0
    let ink = '241,238,228'
    let sig = '255,90,31'
    const ptr = { x: -999, y: -999 }
    const resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1)
      w = c.clientWidth
      h = c.clientHeight
      c.width = w * dpr
      c.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const colours = () => {
      const cs = getComputedStyle(document.documentElement)
      const hex = (v: string) => {
        const m = v.trim().match(/^#([0-9a-f]{6})$/i)
        return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(',') : null
      }
      ink = hex(cs.getPropertyValue('--ink')) ?? ink
      sig = hex(cs.getPropertyValue('--signal')) ?? sig
    }
    const draw = (now: number) => {
      const t = now / 1000
      const speed = level === 2 ? 1.6 : 1
      const step = w < 640 ? 14 : 16
      const phase = (t * speed) / 7
      const i = Math.floor(phase)
      const f = smooth(Math.min(1, (phase - i) * 1.6))
      ctx.clearRect(0, 0, w, h)
      for (let y = step / 2; y < h; y += step) {
        for (let x = step / 2; x < w; x += step) {
          let v = field(i % 4, x, y, w, h, t * speed) * (1 - f) + field((i + 1) % 4, x, y, w, h, t * speed) * f
          if (level === 2) {
            const d = Math.hypot(x - ptr.x, y - ptr.y)
            if (d < 120) v = Math.min(1, v + (1 - d / 120) * 0.8)
          }
          const s = 1.2 + v * 3.4
          ctx.fillStyle = v > 0.93 ? `rgba(${sig},0.75)` : `rgba(${ink},${0.05 + v * 0.2})`
          ctx.fillRect(x - s / 2, y - s / 2, s, s)
        }
      }
    }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < 1000 / 24) return
      last = now
      draw(now)
    }
    resize()
    colours()
    const onMove = (e: PointerEvent) => { ptr.x = e.clientX; ptr.y = e.clientY }
    const onTheme = new MutationObserver(colours)
    onTheme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    addEventListener('resize', resize)
    if (level === 2) addEventListener('pointermove', onMove, { passive: true })
    if (level === 0) draw(2500)
    else raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      onTheme.disconnect()
      removeEventListener('resize', resize)
      removeEventListener('pointermove', onMove)
    }
  }, [level])
  return <canvas ref={ref} aria-hidden className="absolute inset-0 size-full" />
}

export { TAU }
