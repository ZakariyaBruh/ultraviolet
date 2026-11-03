import { clamp, ease, lerp, mix, type Game } from './engine'

export const stack: Game = {
  id: 'stack', name: 'Stack', blurb: 'Build a tower in 3D. Perfect drops win width back.', how: 'Tap, click or space to drop the sliding slab.', pad: ['act'], pointer: true,
  make: (g) => {
    const H = 15, MAXW = 120
    interface Slab { x: number; z: number; w: number; d: number }
    let tower: Slab[] = [{ x: 0, z: 0, w: MAXW, d: MAXW }]
    let t = 0, w = MAXW, d = MAXW, streak = 0, cam = 0, ringT = 0
    let debris: { x: number; z: number; w: number; d: number; lv: number; vy: number; c: string }[] = []
    const cols = [g.pal.signal, g.pal.ice, g.pal.ok, g.pal.warn, g.pal.hot]
    const colour = (lv: number) => { const i = Math.floor(lv / 5), f = (lv % 5) / 5; return mix(cols[i % 5], cols[(i + 1) % 5], f) }
    const sky = (lv: number) => mix(g.pal.bg, cols[Math.floor(lv / 12) % 5], g.light ? 0.1 : 0.08)
    const CX = g.w / 2
    const proj = (x: number, z: number, lv: number): [number, number] => [CX + (x - z) * 0.866, 178 + (x + z) * 0.5 - (lv - cam) * H]
    const box = (s: Slab, lv: number, c: string, alpha = 1) => {
      const x0 = s.x - s.w / 2, x1 = s.x + s.w / 2, z0 = s.z - s.d / 2, z1 = s.z + s.d / 2
      const poly = (pts: [number, number][], col: string) => { g.c.fillStyle = col; g.c.beginPath(); pts.forEach(([a, b], i) => (i ? g.c.lineTo(a, b) : g.c.moveTo(a, b))); g.c.closePath(); g.c.fill() }
      g.c.globalAlpha = alpha
      poly([proj(x0, z1, lv + 1), proj(x1, z1, lv + 1), proj(x1, z1, lv), proj(x0, z1, lv)], mix(c, '#000000', 0.22))
      poly([proj(x1, z0, lv + 1), proj(x1, z1, lv + 1), proj(x1, z1, lv), proj(x1, z0, lv)], mix(c, '#000000', 0.42))
      poly([proj(x0, z0, lv + 1), proj(x1, z0, lv + 1), proj(x1, z1, lv + 1), proj(x0, z1, lv + 1)], c)
      g.c.globalAlpha = 1
    }
    g.banner('STACK', 'drop it square')
    const clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 90, lv: 10 + i * 5, s: g.rnd(0.7, 1.3) }))
    return (dt) => {
      const lv = tower.length
      g.rect(0, 0, g.w, g.h, sky(cam))
      g.c.globalAlpha = 0.5; for (let i = 0; i < 14; i++) g.rect((i * 53 + 17) % g.w, ((i * 37) % 200), 2, 2, g.pal.ink); g.c.globalAlpha = 1
      for (const c of clouds) { const y = 120 - (c.lv - cam) * 5; if (y > -20 && y < g.h) { c.x = (c.x + 8 * dt) % (g.w + 80); g.c.globalAlpha = g.light ? 0.5 : 0.14; g.rrect(c.x - 40, y, 70 * c.s, 14 * c.s, 8, g.pal.ink); g.rrect(c.x - 24, y - 8 * c.s, 40 * c.s, 14 * c.s, 8, g.pal.ink); g.c.globalAlpha = 1 } }
      const top = tower[lv - 1]
      const alongX = lv % 2 === 0
      const speed = 1.5 + Math.min(2.2, lv * 0.045)
      t += dt * speed
      const range = 96
      const off = Math.sin(t * 2.1) * range
      const cur: Slab = alongX ? { x: top.x + off, z: top.z, w, d } : { x: top.x, z: top.z + off, w, d }
      if (g.tap.has('act') || g.ptr.hit) {
        const a0 = alongX ? cur.x - w / 2 : cur.z - d / 2, a1 = alongX ? cur.x + w / 2 : cur.z + d / 2
        const b0 = alongX ? top.x - top.w / 2 : top.z - top.d / 2, b1 = alongX ? top.x + top.w / 2 : top.z + top.d / 2
        const lo = Math.max(a0, b0), hi = Math.min(a1, b1)
        if (hi - lo < 2) { debris.push({ ...cur, lv, vy: 0, c: colour(lv) }); g.end(...proj(cur.x, cur.z, lv + 1)); g.sfx('hit'); return }
        const perfect = Math.abs((alongX ? cur.x - top.x : cur.z - top.z)) < 4.5
        let slab: Slab
        if (perfect) {
          streak++; slab = { x: top.x, z: top.z, w: Math.min(MAXW, w + (streak > 2 ? 4 : 0)), d: Math.min(MAXW, d + (streak > 2 ? 4 : 0)) }
          w = slab.w; d = slab.d
          const [px, py] = proj(slab.x, slab.z, lv + 1); g.shockwave(px, py, g.pal.ink, 80); ringT = 1; g.burst(px, py, g.pal.signal, 14, 150, 3, 'line'); g.flash(g.pal.signal, 0.12)
          g.pop(streak > 1 ? `PERFECT x${streak}` : 'PERFECT', px, py - 30, g.pal.signal); g.score += 10 + streak * 6; g.note(Math.min(24, streak * 2)); g.sfx('win')
        } else {
          streak = 0
          slab = alongX ? { x: (lo + hi) / 2, z: top.z, w: hi - lo, d } : { x: top.x, z: (lo + hi) / 2, w, d: hi - lo }
          if (alongX) w = hi - lo; else d = hi - lo
          const cut: Slab = alongX ? (cur.x < top.x ? { x: (a0 + lo) / 2, z: cur.z, w: lo - a0, d } : { x: (hi + a1) / 2, z: cur.z, w: a1 - hi, d }) : (cur.z < top.z ? { x: cur.x, z: (a0 + lo) / 2, w, d: lo - a0 } : { x: cur.x, z: (hi + a1) / 2, w, d: a1 - hi })
          debris.push({ ...cut, lv, vy: 0, c: colour(lv) })
          g.score += 10; g.sfx('pop'); g.shake(2); const [px, py] = proj(slab.x, slab.z, lv + 1); g.burst(px, py, colour(lv), 6, 90, 2)
        }
        tower.push(slab); t = Math.asin(0) + (Math.random() < 0.5 ? 0 : Math.PI)
        if (tower.length % 10 === 0) { g.banner(`FLOOR ${tower.length}`, 'keep climbing'); g.flash(g.pal.ice, 0.18) }
      }
      cam = lerp(cam, Math.max(0, tower.length - 7), Math.min(1, dt * 4))
      g.intensity = clamp(0.25 + tower.length / 40, 0, 1)
      // the ground, then the tower from the bottom up
      const ground: Slab = { x: 0, z: 0, w: 210, d: 210 }
      box(ground, -1, mix(g.pal.bg, g.pal.ink, 0.2))
      tower.forEach((s, i) => box(s, i, colour(i)))
      for (const q of debris) { q.vy += 520 * dt; q.lv -= (q.vy * dt) / H; box({ x: q.x, z: q.z, w: q.w, d: q.d }, q.lv, q.c, clamp(1 - (lv - q.lv) / 12, 0, 1)) }
      debris = debris.filter((q) => q.lv > cam - 6)
      const curLv = tower.length
      // the shadow of the moving slab on the tower, then the slab
      box(cur, curLv, g.pal.ink)
      if (ringT > 0) { ringT -= dt * 2.4 }
      g.text(`${tower.length - 1} floors`, g.w - 10, 26, g.pal.ink2, 13, 'right')
      void ease
    }
  },
}
