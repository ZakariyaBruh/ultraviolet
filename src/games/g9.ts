import { clamp, drop, ease, hearts, hit, hurt, lerp, mix, type G, type Game } from './engine'

export const cross: Game = {
  id: 'cross', name: 'Crossing', blurb: 'Road, river, and five bays to fill. Mind the diving turtles.', how: 'One hop per press: arrow keys or the pad. Logs and turtles carry you.', pad: ['left', 'up', 'down', 'right'],
  make: (g) => {
    const rows = 9, top = 22, ch = (g.h - top) / rows
    const ry = (r: number) => top + r * ch
    const bays = [48, 144, 240, 336, 432]
    const filled = [false, false, false, false, false]
    type Item = { x0: number; w: number; kind: 'car' | 'bus' | 'truck' | 'sport' | 'log' | 'turtle'; c: string; ph: number }
    interface Lane { r: number; v: number; L: number; items: Item[]; river: boolean }
    const lanes: Lane[] = []
    const mkLane = (r: number, v: number, kinds: Item['kind'][], n: number, river: boolean): void => {
      const L = 560 + (n - 3) * 20, items: Item[] = []
      for (let i = 0; i < n; i++) { const kind = kinds[i % kinds.length]; const w = kind === 'log' ? 74 + (i % 2) * 22 : kind === 'turtle' ? 78 : kind === 'bus' ? 62 : kind === 'truck' ? 70 : kind === 'sport' ? 34 : 38; items.push({ x0: (L / n) * i + r * 31, w, kind, c: [g.pal.hot, g.pal.warn, g.pal.ice, g.pal.ok, g.pal.signal][(i + r) % 5], ph: Math.random() * 6 }) }
      lanes.push({ r, v, L, items, river })
    }
    mkLane(1, 38, ['log'], 4, true); mkLane(2, -34, ['turtle'], 4, true); mkLane(3, 48, ['log'], 3, true)
    mkLane(5, -44, ['truck', 'bus'], 3, false); mkLane(6, 78, ['sport', 'car'], 4, false); mkLane(7, -58, ['car', 'car', 'sport'], 4, false)
    let level = 1, spd = 1
    let fx = 240, fy = 8, tx = 240, ty = 8, hopT = 1, face = 0, best = 8, time = 28, dead = 0, deadKind: 'road' | 'water' | 'time' = 'road', buf: [number, number] | null = null, fly = { bay: -1, t: 0 }
    const reset = () => { fx = tx = 240; fy = ty = 8; hopT = 1; best = 8; time = Math.max(16, 28 - level); face = 0 }
    const posOf = (it: Item, l: Lane) => { const raw = (((it.x0 + l.v * spd * g.time) % l.L) + l.L) % l.L; return raw - it.w }
    const die = (kind: 'road' | 'water' | 'time') => {
      if (dead > 0) return
      dead = 0.9; deadKind = kind
      const x = fx, y = ry(fy) + ch / 2
      if (kind === 'road') { g.burst(x, y, g.pal.ok, 16, 160, 3); g.burst(x, y, g.pal.hot, 8, 140, 3); g.sfx('hit'); g.shake(7) }
      else { g.burst(x, y, g.pal.ice, 18, 140, 3, 'circ'); g.shockwave(x, y, g.pal.ice, 40); g.sfx('die') }
      hurt(g, x, y)
    }
    const bayAt = (x: number) => bays.findIndex((b) => Math.abs(x - b) < 24)
    g.banner('CROSSING', 'fill all five bays')
    return (dt) => {
      dead = Math.max(0, dead - dt)
      if (dead <= 0 && deadKind && fy === -1) reset()
      // scenery
      g.rect(0, ry(0), g.w, ch, mix(g.pal.ok, g.pal.bg, 0.45)); g.rect(0, ry(4), g.w, ch, mix(g.pal.ok, g.pal.bg, 0.3)); g.rect(0, ry(8), g.w, ch, mix(g.pal.ok, g.pal.bg, 0.3))
      const water = mix(g.pal.ice, '#0b1d3a', 0.62)
      g.rect(0, ry(1), g.w, ch * 3, water)
      for (let r = 1; r <= 3; r++) for (let i = 0; i < 9; i++) { const wx = (i * 61 + g.time * (r % 2 ? 14 : -11) + 480) % 480; g.c.globalAlpha = 0.18; g.rect(wx, ry(r) + 8 + (i % 3) * 9, 18, 2, g.pal.ink); g.c.globalAlpha = 1 }
      g.rect(0, ry(5), g.w, ch * 3, '#262632')
      for (const r of [5, 6]) for (let x = 0; x < g.w; x += 36) g.rect(x, ry(r + 1) - 1, 18, 2, '#e9e1b8')
      for (let i = 0; i < 24; i++) { g.rect(i * 20 + 4, ry(4) + 12 + (i % 3) * 5, 2, 2, i % 2 ? g.pal.signal : g.pal.hot) }
      // the bays along the top
      for (let i = 0; i < 5; i++) { g.rect(bays[i] - 24, ry(0) + 2, 48, ch - 2, water); g.circ(bays[i], ry(0) + ch / 2 + 2, 11, mix(g.pal.ok, '#0b1d3a', 0.2)); if (filled[i]) { g.circ(bays[i], ry(0) + ch / 2, 8, g.pal.ok); g.circ(bays[i] - 3, ry(0) + ch / 2 - 3, 2, '#111'); g.circ(bays[i] + 3, ry(0) + ch / 2 - 3, 2, '#111') } }
      if (fly.bay >= 0 && !filled[fly.bay]) { fly.t -= dt; if (fly.t <= 0) fly.bay = -1; else { const fxx = bays[fly.bay] + Math.sin(g.time * 7) * 6; g.circ(fxx, ry(0) + ch / 2 + Math.cos(g.time * 9) * 3, 3, g.pal.ink); g.rect(fxx - 6, ry(0) + ch / 2 - 4, 5, 2, g.hi); g.rect(fxx + 1, ry(0) + ch / 2 - 4, 5, 2, g.hi) } }
      else if (Math.random() < 0.003) { const free = [0, 1, 2, 3, 4].filter((i) => !filled[i]); if (free.length) fly = { bay: free[Math.floor(Math.random() * free.length)], t: 6 } }
      // input
      if (dead <= 0) {
        const want: [number, number] | null = g.tap.has('left') ? [-1, 0] : g.tap.has('right') ? [1, 0] : g.tap.has('up') ? [0, -1] : g.tap.has('down') ? [0, 1] : null
        if (want) buf = want
        if (hopT >= 1 && buf) {
          const [dx, dy] = buf; buf = null
          const nx = clamp(fx + dx * 32, 14, g.w - 14), ny = clamp(fy + dy, 0, 8)
          if (nx !== fx || ny !== fy) { tx = nx; ty = ny; hopT = 0; face = dx ? (dx > 0 ? 1 : 3) : dy < 0 ? 0 : 2; g.sfx('blip'); if (ty < best) { best = ty; g.score += 10; g.note(8 - ty) } }
        }
        time -= dt; if (time <= 0) die('time')
      }
      let riding: { v: number } | null = null
      if (dead <= 0 && hopT >= 1) {
        const l = lanes.find((q) => q.r === fy)
        if (l?.river) {
          for (const it of l.items) { const x = posOf(it, l); const sunk = it.kind === 'turtle' && Math.sin(g.time * 0.9 + it.ph) > 0.82; if (!sunk && fx > x - 4 && fx < x + it.w + 4) riding = { v: l.v * spd } }
          if (riding) { fx += riding.v * dt; tx = fx; if (fx < 4 || fx > g.w - 4) die('water') } else die('water')
        }
      }
      if (hopT < 1) {
        hopT = Math.min(1, hopT + dt / 0.1)
        if (hopT >= 1) {
          fx = tx; fy = ty
          if (fy === 0) {
            const b = bayAt(fx)
            if (b >= 0 && !filled[b]) {
              filled[b] = true; const bonus = Math.floor(time) * 2 + (fly.bay === b ? 200 : 0); g.score += 50 + bonus; g.pop(`+${50 + bonus}`, bays[b], ry(0) + 26, g.pal.signal); g.burst(bays[b], ry(0) + ch / 2, g.pal.ok, 16, 150, 3); g.shockwave(bays[b], ry(0) + ch / 2, g.pal.ok, 50); g.sfx('win'); if (fly.bay === b) fly.bay = -1
              if (filled.every(Boolean)) { filled.fill(false); level++; spd *= 1.13; g.score += 200; g.banner(`LEVEL ${level}`, 'faster traffic'); g.flash(g.pal.signal, 0.25); g.sfx('win') }
              reset()
            } else die('water')
          }
        }
      }
      // traffic and logs
      for (const l of lanes) for (const it of l.items) {
        const x = posOf(it, l), y = ry(l.r), dir = l.v > 0 ? 1 : -1
        if (!l.river) {
          const h = ch - 10, yy = y + 5
          drop(g, x, yy, it.w, h, 5)
          if (it.kind === 'bus' || it.kind === 'truck') { g.rrect(x, yy, it.w, h, 4, it.kind === 'bus' ? g.pal.warn : g.pal.ink); g.rrect(dir > 0 ? x + it.w - 16 : x, yy, 16, h, 4, g.pal.hot); for (let k = 0; k < 3; k++) g.rect(x + 6 + k * 14 + (dir < 0 ? 14 : 0), yy + 4, 9, 6, '#1a2234') }
          else { g.rrect(x, yy, it.w, h, 6, it.c); g.rect(x + (dir > 0 ? it.w * 0.45 : it.w * 0.2), yy + 3, it.w * 0.35, h - 6, '#1a2234'); g.rect(x + 3, yy + 2, it.w - 6, 2, g.hi) }
          g.circ(x + 8, yy + h, 4, '#111'); g.circ(x + it.w - 8, yy + h, 4, '#111'); g.rect(dir > 0 ? x + it.w - 3 : x, yy + 4, 3, 4, g.pal.signal); g.rect(dir > 0 ? x + it.w - 3 : x, yy + h - 8, 3, 4, g.pal.signal)
          if (dead <= 0 && (hopT >= 0.5 ? ty : fy) === l.r && hit(fx - 9, y + 8, 18, ch - 16, x + 2, yy, it.w - 4, h)) die('road')
        } else if (it.kind === 'log') {
          drop(g, x, y + 5, it.w, ch - 10, 8); g.rrect(x, y + 5, it.w, ch - 10, 8, '#8a5a2e'); g.rect(x + 8, y + 9, it.w - 16, 3, g.hi); g.circ(x + 8, y + ch / 2, 5, '#6a421d'); g.circ(x + it.w - 8, y + ch / 2, 5, '#6a421d'); g.ring(x + 8, y + ch / 2, 2.5, '#8a5a2e', 1)
        } else {
          const s = Math.sin(g.time * 0.9 + it.ph), sunk = s > 0.82, dip = s > 0.6
          g.c.globalAlpha = sunk ? 0.2 : dip ? 0.55 : 1
          for (let k = 0; k < 3; k++) { const cx = x + 13 + k * 26; g.circ(cx, y + ch / 2 + 2, 11, g.pal.ok); g.circ(cx - 2, y + ch / 2, 6, mix(g.pal.ok, '#000000', 0.25)); g.circ(cx + dir * 11, y + ch / 2 + 2, 4, mix(g.pal.ok, g.pal.signal, 0.4)) }
          g.c.globalAlpha = 1
          if (dip && !sunk) g.ring(x + it.w / 2, y + ch / 2, 20, g.pal.ink, 1)
        }
      }
      // the frog
      if (dead <= 0 || Math.floor(dead * 14) % 2 === 0) {
        if (dead <= 0) {
          const k = ease(hopT)
          const px = lerp(fx, tx, k), py = lerp(ry(fy), ry(ty), k) + ch / 2, arc = Math.sin(hopT * Math.PI) * 9
          g.c.save(); g.c.translate(px, py - arc); g.c.rotate(face * (Math.PI / 2)); const sq = 1 + Math.sin(hopT * Math.PI) * 0.22
          g.c.scale(1 / sq, sq)
          g.c.globalAlpha = 0.35; g.circ(0, arc + 2, 8, '#000'); g.c.globalAlpha = 1
          g.rrect(-8, -9, 16, 18, 7, g.pal.ok); g.rrect(-12, 3, 6, 6, 3, mix(g.pal.ok, '#000', 0.2)); g.rrect(6, 3, 6, 6, 3, mix(g.pal.ok, '#000', 0.2)); g.rrect(-12, -9, 6, 6, 3, mix(g.pal.ok, '#000', 0.2)); g.rrect(6, -9, 6, 6, 3, mix(g.pal.ok, '#000', 0.2))
          g.circ(-4, -6, 3, '#fff'); g.circ(4, -6, 3, '#fff'); g.circ(-4, -7, 1.4, '#111'); g.circ(4, -7, 1.4, '#111'); g.rect(-4, 0, 8, 1.5, g.lo)
          g.c.restore()
        } else if (deadKind === 'road') { g.rrect(fx - 11, ry(fy) + 8, 22, 15, 6, g.pal.ok); g.rect(fx - 7, ry(fy) + 12, 14, 2, g.lo); g.circ(fx - 4, ry(fy) + 17, 2, '#111'); g.circ(fx + 4, ry(fy) + 17, 2, '#111') }
      }
      if (dead > 0 && dead < 0.05) { fy = -1 }
      // timer
      const tf = clamp(time / Math.max(16, 28 - level), 0, 1)
      g.rect(0, top - 3, g.w, 3, g.lo); g.rect(0, top - 3, g.w * tf, 3, tf < 0.25 ? g.pal.hot : g.pal.ok)
      g.intensity = clamp(0.3 + level * 0.1 + filled.filter(Boolean).length * 0.08, 0, 1)
      g.text(`level ${level}`, g.w - 10, 26, g.pal.ink2, 13, 'right')
      hearts(g)
    }
  },
}

export const orbit: Game = {
  id: 'orbit', name: 'Orbit', blurb: 'Two rings, one satellite. Dodge comets, ride the storms.', how: 'Space or tap reverses your spin. Up and down change ring.', pad: ['act', 'up', 'down'], pointer: true,
  make: (g: G) => {
    const cx = g.w / 2, cy = g.h / 2 + 10, R = [64, 116]
    let a = 0, dir = 1, ring = 1, rr = R[1], t = 0.8, tt = 1, pt = 9, shield = 0, slowT = 0, chain = 0, chainT = 0, storm = 0, nextStorm = 22
    let rocks: { x: number; y: number; vx: number; vy: number; w: number }[] = []
    let warn: { x: number; y: number; a: number; t: number; vx: number; vy: number }[] = []
    let orbs: { a: number; ring: number; life: number }[] = []
    let ups: { a: number; ring: number; k: 'S' | 'T'; life: number }[] = []
    let tr: { x: number; y: number }[] = []
    const stars = Array.from({ length: 70 }, () => ({ a: Math.random() * 6.28, r: g.rnd(20, 330), z: g.rnd(0.3, 1) }))
    g.banner('ORBIT', 'two rings, one satellite')
    const pos = (ringI: number, ang: number) => [cx + Math.cos(ang) * R[ringI], cy + Math.sin(ang) * R[ringI]] as const
    return (dt) => {
      const sl = slowT > 0 ? 0.45 : 1
      for (const s of stars) { s.a += dt * 0.02 * s.z; g.c.globalAlpha = 0.15 + s.z * 0.3; g.rect(cx + Math.cos(s.a) * s.r, cy + Math.sin(s.a) * s.r, s.z > 0.7 ? 2 : 1, s.z > 0.7 ? 2 : 1, g.pal.ink) }
      g.c.globalAlpha = 1
      if (g.tap.has('act') || g.ptr.hit) { dir = -dir; g.sfx('blip'); g.shockwave(...pos(ring, a), g.pal.signal, 24) }
      if (g.tap.has('up') && ring !== 0) { ring = 0; g.sfx('jump') }
      if (g.tap.has('down') && ring !== 1) { ring = 1; g.sfx('jump') }
      rr = lerp(rr, R[ring], Math.min(1, dt * 14))
      a += dir * (1.7 + g.time * 0.012) * dt
      shield = Math.max(0, shield - dt); slowT = Math.max(0, slowT - dt); chainT -= dt; if (chainT <= 0) { chain = 0; g.mult = 1 }; storm = Math.max(0, storm - dt)
      if (g.time > nextStorm) { storm = 8; nextStorm += 24; g.banner('STORM', 'comets incoming'); g.flash(g.pal.hot, 0.2); g.sfx('boom') }
      t -= dt; tt -= dt; pt -= dt
      if (t <= 0) { t = Math.max(0.3, (0.95 - g.time * 0.009) * (storm > 0 ? 0.45 : 1)); const s = Math.random() * 6.28, sx = cx + Math.cos(s) * 300, sy = cy + Math.sin(s) * 250, m = Math.hypot(cx - sx, cy - sy), sp = g.rnd(110, 150); warn.push({ x: clamp(sx, 8, g.w - 8), y: clamp(sy, 28, g.h - 8), a: s, t: 0.8, vx: ((cx - sx) / m) * sp + g.rnd(-20, 20), vy: ((cy - sy) / m) * sp + g.rnd(-20, 20) }); }
      if (tt <= 0) { tt = 1.2; orbs.push({ a: Math.random() * 6.28, ring: Math.random() < 0.5 ? 0 : 1, life: 4.5 }) }
      if (pt <= 0) { pt = g.rnd(11, 16); ups.push({ a: Math.random() * 6.28, ring: Math.random() < 0.5 ? 0 : 1, k: Math.random() < 0.5 ? 'S' : 'T', life: 7 }) }
      // rings and core
      for (const r of R) { g.ring(cx, cy, r, g.pal.ink2, 1); for (let k = 0; k < 36; k++) { const an = (k / 36) * 6.28 + g.time * 0.1; g.rect(cx + Math.cos(an) * r - 0.5, cy + Math.sin(an) * r - 0.5, 1.5, 1.5, g.pal.ink2) } }
      const pulse = 1 + Math.sin(g.time * 5) * 0.08
      for (let k = 0; k < 10; k++) { const an = (k / 10) * 6.28 + g.time * 0.6; g.tri(cx + Math.cos(an - 0.12) * 20, cy + Math.sin(an - 0.12) * 20, cx + Math.cos(an + 0.12) * 20, cy + Math.sin(an + 0.12) * 20, cx + Math.cos(an) * (30 + Math.sin(g.time * 4 + k) * 3), cy + Math.sin(an) * (30 + Math.sin(g.time * 4 + k) * 3), g.pal.warn) }
      g.circ(cx, cy, 20 * pulse, g.pal.warn); g.circ(cx, cy, 13 * pulse, g.pal.signal); g.circ(cx - 4, cy - 4, 4, g.hi)
      const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr
      tr.push({ x: px, y: py }); if (tr.length > 18) tr.shift()
      for (const w of warn) {
        w.t -= dt
        if (Math.floor(w.t * 12) % 2 === 0) { g.tri(w.x - Math.cos(w.a) * 14 + Math.sin(w.a) * 7, w.y - Math.sin(w.a) * 14 - Math.cos(w.a) * 7, w.x - Math.cos(w.a) * 14 - Math.sin(w.a) * 7, w.y - Math.sin(w.a) * 14 + Math.cos(w.a) * 7, w.x - Math.cos(w.a) * 2, w.y - Math.sin(w.a) * 2, g.pal.hot) }
        if (w.t <= 0) { rocks.push({ x: cx + Math.cos(w.a) * 300, y: cy + Math.sin(w.a) * 250, vx: w.vx, vy: w.vy, w: g.rnd(-6, 6) }); w.t = -1 }
      }
      warn = warn.filter((w) => w.t > 0)
      for (const o of orbs) { o.life -= dt; const [ox, oy] = pos(o.ring, o.a); const f = o.life < 1.2 && Math.floor(g.time * 10) % 2; if (!f) { g.circ(ox, oy, 6 + Math.sin(g.time * 8), g.pal.ice); g.ring(ox, oy, 11 + Math.sin(g.time * 5), g.pal.ice, 1) } if (Math.hypot(ox - px, oy - py) < 15) { o.life = 0; chain++; chainT = 2.5; g.mult = 1 + Math.min(4, Math.floor(chain / 3)); const pts = 10 * g.mult; g.score += pts; g.pop(`+${pts}`, ox, oy - 14, g.pal.ice); g.sfx('coin'); g.note((chain % 8) * 2); g.burst(ox, oy, g.pal.ice, 8, 110, 3, 'circ'); g.shockwave(ox, oy, g.pal.ice, 26) } }
      orbs = orbs.filter((o) => o.life > 0)
      for (const u of ups) { u.life -= dt; const [ox, oy] = pos(u.ring, u.a), col = u.k === 'S' ? g.pal.ok : g.pal.signal; g.c.save(); g.c.translate(ox, oy); g.c.rotate(g.time * 2); g.rrect(-8, -8, 16, 16, 4, col); g.c.restore(); g.text(u.k, ox, oy - 7, g.pal.bg, 13, 'center'); if (Math.hypot(ox - px, oy - py) < 17) { u.life = 0; g.sfx('win'); g.burst(ox, oy, col, 12, 130); if (u.k === 'S') { shield = 8; g.pop('shield', ox, oy - 16, col) } else { slowT = 6; g.pop('slow time', ox, oy - 16, col) } } }
      ups = ups.filter((u) => u.life > 0)
      for (const r of rocks) {
        r.x += r.vx * dt * sl; r.y += r.vy * dt * sl
        g.line(r.x, r.y, r.x - r.vx * 0.2, r.y - r.vy * 0.2, g.pal.hot, 6); g.line(r.x, r.y, r.x - r.vx * 0.35, r.y - r.vy * 0.35, g.pal.warn, 2)
        g.circ(r.x, r.y, 8, mix(g.pal.hot, g.pal.ink, 0.15)); g.circ(r.x - 2, r.y - 2, 2.5, g.hi)
        if (Math.hypot(r.x - px, r.y - py) < 13) { r.x = 9999; if (shield > 0) { shield = 0; g.shockwave(px, py, g.pal.ok, 50); g.sfx('hit'); g.shake(4) } else { g.end(px, py); return } }
        if (Math.hypot(r.x - cx, r.y - cy) < 16) { r.x = 9999; g.burst(cx, cy, g.pal.warn, 8, 110); g.shockwave(cx, cy, g.pal.warn, 40); g.sfx('blip') }
      }
      rocks = rocks.filter((r) => r.x < 9000 && r.x > -120 && r.x < 600)
      // the satellite and its tail
      tr.forEach((q, i) => { g.c.globalAlpha = (i / tr.length) * 0.6; g.circ(q.x, q.y, 1.5 + (i / tr.length) * 5, slowT > 0 ? g.pal.signal : g.pal.ink) }); g.c.globalAlpha = 1
      if (shield > 0) { const al = shield < 2 && Math.floor(g.time * 8) % 2 ? 0.3 : 1; g.c.globalAlpha = al; g.ring(px, py, 15 + Math.sin(g.time * 9), g.pal.ok, 2); g.c.globalAlpha = 1 }
      g.circ(px, py + 2, 8, g.lo); g.circ(px, py, 8, g.pal.signal); g.circ(px - 2.5, py - 2.5, 3, g.hi)
      g.line(px - Math.sin(a) * 12, py + Math.cos(a) * 12, px + Math.sin(a) * 12, py - Math.cos(a) * 12, g.pal.ink2, 2)
      g.intensity = clamp(0.3 + g.time / 100 + (storm > 0 ? 0.35 : 0), 0, 1)
      if (slowT > 0) g.text(`slow ${Math.ceil(slowT)}`, g.w - 10, 26, g.pal.signal, 13, 'right')
      g.score += dt * 2
    }
  },
}
