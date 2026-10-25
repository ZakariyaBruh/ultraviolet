import { clamp, hearts, hit, hurt, steer, type Game } from './engine'

const flapped = (g: Parameters<Game['make']>[0]) => g.tap.has('act') || g.tap.has('up') || g.ptr.hit

export const flap: Game = {
  id: 'flap', name: 'Flap', blurb: 'Thread the gaps.', how: 'Tap, click or space to flap.', pad: ['act'], pointer: true,
  make: (g) => {
    let y = 150, v = 0, t = 1
    let ps: { x: number; gap: number; got: boolean }[] = []
    return (dt) => {
      if (flapped(g)) v = -250
      v += 820 * dt; y += v * dt
      t -= dt
      if (t <= 0) { t = 1.5; ps.push({ x: g.w + 20, gap: g.rnd(70, g.h - 130), got: false }) }
      const gh = Math.max(90, 120 - g.time * 0.4)
      for (const p of ps) {
        p.x -= (130 + g.time * 1.5) * dt
        g.rect(p.x, 0, 40, p.gap, g.pal.ok); g.rect(p.x, p.gap + gh, 40, g.h, g.pal.ok)
        if (hit(80, y - 9, 18, 18, p.x, 0, 40, p.gap) || hit(80, y - 9, 18, 18, p.x, p.gap + gh, 40, g.h)) g.end()
        if (!p.got && p.x + 40 < 80) { p.got = true; g.score += 10 }
      }
      ps = ps.filter((p) => p.x > -60)
      if (y < 0 || y > g.h) g.end()
      g.circ(89, y, 9, g.pal.signal)
      g.rect(94, y - 3, 8, 4, g.pal.hot)
    }
  },
}

export const runner: Game = {
  id: 'runner', name: 'Hurdle', blurb: 'Jump everything, run forever.', how: 'Tap, click or space to jump.', pad: ['act'], pointer: true,
  make: (g) => {
    const floor = g.h - 50
    let y = floor, v = 0, t = 1
    let os: { x: number; w: number; h: number }[] = []
    return (dt) => {
      if (flapped(g) && y >= floor) v = -520
      v += 1500 * dt; y = Math.min(floor, y + v * dt)
      if (y >= floor) v = 0
      t -= dt
      const sp = 220 + g.time * 4
      if (t <= 0) { t = g.rnd(0.7, 1.4) * (220 / sp) * 1.4; os.push({ x: g.w + 10, w: g.rnd(16, 34), h: g.rnd(20, 48) }) }
      g.rect(0, floor + 20, g.w, 2, g.pal.ink2)
      for (const o of os) { o.x -= sp * dt; g.rect(o.x, floor + 20 - o.h, o.w, o.h, g.pal.hot); if (hit(60, y - 20, 22, 40, o.x, floor + 20 - o.h, o.w, o.h)) g.end() }
      os = os.filter((o) => o.x > -50)
      g.rect(60, y - 20, 22, 40, g.pal.signal)
      g.score = g.time * 12
    }
  },
}

export const invaders: Game = {
  id: 'invaders', name: 'Invaders', blurb: 'Hold the line.', how: 'Move, and fire with space or by holding down.', pad: ['left', 'right', 'act'], pointer: true,
  make: (g) => {
    let x = g.w / 2, cd = 0, dirx = 1, dropT = 0, wave = 0
    let es: { x: number; y: number }[] = []
    let shots: { x: number; y: number }[] = []
    let bombs: { x: number; y: number }[] = []
    const spawn = () => { es = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) es.push({ x: 60 + c * 42, y: 40 + r * 28 + wave * 6 }); wave++ }
    spawn()
    return (dt) => {
      x = clamp(steer(g, x, 300, dt), 14, g.w - 14)
      cd -= dt
      if ((g.keys.has('act') || g.ptr.down) && cd <= 0) { shots.push({ x, y: g.h - 36 }); cd = 0.32 }
      let edge = false
      const sp = 24 + wave * 8 + (32 - es.length) * 1.4
      for (const e of es) { e.x += dirx * sp * dt; if (e.x < 14 || e.x > g.w - 14) edge = true }
      if (edge) { dirx = -dirx; for (const e of es) e.y += 12 }
      dropT -= dt
      if (dropT <= 0 && es.length) { dropT = Math.max(0.35, 1 - wave * 0.1); const e = es[Math.floor(Math.random() * es.length)]; bombs.push({ x: e.x, y: e.y + 8 }) }
      for (const s of shots) { s.y -= 420 * dt; g.rect(s.x - 1, s.y, 3, 10, g.pal.ink); for (const e of es) if (hit(s.x - 1, s.y, 3, 10, e.x - 12, e.y - 8, 24, 16)) { e.y = 9999; s.y = -99; g.score += 10 } }
      es = es.filter((e) => e.y < 9000); shots = shots.filter((s) => s.y > -10)
      for (const b of bombs) { b.y += 160 * dt; g.rect(b.x - 1, b.y, 3, 10, g.pal.hot); if (hit(b.x - 1, b.y, 3, 10, x - 14, g.h - 30, 28, 14)) { b.y = 9999; hurt(g) } }
      bombs = bombs.filter((b) => b.y < g.h)
      for (const e of es) { g.rect(e.x - 12, e.y - 8, 24, 16, g.pal.ok); g.rect(e.x - 8, e.y - 4, 4, 4, g.pal.bg); g.rect(e.x + 4, e.y - 4, 4, 4, g.pal.bg); if (e.y > g.h - 46) g.end() }
      if (!es.length) { spawn(); g.score += 50 }
      g.rect(x - 14, g.h - 28, 28, 12, g.pal.signal); g.rect(x - 3, g.h - 36, 6, 8, g.pal.signal)
      hearts(g)
    }
  },
}

interface Rock { x: number; y: number; vx: number; vy: number; r: number }
export const asteroids: Game = {
  id: 'asteroids', name: 'Asteroids', blurb: 'Blast the rocks, mind the pieces.', how: 'Left and right turn, up thrusts, space fires.', pad: ['left', 'right', 'up', 'act'],
  make: (g) => {
    let x = g.w / 2, y = g.h / 2, vx = 0, vy = 0, a = -Math.PI / 2, cd = 0, inv = 2
    let rocks: Rock[] = []
    let shots: { x: number; y: number; vx: number; vy: number; life: number }[] = []
    const wave = () => { for (let i = 0; i < 4 + Math.floor(g.time / 20); i++) { const side = Math.random() * Math.PI * 2; rocks.push({ x: g.w / 2 + Math.cos(side) * 260, y: g.h / 2 + Math.sin(side) * 200, vx: g.rnd(-40, 40), vy: g.rnd(-40, 40), r: 26 }) } }
    wave()
    const wrap = (o: { x: number; y: number }) => { o.x = (o.x + g.w) % g.w; o.y = (o.y + g.h) % g.h }
    return (dt) => {
      if (g.keys.has('left')) a -= 4 * dt
      if (g.keys.has('right')) a += 4 * dt
      if (g.keys.has('up')) { vx += Math.cos(a) * 220 * dt; vy += Math.sin(a) * 220 * dt }
      vx *= 1 - 0.4 * dt; vy *= 1 - 0.4 * dt
      x += vx * dt; y += vy * dt; const s = { x, y }; wrap(s); x = s.x; y = s.y
      cd -= dt; inv -= dt
      if (g.keys.has('act') && cd <= 0) { shots.push({ x, y, vx: Math.cos(a) * 340 + vx, vy: Math.sin(a) * 340 + vy, life: 1 }); cd = 0.28 }
      for (const sh of shots) { sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.life -= dt; wrap(sh); g.circ(sh.x, sh.y, 2, g.pal.ink) }
      const born: Rock[] = []
      rocks = rocks.filter((r) => {
        r.x += r.vx * dt; r.y += r.vy * dt; wrap(r)
        g.c.strokeStyle = g.pal.ink2; g.c.lineWidth = 2; g.c.beginPath(); g.c.arc(r.x, r.y, r.r, 0, 7); g.c.stroke()
        const sh = shots.find((q) => q.life > 0 && Math.hypot(q.x - r.x, q.y - r.y) < r.r)
        if (sh) {
          sh.life = 0; g.score += r.r > 20 ? 10 : r.r > 13 ? 20 : 30
          if (r.r > 13) for (let i = 0; i < 2; i++) born.push({ x: r.x, y: r.y, vx: g.rnd(-70, 70), vy: g.rnd(-70, 70), r: r.r / 2 })
          return false
        }
        if (inv <= 0 && Math.hypot(x - r.x, y - r.y) < r.r + 6) { hurt(g); inv = 2; x = g.w / 2; y = g.h / 2; vx = vy = 0 }
        return true
      })
      rocks.push(...born)
      shots = shots.filter((s) => s.life > 0)
      if (!rocks.length) wave()
      if (inv <= 0 || Math.floor(inv * 8) % 2 === 0) { g.line(x + Math.cos(a) * 12, y + Math.sin(a) * 12, x + Math.cos(a + 2.5) * 10, y + Math.sin(a + 2.5) * 10, g.pal.signal); g.line(x + Math.cos(a) * 12, y + Math.sin(a) * 12, x + Math.cos(a - 2.5) * 10, y + Math.sin(a - 2.5) * 10, g.pal.signal); g.line(x + Math.cos(a + 2.5) * 10, y + Math.sin(a + 2.5) * 10, x + Math.cos(a - 2.5) * 10, y + Math.sin(a - 2.5) * 10, g.pal.signal) }
      hearts(g)
    }
  },
}

export const whack: Game = {
  id: 'whack', name: 'Whack', blurb: 'Hit them before they hide.', how: 'Tap or click the pops. Let five slip and you are out.', pad: [], pointer: true,
  make: (g) => {
    g.lives = 5
    const cell = (i: number) => ({ x: 100 + (i % 3) * 140, y: 90 + Math.floor(i / 3) * 80 })
    const up: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0]
    let t = 0.5
    return (dt) => {
      t -= dt
      if (t <= 0) { t = Math.max(0.35, 0.9 - g.time * 0.008); const i = Math.floor(Math.random() * 9); if (!up[i]) up[i] = Math.max(0.6, 1.2 - g.time * 0.01) }
      for (let i = 0; i < 9; i++) {
        const c = cell(i)
        g.circ(c.x, c.y + 12, 26, g.pal.ink2)
        if (up[i] > 0) {
          up[i] -= dt
          g.circ(c.x, c.y, 20, g.pal.signal); g.rect(c.x - 9, c.y - 6, 4, 4, g.pal.bg); g.rect(c.x + 5, c.y - 6, 4, 4, g.pal.bg)
          if (g.ptr.hit && Math.hypot(g.ptr.x - c.x, g.ptr.y - c.y) < 28) { up[i] = 0; g.score += 10 }
          else if (up[i] <= 0) { up[i] = 0; hurt(g) }
        }
      }
      hearts(g)
    }
  },
}
