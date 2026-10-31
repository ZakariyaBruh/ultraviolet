import { clamp, drop, hearts, hurt, mix, type Game } from './engine'

interface Rock { x: number; y: number; vx: number; vy: number; r: number; a: number; w: number; pts: number[]; cr: [number, number, number][] }

export const asteroids: Game = {
  id: 'asteroids', name: 'Asteroids', blurb: 'Rocks, saucers, shields and a nova bomb.', how: 'Left and right turn, up thrusts, space fires. S shield, T triple, N nova.', pad: ['left', 'right', 'up', 'act'],
  make: (g) => {
    let x = g.w / 2, y = g.h / 2, vx = 0, vy = 0, a = -Math.PI / 2, cd = 0, inv = 2, wave = 0, shield = 0, triple = 0, chain = 0, chainT = 0, ut = 18
    let rocks: Rock[] = []
    let shots: { x: number; y: number; vx: number; vy: number; life: number }[] = []
    let ebul: { x: number; y: number; vx: number; vy: number }[] = []
    let ups: { x: number; y: number; k: 'S' | 'T' | 'N'; a: number }[] = []
    let ufo: { x: number; y: number; v: number; hp: number; fire: number; t: number } | null = null
    const mk = (px: number, py: number, r: number): Rock => ({ x: px, y: py, vx: g.rnd(-40, 40) * (34 / r + 0.4), vy: g.rnd(-40, 40) * (34 / r + 0.4), r, a: g.rnd(0, 6.28), w: g.rnd(-1.1, 1.1), pts: Array.from({ length: 12 }, () => g.rnd(0.8, 1.14)), cr: Array.from({ length: 3 }, () => [g.rnd(-0.5, 0.5), g.rnd(-0.5, 0.5), g.rnd(0.14, 0.26)] as [number, number, number]) })
    const spawn = () => { wave++; for (let i = 0; i < 3 + wave; i++) { const s = Math.random() * Math.PI * 2; rocks.push(mk(g.w / 2 + Math.cos(s) * 250, g.h / 2 + Math.sin(s) * 190, 30)) } g.banner(`WAVE ${wave}`, wave === 1 ? 'clear the field' : 'more rocks') }
    spawn()
    const wrap = (o: { x: number; y: number }) => { o.x = (o.x + g.w) % g.w; o.y = (o.y + g.h) % g.h }
    const score = (n: number) => { chain++; chainT = 1.4; g.mult = 1 + Math.min(4, Math.floor(chain / 4)); const p = n * g.mult; g.score += p; return p }
    const drops = (px: number, py: number, p: number) => { if (Math.random() < p) ups.push({ x: px, y: py, k: (['S', 'T', 'N'] as const)[Math.floor(Math.random() * 3)], a: 0 }) }
    const shatter = (r: Rock, by: 'shot' | 'nova') => {
      const pts = score(r.r > 22 ? 10 : r.r > 14 ? 20 : 30); g.pop(`+${pts}`, r.x, r.y - r.r - 6, g.pal.ink)
      g.burst(r.x, r.y, g.pal.ink2, 10, 130, 3); g.burst(r.x, r.y, g.pal.ink, 6, 160, 2, 'line'); g.sfx('boom'); g.shake(r.r > 22 ? 4 : 2); if (r.r > 22) g.freeze(0.035)
      drops(r.x, r.y, by === 'nova' ? 0 : 0.05)
      const kids: Rock[] = []
      if (r.r > 13) for (let i = 0; i < 2; i++) kids.push(mk(r.x, r.y, r.r * 0.58))
      return kids
    }
    const hitShip = () => {
      if (inv > 0) return
      if (shield > 0) { shield = 0; g.shockwave(x, y, g.pal.ice, 60); g.sfx('hit'); inv = 0.8; return }
      hurt(g, x, y); inv = 2.2; x = g.w / 2; y = g.h / 2; vx = vy = 0; chain = 0; g.mult = 1; g.flash(g.pal.hot, 0.35)
    }
    return (dt) => {
      // nebula and stars drift against the ship
      g.c.globalAlpha = g.light ? 0.05 : 0.035
      for (let i = 0; i < 4; i++) g.circ(((100 + i * 130 - x * 0.1 + g.w) % g.w), ((70 + i * 70 - y * 0.1 + g.h) % g.h), 46 + i * 9, i % 2 ? g.pal.hot : g.pal.ice)
      g.c.globalAlpha = 1
      g.stars(-vx * 0.25, -vy * 0.25, 60)
      if (g.keys.has('left')) a -= 4.2 * dt
      if (g.keys.has('right')) a += 4.2 * dt
      const thrust = g.keys.has('up')
      if (thrust) { vx += Math.cos(a) * 230 * dt; vy += Math.sin(a) * 230 * dt; g.burst(x - Math.cos(a) * 10, y - Math.sin(a) * 10, g.pal.warn, 1, 70, 3) }
      vx *= 1 - 0.35 * dt; vy *= 1 - 0.35 * dt
      x += vx * dt; y += vy * dt; const s = { x, y }; wrap(s); x = s.x; y = s.y
      cd -= dt; inv -= dt; shield = Math.max(0, shield - dt); triple = Math.max(0, triple - dt); chainT -= dt; if (chainT <= 0) { chain = 0; g.mult = 1 }
      if (g.keys.has('act') && cd <= 0) {
        for (const da of triple > 0 ? [-0.2, 0, 0.2] : [0]) shots.push({ x: x + Math.cos(a) * 12, y: y + Math.sin(a) * 12, vx: Math.cos(a + da) * 380 + vx, vy: Math.sin(a + da) * 380 + vy, life: 0.9 })
        cd = 0.22; g.sfx('shoot'); vx -= Math.cos(a) * 4; vy -= Math.sin(a) * 4
      }
      for (const sh of shots) { sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.life -= dt; wrap(sh); g.line(sh.x, sh.y, sh.x - sh.vx * 0.03, sh.y - sh.vy * 0.03, g.pal.signal, 3) }
      ut -= dt
      if (ut <= 0 && !ufo) { ut = g.rnd(20, 28); ufo = { x: -20, y: g.rnd(50, g.h - 60), v: 70, hp: 2, fire: 1.4, t: 0 }; g.banner('SAUCER', 'shoot it down') }
      if (ufo) {
        const u = ufo; u.t += dt; u.x += u.v * dt; u.y += Math.sin(u.t * 2) * 40 * dt; u.fire -= dt
        if (u.fire <= 0) { u.fire = 1.5; const an = Math.atan2(y - u.y, x - u.x) + g.rnd(-0.25, 0.25); ebul.push({ x: u.x, y: u.y, vx: Math.cos(an) * 150, vy: Math.sin(an) * 150 }); g.sfx('shoot') }
        drop(g, u.x - 16, u.y - 4, 32, 10, 5); g.rrect(u.x - 16, u.y - 4, 32, 10, 5, g.pal.hot); g.rrect(u.x - 8, u.y - 11, 16, 10, 6, mix(g.pal.hot, g.pal.ink, 0.45)); for (let i = -1; i <= 1; i++) g.circ(u.x + i * 9, u.y + 1, 1.8, Math.floor(g.time * 6 + i) % 2 ? g.pal.signal : g.pal.ink)
        for (const sh of shots) if (sh.life > 0 && Math.hypot(sh.x - u.x, sh.y - u.y) < 16) { sh.life = 0; u.hp--; g.burst(sh.x, sh.y, g.pal.warn, 5, 100, 2, 'line'); g.sfx('blip'); if (u.hp <= 0) { const pts = score(200); g.pop(`+${pts}`, u.x, u.y - 14, g.pal.hot); g.burst(u.x, u.y, g.pal.hot, 24, 200, 3); g.shockwave(u.x, u.y, g.pal.hot, 70); g.freeze(0.06); g.sfx('win'); drops(u.x, u.y, 1); ufo = null; break } }
        if (ufo && (ufo.x > g.w + 24)) ufo = null
        if (ufo && inv <= 0 && Math.hypot(x - ufo.x, y - ufo.y) < 20) hitShip()
      }
      for (const b of ebul) { b.x += b.vx * dt; b.y += b.vy * dt; g.circ(b.x, b.y, 3.5, g.pal.hot); g.circ(b.x, b.y, 1.5, g.pal.ink); if (inv <= 0 && Math.hypot(b.x - x, b.y - y) < 10) { b.x = -999; hitShip() } }
      ebul = ebul.filter((b) => b.x > -20 && b.x < g.w + 20 && b.y > -20 && b.y < g.h + 20)
      const born: Rock[] = []
      rocks = rocks.filter((r) => {
        r.x += r.vx * dt; r.y += r.vy * dt; r.a += r.w * dt; wrap(r)
        g.c.save(); g.c.translate(r.x, r.y); g.c.rotate(r.a)
        g.c.beginPath(); r.pts.forEach((p, i) => { const an = (i / r.pts.length) * Math.PI * 2; const px = Math.cos(an) * r.r * p, py = Math.sin(an) * r.r * p; if (i) g.c.lineTo(px, py); else g.c.moveTo(px, py) }); g.c.closePath()
        g.c.fillStyle = mix(g.pal.ink2, g.pal.bg, 0.6); g.c.fill(); g.c.strokeStyle = g.pal.ink2; g.c.lineWidth = 2; g.c.stroke()
        if (r.r > 14) for (const [cx, cy, cr] of r.cr) { g.circ(cx * r.r, cy * r.r, cr * r.r, g.lo); g.ring(cx * r.r - 1, cy * r.r - 1, cr * r.r, g.hi, 1) }
        g.c.restore()
        const sh = shots.find((q) => q.life > 0 && Math.hypot(q.x - r.x, q.y - r.y) < r.r)
        if (sh) { sh.life = 0; born.push(...shatter(r, 'shot')); return false }
        if (inv <= 0 && Math.hypot(x - r.x, y - r.y) < r.r * 0.85 + 7) hitShip()
        return true
      })
      rocks.push(...born)
      shots = shots.filter((q) => q.life > 0)
      for (const u of ups) {
        u.a += dt; const col = u.k === 'S' ? g.pal.ice : u.k === 'T' ? g.pal.warn : g.pal.hot
        g.c.save(); g.c.translate(u.x, u.y); g.c.rotate(u.a * 2); g.rrect(-9, -9, 18, 18, 4, col); g.c.restore(); g.text(u.k, u.x, u.y - 8, g.pal.bg, 14, 'center'); g.ring(u.x, u.y, 14 + Math.sin(g.time * 8), col, 1)
        if (Math.hypot(u.x - x, u.y - y) < 18) {
          u.a = -999; g.sfx('coin'); g.burst(u.x, u.y, col, 10, 120)
          if (u.k === 'S') { shield = 9; g.pop('shield', x, y - 20, col) } else if (u.k === 'T') { triple = 10; g.pop('triple shot', x, y - 20, col) }
          else { g.pop('NOVA', x, y - 20, col); g.shockwave(x, y, g.pal.hot, 160); g.flash(g.pal.ink, 0.4); g.freeze(0.08); g.shake(10); g.sfx('boom'); const keep: Rock[] = []; const kids: Rock[] = []; for (const r of rocks) { if (Math.hypot(r.x - x, r.y - y) < 150) kids.push(...shatter(r, 'nova')); else keep.push(r) } rocks = keep.concat(kids) }
        }
      }
      ups = ups.filter((u) => u.a > -100 && u.a < 12)
      if (!rocks.length && !ufo) { spawn(); g.score += 50; g.sfx('win') }
      if (inv <= 0 || Math.floor(inv * 10) % 2 === 0) {
        g.c.save(); g.c.translate(x, y); g.c.rotate(a)
        if (thrust) { g.tri(-8, -4, -8, 4, -16 - Math.random() * 8, 0, g.pal.warn); g.tri(-8, -2, -8, 2, -11, 0, g.pal.ink) }
        g.tri(14, 0, -9, -10, -9, 10, g.lo); g.tri(13, 0, -9, -9, -9, 9, g.pal.signal); g.tri(-1, 0, -9, -5, -9, 5, g.pal.bg); g.tri(13, 0, 2, -3, 2, 3, g.pal.ink)
        g.c.restore()
      }
      if (shield > 0) { const al = shield < 2 && Math.floor(g.time * 8) % 2 ? 0.3 : 1; g.c.globalAlpha = al; g.ring(x, y, 17 + Math.sin(g.time * 9), g.pal.ice, 2); g.c.globalAlpha = al * 0.12; g.circ(x, y, 17, g.pal.ice); g.c.globalAlpha = 1 }
      g.intensity = clamp(0.3 + wave * 0.07 + (ufo ? 0.25 : 0), 0, 1)
      const tags: [number, string, string][] = [[shield, 'shield', g.pal.ice], [triple, 'triple', g.pal.warn]]
      let ty = 66; for (const [t, n, col] of tags) if (t > 0) { g.rect(10, ty, 4, 10, col); g.text(`${n} ${Math.ceil(t)}`, 18, ty - 2, col, 12); ty += 14 }
      hearts(g)
    }
  },
}
