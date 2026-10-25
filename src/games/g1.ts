import { clamp, drop, hit, steer, type Game } from './engine'

export const dodge: Game = {
  id: 'dodge', name: 'Dodge', blurb: 'Slip between the falling rocks. Grab the gems.', how: 'Left and right, or drag. Close calls score.', pad: ['left', 'right'], pointer: true,
  make: (g) => {
    let x = g.w / 2, t = 0.4, gt = 3, tilt = 0
    let bs: { x: number; y: number; w: number; h: number; v: number; near: boolean; c: number }[] = []
    let gems: { x: number; y: number }[] = []
    g.lives = 0
    const cols = [g.pal.hot, g.pal.warn, '#c84a6a']
    return (dt) => {
      g.stars(0, 160 + g.time * 3)
      const px = x
      x = clamp(steer(g, x, 300, dt), 14, g.w - 14)
      tilt += (clamp((x - px) * 0.6, -0.5, 0.5) - tilt) * Math.min(1, dt * 12)
      t -= dt
      if (t <= 0) { t = Math.max(0.17, 0.62 - g.time * 0.0065); const w = g.rnd(18, 54); bs.push({ x: g.rnd(0, g.w - w), y: -30, w, h: g.rnd(14, 24), v: g.rnd(120, 190) + g.time * 3.2, near: false, c: Math.floor(Math.random() * 3) }) }
      gt -= dt
      if (gt <= 0) { gt = g.rnd(3, 5); gems.push({ x: g.rnd(30, g.w - 30), y: -10 }) }
      const py = g.h - 40
      for (const b of bs) {
        b.y += b.v * dt
        drop(g, b.x, b.y, b.w, b.h, 4)
        g.rrect(b.x, b.y, b.w, b.h, 4, cols[b.c]); g.rect(b.x + 3, b.y + 3, b.w - 6, 3, 'rgba(255,255,255,.28)')
        if (hit(x - 9, py - 4, 18, 24, b.x + 2, b.y + 2, b.w - 4, b.h - 4)) { g.end(x, py + 8); return }
        if (!b.near && b.y > py - 6 && b.y < py + 20 && (Math.abs(b.x + b.w / 2 - x) < b.w / 2 + 22)) { b.near = true; g.score += 5; g.pop('close +5', x, py - 24, g.pal.ice); g.sfx('blip') }
      }
      bs = bs.filter((b) => b.y < g.h)
      for (const m of gems) {
        m.y += 130 * dt
        g.tri(m.x, m.y - 8, m.x + 7, m.y, m.x, m.y + 8, g.pal.ice); g.tri(m.x, m.y - 8, m.x - 7, m.y, m.x, m.y + 8, '#a6e8ff')
        if (Math.hypot(m.x - x, m.y - py) < 18) { m.y = 999; g.score += 25; g.pop('+25', m.x, py - 20, g.pal.ice); g.burst(m.x, py, g.pal.ice, 10, 120); g.sfx('coin') }
      }
      gems = gems.filter((m) => m.y < g.h + 10)
      // the ship
      g.c.save(); g.c.translate(x, py + 8); g.c.rotate(tilt)
      g.tri(-5, 14, 5, 14, 0, 14 + 8 + Math.random() * 8, g.pal.warn)
      g.tri(-12, 14, 12, 14, 0, -16, g.pal.signal); g.tri(-4, 14, 4, 14, 0, -4, g.pal.bg)
      g.c.restore()
      g.score += dt * 4
      g.lives = 0
    }
  },
}

