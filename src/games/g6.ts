import { clamp, drop, hearts, hit, hurt, mix, steer, type G, type Game } from './engine'

const INV: string[][] = [
  ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'],
  ['00100000100', '10010001001', '10111111101', '11101110111', '11111111111', '01111111110', '00100000100', '01000000010'],
  ['00001111000', '01111111110', '11111111111', '11100110111', '11111111111', '00011011000', '00110110110', '11000000011'],
]
const BOSS = ['0000011111111110000', '0001111111111111000', '0111111111111111110', '1111011111111101111', '1111111111111111111', '1110111111111110111', '0111001110011100110', '0011000110001100100', '0000000100100000000']
const sprite = (g: G, rows: string[], x: number, y: number, s: number, c: string, shadow = true) => {
  if (shadow) for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === '1') g.rect(x + i * s + 1, y + j * s + 2, s, s, g.lo)
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === '1') g.rect(x + i * s, y + j * s, s, s, c)
}

export const invaders: Game = {
  id: 'invaders', name: 'Invaders', blurb: 'Formations, dive-bombers, power-ups and a boss every third wave.', how: 'Move, fire with space or by holding down. R rapid, S spread, H shield.', pad: ['left', 'right', 'act'], pointer: true,
  make: (g) => {
    interface E { x: number; y: number; k: number; d: { x: number; y: number; t: number; tx: number } | null; hit: number }
    interface Bl { x: number; y: number; vx: number; vy: number }
    let x = g.w / 2, vx = 0, cd = 0, dirx = 1, dropT = 1.2, wave = 0, anim = 0, inv = 0, divT = 5, chain = 0, chainT = 0
    let rapid = 0, spread = 0, shield = 0
    let es: E[] = []
    let shots: Bl[] = []
    let bombs: Bl[] = []
    let walls: { x: number; y: number; hp: number }[] = []
    let ups: { x: number; y: number; k: 'R' | 'S' | 'H' | '+' }[] = []
    let ufo: { x: number; v: number } | null = null
    let ut = 14
    let boss: { x: number; y: number; hp: number; max: number; t: number; fire: number; hurt: number; dying: number } | null = null
    const mkWalls = () => { walls = []; for (let b = 0; b < 4; b++) for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) if (!(r === 3 && c > 2 && c < 5)) walls.push({ x: 50 + b * 105 + c * 5, y: g.h - 90 + r * 5, hp: 2 }) }
    const next = () => {
      wave++; es = []; bombs = []; shots = []
      if (wave % 3 === 0) { const max = 24 + wave * 4; boss = { x: g.w / 2, y: 62, hp: max, max, t: 0, fire: 1.4, hurt: 0, dying: 0 }; g.banner(`BOSS`, `wave ${wave}`); g.flash(g.pal.hot, 0.22) }
      else { boss = null; for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) es.push({ x: 70 + c * 40, y: 46 + r * 26 + Math.min(wave, 3) * 7, k: r === 0 ? 2 : r < 3 ? 1 : 0, d: null, hit: 0 }); dirx = 1; g.banner(`WAVE ${wave}`, wave > 1 ? 'they are faster' : 'hold the line') }
      mkWalls()
    }
    next()
    const addScore = (n: number) => { chain++; chainT = 1.3; g.mult = 1 + Math.min(4, Math.floor(chain / 3)); const p = n * g.mult; g.score += p; return p }
    const hitPlayer = () => {
      if (inv > 0) return
      if (shield > 0) { shield = 0; g.shockwave(x, g.h - 26, g.pal.ice, 50); g.sfx('hit'); inv = 0.6; return }
      hurt(g, x, g.h - 26); inv = 1.6; chain = 0; g.mult = 1; g.flash(g.pal.hot, 0.3)
    }
    const drops = (px: number, py: number, p = 0.1) => { if (Math.random() < p) ups.push({ x: px, y: py, k: (['R', 'S', 'H', '+'] as const)[Math.floor(Math.random() * 4)] }) }
    return (dt) => {
      g.stars(0, 14, 60)
      g.c.globalAlpha = 0.14; g.circ(390, 74, 46, g.pal.ice); g.c.globalAlpha = 0.1; g.c.strokeStyle = g.pal.ice; g.c.lineWidth = 5; g.c.beginPath(); g.c.ellipse(390, 74, 76, 14, -0.3, 0, Math.PI * 2); g.c.stroke(); g.c.globalAlpha = 1
      const lx = x
      x = clamp(steer(g, x, 300, dt), 16, g.w - 16)
      vx += ((x - lx) / Math.max(dt, 0.001) - vx) * Math.min(1, dt * 12)
      cd -= dt; inv -= dt; anim += dt; rapid = Math.max(0, rapid - dt); spread = Math.max(0, spread - dt); shield = Math.max(0, shield - dt)
      chainT -= dt; if (chainT <= 0) { chain = 0; g.mult = 1 }
      if ((g.keys.has('act') || g.ptr.down) && cd <= 0 && shots.length < (rapid > 0 ? 8 : 3)) {
        const mk = (a: number) => shots.push({ x: x + a * 14, y: g.h - 42, vx: a * 70, vy: -440 })
        if (spread > 0) { mk(-1); mk(0); mk(1) } else mk(0)
        cd = rapid > 0 ? 0.11 : 0.3; g.sfx('shoot')
      }
      let edge = false
      const sp = 20 + wave * 6 + (32 - es.length) * 1.7
      for (const e of es) { if (!e.d) { e.x += dirx * sp * dt; if (e.x < 14 || e.x > g.w - 14) edge = true } }
      if (edge) { dirx = -dirx; for (const e of es) { e.y += 10; e.x += dirx * 3 } }
      dropT -= dt; divT -= dt
      const live = es.filter((e) => !e.d)
      if (dropT <= 0 && live.length) { dropT = Math.max(0.28, 1.1 - wave * 0.09); const e = live[Math.floor(Math.random() * live.length)]; bombs.push({ x: e.x, y: e.y + 8, vx: 0, vy: 150 + wave * 6 }) }
      if (divT <= 0 && live.length > 4) { divT = Math.max(2.4, 6 - wave * 0.5); const e = live[Math.floor(Math.random() * live.length)]; e.d = { x: e.x, y: e.y, t: 0, tx: x }; g.sfx('blip') }
      ut -= dt
      if (ut <= 0 && !ufo && !boss) { ut = g.rnd(14, 22); const d = Math.random() < 0.5; ufo = { x: d ? -20 : g.w + 20, v: d ? 95 : -95 } }
      if (ufo) { ufo.x += ufo.v * dt; drop(g, ufo.x - 15, 26, 30, 10, 5); g.rrect(ufo.x - 15, 26, 30, 10, 5, g.pal.hot); g.rrect(ufo.x - 8, 20, 16, 9, 5, mix(g.pal.hot, g.pal.ink, 0.4)); for (let i = -1; i <= 1; i++) g.circ(ufo.x + i * 8, 31, 1.6, g.pal.signal); if (ufo.x < -30 || ufo.x > g.w + 30) ufo = null }
      for (const e of es) if (e.d) {
        const d = e.d; d.t += dt; d.y += (130 + wave * 8) * dt; d.x += Math.sin(d.t * 5) * 70 * dt + (d.tx - d.x) * dt * 0.7
        if (d.y > g.h + 20) e.d = null
        if (inv <= 0 && hit(d.x - 11, d.y - 8, 22, 16, x - 14, g.h - 34, 28, 16)) { e.hit = 1; e.d = null; e.y = 9999; g.burst(d.x, d.y, g.pal.warn, 12, 150); hitPlayer() }
      }
      for (const s of shots) {
        s.x += s.vx * dt; s.y += s.vy * dt; g.rect(s.x - 1, s.y, 3, 11, g.pal.ink); g.rect(s.x - 1, s.y + 11, 3, 4, g.pal.warn)
        for (const e of es) {
          const ex = e.d ? e.d.x : e.x, ey = e.d ? e.d.y : e.y
          if (e.y < 9000 && hit(s.x - 1, s.y, 3, 11, ex - 12, ey - 9, 24, 18)) {
            s.y = -99; const pts = addScore(([10, 20, 30][e.k]) * (e.d ? 2 : 1)); g.sfx('boom'); g.pop(`+${pts}`, ex, ey - 12, g.pal.ink); const col = [g.pal.ok, g.pal.ice, g.pal.warn][e.k]; g.burst(ex, ey, col, 12, 150, 3); g.burst(ex, ey, g.pal.ink, 4, 110, 2, 'line'); g.shockwave(ex, ey, col, 26); drops(ex, ey, e.d ? 0.2 : 0.07); e.y = 9999; g.shake(1.6)
          }
        }
        if (ufo && hit(s.x - 1, s.y, 3, 11, ufo.x - 15, 20, 30, 16)) { const pts = addScore(100); g.pop(`+${pts}`, ufo.x, 40, g.pal.hot); g.burst(ufo.x, 30, g.pal.hot, 22, 190, 3); g.shockwave(ufo.x, 30, g.pal.hot, 50); g.sfx('win'); g.freeze(0.05); drops(ufo.x, 32, 1); ufo = null; s.y = -99 }
        if (boss && boss.dying <= 0 && hit(s.x - 1, s.y, 3, 11, boss.x - 29, boss.y - 14, 58, 28)) { s.y = -99; boss.hp--; boss.hurt = 1; g.sfx('blip'); g.burst(s.x, s.y + 12, g.pal.warn, 4, 110, 2, 'line'); g.score += 2; if (boss.hp <= 0) { boss.dying = 0.8; g.freeze(0.12); g.flash(g.pal.ink, 0.5); g.sfx('boom') } }
        for (const w of walls) if (w.hp > 0 && hit(s.x - 1, s.y, 3, 11, w.x, w.y, 5, 5)) { w.hp--; s.y = -99 }
      }
      es = es.filter((e) => e.y < 9000); shots = shots.filter((s) => s.y > -16 && s.x > -10 && s.x < g.w + 10)
      for (const b of bombs) {
        b.x += b.vx * dt; b.y += b.vy * dt; g.rect(b.x - 1.5, b.y, 3, 10, g.pal.hot); g.circ(b.x, b.y + 11, 2.5, g.pal.warn)
        for (const w of walls) if (w.hp > 0 && hit(b.x - 1, b.y, 3, 10, w.x, w.y, 5, 5)) { w.hp--; b.y = 9999 }
        if (inv <= 0 && hit(b.x - 2, b.y, 4, 10, x - 14, g.h - 34, 28, 16)) { b.y = 9999; hitPlayer() }
      }
      bombs = bombs.filter((b) => b.y < g.h && b.x > -10 && b.x < g.w + 10)
      for (const w of walls) if (w.hp > 0) g.rect(w.x, w.y, 5, 5, w.hp > 1 ? g.pal.ok : mix(g.pal.ok, g.pal.bg, 0.45))
      for (const u of ups) {
        u.y += 70 * dt; const col = u.k === 'R' ? g.pal.warn : u.k === 'S' ? g.pal.ice : u.k === 'H' ? g.pal.ok : g.pal.hot
        drop(g, u.x - 9, u.y - 9, 18, 18, 9); g.rrect(u.x - 9, u.y - 9, 18, 18, 9, col); g.text(u.k, u.x, u.y - 8, g.pal.bg, 14, 'center'); g.ring(u.x, u.y, 12 + Math.sin(g.time * 8), col, 1)
        if (hit(u.x - 9, u.y - 9, 18, 18, x - 16, g.h - 38, 32, 22)) { u.y = 999; g.sfx('coin'); g.burst(u.x, g.h - 30, col, 10, 120); if (u.k === 'R') { rapid = 9; g.pop('rapid fire', x, g.h - 60, col) } else if (u.k === 'S') { spread = 9; g.pop('spread shot', x, g.h - 60, col) } else if (u.k === 'H') { shield = 8; g.pop('shield', x, g.h - 60, col) } else { g.lives = Math.min(5, g.lives + 1); g.pop('+1 life', x, g.h - 60, col) } }
      }
      ups = ups.filter((u) => u.y < g.h + 12)
      const frame = Math.floor(anim * 2.2) % 2
      for (const e of es) {
        const ex = e.d ? e.d.x : e.x, ey = e.d ? e.d.y : e.y
        const col = [g.pal.ok, g.pal.ice, g.pal.warn][e.k]
        const wob = e.d ? Math.sin(g.time * 18) * 1.5 : 0
        sprite(g, INV[e.k].map((r) => (frame ? r.split('').reverse().join('') : r)), ex - 11 + wob, ey - 8, 2, e.d ? g.pal.hot : col)
        if (!e.d && e.y > g.h - 96) { g.end(ex, ey); return }
      }
      if (boss) {
        const b = boss; b.t += dt; b.hurt = Math.max(0, b.hurt - dt * 8)
        if (b.dying > 0) {
          b.dying -= dt; if (Math.random() < 0.6) { g.burst(b.x + g.rnd(-30, 30), b.y + g.rnd(-12, 12), g.pal.warn, 8, 160, 3); g.shake(5) }
          if (b.dying <= 0) { g.burst(b.x, b.y, g.pal.hot, 40, 260, 4); g.shockwave(b.x, b.y, g.pal.warn, 120); g.shake(14); const pts = addScore(500); g.pop(`+${pts}`, b.x, b.y, g.pal.signal); for (let i = 0; i < 3; i++) drops(b.x + (i - 1) * 24, b.y, 1); boss = null; g.sfx('win') }
        } else {
          b.x = g.w / 2 + Math.sin(b.t * 0.9) * 150; b.y = 60 + Math.sin(b.t * 1.7) * 10; b.fire -= dt
          if (b.fire <= 0) { b.fire = Math.max(0.7, 1.3 - wave * 0.04); if (Math.floor(b.t) % 2) { for (let i = -2; i <= 2; i++) bombs.push({ x: b.x, y: b.y + 14, vx: i * 46, vy: 150 }) } else { const a = Math.atan2(g.h - 30 - b.y, x - b.x); bombs.push({ x: b.x, y: b.y + 14, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200 }) }; g.sfx('shoot') }
        }
        if (boss) { sprite(g, BOSS, b.x - 29, b.y - 14, 3, b.hurt > 0.3 ? g.pal.ink : mix(g.pal.hot, g.pal.ink, 0.2)); g.rect(g.w / 2 - 80, 26, 160, 5, g.lo); g.rect(g.w / 2 - 80, 26, 160 * (b.hp / b.max), 5, g.pal.hot); g.text('BOSS', g.w / 2, 30, g.pal.ink2, 11, 'center') }
      }
      if (!es.length && !boss) { g.score += 50; g.sfx('win'); next() }
      // the ship
      if (inv <= 0 || Math.floor(inv * 10) % 2) {
        g.c.save(); g.c.translate(x, g.h - 26); g.c.rotate(clamp(vx * 0.0009, -0.25, 0.25))
        const fl = 8 + Math.random() * 5
        g.tri(-4, 6, 4, 6, 0, 6 + fl, g.pal.warn); g.tri(-2, 6, 2, 6, 0, 6 + fl * 0.5, g.pal.ink)
        g.tri(-16, 8, -5, -2, -5, 8, g.pal.ink2); g.tri(16, 8, 5, -2, 5, 8, g.pal.ink2)
        drop(g, -8, -14, 16, 22, 4); g.rrect(-7, -14, 14, 22, 5, g.pal.signal); g.rrect(-3, -8, 6, 8, 3, g.pal.bg); g.rect(-6, 0, 12, 1, g.hi)
        g.c.restore()
      }
      if (shield > 0) { const a = shield < 2 && Math.floor(g.time * 8) % 2 ? 0.3 : 1; g.c.globalAlpha = a; g.ring(x, g.h - 26, 24 + Math.sin(g.time * 10), g.pal.ice, 2); g.c.globalAlpha = a * 0.1; g.circ(x, g.h - 26, 24, g.pal.ice); g.c.globalAlpha = 1 }
      g.intensity = clamp(0.3 + wave * 0.08 + (boss ? 0.3 : 0) + (1 - es.length / 32) * 0.2, 0, 1)
      const tags: [number, string, string][] = [[rapid, 'rapid', g.pal.warn], [spread, 'spread', g.pal.ice], [shield, 'shield', g.pal.ok]]
      let ty = 66; for (const [t, n, col] of tags) if (t > 0) { g.rect(10, ty, 4, 10, col); g.text(`${n} ${Math.ceil(t)}`, 18, ty - 2, col, 12); ty += 14 }
      hearts(g)
    }
  },
}
