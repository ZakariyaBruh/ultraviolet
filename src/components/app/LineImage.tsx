import { useEffect, useRef } from 'react'

const BARS = ['#f3f1ea', '#ffd23f', '#3ee0ff', '#4ade80', '#ff5d8f', '#ff3b3b', '#3b5bff']

/**
 * The front image: hairlines (the feed) pushed around by a broadcast test card (the one thing you stay on).
 * Move to bend the lines toward your pointer, click to send a ripple through them. Colours come from the theme.
 */
export function LineImage({ focus = [0.66, 0.5], still = false, className = '' }: { focus?: [number, number]; still?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const target = useRef({ x: focus[0], y: focus[1] })
  const ripples = useRef<number[]>([])
  const near = useRef(0)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    let w = 0, h = 0, raf = 0, last = 0
    let ground = '#05070c', ink = '#f3f1ea'
    const cur = { x: focus[0], y: focus[1] }
    const readColours = () => {
      const cs = getComputedStyle(document.documentElement)
      ground = cs.getPropertyValue('--ground').trim() || ground
      ink = cs.getPropertyValue('--ink').trim() || ink
    }
    const resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1)
      w = c.clientWidth; h = c.clientHeight
      c.width = w * dpr; c.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const draw = (now: number) => {
      const t = now / 1000
      const fx = cur.x * w, fy = cur.y * h
      const R = Math.min(w, h) * 0.12
      const gap = Math.max(5.5, h / 118)
      ctx.fillStyle = ground
      ctx.fillRect(0, 0, w, h)
      ctx.lineWidth = 1.15
      ctx.lineJoin = 'round'
      ripples.current = ripples.current.filter((r) => t - r < 2.4)
      const lines = Math.ceil(h / gap) + 8
      const sig = R * 3.1
      for (let li = 0; li < lines; li++) {
        const y0 = li * gap - 6 * gap
        const pts: [number, number][] = []
        for (let x = 0; x <= w + 3; x += 3) {
          const dx = x - fx, dy = y0 - fy
          const d = Math.hypot(dx, dy)
          const ridge = Math.sin(x * 0.011 + li * 0.35 + t * 0.35) * 5 + Math.sin(x * 0.027 - li * 0.2 - t * 0.2) * 3 + Math.sin(li * 0.9 + x * 0.004) * 2
          const bump = Math.exp(-(d * d) / (2 * sig * sig))
          let lift = -bump * R * 1.5
          const part = d < R * 2.2 ? (R * 2.2 - d) * 0.8 * Math.sign(dy || 1) : 0
          for (const r0 of ripples.current) { const rr = (t - r0) * 420; const e = d - rr; lift += Math.sin(e * 0.06) * Math.exp(-(e * e) / 5000) * 26 * (1 - (t - r0) / 2.4) }
          pts.push([x, y0 + ridge * (0.4 + bump * 2) + lift + part])
        }
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1])
        ctx.lineTo(w + 3, h + 20); ctx.lineTo(0, h + 20); ctx.closePath()
        ctx.fillStyle = ground; ctx.fill()
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1])
        ctx.strokeStyle = ink; ctx.stroke()
      }

      // the test card: bars above, greys below, rings and a crosshair on top
      const Rc = R * 1.9
      ctx.save()
      ctx.beginPath(); ctx.arc(fx, fy, Rc, 0, Math.PI * 2); ctx.clip()
      ctx.fillStyle = '#000'; ctx.fillRect(fx - Rc, fy - Rc, Rc * 2, Rc * 2)
      const bw = (Rc * 2) / 7
      BARS.forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(fx - Rc + i * bw, fy - Rc, bw + 0.5, Rc * 0.9) })
      for (let i = 0; i < 8; i++) { const g = Math.round((i / 7) * 255); ctx.fillStyle = `rgb(${g},${g},${g})`; ctx.fillRect(fx - Rc + (i * Rc * 2) / 8, fy + Rc * 0.28, Rc / 4 + 0.5, Rc) }
      ctx.fillStyle = '#111'; ctx.fillRect(fx - Rc, fy - Rc * 0.1, Rc * 2, Rc * 0.38)
      ctx.fillStyle = '#fff'; ctx.fillRect(fx - Rc * 0.1, fy - Rc * 0.1, Rc * 0.2, Rc * 0.38)
      ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 1.5
      for (const k of [0.3, 0.58, 0.86]) { ctx.beginPath(); ctx.arc(fx, fy, Rc * k, 0, Math.PI * 2); ctx.stroke() }
      ctx.beginPath(); ctx.moveTo(fx - Rc, fy); ctx.lineTo(fx + Rc, fy); ctx.moveTo(fx, fy - Rc); ctx.lineTo(fx, fy + Rc); ctx.stroke()
      ctx.restore()
      // a turning ring of ticks that speeds up as your pointer closes in
      const spin = t * (0.3 + near.current * 2.2)
      ctx.strokeStyle = ink; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(fx, fy, Rc + 3, 0, Math.PI * 2); ctx.stroke()
      ctx.lineWidth = 1.5
      for (let i = 0; i < 72; i++) {
        const a = spin + (i / 72) * Math.PI * 2, long = i % 6 === 0
        ctx.beginPath(); ctx.moveTo(fx + Math.cos(a) * (Rc + 7), fy + Math.sin(a) * (Rc + 7)); ctx.lineTo(fx + Math.cos(a) * (Rc + (long ? 18 : 12)), fy + Math.sin(a) * (Rc + (long ? 18 : 12))); ctx.stroke()
      }
    }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < 1000 / 24) return
      last = now
      cur.x += (target.current.x - cur.x) * 0.06
      cur.y += (target.current.y - cur.y) * 0.06
      draw(now)
    }
    const onMove = (e: PointerEvent) => {
      const r = c.getBoundingClientRect()
      target.current = { x: Math.min(0.85, Math.max(0.15, (e.clientX - r.left) / r.width)), y: Math.min(0.72, Math.max(0.3, (e.clientY - r.top) / r.height)) }
      const d = Math.hypot(e.clientX - r.left - cur.x * r.width, e.clientY - r.top - cur.y * r.height)
      near.current = Math.max(0, 1 - d / 300)
    }
    const onClick = () => { ripples.current.push(performance.now() / 1000) }
    c.addEventListener('click', onClick)
    readColours()
    resize()
    const ro = new ResizeObserver(() => { resize(); if (still) draw(3000) })
    ro.observe(c)
    const mo = new MutationObserver(() => { readColours(); if (still) draw(3000) })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    addEventListener('pointermove', onMove, { passive: true })
    if (still) draw(3000)
    else raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); removeEventListener('pointermove', onMove); c.removeEventListener('click', onClick) }
  }, [focus, still])
  return <canvas ref={ref} role="img" aria-label="Hairlines bending around a broadcast test card. Move to pull them toward your pointer, click to send a ripple through them." className={`cursor-crosshair ${className}`} />
}
