import { clamp, hearts, hit, hurt, steer, type Game } from './engine'

export const aim: Game = {
  id: 'aim', name: 'Aim', blurb: 'Pop the targets as they shrink.', how: 'Tap or click each target before it vanishes.', pad: [], pointer: true,
  make: (g) => {
    g.lives = 5
    let ts: { x: number; y: number; r: number; life: number; max: number }[] = []
    let t = 0.3
    return (dt) => {
      t -= dt
      if (t <= 0) { t = Math.max(0.35, 0.8 - g.time * 0.007); const max = Math.max(0.7, 1.4 - g.time * 0.01); ts.push({ x: g.rnd(30, g.w - 30), y: g.rnd(40, g.h - 30), r: g.rnd(18, 30), life: max, max }) }
      for (const o of ts) {
        o.life -= dt
        const k = o.life / o.max
        g.circ(o.x, o.y, o.r, g.pal.hot); g.circ(o.x, o.y, o.r * 0.66 * k + 2, g.pal.ink); g.circ(o.x, o.y, o.r * 0.25, g.pal.hot)
        if (g.ptr.hit && Math.hypot(g.ptr.x - o.x, g.ptr.y - o.y) < o.r) { o.life = -9; g.score += 10 + Math.round(k * 10) }
        else if (o.life <= 0) hurt(g)
      }
      ts = ts.filter((o) => o.life > 0)
      hearts(g)
    }
  },
}

export const stack: Game = {
  id: 'stack', name: 'Stack', blurb: 'Drop the slab, keep it square.', how: 'Tap, click or space to drop the moving slab.', pad: ['act'], pointer: true,
  make: (g) => {
    const H = 16
    let layers = [{ x: 170, w: 140 }]
    let mx = 0, dir = 1, w = 140
    return (dt) => {
      const sp = 130 + layers.length * 9
      mx += dir * sp * dt
      if (mx < 0 || mx + w > g.w) { dir = -dir; mx = clamp(mx, 0, g.w - w) }
      if (g.tap.has('act') || g.ptr.hit) {
        const top = layers[layers.length - 1]
        const l = Math.max(mx, top.x), r = Math.min(mx + w, top.x + top.w)
        if (r - l < 3) { g.end() } else { w = r - l; layers.push({ x: l, w }); g.score += 10; mx = dir > 0 ? 0 : g.w - w }
        if (layers.length > 12) layers = layers.slice(-12)
      }
      const base = g.h - 20
      layers.forEach((q, i) => g.rect(q.x, base - (layers.length - i) * H, q.w, H - 2, i % 2 ? g.pal.ice : g.pal.signal))
      g.rect(mx, base - (layers.length + 1) * H, w, H - 2, g.pal.ink)
    }
  },
}

export const cross: Game = {
  id: 'cross', name: 'Crossing', blurb: 'Get to the other side, again.', how: 'One step per press. Arrow keys or the pad.', pad: ['left', 'up', 'down', 'right'],
  make: (g) => {
    const rows = 8, ch = (g.h - 20) / (rows + 1)
    let gx = 12, gy = rows
    const lanes = Array.from({ length: rows - 1 }, (_, i) => ({ y: i + 1, v: (i % 2 ? 1 : -1) * (50 + i * 14), cars: Array.from({ length: 3 }, (_, k) => ({ x: k * 170 + Math.random() * 60, w: 36 + Math.random() * 20 })) }))
    return (dt) => {
      if (g.tap.has('left')) gx = Math.max(0, gx - 1)
      if (g.tap.has('right')) gx = Math.min(23, gx + 1)
      if (g.tap.has('up')) { gy -= 1; if (gy <= 0) { g.score += 50; gy = rows } }
      if (g.tap.has('down')) gy = Math.min(rows, gy + 1)
      const px = gx * 20 + 2, py = 20 + gy * ch + 3
      g.rect(0, 20, g.w, ch, g.pal.ok); g.rect(0, 20 + rows * ch, g.w, ch, g.pal.ok)
      for (const l of lanes) {
        g.rect(0, 20 + l.y * ch + ch - 1, g.w, 1, g.pal.ink2)
        for (const c of l.cars) {
          c.x += l.v * dt * (1 + g.time / 60)
          if (c.x > g.w + 20) c.x = -c.w - 10
          if (c.x < -c.w - 20) c.x = g.w + 10
          g.rect(c.x, 20 + l.y * ch + 4, c.w, ch - 8, l.v > 0 ? g.pal.hot : g.pal.warn)
          if (hit(px, py, 16, ch - 8, c.x, 20 + l.y * ch + 4, c.w, ch - 8)) { hurt(g); gy = rows; gx = 12 }
        }
      }
      g.rect(px, py, 16, ch - 8, g.pal.signal)
      hearts(g)
    }
  },
}

export const tunnel: Game = {
  id: 'tunnel', name: 'Tunnel', blurb: 'Hold your line down a closing cave.', how: 'Left and right, or drag.', pad: ['left', 'right'], pointer: true,
  make: (g) => {
    let mid = g.w / 2, gap = 220
    const rows: { m: number; gp: number }[] = Array.from({ length: g.h / 8 + 2 }, () => ({ m: mid, gp: gap }))
    let acc = 0, x = g.w / 2, drift = 0
    return (dt) => {
      x = clamp(steer(g, x, 240, dt), 6, g.w - 6)
      acc += dt * (110 + g.time * 2)
      while (acc >= 8) { acc -= 8; drift = clamp(drift + g.rnd(-0.8, 0.8), -3, 3); mid = clamp(mid + drift, gap / 2 + 6, g.w - gap / 2 - 6); gap = Math.max(96, gap - 0.04); rows.unshift({ m: mid, gp: gap }); rows.pop() }
      rows.forEach((r, i) => { const y = i * 8 - 8 + acc; g.rect(0, y, r.m - r.gp / 2, 9, g.pal.ink2); g.rect(r.m + r.gp / 2, y, g.w, 9, g.pal.ink2) })
      const r = rows[Math.floor((g.h - 40) / 8)]
      if (x < r.m - r.gp / 2 + 5 || x > r.m + r.gp / 2 - 5) g.end()
      g.rect(x - 6, g.h - 46, 12, 18, g.pal.signal)
      g.score = g.time * 10
    }
  },
}

export const orbit: Game = {
  id: 'orbit', name: 'Orbit', blurb: 'Circle the core, collect the sparks.', how: 'Tap, click or space to reverse your spin.', pad: ['act'], pointer: true,
  make: (g) => {
    const cx = g.w / 2, cy = g.h / 2 + 8, R = 100
    let a = 0, dir = 1, t = 0, tt = 1
    let rocks: { x: number; y: number; vx: number; vy: number }[] = []
    let orbs: { a: number; life: number }[] = []
    return (dt) => {
      if (g.tap.has('act') || g.ptr.hit) dir = -dir
      a += dir * (1.8 + g.time * 0.01) * dt
      t -= dt; tt -= dt
      if (t <= 0) { t = Math.max(0.35, 1 - g.time * 0.01); const s = Math.random() * 7; const x = cx + Math.cos(s) * 280, y = cy + Math.sin(s) * 220; const m = Math.hypot(cx - x, cy - y); rocks.push({ x, y, vx: ((cx - x) / m) * 120 + g.rnd(-20, 20), vy: ((cy - y) / m) * 120 + g.rnd(-20, 20) }) }
      if (tt <= 0) { tt = 1.6; orbs.push({ a: Math.random() * 6.28, life: 4 }) }
      g.c.strokeStyle = g.pal.ink2; g.c.lineWidth = 1; g.c.beginPath(); g.c.arc(cx, cy, R, 0, 7); g.c.stroke()
      g.circ(cx, cy, 14, g.pal.warn)
      const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R
      for (const o of orbs) { o.life -= dt; const ox = cx + Math.cos(o.a) * R, oy = cy + Math.sin(o.a) * R; g.circ(ox, oy, 6, g.pal.ice); if (Math.hypot(ox - px, oy - py) < 14) { o.life = 0; g.score += 10 } }
      orbs = orbs.filter((o) => o.life > 0)
      for (const r of rocks) { r.x += r.vx * dt; r.y += r.vy * dt; g.circ(r.x, r.y, 7, g.pal.hot); if (Math.hypot(r.x - px, r.y - py) < 12) g.end(); if (Math.hypot(r.x - cx, r.y - cy) < 10) r.x = 9999 }
      rocks = rocks.filter((r) => r.x < 9000 && r.x > -100 && r.x < 700)
      g.circ(px, py, 8, g.pal.signal)
    }
  },
}
