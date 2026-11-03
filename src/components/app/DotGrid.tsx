import { useEffect, useRef } from 'react'

/**
 * Anything drawn in front of the dot matrix can ask it to leave those places empty: `test` says whether a point (in the
 * matrix's own pixels) is covered, and `bump` is called when that changes while the matrix is not animating itself.
 */
export const dotHoles: { test: ((x: number, y: number) => boolean) | null; bump: (() => void) | null } = { test: null, bump: null }

/**
 * A plain, regular dot matrix. Dots swell and light up near your pointer; a click sends one ring of light across the grid.
 * Colours come from the theme.
 */
export function DotGrid({ still = false, className = '' }: { still?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    let w = 0, h = 0, raf = 0, last = 0
    let ink = '243,241,234', sig = '255,210,63'
    const ptr = { x: -9999, y: -9999, tx: -9999, ty: -9999 }
    const rings: number[] = []
    const rgb = (v: string, fb: string) => {
      const m = v.trim().match(/^#([0-9a-f]{6})$/i)
      return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(',') : fb
    }
    const colours = () => {
      const cs = getComputedStyle(document.documentElement)
      ink = rgb(cs.getPropertyValue('--ink'), ink)
      sig = rgb(cs.getPropertyValue('--signal'), sig)
    }
    const resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1)
      w = c.clientWidth; h = c.clientHeight
      c.width = w * dpr; c.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const draw = (now: number) => {
      const t = now / 1000
      const step = w < 640 ? 18 : 22
      const cols = Math.ceil(w / step), rows = Math.ceil(h / step)
      const ox = (w - (cols - 1) * step) / 2, oy = (h - (rows - 1) * step) / 2
      while (rings.length && t - rings[0] > 2.2) rings.shift()
      ctx.clearRect(0, 0, w, h)
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = ox + i * step, y = oy + j * step
          if (dotHoles.test?.(x, y)) continue // something is drawn in front of this one
          const d = Math.hypot(x - ptr.x, y - ptr.y)
          let a = 0.4 + 0.08 * Math.sin(i * 0.35 + j * 0.25 + t * 0.9)
          let r = 1.7
          let lit = 0
          if (d < 140) { const k = 1 - d / 140; r += k * 3.4; a += k * 0.5; lit = k }
          for (const r0 of rings) {
            const e = Math.hypot(x - ptr.x, y - ptr.y) - (t - r0) * 380
            const k = Math.exp(-(e * e) / 1400) * (1 - (t - r0) / 2.2)
            if (k > 0.01) { r += k * 2.4; a += k * 0.6; lit = Math.max(lit, k) }
          }
          ctx.fillStyle = lit > 0.08 ? `rgba(${sig},${Math.min(1, a + 0.2)})` : `rgba(${ink},${Math.min(1, a)})`
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
        }
      }
    }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < 1000 / 30) return
      last = now
      ptr.x += (ptr.tx - ptr.x) * 0.25; ptr.y += (ptr.ty - ptr.y) * 0.25
      draw(now / 1)
    }
    const onMove = (e: PointerEvent) => {
      const r = c.getBoundingClientRect()
      const x = e.clientX - r.left, y = e.clientY - r.top
      if (ptr.tx < -999) { ptr.x = x; ptr.y = y }
      ptr.tx = x; ptr.ty = y
    }
    const onClick = () => { rings.push(performance.now() / 1000) }
    colours(); resize()
    const ro = new ResizeObserver(() => { resize(); if (still) draw(2500) })
    ro.observe(c)
    const mo = new MutationObserver(() => { colours(); if (still) draw(2500) })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    c.addEventListener('click', onClick)
    addEventListener('pointermove', onMove, { passive: true })
    if (still) { dotHoles.bump = () => draw(2500); draw(2500) }
    else raf = requestAnimationFrame(loop)
    return () => { dotHoles.bump = null; cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); c.removeEventListener('click', onClick); removeEventListener('pointermove', onMove) }
  }, [still])
  return <canvas ref={ref} role="img" aria-label="A grid of dots that light up around your pointer. Click to send a ring of light across it." className={`cursor-crosshair ${className}`} />
}
