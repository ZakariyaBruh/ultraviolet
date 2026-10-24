import { useEffect, useRef } from 'react'

const N = 2744
function mulberry(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

/** Four shapes (knot, helix, cube lattice, dune) with the same number of points, so any one can melt into any other. */
function makeShapes() {
  const r = mulberry(11)
  const sphere = new Float32Array(N * 3), knot = new Float32Array(N * 3), lattice = new Float32Array(N * 3), dune = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const ht = (i >> 1) / (N / 2), ha = ht * Math.PI * 6 + (i & 1) * Math.PI
    sphere.set([0.62 * Math.cos(ha) + (r() - 0.5) * 0.06, (ht - 0.5) * 2.4, 0.62 * Math.sin(ha) + (r() - 0.5) * 0.06], i * 3)
    const u = (i / N) * Math.PI * 2 * 1, q = 3, p = 2, rr = Math.cos(q * u) + 2.1
    knot.set([(rr * Math.cos(p * u)) / 3 + (r() - 0.5) * 0.28, (rr * Math.sin(p * u)) / 3 + (r() - 0.5) * 0.28, (-Math.sin(q * u)) / 1.6 + (r() - 0.5) * 0.28], i * 3)
    const a = i % 14, b = Math.floor(i / 14) % 14, c = Math.floor(i / 196)
    lattice.set([(a / 13 - 0.5) * 1.7, (b / 13 - 0.5) * 1.7, (c / 13 - 0.5) * 1.7], i * 3)
    const col = i % 56, row = Math.floor(i / 56), x = (col / 55 - 0.5) * 2.4, z = (row / 48 - 0.5) * 2.4
    dune.set([x, 0.28 * Math.sin(x * 3.2 + z * 1.6) + 0.18 * Math.cos(z * 3.6), z], i * 3)
  }
  const perm = (arr: Float32Array) => { const idx = Array.from({ length: N }, (_, i) => i); const rr = mulberry(5); for (let i = N - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]] } const o = new Float32Array(N * 3); idx.forEach((k, i) => o.set(arr.subarray(k * 3, k * 3 + 3), i * 3)); return o }
  return [perm(knot), perm(sphere), perm(lattice), perm(dune)]
}

/**
 * Hard white hairlines on black, pushed up by a field of ridges, with the lines parting
 * around one vivid point. The only colour on the page lives in that point and in the lines closest to it.
 */
export function LineImage({ focus = [0.66, 0.5], still = false, className = '' }: { focus?: [number, number]; still?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const target = useRef({ x: focus[0], y: focus[1] })
  const mouse = useRef({ x: 0, y: 0, in: false })
  const morph = useRef({ from: 0, to: 0, t: 1 })
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    let w = 0, h = 0, raf = 0, last = 0, lastMorph = 0
    const cur = { x: focus[0], y: focus[1] }
    const shapes = makeShapes()
    const delay = Float32Array.from({ length: N }, (_, i) => mulberry(i + 3)())
    const rot = { y: 0.6, x: 0.35, ty: 0.6, tx: 0.35 }
    const offs = new Float32Array(N * 2)
    const resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1)
      w = c.clientWidth; h = c.clientHeight
      c.width = w * dpr; c.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const draw = (now: number) => {
      const t = now / 1000
      const fx = cur.x * w, fy = cur.y * h
      const R = Math.min(w, h) * 0.135
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
      // the point: a cloud of dots that turns with your pointer, parts around your cursor, and melts between shapes
      ctx.fillStyle = '#000'
      ctx.beginPath(); ctx.arc(fx, fy, R * 1.75, 0, Math.PI * 2); ctx.fill()
      const m = morph.current
      if (m.t < 1) m.t = Math.min(1, m.t + 1 / 70)
      if (m.t >= 1 && m.from !== m.to) m.from = m.to
      if (!still && m.t >= 1 && now - lastMorph > 6000) { lastMorph = now; m.to = (m.to + 1) % shapes.length; m.t = 0 }
      const A = shapes[m.from], B = shapes[m.to]
      rot.ty = mouse.current.in ? ((mouse.current.x - fx) / w) * 3.2 : t * 0.25
      rot.tx = mouse.current.in ? ((mouse.current.y - fy) / h) * 2.2 : 0.35
      rot.y += (rot.ty - rot.y) * 0.06; rot.x += (rot.tx - rot.x) * 0.06
      const cy = Math.cos(rot.y), sy = Math.sin(rot.y), cx = Math.cos(rot.x), sx = Math.sin(rot.x)
      const unit = R * 1.55, cam = 3.4
      const buckets: number[][] = Array.from({ length: 24 }, () => [])
      const ph = Math.floor(t * 4)
      for (let i = 0; i < N; i++) {
        const tt = Math.min(1, Math.max(0, m.t * 1.5 - delay[i] * 0.5)), e = tt * tt * (3 - 2 * tt)
        const x0 = A[i * 3] + (B[i * 3] - A[i * 3]) * e, y0 = A[i * 3 + 1] + (B[i * 3 + 1] - A[i * 3 + 1]) * e, z0 = A[i * 3 + 2] + (B[i * 3 + 2] - A[i * 3 + 2]) * e
        const x1 = x0 * cy + z0 * sy, z1 = -x0 * sy + z0 * cy
        const y2 = y0 * cx - z1 * sx, z2 = y0 * sx + z1 * cx
        const k = cam / (cam - z2)
        let px = fx + x1 * unit * k, py = fy + y2 * unit * k
        if (mouse.current.in) {
          const dx = px - mouse.current.x, dy = py - mouse.current.y, d2 = dx * dx + dy * dy
          if (d2 < 130 * 130 && d2 > 1) { const d = Math.sqrt(d2), f = (1 - d / 130) * 46; offs[i * 2] += (dx / d * f - offs[i * 2]) * 0.3; offs[i * 2 + 1] += (dy / d * f - offs[i * 2 + 1]) * 0.3 } else { offs[i * 2] *= 0.88; offs[i * 2 + 1] *= 0.88 }
        } else { offs[i * 2] *= 0.88; offs[i * 2 + 1] *= 0.88 }
        px += offs[i * 2]; py += offs[i * 2 + 1]
        const hueB = (Math.floor((Math.atan2(A[i * 3 + 2], A[i * 3]) / Math.PI + 1) * 12) + ph) % 24
        const sz = 1.1 + (z2 + 1.2) * 0.9
        buckets[hueB].push(px, py, sz)
      }
      for (let bk = 0; bk < 24; bk++) {
        const arr = buckets[bk]
        if (!arr.length) continue
        ctx.fillStyle = `hsl(${bk * 15} 100% 62%)`
        ctx.beginPath()
        for (let q = 0; q < arr.length; q += 3) ctx.rect(arr[q] - arr[q + 2] / 2, arr[q + 1] - arr[q + 2] / 2, arr[q + 2], arr[q + 2])
        ctx.fill()
      }
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
      mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top, in: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom }
      target.current = { x: Math.min(0.85, Math.max(0.15, (e.clientX - r.left) / r.width)), y: Math.min(0.75, Math.max(0.3, (e.clientY - r.top) / r.height)) }
    }
    const onClick = () => { const m = morph.current; if (m.t >= 1) { m.to = (m.to + 1) % shapes.length; m.t = 0; lastMorph = performance.now() } }
    c.addEventListener('click', onClick)
    resize()
    const ro = new ResizeObserver(() => { resize(); if (still) draw(3000) })
    ro.observe(c)
    addEventListener('pointermove', onMove, { passive: true })
    if (still) draw(3000)
    else raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('pointermove', onMove); c.removeEventListener('click', onClick) }
  }, [focus, still])
  return <canvas ref={ref} role="img" aria-label="Hairlines of white on black parting around a cloud of coloured dots that turns and changes shape. Move to rotate it, click to change its shape." className={`cursor-crosshair ${className}`} />
}
