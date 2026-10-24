import { useEffect, useRef } from 'react'

/**
 * Hard white hairlines on black, pushed up by a field of ridges, with the lines parting
 * around one vivid point. The only colour on the page lives in that point and in the lines closest to it.
 */
export function LineImage({ focus = [0.66, 0.5], still = false, className = '' }: { focus?: [number, number]; still?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const target = useRef({ x: focus[0], y: focus[1] })
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    let w = 0, h = 0, raf = 0, last = 0
    const cur = { x: focus[0], y: focus[1] }
    const resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1)
      w = c.clientWidth; h = c.clientHeight
      c.width = w * dpr; c.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const draw = (now: number) => {
      const t = now / 1000
      const fx = cur.x * w, fy = cur.y * h
      const R = Math.min(w, h) * 0.105
      const gap = Math.max(5.5, h / 118)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)
      ctx.lineWidth = 1.15
      ctx.lineJoin = 'round'
      const lines = Math.ceil(h / gap) + 8
      const sig = R * 3.1
      for (let li = 0; li < lines; li++) {
        const y0 = li * gap - 6 * gap
        const pts: [number, number, number][] = []
        for (let x = 0; x <= w + 3; x += 3) {
          const dx = x - fx, dy = y0 - fy
          const d = Math.hypot(dx, dy)
          const ridge = Math.sin(x * 0.011 + li * 0.35 + t * 0.35) * 5 + Math.sin(x * 0.027 - li * 0.2 - t * 0.2) * 3 + Math.sin(li * 0.9 + x * 0.004) * 2
          const bump = Math.exp(-(d * d) / (2 * sig * sig))
          const wave = Math.cos(d * 0.045 - t * 1.4) * Math.exp(-d / (R * 5.5))
          const lift = -bump * R * 1.9 - wave * R * 0.22 * (d < R * 7 ? 1 : 0)
          // lines are shoved outward from the point so they part around it
          const part = d < R * 1.5 ? (R * 1.5 - d) * 0.9 * Math.sign(dy || 1) : 0
          pts.push([x, y0 + ridge * (0.4 + bump * 2.2) + lift + part, d])
        }
        // occlude what is behind this line, as a ridge plot does
        ctx.beginPath()
        ctx.moveTo(pts[0][0], pts[0][1])
        for (const p of pts) ctx.lineTo(p[0], p[1])
        ctx.lineTo(w + 3, h + 20); ctx.lineTo(0, h + 20); ctx.closePath()
        ctx.fillStyle = '#000'
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(pts[0][0], pts[0][1])
        for (const p of pts) ctx.lineTo(p[0], p[1])
        ctx.strokeStyle = '#f4f1e8'
        ctx.stroke()
        // the colour: only the stretch of line near the focus
        let open = false
        for (const p of pts) {
          if (p[2] < R * 3.6) {
            const k = p[2] / (R * 3.6)
            const hue = (330 + k * 150 + t * 20) % 360
            ctx.strokeStyle = `hsl(${hue} 100% ${58 + (1 - k) * 8}%)`
            if (!open) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); open = true } else { ctx.lineTo(p[0], p[1]); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p[0], p[1]) }
          } else open = false
        }
      }
      // the point: one hard-edged sphere of colour, cut by black scan rows so it still belongs to the lines
      ctx.save()
      ctx.beginPath(); ctx.arc(fx, fy - R * 0.2, R, 0, Math.PI * 2); ctx.clip()
      const g = typeof ctx.createConicGradient === 'function' ? ctx.createConicGradient(t * 0.6, fx, fy) : ctx.createLinearGradient(fx - R, fy - R, fx + R, fy + R)
      ;[['#ff2d95', 0], ['#ff7a00', 0.22], ['#ffe600', 0.42], ['#18ffb0', 0.6], ['#22b8ff', 0.78], ['#a23bff', 0.92], ['#ff2d95', 1]].forEach(([col, s]) => g.addColorStop(s as number, col as string))
      ctx.fillStyle = g as CanvasGradient
      ctx.fillRect(fx - R, fy - R * 1.3, R * 2, R * 2.2)
      const sh = ctx.createRadialGradient(fx - R * 0.35, fy - R * 0.55, R * 0.05, fx, fy, R * 1.1)
      sh.addColorStop(0, 'rgba(255,255,255,0.85)'); sh.addColorStop(0.28, 'rgba(255,255,255,0)'); sh.addColorStop(0.7, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.78)')
      ctx.fillStyle = sh; ctx.fillRect(fx - R, fy - R * 1.3, R * 2, R * 2.2)
      ctx.fillStyle = '#000'
      for (let y = fy - R * 1.3; y < fy + R; y += gap) ctx.fillRect(fx - R, y + gap * 0.62, R * 2, gap * 0.38)
      ctx.restore()
    }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < 1000 / 20) return
      last = now
      cur.x += (target.current.x - cur.x) * 0.06
      cur.y += (target.current.y - cur.y) * 0.06
      draw(now)
    }
    const onMove = (e: PointerEvent) => {
      const r = c.getBoundingClientRect()
      target.current = { x: Math.min(0.85, Math.max(0.15, (e.clientX - r.left) / r.width)), y: Math.min(0.75, Math.max(0.3, (e.clientY - r.top) / r.height)) }
    }
    resize()
    const ro = new ResizeObserver(() => { resize(); if (still) draw(3000) })
    ro.observe(c)
    addEventListener('pointermove', onMove, { passive: true })
    if (still) draw(3000)
    else raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('pointermove', onMove) }
  }, [focus, still])
  return <canvas ref={ref} role="img" aria-label="Hairlines of white on black parting around one bright sphere of colour" className={className} />
}
