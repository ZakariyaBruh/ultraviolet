import { clamp, hearts, hit, hurt, steer, type Game } from './engine'

export const dodge: Game = {
  id: 'dodge', name: 'Dodge', blurb: 'Slip between the falling blocks.', how: 'Left and right, or drag.', pad: ['left', 'right'], pointer: true,
  make: (g) => {
    let x = g.w / 2, t = 0
    let bs: { x: number; y: number; w: number; v: number }[] = []
    return (dt) => {
      x = clamp(steer(g, x, 280, dt), 12, g.w - 12)
      t -= dt
      if (t <= 0) { t = Math.max(0.16, 0.55 - g.time * 0.006); bs.push({ x: g.rnd(0, g.w - 40), y: -20, w: g.rnd(18, 56), v: g.rnd(120, 180) + g.time * 3 }) }
      for (const b of bs) { b.y += b.v * dt; g.rect(b.x, b.y, b.w, 16, g.pal.hot); if (hit(x - 10, g.h - 34, 20, 20, b.x, b.y, b.w, 16)) g.end() }
      bs = bs.filter((b) => b.y < g.h)
      g.rect(x - 10, g.h - 34, 20, 20, g.pal.signal)
      g.score = g.time * 10
    }
  },
}

export const catcher: Game = {
  id: 'catch', name: 'Catch', blurb: 'Stars in, bombs out.', how: 'Move the basket. Miss a star and you lose a heart; a bomb costs one too.', pad: ['left', 'right'], pointer: true,
  make: (g) => {
    let x = g.w / 2, t = 0
    let fs: { x: number; y: number; bomb: boolean; v: number }[] = []
    g.lives = 4
    return (dt) => {
      x = clamp(steer(g, x, 300, dt), 30, g.w - 30)
      t -= dt
      if (t <= 0) { t = Math.max(0.3, 0.9 - g.time * 0.01); fs.push({ x: g.rnd(14, g.w - 14), y: -10, bomb: Math.random() < 0.28, v: g.rnd(110, 160) + g.time * 2.5 }) }
      for (const f of fs) {
        f.y += f.v * dt
        g.circ(f.x, f.y, 9, f.bomb ? g.pal.hot : g.pal.signal)
        if (f.bomb) g.text('×', f.x, f.y - 8, g.pal.bg, 16, 'center')
        if (f.y > g.h - 40 && f.y < g.h - 14 && Math.abs(f.x - x) < 34) { if (f.bomb) hurt(g); else g.score += 10; f.y = 999 }
        else if (f.y > g.h && !f.bomb) { hurt(g) }
      }
      fs = fs.filter((f) => f.y < g.h)
      g.rect(x - 30, g.h - 30, 60, 8, g.pal.ice)
      g.rect(x - 30, g.h - 38, 4, 8, g.pal.ice); g.rect(x + 26, g.h - 38, 4, 8, g.pal.ice)
      hearts(g)
    }
  },
}

export const pong: Game = {
  id: 'pong', name: 'Rally', blurb: 'Keep the ball alive; it speeds up.', how: 'Move the paddle.', pad: ['left', 'right'], pointer: true,
  make: (g) => {
    let px = g.w / 2, bx = g.w / 2, by = 120, vx = 150, vy = 170
    return (dt) => {
      px = clamp(steer(g, px, 360, dt), 40, g.w - 40)
      bx += vx * dt; by += vy * dt
      if (bx < 6 || bx > g.w - 6) { vx = -vx; bx = clamp(bx, 6, g.w - 6) }
      if (by < 6) { vy = Math.abs(vy); by = 6 }
      if (vy > 0 && by > g.h - 30 && by < g.h - 16 && Math.abs(bx - px) < 44) { vy = -Math.abs(vy) * 1.04; vx = (bx - px) * 5 + vx * 0.3; g.score += 10 }
      if (by > g.h + 10) { g.lives -= 1; if (g.lives <= 0) g.end(); bx = g.w / 2; by = 100; vy = 170; vx = g.rnd(-120, 120) }
      g.circ(bx, by, 6, g.pal.ink)
      g.rect(px - 40, g.h - 24, 80, 8, g.pal.signal)
      hearts(g)
    }
  },
}

export const breakout: Game = {
  id: 'breakout', name: 'Breakout', blurb: 'Smash every brick.', how: 'Move the paddle.', pad: ['left', 'right'], pointer: true,
  make: (g) => {
    const cols = [g.pal.hot, g.pal.warn, g.pal.signal, g.pal.ok, g.pal.ice]
    let bricks: { x: number; y: number; c: string }[] = []
    const fill = () => { bricks = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) bricks.push({ x: 12 + c * 45.6, y: 40 + r * 18, c: cols[r] }) }
    fill()
    let px = g.w / 2, bx = g.w / 2, by = 220, vx = 130, vy = -190
    return (dt) => {
      px = clamp(steer(g, px, 380, dt), 36, g.w - 36)
      bx += vx * dt; by += vy * dt
      if (bx < 5 || bx > g.w - 5) { vx = -vx; bx = clamp(bx, 5, g.w - 5) }
      if (by < 5) { vy = Math.abs(vy); by = 5 }
      if (vy > 0 && by > g.h - 30 && by < g.h - 16 && Math.abs(bx - px) < 40) { vy = -Math.abs(vy); vx = (bx - px) * 6 }
      for (const b of bricks) if (hit(bx - 4, by - 4, 8, 8, b.x, b.y, 42, 14)) { b.y = 9999; vy = -vy; g.score += 10; break }
      bricks = bricks.filter((b) => b.y < 9000)
      if (!bricks.length) { fill(); vy = -Math.abs(vy) * 1.1; by = 220 }
      if (by > g.h + 10) { hurt(g); bx = g.w / 2; by = 220; vy = -190; vx = g.rnd(-120, 120) }
      for (const b of bricks) g.rect(b.x, b.y, 42, 14, b.c)
      g.circ(bx, by, 5, g.pal.ink)
      g.rect(px - 36, g.h - 24, 72, 8, g.pal.signal)
      hearts(g)
    }
  },
}

export const snake: Game = {
  id: 'snake', name: 'Snake', blurb: 'Eat, grow, do not bite yourself.', how: 'Arrow keys or the pad.', pad: ['left', 'up', 'down', 'right'],
  make: (g) => {
    const cw = g.w / 24, ch = (g.h - 20) / 15
    let body = [{ x: 8, y: 7 }, { x: 7, y: 7 }, { x: 6, y: 7 }]
    let dir = { x: 1, y: 0 }, want = dir, t = 0
    const spawn = () => ({ x: Math.floor(Math.random() * 24), y: Math.floor(Math.random() * 15) })
    let food = spawn()
    return (dt) => {
      if (g.tap.has('left') && dir.x === 0) want = { x: -1, y: 0 }
      if (g.tap.has('right') && dir.x === 0) want = { x: 1, y: 0 }
      if (g.tap.has('up') && dir.y === 0) want = { x: 0, y: -1 }
      if (g.tap.has('down') && dir.y === 0) want = { x: 0, y: 1 }
      t += dt
      const every = Math.max(0.06, 0.13 - body.length * 0.0011)
      if (t >= every) {
        t = 0; dir = want
        const h = { x: body[0].x + dir.x, y: body[0].y + dir.y }
        if (h.x < 0 || h.y < 0 || h.x >= 24 || h.y >= 15 || body.some((b) => b.x === h.x && b.y === h.y)) { g.end(); return }
        body = [h, ...body]
        if (h.x === food.x && h.y === food.y) { g.score += 10; food = spawn() } else body.pop()
      }
      g.rect(0, 20, g.w, 1, g.pal.ink2)
      body.forEach((b, i) => g.rect(b.x * cw + 1, 20 + b.y * ch + 1, cw - 2, ch - 2, i ? g.pal.ok : g.pal.signal))
      g.circ(food.x * cw + cw / 2, 20 + food.y * ch + ch / 2, Math.min(cw, ch) / 2 - 2, g.pal.hot)
    }
  },
}
