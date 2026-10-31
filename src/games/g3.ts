import { clamp, lerp, steer, type Game } from './engine'

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

