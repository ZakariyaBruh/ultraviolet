import { clamp, cursor, drop, grid, hearts, hit, hurt, lerp, steer, type Cur, type Game } from './engine'

export const aim: Game = {
  id: 'aim', name: 'Aim', blurb: 'Pop the targets before the rings close. Bullseyes pay more.', how: 'Click or tap targets, or move with the arrows and press space.', pad: ['left', 'right', 'up', 'down', 'act'], pointer: true,
  make: (g) => {
    g.lives = 5
    const cur: Cur = { x: g.w / 2, y: g.h / 2, px: g.w / 2, py: g.h / 2 }
    let ts: { x: number; y: number; r: number; life: number; max: number; born: number }[] = []
    let rip: { x: number; y: number; t: number }[] = []
    let t = 0.3, combo = 0
    return (dt) => {
      grid(g, 32, 0)
      cursor(g, cur, dt, 320)
      t -= dt
      if (t <= 0) { t = Math.max(0.3, 0.8 - g.time * 0.007); const max = Math.max(0.75, 1.5 - g.time * 0.011); ts.push({ x: g.rnd(34, g.w - 34), y: g.rnd(48, g.h - 34), r: g.rnd(18, 30), life: max, max, born: 0 }) }
      const shoot = g.ptr.hit || g.tap.has('act')
      let hitAny = false
      for (const o of ts) {
        o.life -= dt; o.born = Math.min(1, o.born + dt * 8)
        const k = o.life / o.max, r = o.r * (0.4 + 0.6 * o.born)
        g.circ(o.x, o.y, r, g.pal.hot); g.circ(o.x, o.y, r * 0.62, g.pal.ink); g.circ(o.x, o.y, r * 0.28, g.pal.hot)
        g.ring(o.x, o.y, r + 3 + k * 10, g.pal.signal, 2)
        if (shoot && !hitAny) {
          const d = Math.hypot(cur.x - o.x, cur.y - o.y)
          if (d < r + 2) { hitAny = true; o.life = -9; const bull = d < r * 0.28; combo++; const pts = (10 + Math.round(k * 10) + (bull ? 15 : 0)) * (combo >= 8 ? 2 : 1); g.score += pts; g.pop(bull ? `bullseye +${pts}` : `+${pts}`, o.x, o.y - r - 12, bull ? g.pal.signal : g.pal.ink); g.burst(o.x, o.y, g.pal.hot, 10, 130); g.sfx(bull ? 'win' : 'pop'); rip.push({ x: o.x, y: o.y, t: 0 }) }
        }
        if (o.life <= 0 && o.life > -5) { combo = 0; hurt(g, o.x, o.y) }
      }
      if (shoot && !hitAny) { combo = 0; rip.push({ x: cur.x, y: cur.y, t: 0 }); g.sfx('blip') }
      ts = ts.filter((o) => o.life > 0)
      rip = rip.filter((r) => (r.t += dt) < 0.3)
      for (const r of rip) { g.c.globalAlpha = 1 - r.t / 0.3; g.ring(r.x, r.y, 8 + r.t * 90, g.pal.ink, 2); g.c.globalAlpha = 1 }
      g.ring(cur.x, cur.y, 11, g.pal.signal, 2); g.line(cur.x - 17, cur.y, cur.x - 6, cur.y, g.pal.signal); g.line(cur.x + 6, cur.y, cur.x + 17, cur.y, g.pal.signal); g.line(cur.x, cur.y - 17, cur.x, cur.y - 6, g.pal.signal); g.line(cur.x, cur.y + 6, cur.x, cur.y + 17, g.pal.signal)
      if (combo >= 3) g.text(`streak ${combo}`, g.w - 10, 26, g.pal.signal, 16, 'right')
      hearts(g)
    }
  },
}

export const stack: Game = {
  id: 'stack', name: 'Stack', blurb: 'Drop the slab square. Perfect drops win width back.', how: 'Tap, click or space to drop the moving slab.', pad: ['act'], pointer: true,
  make: (g) => {
    const H = 16
    let layers = [{ x: 160, w: 160 }]
    let mx = 0, dir = 1, w = 160, cam = 0, streak = 0
    let bits: { x: number; y: number; w: number; vy: number; c: string }[] = []
    const cols = [g.pal.signal, g.pal.ice, g.pal.ok, g.pal.warn, g.pal.hot]
    let n = 1
    g.lives = 0
    return (dt) => {
      grid(g, 40, 0, true)
      const sp = 140 + n * 8
      mx += dir * sp * dt
      if (mx < 0) { mx = 0; dir = 1 }
      if (mx + w > g.w) { mx = g.w - w; dir = -1 }
      if (g.tap.has('act') || g.ptr.hit) {
        const top = layers[layers.length - 1]
        let l = Math.max(mx, top.x), r = Math.min(mx + w, top.x + top.w)
        if (r - l < 3) { bits.push({ x: mx, y: 0, w, vy: 0, c: cols[n % 5] }); g.end(mx + w / 2, g.h - 40 - (n - cam) * H); g.sfx('hit'); layers.push({ x: mx, w: 0 }); return }
        if (Math.abs(mx - top.x) < 4) { l = top.x; r = top.x + Math.min(top.w + 6, 200); streak++; g.score += 10 + streak * 5; g.pop(streak > 1 ? `perfect x${streak}` : 'perfect', g.w / 2, g.h - 70 - (n - cam) * H, g.pal.signal); g.burst(g.w / 2, g.h - 40 - (n - cam) * H, g.pal.signal, 14, 140); g.sfx('win') }
        else { streak = 0; g.score += 10; g.sfx('pop'); const cut = mx < top.x ? { x: mx, w: top.x - mx } : { x: top.x + top.w, w: mx + w - (top.x + top.w) }; bits.push({ x: cut.x, y: g.h - 40 - (n - cam) * H, w: cut.w, vy: 0, c: cols[n % 5] }) }
        w = r - l; layers.push({ x: l, w }); n++
        mx = dir > 0 ? 0 : g.w - w
        if (layers.length > 14) layers = layers.slice(-14)
      }
      const targetCam = Math.max(0, n - 9)
      cam += (targetCam - cam) * Math.min(1, dt * 4)
      const yOf = (i: number) => g.h - 40 - (i - cam) * H
      const first = n - layers.length
      layers.forEach((q, i) => { const gi = first + i; g.rect(q.x, yOf(gi), q.w, H - 1, cols[gi % 5]); g.rect(q.x, yOf(gi), q.w, 4, 'rgba(255,255,255,.28)') })
      g.rect(0, yOf(0) + H, g.w, 60, g.pal.ground2)
      for (const b of bits) { b.vy += 700 * dt; b.y += b.vy * dt; g.rect(b.x, b.y, b.w, H - 1, b.c) }
      bits = bits.filter((b) => b.y < g.h + 20)
      drop(g, mx, yOf(n), w, H - 1, 1)
      g.rect(mx, yOf(n), w, H - 1, g.pal.ink); g.rect(mx, yOf(n), w, 4, 'rgba(255,255,255,.5)')
      g.text(`${n - 1} floors`, g.w - 10, 26, g.pal.ink2, 13, 'right')
    }
  },
}

export const cross: Game = {
  id: 'cross', name: 'Crossing', blurb: 'Dodge the traffic, ride the logs, reach the far bank.', how: 'One hop per press: arrow keys or the pad. Logs carry you.', pad: ['left', 'up', 'down', 'right'], pointer: true,
  make: (g) => {
    const rows = 9, top = 22, ch = (g.h - top) / rows
    let gx = 240, gy = 8, best = 8, hop = 0
    let dead = 0
    // 0 goal, 1-3 river, 4 bank, 5-7 road, 8 start
    interface Lane { y: number; v: number; items: { x: number; w: number }[]; kind: 'river' | 'road' }
    const lanes: Lane[] = []
    for (let i = 1; i <= 3; i++) lanes.push({ y: i, v: (i % 2 ? 1 : -1) * (36 + i * 10), kind: 'river', items: Array.from({ length: 3 }, (_, k) => ({ x: k * 170 + i * 40, w: 70 + (i % 2) * 20 })) })
    for (let i = 5; i <= 7; i++) lanes.push({ y: i, v: (i % 2 ? -1 : 1) * (55 + i * 8), kind: 'road', items: Array.from({ length: 3 }, (_, k) => ({ x: k * 170 + i * 33, w: 34 + (i % 3) * 8 })) })
    const rowY = (r: number) => top + r * ch
    const reset = () => { gx = 240; gy = 8; best = 8; dead = 0.5 }
    const go = (dx: number, dy: number) => { gx = clamp(gx + dx * 30, 15, g.w - 15); gy = clamp(gy + dy, 0, 8); hop = 1; g.sfx('blip'); if (gy < best) { best = gy; g.score += 10 } if (gy === 0) { g.score += 100; g.pop('home +100', gx, rowY(0)); g.sfx('win'); g.burst(gx, rowY(0) + 10, g.pal.ok, 16, 140); reset() } }
    return (dt) => {
      dead = Math.max(0, dead - dt); hop = Math.max(0, hop - dt * 8)
      g.rect(0, rowY(0), g.w, ch, g.pal.ok); g.rect(0, rowY(4), g.w, ch, '#38a06a'); g.rect(0, rowY(8), g.w, ch, g.pal.ok)
      g.rect(0, rowY(1), g.w, ch * 3, '#1c3d6e')
      g.rect(0, rowY(5), g.w, ch * 3, '#2a2a36')
      for (let r = 5; r < 7; r++) for (let x = 0; x < g.w; x += 40) g.rect(x, rowY(r + 1) - 1, 22, 2, g.pal.ink2)
      if (!dead) {
        if (g.tap.has('left')) go(-1, 0); if (g.tap.has('right')) go(1, 0); if (g.tap.has('up')) go(0, -1); if (g.tap.has('down')) go(0, 1)
      }
      let onLog = false
      for (const l of lanes) {
        const sp = l.v * (1 + g.time / 90)
        for (const it of l.items) {
          it.x += sp * dt
          if (it.x > g.w + 20) it.x = -it.w - 20
          if (it.x < -it.w - 20) it.x = g.w + 20
          const y = rowY(l.y)
          if (l.kind === 'river') {
            drop(g, it.x, y + 4, it.w, ch - 8, 6); g.rrect(it.x, y + 4, it.w, ch - 8, 6, '#8a5a2e'); g.rect(it.x + 6, y + 8, it.w - 12, 3, 'rgba(255,255,255,.2)')
            if (gy === l.y && gx > it.x - 4 && gx < it.x + it.w + 4 && !dead) { onLog = true; gx += sp * dt }
          } else {
            const c = sp > 0 ? g.pal.hot : g.pal.warn
            drop(g, it.x, y + 6, it.w, ch - 12, 5); g.rrect(it.x, y + 6, it.w, ch - 12, 5, c); g.rect(it.x + (sp > 0 ? it.w - 12 : 4), y + 9, 8, ch - 18, 'rgba(20,20,40,.7)')
            if (gy === l.y && !dead && hit(gx - 9, rowY(gy) + 6, 18, ch - 12, it.x, y + 6, it.w, ch - 12)) { hurt(g, gx, rowY(gy) + ch / 2); reset() }
          }
        }
      }
      if (!dead && gy >= 1 && gy <= 3 && (!onLog || gx < 0 || gx > g.w)) { g.burst(gx, rowY(gy) + ch / 2, g.pal.ice, 12, 100); hurt(g, gx, rowY(gy) + ch / 2); reset() }
      const py = rowY(gy) + ch / 2 - hop * 6
      if (!dead || Math.floor(dead * 12) % 2) { drop(g, gx - 9, py - 8, 18, 16, 6); g.rrect(gx - 9, py - 8, 18, 16, 6, g.pal.signal); g.circ(gx - 4, py - 5, 2.5, g.pal.bg); g.circ(gx + 4, py - 5, 2.5, g.pal.bg) }
      hearts(g)
    }
  },
}

export const tunnel: Game = {
  id: 'tunnel', name: 'Tunnel', blurb: 'Hold your line down a closing cave. Collect the crystals.', how: 'Left and right, or drag.', pad: ['left', 'right'], pointer: true,
  make: (g) => {
    const STEP = 8
    let mid = g.w / 2, gap = 230, drift = 0, acc = 0, x = g.w / 2, tilt = 0
    const rows: { m: number; gp: number; gem: boolean }[] = Array.from({ length: Math.ceil(g.h / STEP) + 3 }, () => ({ m: mid, gp: gap, gem: false }))
    g.lives = 0
    return (dt) => {
      const px = x
      x = clamp(steer(g, x, 250, dt), 8, g.w - 8)
      tilt = lerp(tilt, clamp((x - px) * 0.5, -0.5, 0.5), Math.min(1, dt * 12))
      acc += dt * (120 + g.time * 2.4)
      while (acc >= STEP) { acc -= STEP; drift = clamp(drift + g.rnd(-0.9, 0.9), -3.2, 3.2); mid = clamp(mid + drift, gap / 2 + 8, g.w - gap / 2 - 8); gap = Math.max(92, gap - 0.05); rows.unshift({ m: mid, gp: gap, gem: Math.random() < 0.012 }); rows.pop() }
      g.c.beginPath(); g.c.moveTo(0, 0)
      rows.forEach((r, i) => g.c.lineTo(r.m - r.gp / 2, i * STEP - STEP + acc)); g.c.lineTo(0, g.h + 20); g.c.closePath()
      g.c.fillStyle = g.pal.ink; g.c.globalAlpha = 0.1; g.c.fill(); g.c.globalAlpha = 1
      g.c.beginPath(); g.c.moveTo(g.w, 0)
      rows.forEach((r, i) => g.c.lineTo(r.m + r.gp / 2, i * STEP - STEP + acc)); g.c.lineTo(g.w, g.h + 20); g.c.closePath(); g.c.globalAlpha = 0.1; g.c.fill(); g.c.globalAlpha = 1
      g.c.strokeStyle = g.pal.ice; g.c.lineWidth = 2; g.c.beginPath(); rows.forEach((r, i) => { const y = i * STEP - STEP + acc; if (i) g.c.lineTo(r.m - r.gp / 2, y); else g.c.moveTo(r.m - r.gp / 2, y) }); g.c.stroke()
      g.c.beginPath(); rows.forEach((r, i) => { const y = i * STEP - STEP + acc; if (i) g.c.lineTo(r.m + r.gp / 2, y); else g.c.moveTo(r.m + r.gp / 2, y) }); g.c.stroke()
      const py = g.h - 52, ri = Math.floor((py + STEP - acc) / STEP)
      rows.forEach((r, i) => { if (r.gem) { const y = i * STEP - STEP + acc; g.tri(r.m, y - 8, r.m + 6, y, r.m, y + 8, g.pal.signal); g.tri(r.m, y - 8, r.m - 6, y, r.m, y + 8, '#fff3b0'); if (Math.hypot(r.m - x, y - py) < 14) { r.gem = false; g.score += 25; g.pop('+25', r.m, y - 16); g.sfx('coin'); g.burst(r.m, y, g.pal.signal, 8, 100) } } })
      const r = rows[ri]
      if (r && (x < r.m - r.gp / 2 + 5 || x > r.m + r.gp / 2 - 5)) { g.end(x, py); return }
      if (Math.random() < 0.6) g.burst(x, py + 14, g.pal.ice, 1, 40, 2)
      g.c.save(); g.c.translate(x, py); g.c.rotate(tilt)
      g.tri(-9, 12, 9, 12, 0, -14, g.pal.signal); g.tri(-3, 12, 3, 12, 0, 0, g.pal.bg)
      g.c.restore()
      g.score += dt * 8
    }
  },
}

export const orbit: Game = {
  id: 'orbit', name: 'Orbit', blurb: 'Circle the core on two rings and collect the sparks.', how: 'Space or tap reverses your spin. Up and down change ring.', pad: ['act', 'up', 'down'], pointer: true,
  make: (g) => {
    const cx = g.w / 2, cy = g.h / 2 + 10, R = [62, 112]
    let a = 0, dir = 1, ring = 1, rr = R[1], t = 0.8, tt = 1
    let rocks: { x: number; y: number; vx: number; vy: number }[] = []
    let orbs: { a: number; ring: number; life: number }[] = []
    let tr: { x: number; y: number }[] = []
    g.lives = 0
    return (dt) => {
      g.stars(0, 0, 30)
      if (g.tap.has('act') || g.ptr.hit) { dir = -dir; g.sfx('blip') }
      if (g.tap.has('up')) ring = 0
      if (g.tap.has('down')) ring = 1
      rr = lerp(rr, R[ring], Math.min(1, dt * 14))
      a += dir * (1.7 + g.time * 0.012) * dt
      t -= dt; tt -= dt
      if (t <= 0) { t = Math.max(0.3, 0.95 - g.time * 0.009); const s = Math.random() * 7; const x = cx + Math.cos(s) * 290, y = cy + Math.sin(s) * 230; const m = Math.hypot(cx - x, cy - y); const sp = g.rnd(110, 150); rocks.push({ x, y, vx: ((cx - x) / m) * sp + g.rnd(-20, 20), vy: ((cy - y) / m) * sp + g.rnd(-20, 20) }) }
      if (tt <= 0) { tt = 1.3; orbs.push({ a: Math.random() * 6.28, ring: Math.random() < 0.5 ? 0 : 1, life: 4 }) }
      for (const r of R) g.ring(cx, cy, r, g.pal.ink2, 1)
      const pulse = 1 + Math.sin(g.time * 5) * 0.08
      g.circ(cx, cy, 18 * pulse, g.pal.warn); g.circ(cx, cy, 11 * pulse, g.pal.signal)
      const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr
      tr.push({ x: px, y: py }); if (tr.length > 14) tr.shift()
      for (const o of orbs) { o.life -= dt; const ox = cx + Math.cos(o.a) * R[o.ring], oy = cy + Math.sin(o.a) * R[o.ring]; g.circ(ox, oy, 6 + Math.sin(g.time * 8) , g.pal.ice); g.ring(ox, oy, 10, g.pal.ice, 1); if (Math.hypot(ox - px, oy - py) < 14) { o.life = 0; g.score += 10; g.pop('+10', ox, oy - 14, g.pal.ice); g.sfx('coin'); g.burst(ox, oy, g.pal.ice, 8, 100) } }
      orbs = orbs.filter((o) => o.life > 0)
      for (const r of rocks) { r.x += r.vx * dt; r.y += r.vy * dt; g.line(r.x, r.y, r.x - r.vx * 0.12, r.y - r.vy * 0.12, g.pal.hot, 4); g.circ(r.x, r.y, 7, g.pal.hot); if (Math.hypot(r.x - px, r.y - py) < 12) { g.end(px, py); return } if (Math.hypot(r.x - cx, r.y - cy) < 14) { r.x = 9999; g.burst(cx, cy, g.pal.warn, 6, 90) } }
      rocks = rocks.filter((r) => r.x < 9000 && r.x > -100 && r.x < 700)
      tr.forEach((q, i) => { g.c.globalAlpha = i / 20; g.circ(q.x, q.y, 2 + i * 0.25, g.pal.signal) }); g.c.globalAlpha = 1
      g.circ(px, py, 8, g.pal.signal); g.circ(px - 2, py - 2, 3, '#fff3b0')
      g.score += dt * 3
    }
  },
}
