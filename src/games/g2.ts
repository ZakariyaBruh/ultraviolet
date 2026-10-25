import { clamp, drop, hearts, hit, hurt, steer, type G, type Game } from './engine'

const flapped = (g: G) => g.tap.has('act') || g.tap.has('up') || g.ptr.hit

export const flap: Game = {
  id: 'flap', name: 'Flap', blurb: 'Thread the pipes. Every one is a point.', how: 'Tap, click or space to flap.', pad: ['act'], pointer: true,
  make: (g) => {
    let y = 150, v = 0, t = 0.6, ground = 0, wing = 0
    let ps: { x: number; gap: number; got: boolean }[] = []
    const clouds = Array.from({ length: 5 }, () => ({ x: Math.random() * g.w, y: g.rnd(30, 150), s: g.rnd(0.6, 1.3) }))
    g.lives = 0
    return (dt) => {
      const sp = 125 + g.time * 1.4
      g.c.globalAlpha = 0.08
      for (const c of clouds) { c.x -= sp * 0.2 * c.s * dt; if (c.x < -60) c.x = g.w + 40; g.circ(c.x, c.y, 18 * c.s, g.pal.ink); g.circ(c.x + 16 * c.s, c.y + 4, 14 * c.s, g.pal.ink); g.circ(c.x - 16 * c.s, c.y + 5, 12 * c.s, g.pal.ink) }
      g.c.globalAlpha = 1
      if (flapped(g)) { v = -255; wing = 1; g.sfx('jump') }
      v += 830 * dt; y += v * dt; wing = Math.max(0, wing - dt * 5)
      t -= dt
      const gh = Math.max(96, 126 - g.time * 0.5)
      if (t <= 0) { t = 1.45 - Math.min(0.3, g.time * 0.005); ps.push({ x: g.w + 20, gap: g.rnd(54, g.h - 54 - gh - 22), got: false }) }
      const floor = g.h - 22
      for (const p of ps) {
        p.x -= sp * dt
        for (const [y0, y1] of [[-10, p.gap], [p.gap + gh, floor]] as const) {
          g.rect(p.x + 3, y0, 40, y1 - y0, g.pal.ok); g.rect(p.x + 8, y0, 6, y1 - y0, 'rgba(255,255,255,.22)')
          const cy = y0 < 0 ? y1 - 16 : y0
          g.rrect(p.x - 2, cy, 50, 16, 3, '#38c777'); g.rect(p.x + 4, cy + 3, 6, 10, 'rgba(255,255,255,.22)')
        }
        if (hit(80, y - 8, 18, 16, p.x, -10, 46, p.gap) || hit(80, y - 8, 18, 16, p.x, p.gap + gh, 46, g.h)) { g.end(89, y); return }
        if (!p.got && p.x + 46 < 80) { p.got = true; g.score += 10; g.sfx('coin'); g.pop('+10', 89, y - 24) }
      }
      ps = ps.filter((p) => p.x > -60)
      ground = (ground - sp * dt) % 24
      g.rect(0, floor, g.w, g.h - floor, '#6b4f2a'); g.rect(0, floor, g.w, 5, g.pal.ok)
      for (let x = ground; x < g.w; x += 24) g.rect(x, floor + 5, 12, 3, 'rgba(0,0,0,.25)')
      if (y < -4 || y > floor - 6) { g.end(89, clamp(y, 0, floor)); return }
      g.c.save(); g.c.translate(89, y); g.c.rotate(clamp(v / 600, -0.5, 0.9))
      drop(g, -12, -9, 24, 18, 8)
      g.rrect(-12, -9, 24, 18, 8, g.pal.signal); g.rrect(-9, wing > 0.3 ? -3 : 0, 11, 8, 4, g.pal.warn); g.circ(5, -3, 4, '#fff'); g.circ(6, -3, 2, '#111'); g.tri(11, -1, 19, 2, 11, 5, g.pal.hot)
      g.c.restore()
    }
  },
}

export const runner: Game = {
  id: 'runner', name: 'Hurdle', blurb: 'Jump the cacti, duck the birds, grab the coins.', how: 'Hold jump (space, tap, up) for height. Down ducks.', pad: ['act', 'down'], pointer: true,
  make: (g) => {
    const floor = g.h - 54
    let y = floor, v = 0, t = 1.2, ct = 2, sx = 0, run = 0
    let os: { x: number; w: number; h: number; k: 'cactus' | 'bird'; y: number }[] = []
    let cs: { x: number; y: number }[] = []
    g.lives = 0
    return (dt) => {
      const sp = 210 + g.time * 3.6
      sx = (sx - sp * 0.3 * dt) % 80
      g.c.globalAlpha = 0.07
      for (let x = sx - 80; x < g.w + 80; x += 80) { g.rect(x, floor - 40, 40, 60, g.pal.ink); g.rect(x + 46, floor - 70, 28, 90, g.pal.ink); g.rect(x + 14, floor - 58, 10, 18, g.pal.ink) }
      g.c.globalAlpha = 1
      const air = y < floor - 1
      const want = g.tap.has('act') || g.tap.has('up') || g.ptr.hit
      if (want && !air) { v = -560; g.sfx('jump'); g.burst(70, floor + 20, g.pal.ink2, 5, 60, 2) }
      if (air && v < -200 && !(g.keys.has('act') || g.keys.has('up') || g.ptr.down)) v *= 0.86
      v += 1650 * dt; y = Math.min(floor, y + v * dt)
      if (y >= floor && v > 0) v = 0
      const duck = !air && (g.keys.has('down'))
      run += dt * (sp / 28)
      t -= dt
      if (t <= 0) { t = g.rnd(0.75, 1.45) * Math.max(0.55, 1 - g.time * 0.006) * (240 / sp) * 1.5; if (Math.random() < 0.25 && g.time > 8) os.push({ x: g.w + 10, w: 30, h: 18, k: 'bird', y: floor - 26 }); else os.push({ x: g.w + 10, w: g.rnd(14, 24) * (Math.random() < 0.25 ? 2 : 1), h: g.rnd(22, 46), k: 'cactus', y: 0 }) }
      ct -= dt
      if (ct <= 0) { ct = g.rnd(2, 3.5); for (let i = 0; i < 4; i++) cs.push({ x: g.w + 10 + i * 24, y: floor - 36 - Math.sin(i / 3 * Math.PI) * 54 }) }
      g.rect(0, floor + 22, g.w, 2, g.pal.ink2)
      for (let x = (-(g.time * sp) % 40); x < g.w; x += 40) g.rect(x, floor + 30, 14, 2, g.pal.ink2)
      const bx = 62, bw = 20, bh = duck ? 22 : 40, by = y + 20 - bh
      for (const o of os) {
        o.x -= sp * dt
        if (o.k === 'cactus') {
          const oy = floor + 22 - o.h
          drop(g, o.x, oy, o.w, o.h, 4); g.rrect(o.x, oy, o.w, o.h, 4, g.pal.ok); g.rect(o.x + 3, oy + 3, 3, o.h - 6, 'rgba(255,255,255,.25)'); g.rrect(o.x - 6, oy + o.h * 0.35, 8, 4, 2, g.pal.ok); g.rrect(o.x + o.w - 2, oy + o.h * 0.2, 8, 4, 2, g.pal.ok)
          if (hit(bx + 3, by + 2, bw - 6, bh - 2, o.x, oy, o.w, o.h)) { g.end(bx + 10, by + 10); return }
        } else {
          const wing = Math.sin(g.time * 18) * 6
          g.tri(o.x, o.y + 9, o.x + 26, o.y + 5, o.x + 6, o.y + 17, g.pal.hot); g.tri(o.x + 10, o.y + 10, o.x + 22, o.y + 8 - wing, o.x + 14, o.y + 2 - wing * 2, '#c84a6a'); g.tri(o.x, o.y + 9, o.x - 8, o.y + 11, o.x, o.y + 13, g.pal.warn)
          if (hit(bx + 3, by + 2, bw - 6, bh - 2, o.x, o.y, 26, 16)) { g.end(bx + 10, by + 10); return }
        }
      }
      os = os.filter((o) => o.x > -60)
      for (const c of cs) { c.x -= sp * dt; g.circ(c.x, c.y, 6, g.pal.signal); g.circ(c.x - 1.5, c.y - 1.5, 2, '#fff3b0'); if (Math.hypot(c.x - 72, c.y - (by + bh / 2)) < 16) { c.x = -99; g.score += 10; g.sfx('coin'); g.pop('+10', 72, by - 8) } }
      cs = cs.filter((c) => c.x > -20)
      // the runner
      drop(g, bx, by, bw, bh, 5)
      g.rrect(bx, by, bw, bh - 8, 5, g.pal.signal); g.rect(bx + 12, by + 6, 3, 3, g.pal.bg)
      if (!air && !duck) { const l = Math.sin(run) * 5; g.rect(bx + 3 + l, by + bh - 8, 5, 8, g.pal.warn); g.rect(bx + 12 - l, by + bh - 8, 5, 8, g.pal.warn) } else if (!duck) { g.rect(bx + 3, by + bh - 8, 5, 6, g.pal.warn); g.rect(bx + 12, by + bh - 6, 5, 6, g.pal.warn) } else { g.rect(bx + 2, by + bh - 6, 16, 6, g.pal.warn) }
      g.score += dt * 8
    }
  },
}

const INV: string[][] = [
  ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'],
  ['00100000100', '10010001001', '10111111101', '11101110111', '11111111111', '01111111110', '00100000100', '01000000010'],
  ['00001111000', '01111111110', '11111111111', '11100110111', '11111111111', '00011011000', '00110110110', '11000000011'],
]
const spr = (g: G, rows: string[], x: number, y: number, s: number, c: string) => { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === '1') g.rect(x + i * s, y + j * s, s, s, c) }

export const invaders: Game = {
  id: 'invaders', name: 'Invaders', blurb: 'Hold the line behind your shields.', how: 'Move, fire with space or by holding down. Bonus ships fly past.', pad: ['left', 'right', 'act'], pointer: true,
  make: (g) => {
    let x = g.w / 2, cd = 0, dirx = 1, dropT = 1, wave = 0, anim = 0, ufo: { x: number; v: number } | null = null, ut = 12, inv = 0
    let es: { x: number; y: number; k: number }[] = []
    let shots: { x: number; y: number }[] = []
    let bombs: { x: number; y: number }[] = []
    let walls: { x: number; y: number; hp: number }[] = []
    const mkWalls = () => { walls = []; for (let b = 0; b < 4; b++) for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) if (!(r === 3 && c > 2 && c < 5)) walls.push({ x: 50 + b * 105 + c * 5, y: g.h - 88 + r * 5, hp: 2 }) }
    const spawn = () => { es = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) es.push({ x: 70 + c * 40, y: 44 + r * 26 + Math.min(wave, 3) * 8, k: r === 0 ? 2 : r < 3 ? 1 : 0 }); wave++; dirx = 1 }
    spawn(); mkWalls()
    return (dt) => {
      g.stars(0, 10, 40)
      x = clamp(steer(g, x, 290, dt), 16, g.w - 16)
      cd -= dt; inv -= dt; anim += dt
      if ((g.keys.has('act') || g.ptr.down) && cd <= 0 && shots.length < 3) { shots.push({ x, y: g.h - 38 }); cd = 0.3; g.sfx('shoot') }
      let edge = false
      const sp = 22 + wave * 7 + (32 - es.length) * 1.7
      for (const e of es) { e.x += dirx * sp * dt; if (e.x < 14 || e.x > g.w - 14) edge = true }
      if (edge) { dirx = -dirx; for (const e of es) { e.y += 12; e.x += dirx * 3 } }
      dropT -= dt
      if (dropT <= 0 && es.length) { dropT = Math.max(0.3, 1.1 - wave * 0.1); const e = es[Math.floor(Math.random() * es.length)]; bombs.push({ x: e.x, y: e.y + 8 }) }
      ut -= dt
      if (ut <= 0 && !ufo) { ut = g.rnd(14, 22); const d = Math.random() < 0.5; ufo = { x: d ? -20 : g.w + 20, v: d ? 90 : -90 } }
      if (ufo) { ufo.x += ufo.v * dt; g.rrect(ufo.x - 14, 28, 28, 8, 4, g.pal.hot); g.rrect(ufo.x - 7, 23, 14, 7, 4, '#c84a6a'); if (ufo.x < -30 || ufo.x > g.w + 30) ufo = null }
      for (const s of shots) {
        s.y -= 430 * dt; g.rect(s.x - 1, s.y, 3, 10, g.pal.ink)
        for (const e of es) if (e.y < 9000 && hit(s.x - 1, s.y, 3, 10, e.x - 12, e.y - 8, 24, 16)) { s.y = -99; const pts = [10, 20, 30][e.k]; g.score += pts; g.sfx('boom'); g.pop(`+${pts}`, e.x, e.y - 12); g.burst(e.x, e.y - 8, [g.pal.ok, g.pal.ice, g.pal.warn][e.k], 10, 100); e.y = 9999 }
        if (ufo && hit(s.x - 1, s.y, 3, 10, ufo.x - 14, 23, 28, 13)) { g.score += 100; g.pop('+100', ufo.x, 40, g.pal.hot); g.burst(ufo.x, 30, g.pal.hot, 18, 160); g.sfx('win'); ufo = null; s.y = -99 }
        for (const w of walls) if (w.hp > 0 && hit(s.x - 1, s.y, 3, 10, w.x, w.y, 5, 5)) { w.hp--; s.y = -99 }
      }
      es = es.filter((e) => e.y < 9000); shots = shots.filter((s) => s.y > -10)
      for (const b of bombs) {
        b.y += 150 * dt + wave * 4 * dt; g.rect(b.x - 1, b.y, 3, 10, g.pal.hot)
        for (const w of walls) if (w.hp > 0 && hit(b.x - 1, b.y, 3, 10, w.x, w.y, 5, 5)) { w.hp--; b.y = 9999 }
        if (inv <= 0 && hit(b.x - 1, b.y, 3, 10, x - 14, g.h - 32, 28, 16)) { b.y = 9999; hurt(g, x, g.h - 24); inv = 1.4 }
      }
      bombs = bombs.filter((b) => b.y < g.h)
      for (const w of walls) if (w.hp > 0) g.rect(w.x, w.y, 5, 5, w.hp > 1 ? g.pal.ok : '#2a8a58')
      const frame = Math.floor(anim * 2.2) % 2
      for (const e of es) { spr(g, INV[e.k].map((r) => (frame ? r.split('').reverse().join('') : r)), e.x - 11, e.y - 8, 2, [g.pal.ok, g.pal.ice, g.pal.warn][e.k]); if (e.y > g.h - 90) { g.end(e.x, e.y); return } }
      if (!es.length) { spawn(); mkWalls(); g.score += 50; g.pop(`wave ${wave}`, g.w / 2, 150, g.pal.signal); g.sfx('win') }
      if (inv <= 0 || Math.floor(inv * 10) % 2) { drop(g, x - 14, g.h - 30, 28, 12, 2); g.rrect(x - 14, g.h - 30, 28, 12, 2, g.pal.signal); g.rect(x - 3, g.h - 38, 6, 9, g.pal.signal); g.rect(x - 1, g.h - 41, 2, 4, g.pal.signal) }
      hearts(g)
    }
  },
}

interface Rock { x: number; y: number; vx: number; vy: number; r: number; a: number; w: number; pts: number[] }
export const asteroids: Game = {
  id: 'asteroids', name: 'Asteroids', blurb: 'Blast the rocks, mind the pieces.', how: 'Left and right turn, up thrusts, space fires.', pad: ['left', 'right', 'up', 'act'],
  make: (g) => {
    let x = g.w / 2, y = g.h / 2, vx = 0, vy = 0, a = -Math.PI / 2, cd = 0, inv = 2, wave = 0
    let rocks: Rock[] = []
    let shots: { x: number; y: number; vx: number; vy: number; life: number }[] = []
    const mk = (px: number, py: number, r: number): Rock => ({ x: px, y: py, vx: g.rnd(-45, 45) * (30 / r + 0.4), vy: g.rnd(-45, 45) * (30 / r + 0.4), r, a: g.rnd(0, 6.28), w: g.rnd(-1.2, 1.2), pts: Array.from({ length: 11 }, () => g.rnd(0.78, 1.15)) })
    const spawn = () => { wave++; for (let i = 0; i < 3 + wave; i++) { const s = Math.random() * Math.PI * 2; rocks.push(mk(g.w / 2 + Math.cos(s) * 250, g.h / 2 + Math.sin(s) * 190, 28)) } }
    spawn()
    const wrap = (o: { x: number; y: number }) => { o.x = (o.x + g.w) % g.w; o.y = (o.y + g.h) % g.h }
    return (dt) => {
      g.stars(-vx * 0.2, -vy * 0.2, 50)
      if (g.keys.has('left')) a -= 4.2 * dt
      if (g.keys.has('right')) a += 4.2 * dt
      const thrust = g.keys.has('up')
      if (thrust) { vx += Math.cos(a) * 230 * dt; vy += Math.sin(a) * 230 * dt; if (Math.random() < 0.7) g.burst(x - Math.cos(a) * 10, y - Math.sin(a) * 10, g.pal.warn, 1, 60, 2) }
      vx *= 1 - 0.35 * dt; vy *= 1 - 0.35 * dt
      x += vx * dt; y += vy * dt; const s = { x, y }; wrap(s); x = s.x; y = s.y
      cd -= dt; inv -= dt
      if (g.keys.has('act') && cd <= 0) { shots.push({ x: x + Math.cos(a) * 12, y: y + Math.sin(a) * 12, vx: Math.cos(a) * 360 + vx, vy: Math.sin(a) * 360 + vy, life: 0.95 }); cd = 0.24; g.sfx('shoot') }
      for (const sh of shots) { sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.life -= dt; wrap(sh); g.circ(sh.x, sh.y, 2.2, g.pal.ink) }
      const born: Rock[] = []
      rocks = rocks.filter((r) => {
        r.x += r.vx * dt; r.y += r.vy * dt; r.a += r.w * dt; wrap(r)
        g.c.save(); g.c.translate(r.x, r.y); g.c.rotate(r.a); g.c.beginPath()
        r.pts.forEach((p, i) => { const an = (i / r.pts.length) * Math.PI * 2; const px = Math.cos(an) * r.r * p, py = Math.sin(an) * r.r * p; if (i) g.c.lineTo(px, py); else g.c.moveTo(px, py) })
        g.c.closePath(); g.c.fillStyle = g.pal.ground2; g.c.fill(); g.c.strokeStyle = g.pal.ink2; g.c.lineWidth = 2; g.c.stroke(); g.c.restore()
        const sh = shots.find((q) => q.life > 0 && Math.hypot(q.x - r.x, q.y - r.y) < r.r)
        if (sh) {
          sh.life = 0; const pts = r.r > 20 ? 10 : r.r > 13 ? 20 : 30
          g.score += pts; g.burst(r.x, r.y, g.pal.ink2, 10, 100); g.sfx('boom'); g.shake(3)
          if (r.r > 12) for (let i = 0; i < 2; i++) born.push(mk(r.x, r.y, r.r * 0.55))
          return false
        }
        if (inv <= 0 && Math.hypot(x - r.x, y - r.y) < r.r * 0.85 + 7) { hurt(g, x, y); inv = 2.2; x = g.w / 2; y = g.h / 2; vx = vy = 0 }
        return true
      })
      rocks.push(...born)
      shots = shots.filter((q) => q.life > 0)
      if (!rocks.length) { spawn(); g.score += 50; g.pop(`wave ${wave}`, g.w / 2, 100, g.pal.signal); g.sfx('win') }
      if (inv <= 0 || Math.floor(inv * 10) % 2 === 0) {
        g.c.save(); g.c.translate(x, y); g.c.rotate(a)
        if (thrust) g.tri(-8, -4, -8, 4, -16 - Math.random() * 6, 0, g.pal.warn)
        g.tri(13, 0, -9, -9, -9, 9, g.pal.signal); g.tri(-2, 0, -9, -5, -9, 5, g.pal.bg)
        g.c.restore()
      }
      hearts(g)
    }
  },
}

export const whack: Game = {
  id: 'whack', name: 'Whack', blurb: 'Bonk the moles. Leave the bombs. Gold ones pay well.', how: 'Tap, click, or arrows plus space. Let five moles escape and you are out.', pad: ['left', 'right', 'up', 'down', 'act'], pointer: true,
  make: (g) => {
    g.lives = 5
    const cell = (i: number) => ({ x: 110 + (i % 3) * 130, y: 110 + Math.floor(i / 3) * 76 })
    const up: { t: number; max: number; k: 'mole' | 'bomb' | 'gold' }[] = Array.from({ length: 9 }, () => ({ t: 0, max: 1, k: 'mole' }))
    const hitFx: number[] = Array(9).fill(0)
    let t = 0.4, cur = 4, usedKeys = false
    const whackAt = (i: number) => {
      const m = up[i]; const c = cell(i)
      if (m.t <= 0) return
      hitFx[i] = 0.35
      if (m.k === 'bomb') { m.t = 0; hurt(g, c.x, c.y); return }
      m.t = 0; const pts = m.k === 'gold' ? 30 : 10; g.score += pts; g.pop(`+${pts}`, c.x, c.y - 34, m.k === 'gold' ? g.pal.signal : g.pal.ink); g.burst(c.x, c.y - 10, m.k === 'gold' ? g.pal.signal : '#a98055', 8, 120); g.sfx('pop'); g.shake(2)
    }
    return (dt) => {
      g.stars(0, 0, 25)
      t -= dt
      if (t <= 0) {
        t = Math.max(0.28, 0.85 - g.time * 0.008)
        const i = Math.floor(Math.random() * 9)
        if (up[i].t <= 0) { const r = Math.random(); const k = r < 0.16 ? 'bomb' : r < 0.26 ? 'gold' : 'mole'; const life = Math.max(0.55, 1.25 - g.time * 0.01); up[i] = { t: life, max: life, k } }
      }
      for (const k of ['left', 'right', 'up', 'down'] as const) if (g.tap.has(k)) { usedKeys = true; cur = k === 'left' ? (cur % 3 ? cur - 1 : cur) : k === 'right' ? (cur % 3 < 2 ? cur + 1 : cur) : k === 'up' ? (cur > 2 ? cur - 3 : cur) : (cur < 6 ? cur + 3 : cur) }
      if (g.tap.has('act')) { usedKeys = true; whackAt(cur) }
      if (g.ptr.hit) { usedKeys = false; for (let i = 0; i < 9; i++) { const c = cell(i); if (Math.hypot(g.ptr.x - c.x, g.ptr.y - (c.y - 10)) < 36) { whackAt(i); break } } }
      for (let i = 0; i < 9; i++) {
        const c = cell(i), m = up[i]
        g.c.globalAlpha = 0.5; g.circ(c.x, c.y + 14, 34, '#000'); g.c.globalAlpha = 1
        if (m.t > 0) {
          m.t -= dt
          const life = m.max, k = m.t / life
          const rise = k > 0.85 ? (1 - k) / 0.15 : k < 0.2 ? k / 0.2 : 1
          const hy = c.y + 14 - rise * 40
          const body = m.k === 'bomb' ? '#2a2234' : m.k === 'gold' ? g.pal.signal : '#a98055'
          g.c.save(); g.c.beginPath(); g.c.rect(c.x - 40, c.y - 60, 80, 74); g.c.clip()
          g.rrect(c.x - 20, hy - 6, 40, 52, 18, body); g.rrect(c.x - 20, hy - 6, 40, 14, 12, 'rgba(255,255,255,.15)')
          if (m.k === 'bomb') { g.circ(c.x - 7, hy + 10, 4, g.pal.hot); g.circ(c.x + 7, hy + 10, 4, g.pal.hot); g.rect(c.x - 6, hy + 22, 12, 3, g.pal.hot) } else { g.circ(c.x - 7, hy + 8, 3.5, '#fff'); g.circ(c.x + 7, hy + 8, 3.5, '#fff'); g.circ(c.x - 7, hy + 9, 1.8, '#111'); g.circ(c.x + 7, hy + 9, 1.8, '#111'); g.circ(c.x, hy + 16, 4, '#d67a8a') }
          g.c.restore()
          if (m.t <= 0 && m.k !== 'bomb') hurt(g, c.x, c.y)
        }
        g.c.fillStyle = '#3f8f5a'; g.c.beginPath(); g.c.ellipse(c.x, c.y + 14, 38, 11, 0, 0, Math.PI); g.c.fill()
        g.c.fillStyle = '#2a6a41'; g.c.beginPath(); g.c.ellipse(c.x, c.y + 14, 38, 11, 0, Math.PI, Math.PI * 2); g.c.fill()
        if (hitFx[i] > 0) { hitFx[i] -= dt; g.text('★', c.x - 22 + Math.sin(g.time * 30) * 4, c.y - 40, g.pal.signal, 16); g.text('★', c.x + 16, c.y - 36, g.pal.signal, 14) }
        if (usedKeys && i === cur) g.ring(c.x, c.y - 4, 40, g.pal.signal, 2)
      }
      hearts(g)
    }
  },
}
