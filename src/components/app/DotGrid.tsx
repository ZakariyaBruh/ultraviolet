import { useEffect, useRef } from 'react'
import { dprCap, everyFrame, pace, usePerf } from '@/lib/perf'

/** how many strengths the dots at rest are sorted into (their strength only ranges over 0.16, so eight steps cannot be seen) */
const REST = 8

/**
 * Anything drawn in front of the dot matrix can ask it to leave those places empty: `test` says whether a point (in the
 * matrix's own pixels) is covered, and `bump` is called when that changes while the matrix is not animating itself.
 */
export const dotHoles: { test: ((x: number, y: number) => boolean) | null; bump: (() => void) | null } = { test: null, bump: null }

/**
 * A plain, regular dot matrix. Dots swell and light up near your pointer; a click sends one ring of light across the grid.
 * Colours come from the theme.
 */
export function DotGrid({ still: asked = false, className = '' }: { still?: boolean; className?: string }) {
  // at still detail (lib/perf.ts) the grid is one drawn frame, as it is with calm motion
  const tier = usePerf((s) => s.tier)
  const still = tier === 0 || asked
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    let w = 0, h = 0, last = 0
    let stop: (() => void) | undefined
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
      const dpr = Math.min(dprCap(), devicePixelRatio || 1)
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
      // Nearly every dot is at rest: the same size, its strength riding a slow wave between 0.32 and 0.48. Those are sorted into
      // eight strengths and each strength is filled in one go, so a frame is eight fills and not a fill for each of a thousand or
      // more dots. Only the few the pointer or a ring is touching are worked out and drawn one by one, exactly as before.
      const rest: Path2D[] = []
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = ox + i * step, y = oy + j * step
          if (dotHoles.test?.(x, y)) continue // something is drawn in front of this one
          const d = Math.hypot(x - ptr.x, y - ptr.y)
          let a = 0.4 + 0.08 * Math.sin(i * 0.35 + j * 0.25 + t * 0.9)
          let r = 1.7
          let lit = 0
          let touched = false
          if (d < 140) { const k = 1 - d / 140; r += k * 3.4; a += k * 0.5; lit = k; touched = true }
          for (const r0 of rings) {
            const e = d - (t - r0) * 380
            const k = Math.exp(-(e * e) / 1400) * (1 - (t - r0) / 2.2)
            if (k > 0.01) { r += k * 2.4; a += k * 0.6; lit = Math.max(lit, k); touched = true }
          }
          if (!touched) {
            const b = Math.min(REST - 1, Math.max(0, Math.floor(((a - 0.32) / 0.16) * REST)))
            const path = (rest[b] ??= new Path2D())
            path.moveTo(x + r, y); path.arc(x, y, r, 0, Math.PI * 2)
            continue
          }
          ctx.fillStyle = lit > 0.08 ? `rgba(${sig},${Math.min(1, a + 0.2)})` : `rgba(${ink},${Math.min(1, a)})`
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
        }
      }
      for (let b = 0; b < REST; b++) {
        if (!rest[b]) continue
        ctx.fillStyle = `rgba(${ink},${(0.32 + ((b + 0.5) / REST) * 0.16).toFixed(3)})`
        ctx.fill(rest[b])
      }
    }
    const loop = (now: number) => {
      // the light follows the pointer with the same weight whatever the frame rate
      const k = last ? 1 - Math.pow(0.75, Math.min(250, now - last) / 33.3) : 1
      last = now
      ptr.x += (ptr.tx - ptr.x) * k; ptr.y += (ptr.ty - ptr.y) * k
      draw(now)
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
    else stop = everyFrame(loop, pace(3, 6)) // twenty times a second, ten at light detail: each frame is a whole screen of pixels to hand over
    return () => { dotHoles.bump = null; stop?.(); ro.disconnect(); mo.disconnect(); c.removeEventListener('click', onClick); removeEventListener('pointermove', onMove) }
  }, [still, tier])
  return <canvas ref={ref} role="img" aria-label="A grid of dots that light up around your pointer. Click to send a ring of light across it." className={`cursor-crosshair ${className}`} />
}
