import { clamp, drop, grid, hearts, hit, hurt, steer, type Game } from './engine'

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

export const catcher: Game = {
  id: 'catch', name: 'Catch', blurb: 'Stars in, bombs out. Chain them for a multiplier.', how: 'Move the basket. Missing a star or catching a bomb costs a heart.', pad: ['left', 'right'], pointer: true,
  make: (g) => {
    let x = g.w / 2, t = 0.2, combo = 0, bounce = 0
    let fs: { x: number; y: number; k: 'star' | 'bomb' | 'gem'; v: number; r: number }[] = []
    g.lives = 4
    return (dt) => {
      grid(g, 32, g.time * 6, true)
      x = clamp(steer(g, x, 340, dt), 34, g.w - 34)
      bounce = Math.max(0, bounce - dt * 6)
      t -= dt
      if (t <= 0) { t = Math.max(0.28, 0.8 - g.time * 0.008); const q = Math.random(); fs.push({ x: g.rnd(16, g.w - 16), y: -12, k: q < 0.24 ? 'bomb' : q < 0.32 ? 'gem' : 'star', v: g.rnd(120, 170) + g.time * 2.4, r: 0 }) }
      for (const f of fs) {
        f.y += f.v * dt; f.r += dt * 3
        if (f.k === 'bomb') { g.circ(f.x, f.y, 10, '#1a1426'); g.ring(f.x, f.y, 10, g.pal.hot, 2); g.line(f.x + 4, f.y - 8, f.x + 8, f.y - 13, g.pal.warn, 2); g.circ(f.x + 9, f.y - 14, 2 + Math.random() * 2, g.pal.warn) }
        else if (f.k === 'gem') { g.tri(f.x, f.y - 10, f.x + 9, f.y, f.x, f.y + 10, g.pal.ice); g.tri(f.x, f.y - 10, f.x - 9, f.y, f.x, f.y + 10, '#a6e8ff') }
        else { g.c.save(); g.c.translate(f.x, f.y); g.c.rotate(f.r); for (let i = 0; i < 5; i++) { g.c.rotate((Math.PI * 2) / 5); g.tri(-3, -4, 3, -4, 0, -11, g.pal.signal) } g.circ(0, 0, 5, g.pal.signal); g.c.restore() }
        const inBasket = f.y > g.h - 52 && f.y < g.h - 22 && Math.abs(f.x - x) < 36
        if (inBasket) {
          f.y = 9999; bounce = 1
          if (f.k === 'bomb') { combo = 0; hurt(g, x, g.h - 40) } else { combo = Math.min(combo + 1, 40); const m = 1 + Math.floor(combo / 5); const pts = (f.k === 'gem' ? 25 : 10) * m; g.score += pts; g.pop(`+${pts}${m > 1 ? ' x' + m : ''}`, f.x, g.h - 64, f.k === 'gem' ? g.pal.ice : g.pal.signal); g.burst(f.x, g.h - 40, f.k === 'gem' ? g.pal.ice : g.pal.signal, 8, 110); g.sfx('coin') }
        } else if (f.y > g.h + 8 && f.k !== 'bomb') { f.y = 9999; combo = 0; hurt(g, f.x, g.h - 6) }
      }
      fs = fs.filter((f) => f.y < 9000 && f.y < g.h + 30)
      const by = g.h - 34 + bounce * 4
      drop(g, x - 32, by, 64, 18, 6)
      g.rrect(x - 32, by, 64, 18, 6, g.pal.ice); g.rect(x - 32, by, 64, 5, '#a6e8ff'); g.rect(x - 28, by + 18, 56, 3, g.pal.ice)
      if (combo >= 5) g.text(`x${1 + Math.floor(combo / 5)}`, g.w - 10, 26, g.pal.signal, 18, 'right')
      hearts(g)
    }
  },
}

export const pong: Game = {
  id: 'pong', name: 'Rally', blurb: 'Keep every ball alive. A new one joins every few hits.', how: 'Move the paddle. Hit with the edge to steer the ball.', pad: ['left', 'right'], pointer: true,
  make: (g) => {
    let px = g.w / 2, hits = 0, shine = 0
    interface B { x: number; y: number; vx: number; vy: number; tr: { x: number; y: number }[] }
    const mk = (): B => ({ x: g.rnd(120, g.w - 120), y: 90, vx: g.rnd(-110, 110), vy: 170, tr: [] })
    let bs: B[] = [mk()]
    return (dt) => {
      grid(g, 40, 0)
      g.c.globalAlpha = 0.5; g.rect(0, 0, 3, g.h, g.pal.ink2); g.rect(g.w - 3, 0, 3, g.h, g.pal.ink2); g.rect(0, 0, g.w, 3, g.pal.ink2); g.c.globalAlpha = 1
      px = clamp(steer(g, px, 400, dt), 40, g.w - 40)
      shine = Math.max(0, shine - dt * 5)
      for (const b of bs) {
        b.x += b.vx * dt; b.y += b.vy * dt
        b.tr.push({ x: b.x, y: b.y }); if (b.tr.length > 8) b.tr.shift()
        if (b.x < 10) { b.vx = Math.abs(b.vx); b.x = 10; g.sfx('blip') }
        if (b.x > g.w - 10) { b.vx = -Math.abs(b.vx); b.x = g.w - 10; g.sfx('blip') }
        if (b.y < 10) { b.vy = Math.abs(b.vy); b.y = 10; g.sfx('blip') }
        if (b.vy > 0 && b.y > g.h - 34 && b.y < g.h - 18 && Math.abs(b.x - px) < 46) {
          const off = (b.x - px) / 46
          const sp = Math.min(520, Math.hypot(b.vx, b.vy) * 1.035)
          const ang = off * 1.0
          b.vx = Math.sin(ang) * sp; b.vy = -Math.cos(ang) * sp
          hits++; shine = 1; g.score += 10; g.sfx('pop'); g.burst(b.x, g.h - 30, g.pal.signal, 5, 90, 2)
          if (hits % 8 === 0 && bs.length < 3) { bs.push(mk()); g.pop('new ball', g.w / 2, 100, g.pal.ice) }
          if (hits % 5 === 0) g.pop(`${hits} hits`, px, g.h - 60, g.pal.ice)
        }
      }
      const before = bs.length
      bs = bs.filter((b) => b.y < g.h + 12)
      if (bs.length < before && bs.length > 0) { g.shake(5); g.sfx('hit') }
      if (!bs.length) { hurt(g, px, g.h - 20); bs = [mk()] }
      for (const b of bs) { b.tr.forEach((q, i) => { g.c.globalAlpha = i / 16; g.circ(q.x, q.y, 3 + i * 0.4, g.pal.ink) }); g.c.globalAlpha = 1; g.circ(b.x, b.y, 7, g.pal.ink) }
      drop(g, px - 42, g.h - 26, 84, 10, 4)
      g.rrect(px - 42, g.h - 26, 84, 10, 4, shine > 0 ? g.pal.ink : g.pal.signal)
      hearts(g)
    }
  },
}

export const breakout: Game = {
  id: 'breakout', name: 'Breakout', blurb: 'Smash every brick. Catch the capsules.', how: 'Move the paddle, click or press space to launch. W widens it, S slows the ball.', pad: ['left', 'right', 'act'], pointer: true,
  make: (g) => {
    const cols = [g.pal.hot, g.pal.warn, g.pal.signal, g.pal.ok, g.pal.ice]
    let bricks: { x: number; y: number; c: string; hp: number }[] = []
    let level = 0
    const fill = () => { bricks = []; for (let r = 0; r < 5 + Math.min(2, level); r++) for (let c = 0; c < 10; c++) if (!(level && (r + c) % 7 === 0)) bricks.push({ x: 12 + c * 45.6, y: 42 + r * 17, c: cols[r % 5], hp: level >= 1 && r === 0 ? 2 : 1 }) }
    fill()
    let px = g.w / 2, pw = 74, wide = 0, slow = 0
    let bx = px, by = g.h - 34, vx = 0, vy = 0, held = true
    let caps: { x: number; y: number; k: 'W' | 'S' }[] = []
    let tr: { x: number; y: number }[] = []
    return (dt) => {
      grid(g, 40, 0)
      px = clamp(steer(g, px, 420, dt), pw / 2, g.w - pw / 2)
      wide = Math.max(0, wide - dt); slow = Math.max(0, slow - dt)
      pw = wide > 0 ? 112 : 74
      if (held) { bx = px; by = g.h - 36; if (g.tap.has('act') || g.ptr.hit) { held = false; const a = g.rnd(-0.5, 0.5); vx = Math.sin(a) * 250; vy = -Math.cos(a) * 250; g.sfx('shoot') } }
      else {
        const k = slow > 0 ? 0.65 : 1
        bx += vx * dt * k; by += vy * dt * k
        tr.push({ x: bx, y: by }); if (tr.length > 7) tr.shift()
        if (bx < 5 || bx > g.w - 5) { vx = -vx; bx = clamp(bx, 5, g.w - 5); g.sfx('blip') }
        if (by < 5) { vy = Math.abs(vy); by = 5; g.sfx('blip') }
        if (vy > 0 && by > g.h - 36 && by < g.h - 20 && Math.abs(bx - px) < pw / 2 + 4) { const off = (bx - px) / (pw / 2); const sp = Math.min(430, Math.hypot(vx, vy)); vx = Math.sin(off * 1.05) * sp; vy = -Math.cos(off * 1.05) * sp; g.sfx('pop') }
        for (const b of bricks) if (hit(bx - 4, by - 4, 8, 8, b.x, b.y, 42, 14)) {
          const fromSide = Math.abs(bx - (b.x + 21)) > 21 + 2 - 1 && Math.abs(by - (b.y + 7)) < 12
          if (fromSide) vx = -vx; else vy = -vy
          b.hp--; g.sfx('pop')
          if (b.hp <= 0) { b.y = 9999; g.score += 10; g.burst(bx, by, b.c, 7, 120, 3); if (Math.random() < 0.14) caps.push({ x: bx, y: by, k: Math.random() < 0.5 ? 'W' : 'S' }) }
          const sp = Math.hypot(vx, vy); if (sp < 440) { vx *= 1.012; vy *= 1.012 }
          break
        }
        bricks = bricks.filter((b) => b.y < 9000)
        if (!bricks.length) { level++; fill(); held = true; tr = []; g.score += 100; g.pop('cleared +100', g.w / 2, 190, g.pal.signal); g.sfx('win') }
        if (by > g.h + 10) { hurt(g, bx, g.h - 6); held = true; tr = []; wide = 0 }
      }
      for (const q of caps) {
        q.y += 90 * dt
        g.rrect(q.x - 11, q.y - 7, 22, 14, 7, q.k === 'W' ? g.pal.ok : g.pal.ice); g.text(q.k, q.x, q.y - 8, g.pal.bg, 13, 'center')
        if (hit(q.x - 11, q.y - 7, 22, 14, px - pw / 2, g.h - 26, pw, 12)) { q.y = 999; g.sfx('coin'); if (q.k === 'W') { wide = 12; g.pop('wide paddle', px, g.h - 50, g.pal.ok) } else { slow = 10; g.pop('slow ball', px, g.h - 50, g.pal.ice) } }
      }
      caps = caps.filter((q) => q.y < g.h + 10)
      for (const b of bricks) { drop(g, b.x, b.y, 42, 14, 2, 1, 2); g.rrect(b.x, b.y, 42, 14, 2, b.hp > 1 ? g.pal.ink : b.c); g.rect(b.x + 2, b.y + 2, 38, 3, 'rgba(255,255,255,.28)') }
      tr.forEach((q, i) => { g.c.globalAlpha = i / 12; g.circ(q.x, q.y, 3, g.pal.ink) }); g.c.globalAlpha = 1
      g.circ(bx, by, 5, g.pal.ink)
      drop(g, px - pw / 2, g.h - 26, pw, 10, 4)
      g.rrect(px - pw / 2, g.h - 26, pw, 10, 4, wide > 0 ? g.pal.ok : g.pal.signal)
      if (held) g.text('space / click to launch', g.w / 2, g.h - 60, g.pal.ink2, 13, 'center')
      hearts(g)
    }
  },
}

export const snake: Game = {
  id: 'snake', name: 'Snake', blurb: 'Eat, grow, do not bite yourself. Gold apples are rare.', how: 'Arrow keys, the pad, or swipe.', pad: ['left', 'up', 'down', 'right'], pointer: true,
  make: (g) => {
    const cw = g.w / 24, ch = (g.h - 22) / 15, top = 22
    let body = [{ x: 8, y: 7 }, { x: 7, y: 7 }, { x: 6, y: 7 }]
    let dir = { x: 1, y: 0 }, want = dir, t = 0, gold: { x: number; y: number; life: number } | null = null
    let sx = 0, sy = 0, swiping = false
    const free = () => { for (;;) { const p = { x: Math.floor(Math.random() * 24), y: Math.floor(Math.random() * 15) }; if (!body.some((b) => b.x === p.x && b.y === p.y)) return p } }
    let food = free()
    g.lives = 0
    const cx = (v: number) => v * cw + cw / 2, cy = (v: number) => top + v * ch + ch / 2
    return (dt) => {
      for (let y = 0; y < 15; y++) for (let x = 0; x < 24; x++) if ((x + y) % 2) { g.c.globalAlpha = 0.05; g.rect(x * cw, top + y * ch, cw, ch, g.pal.ink); g.c.globalAlpha = 1 }
      if (g.ptr.down && !swiping) { swiping = true; sx = g.ptr.x; sy = g.ptr.y }
      if (!g.ptr.down) swiping = false
      if (swiping) { const dx = g.ptr.x - sx, dy = g.ptr.y - sy; if (Math.hypot(dx, dy) > 22) { if (Math.abs(dx) > Math.abs(dy)) { if (dir.x === 0) want = { x: Math.sign(dx), y: 0 } } else if (dir.y === 0) want = { x: 0, y: Math.sign(dy) }; sx = g.ptr.x; sy = g.ptr.y } }
      if (g.tap.has('left') && dir.x === 0) want = { x: -1, y: 0 }
      if (g.tap.has('right') && dir.x === 0) want = { x: 1, y: 0 }
      if (g.tap.has('up') && dir.y === 0) want = { x: 0, y: -1 }
      if (g.tap.has('down') && dir.y === 0) want = { x: 0, y: 1 }
      t += dt
      if (gold) { gold.life -= dt; if (gold.life <= 0) gold = null }
      const every = Math.max(0.065, 0.14 - body.length * 0.0011)
      if (t >= every) {
        t = 0; dir = want
        const h = { x: body[0].x + dir.x, y: body[0].y + dir.y }
        if (h.x < 0 || h.y < 0 || h.x >= 24 || h.y >= 15 || body.slice(0, -1).some((b) => b.x === h.x && b.y === h.y)) { g.end(cx(body[0].x), cy(body[0].y)); return }
        body = [h, ...body]
        if (h.x === food.x && h.y === food.y) { g.score += 10; g.sfx('coin'); g.burst(cx(h.x), cy(h.y), g.pal.hot, 9, 110); g.pop('+10', cx(h.x), cy(h.y) - 10, g.pal.hot); food = free(); if (!gold && Math.random() < 0.22) gold = { ...free(), life: 6 } }
        else if (gold && h.x === gold.x && h.y === gold.y) { g.score += 40; g.sfx('win'); g.burst(cx(h.x), cy(h.y), g.pal.signal, 14, 140); g.pop('+40', cx(h.x), cy(h.y) - 10, g.pal.signal); gold = null; body.push({ ...body[body.length - 1] }) }
        else body.pop()
      }
      const pulse = 1 + Math.sin(g.time * 8) * 0.12
      g.circ(cx(food.x), cy(food.y) + 1, (Math.min(cw, ch) / 2 - 2) * pulse, g.pal.hot); g.rect(cx(food.x) - 1, cy(food.y) - 9, 2, 4, g.pal.ok)
      if (gold) { g.circ(cx(gold.x), cy(gold.y), (Math.min(cw, ch) / 2 - 1) * pulse, g.pal.signal); g.ring(cx(gold.x), cy(gold.y), 9 + Math.sin(g.time * 14) * 2, g.pal.signal, 1) }
      body.forEach((b, i) => { g.rrect(b.x * cw + 1.5, top + b.y * ch + 1.5, cw - 3, ch - 3, 5, i ? (i % 2 ? g.pal.ok : '#38c777') : g.pal.signal); })
      const h = body[0]
      g.circ(cx(h.x) + dir.y * 4 - dir.x * 1, cy(h.y) + dir.x * 4 - dir.y * 1, 2.2, g.pal.bg); g.circ(cx(h.x) - dir.y * 4 - dir.x * 1, cy(h.y) - dir.x * 4 - dir.y * 1, 2.2, g.pal.bg)
    }
  },
}

