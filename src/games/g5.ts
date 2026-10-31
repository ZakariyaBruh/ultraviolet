import { clamp, drop, ease, hearts, hit, hurt, mix, steer, type G, type Game } from './engine'

/** a synthwave floor: a sun on the horizon and a grid running toward it */
const synth = (g: G, t: number, horizon = 96) => {
  const c = g.c
  c.save()
  c.globalAlpha = g.light ? 0.16 : 0.2
  c.fillStyle = g.pal.hot
  c.beginPath(); c.arc(g.w / 2, horizon, 54, Math.PI, 0); c.fill()
  c.fillStyle = g.pal.bg
  for (let i = 0; i < 5; i++) c.fillRect(g.w / 2 - 60, horizon - 46 + i * 9 + ((t * 8) % 9) * 0, 120, 1 + i * 0.9)
  c.globalAlpha = 1
  c.restore()
  g.c.globalAlpha = 0.11
  g.rect(0, horizon, g.w, 1, g.pal.ink)
  for (let i = -10; i <= 10; i++) g.line(g.w / 2 + i * 8, horizon, g.w / 2 + i * 56, g.h, g.pal.ink, 1)
  const off = (t * 0.5) % 1
  for (let k = 0; k < 9; k++) { const u = (k + off) / 9; const y = horizon + (g.h - horizon) * u * u; g.rect(0, y, g.w, 1, g.pal.ink) }
  g.c.globalAlpha = 1
}

export const pong: Game = {
  id: 'pong', name: 'Rally', blurb: 'Neon arena. Bank shots off the bumpers.', how: 'Move the paddle; hit with the edge to steer. Bumpers score.', pad: ['left', 'right'], pointer: true,
  make: (g) => {
    interface B { x: number; y: number; vx: number; vy: number; tr: { x: number; y: number }[] }
    interface Bump { x: number; y: number; r: number; p: number }
    const layouts = [[[150, 130], [330, 130]], [[240, 100], [140, 160], [340, 160]], [[110, 110], [240, 150], [370, 110], [240, 80]]]
    let px = g.w / 2, pv = 0, squash = 0, hits = 0, level = 1, speedK = 1
    const mk = (): B => ({ x: g.rnd(150, g.w - 150), y: 190, vx: g.rnd(-90, 90), vy: -190 * speedK, tr: [] })
    let bs: B[] = [mk()]
    let bumps: Bump[] = layouts[0].map(([x, y]) => ({ x, y, r: 17, p: 0 }))
    let wallFx: { x: number; y: number; t: number }[] = []
    g.banner('RALLY', 'keep the balls alive')
    return (dt) => {
      synth(g, g.time)
      const lx = px
      px = clamp(steer(g, px, 430, dt), 42, g.w - 42)
      pv += (((px - lx) / Math.max(dt, 0.001)) - pv) * Math.min(1, dt * 14)
      squash = Math.max(0, squash - dt * 6)
      g.mult = 1 + Math.min(4, Math.floor(hits / 6))
      let fast = 0
      for (const b of bs) {
        b.x += b.vx * dt; b.y += b.vy * dt
        b.tr.push({ x: b.x, y: b.y }); if (b.tr.length > 10) b.tr.shift()
        const sp = Math.hypot(b.vx, b.vy); fast = Math.max(fast, sp)
        if (b.x < 10) { b.vx = Math.abs(b.vx); b.x = 10; wallFx.push({ x: 0, y: b.y, t: 0 }); g.sfx('blip') }
        if (b.x > g.w - 10) { b.vx = -Math.abs(b.vx); b.x = g.w - 10; wallFx.push({ x: g.w, y: b.y, t: 0 }); g.sfx('blip') }
        if (b.y < 10) { b.vy = Math.abs(b.vy); b.y = 10; wallFx.push({ x: b.x, y: 0, t: 0 }); g.sfx('blip') }
        for (const m of bumps) {
          const dx = b.x - m.x, dy = b.y - m.y, d = Math.hypot(dx, dy)
          if (d < m.r + 7) {
            const nx = dx / d, ny = dy / d, dot = b.vx * nx + b.vy * ny
            b.vx = (b.vx - 2 * dot * nx) * 1.05; b.vy = (b.vy - 2 * dot * ny) * 1.05
            b.x = m.x + nx * (m.r + 8); b.y = m.y + ny * (m.r + 8)
            m.p = 1; const pts = 25 * g.mult; g.score += pts; g.pop(`+${pts}`, m.x, m.y - m.r - 8, g.pal.ice); g.burst(b.x, b.y, g.pal.ice, 8, 140, 3, 'line'); g.shockwave(m.x, m.y, g.pal.ice, 40); g.sfx('pop'); g.freeze(0.025)
          }
        }
        if (b.vy > 0 && b.y > g.h - 36 && b.y < g.h - 20 && Math.abs(b.x - px) < 48) {
          const off = clamp((b.x - px) / 48, -1, 1)
          const s = Math.min(560, Math.hypot(b.vx, b.vy) * 1.03 + 4)
          b.vx = Math.sin(off * 1.05) * s + pv * 0.12; b.vy = -Math.cos(off * 1.05) * s
          hits++; squash = 1; g.score += 10 * g.mult; g.note(hits % 12); g.burst(b.x, g.h - 34, g.pal.signal, 6, 100, 2, 'line'); g.shake(1.5)
          if (Math.abs(off) < 0.12) { g.pop('perfect', b.x, g.h - 60, g.pal.signal); g.score += 10 }
          if (hits % 9 === 0 && bs.length < 3) { bs.push(mk()); g.pop('multiball', g.w / 2, 120, g.pal.hot); g.sfx('win') }
          if (hits % 14 === 0) { level++; speedK *= 1.08; bumps = layouts[(level - 1) % 3].map(([x, y]) => ({ x, y, r: 17, p: 0 })); g.banner(`LEVEL ${level}`, 'faster'); g.flash(g.pal.signal, 0.2) }
        }
      }
      const n0 = bs.length
      bs = bs.filter((b) => b.y < g.h + 14)
      if (bs.length < n0 && bs.length > 0) { g.shake(5); g.sfx('hit') }
      if (!bs.length) { hurt(g, px, g.h - 20); hits = Math.floor(hits / 2); bs = [mk()]; g.flash(g.pal.hot, 0.3) }
      g.intensity = clamp(fast / 460, 0.2, 1)
      for (const w of wallFx) { w.t += dt; g.c.globalAlpha = Math.max(0, 1 - w.t * 3); if (w.x === 0 || w.x === g.w) g.rect(w.x === 0 ? 0 : g.w - 4, w.y - 24, 4, 48, g.pal.ice); else g.rect(w.x - 24, 0, 48, 4, g.pal.ice); g.c.globalAlpha = 1 }
      wallFx = wallFx.filter((w) => w.t < 0.34)
      g.c.globalAlpha = 0.4; g.rect(0, 0, 2, g.h, g.pal.ice); g.rect(g.w - 2, 0, 2, g.h, g.pal.ice); g.rect(0, 0, g.w, 2, g.pal.ice); g.c.globalAlpha = 1
      for (const m of bumps) {
        m.p = Math.max(0, m.p - dt * 5)
        const r = m.r * (1 + m.p * 0.25)
        drop(g, m.x - r, m.y - r, r * 2, r * 2, r); g.circ(m.x, m.y, r, g.pal.ground2); g.ring(m.x, m.y, r, g.pal.ice, 3); g.circ(m.x, m.y, r * 0.45, m.p > 0.3 ? g.pal.ink : g.pal.ice); g.circ(m.x - r * 0.3, m.y - r * 0.3, 2, g.hi)
      }
      for (const b of bs) {
        const sp = Math.hypot(b.vx, b.vy), col = mix(g.pal.ink, g.pal.hot, clamp((sp - 260) / 260, 0, 1))
        b.tr.forEach((q, i) => { g.c.globalAlpha = (i / b.tr.length) * 0.5; g.circ(q.x, q.y, 2 + (i / b.tr.length) * 5, col) }); g.c.globalAlpha = 1
        g.circ(b.x, b.y + 2, 7, g.lo); g.circ(b.x, b.y, 7, col); g.circ(b.x - 2, b.y - 2, 2, g.hi)
      }
      const pw = 88 * (1 - squash * 0.08), ph = 10 * (1 + squash * 0.7)
      drop(g, px - pw / 2, g.h - 26, pw, ph, 5)
      g.rrect(px - pw / 2, g.h - 26 - squash * 2, pw, ph, 5, g.pal.signal); g.rect(px - pw / 2 + 5, g.h - 25 - squash * 2, pw - 10, 2, g.hi)
      g.rect(px - pw / 2, g.h - 26 + ph - 3 - squash * 2, 6, 3, g.pal.ink); g.rect(px + pw / 2 - 6, g.h - 26 + ph - 3 - squash * 2, 6, 3, g.pal.ink)
      hearts(g)
    }
  },
}

export const breakout: Game = {
  id: 'breakout', name: 'Breakout', blurb: 'Four levels of bricks: steel, explosives, lasers, multiball.', how: 'Move the paddle. Space or click launches and fires lasers.', pad: ['left', 'right', 'act'], pointer: true,
  make: (g) => {
    type K = 'n' | 't' | 's' | 'x'
    interface Brick { x: number; y: number; k: K; hp: number; c: string; f: number }
    interface Ball { x: number; y: number; vx: number; vy: number; tr: { x: number; y: number }[] }
    const cols = [g.pal.hot, g.pal.warn, g.pal.signal, g.pal.ok, g.pal.ice]
    const PAT = [
      ['nnnnnnnnnn', 'nnnnnnnnnn', 'tttttttttt', 'nnnnnnnnnn', 'nnnnnnnnnn'],
      ['n.n.n.n.n.', '.n.n.n.n.n', 'nsnnxnnsnn', '.n.n.n.n.n', 'n.n.n.n.n.'],
      ['....nn....', '...nttn...', '..nnxxnn..', '.nnsnnsnn.', 'nntnnnntnn'],
      ['ssnnnnnnss', 'nnxnnnnxnn', 'nttttttttn', 'nnxnnnnxnn', 'ssnnnnnnss', '..nn..nn..'],
    ]
    let level = 0
    let bricks: Brick[] = []
    const build = () => { bricks = []; PAT[level % 4].forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') bricks.push({ x: 12 + c * 45.6, y: 44 + r * 17, k: ch as K, hp: ch === 't' ? 2 : ch === 's' ? 99 : 1, c: ch === 'x' ? g.pal.hot : cols[r % 5], f: 0 }) })) }
    build()
    let px = g.w / 2, pw = 76, wide = 0, slow = 0, laser = 0, squash = 0, hold = true, chain = 0, lcd = 0
    let balls: Ball[] = [{ x: px, y: g.h - 36, vx: 0, vy: 0, tr: [] }]
    let caps: { x: number; y: number; k: 'W' | 'S' | 'M' | 'L'; t: number }[] = []
    let lasers: { x: number; y: number }[] = []
    const CAP = { W: 'ok', S: 'ice', M: 'warn', L: 'hot' } as const
    const kill = (b: Brick, by: 'ball' | 'laser' | 'blast') => {
      b.hp = 0; g.score += 10 * g.mult; g.burst(b.x + 21, b.y + 7, b.c, 8, 150, 3); g.sfx('pop')
      if (b.k === 'x') { g.shockwave(b.x + 21, b.y + 7, g.pal.hot, 60); g.shake(6); g.freeze(0.05); g.flash(g.pal.hot, 0.18); g.sfx('boom'); for (const o of bricks) if (o.hp > 0 && o !== b && Math.hypot(o.x - b.x, o.y - b.y) < 70 && o.k !== 's') kill(o, 'blast') }
      if (by !== 'blast' && Math.random() < 0.13) caps.push({ x: b.x + 21, y: b.y + 7, k: (['W', 'S', 'M', 'L'] as const)[Math.floor(Math.random() * 4)], t: 0 })
    }
    g.banner('LEVEL 1', 'break them all')
    return (dt) => {
      g.stars(0, 6, 40); g.c.globalAlpha = 0.05; for (let i = 0; i < 4; i++) g.circ(100 + i * 110 + Math.sin(g.time * 0.3 + i) * 20, 120 + (i % 2) * 70, 60 + i * 10, g.pal.ink); g.c.globalAlpha = 1
      px = clamp(steer(g, px, 440, dt), pw / 2, g.w - pw / 2)
      wide = Math.max(0, wide - dt); slow = Math.max(0, slow - dt); laser = Math.max(0, laser - dt); squash = Math.max(0, squash - dt * 6); lcd -= dt
      pw = wide > 0 ? 116 : 76
      g.mult = 1 + Math.min(3, Math.floor(chain / 4))
      const fire = g.tap.has('act') || g.ptr.hit
      if (hold) { const b = balls[0]; b.x = px; b.y = g.h - 36; if (fire) { hold = false; const a = g.rnd(-0.45, 0.45); b.vx = Math.sin(a) * 260; b.vy = -Math.cos(a) * 260; g.sfx('shoot') } }
      else if (laser > 0 && fire && lcd <= 0) { lasers.push({ x: px - pw / 2 + 4, y: g.h - 34 }, { x: px + pw / 2 - 4, y: g.h - 34 }); lcd = 0.28; g.sfx('shoot') }
      let top = 0
      if (!hold) for (const b of balls) {
        const k = slow > 0 ? 0.68 : 1
        b.x += b.vx * dt * k; b.y += b.vy * dt * k
        b.tr.push({ x: b.x, y: b.y }); if (b.tr.length > 8) b.tr.shift()
        top = Math.max(top, Math.hypot(b.vx, b.vy))
        if (b.x < 5 || b.x > g.w - 5) { b.vx = -b.vx; b.x = clamp(b.x, 5, g.w - 5); g.sfx('blip') }
        if (b.y < 5) { b.vy = Math.abs(b.vy); b.y = 5; g.sfx('blip') }
        if (b.vy > 0 && b.y > g.h - 38 && b.y < g.h - 20 && Math.abs(b.x - px) < pw / 2 + 4) { const off = (b.x - px) / (pw / 2); const sp = Math.min(440, Math.hypot(b.vx, b.vy)); b.vx = Math.sin(off * 1.05) * sp; b.vy = -Math.cos(off * 1.05) * sp; squash = 1; chain = 0; g.sfx('pop'); g.shake(1.5) }
        for (const br of bricks) if (br.hp > 0 && hit(b.x - 4, b.y - 4, 8, 8, br.x, br.y, 42, 14)) {
          const side = Math.abs(b.x - (br.x + 21)) > 22 && Math.abs(b.y - (br.y + 7)) < 11
          if (side) b.vx = -b.vx; else b.vy = -b.vy
          br.f = 1
          if (br.k === 's') { g.sfx('blip'); g.burst(b.x, b.y, g.pal.ink2, 3, 80, 2, 'line'); break }
          br.hp--; chain++
          if (br.hp <= 0) kill(br, 'ball'); else { g.sfx('pop'); g.burst(b.x, b.y, g.pal.ink, 4, 90, 2) }
          const sp = Math.hypot(b.vx, b.vy); if (sp < 450) { b.vx *= 1.012; b.vy *= 1.012 }
          break
        }
      }
      for (const l of lasers) { l.y -= 520 * dt; for (const br of bricks) if (br.hp > 0 && hit(l.x - 1, l.y, 3, 12, br.x, br.y, 42, 14)) { l.y = -99; if (br.k !== 's') { br.hp--; if (br.hp <= 0) kill(br, 'laser') } else g.sfx('blip') } }
      lasers = lasers.filter((l) => l.y > -10)
      const before = balls.length
      balls = balls.filter((b) => b.y < g.h + 10)
      if (!hold && balls.length < before && balls.length > 0) g.shake(4)
      if (!hold && !balls.length) { hurt(g, px, g.h - 8); hold = true; wide = 0; laser = 0; chain = 0; balls = [{ x: px, y: g.h - 36, vx: 0, vy: 0, tr: [] }]; g.flash(g.pal.hot, 0.3) }
      bricks = bricks.filter((b) => b.hp > 0)
      if (!bricks.some((b) => b.k !== 's')) { level++; build(); hold = true; g.score += 100; balls = [{ x: px, y: g.h - 36, vx: 0, vy: 0, tr: [] }]; caps = []; g.banner(`LEVEL ${level + 1}`, 'clear!'); g.sfx('win'); g.flash(g.pal.signal, 0.25) }
      g.intensity = clamp(top / 440, 0.2, 1)
      for (const q of caps) {
        q.y += 80 * dt; q.t += dt
        const col = g.pal[CAP[q.k]]
        drop(g, q.x - 12, q.y - 8, 24, 16, 8); g.rrect(q.x - 12, q.y - 8, 24, 16, 8, col); g.rect(q.x - 8, q.y - 6, 16, 2, g.hi); g.text(q.k, q.x, q.y - 8, g.pal.bg, 14, 'center')
        if (hit(q.x - 12, q.y - 8, 24, 16, px - pw / 2, g.h - 28, pw, 14)) {
          q.y = 999; g.sfx('coin'); g.burst(q.x, g.h - 30, col, 10, 120)
          if (q.k === 'W') { wide = 12; g.pop('wide', px, g.h - 54, col) }
          else if (q.k === 'S') { slow = 10; g.pop('slow', px, g.h - 54, col) }
          else if (q.k === 'L') { laser = 9; g.pop('lasers', px, g.h - 54, col) }
          else { g.pop('multiball', px, g.h - 54, col); const src = balls[0]; if (src && !hold) for (const a of [-0.5, 0.5]) balls.push({ x: src.x, y: src.y, vx: src.vx * Math.cos(a) - src.vy * Math.sin(a), vy: src.vx * Math.sin(a) + src.vy * Math.cos(a), tr: [] }) }
        }
      }
      caps = caps.filter((q) => q.y < g.h + 10)
      for (const br of bricks) {
        br.f = Math.max(0, br.f - dt * 8)
        const col = br.f > 0.2 ? g.pal.ink : br.k === 's' ? g.pal.ink2 : br.k === 't' && br.hp > 1 ? mix(br.c, g.pal.ink, 0.35) : br.c
        drop(g, br.x, br.y, 42, 14, 3, 1, 2); g.rrect(br.x, br.y, 42, 14, 3, col); g.rect(br.x + 2, br.y + 2, 38, 2, g.hi)
        if (br.k === 's') { g.rect(br.x + 4, br.y + 6, 34, 1, g.lo); g.circ(br.x + 5, br.y + 7, 1.5, g.lo); g.circ(br.x + 37, br.y + 7, 1.5, g.lo) }
        if (br.k === 'x') { g.circ(br.x + 21, br.y + 7, 4 + Math.sin(g.time * 10) * 0.8, g.pal.warn); g.text('!', br.x + 21, br.y - 1, g.pal.bg, 12, 'center') }
      }
      for (const l of lasers) g.rect(l.x - 1, l.y, 3, 12, g.pal.hot)
      for (const b of balls) { b.tr.forEach((q, i) => { g.c.globalAlpha = (i / b.tr.length) * 0.45; g.circ(q.x, q.y, 1 + (i / b.tr.length) * 4, g.pal.ink) }); g.c.globalAlpha = 1; g.circ(b.x, b.y + 1.5, 5, g.lo); g.circ(b.x, b.y, 5, g.pal.ink); g.circ(b.x - 1.5, b.y - 1.5, 1.6, g.hi) }
      const ph = 10 * (1 + squash * 0.6), pc = wide > 0 ? g.pal.ok : g.pal.signal
      drop(g, px - pw / 2, g.h - 26, pw, ph, 5)
      g.rrect(px - pw / 2, g.h - 26, pw, ph, 5, pc); g.rect(px - pw / 2 + 5, g.h - 25, pw - 10, 2, g.hi)
      if (laser > 0) { g.rect(px - pw / 2 + 2, g.h - 32, 4, 7, g.pal.hot); g.rect(px + pw / 2 - 6, g.h - 32, 4, 7, g.pal.hot) }
      if (hold) g.text(laser > 0 ? '' : 'space or click to launch', g.w / 2, g.h - 62, g.pal.ink2, 13, 'center')
      const tags: [number, string, string][] = [[wide, 'wide', g.pal.ok], [slow, 'slow', g.pal.ice], [laser, 'laser', g.pal.hot]]
      let ty = 70; for (const [t, n, col] of tags) if (t > 0) { g.rect(10, ty, 4, 10, col); g.text(`${n} ${Math.ceil(t)}`, 18, ty - 2, col, 12); ty += 14 }
      hearts(g)
    }
  },
}

export const snake: Game = {
  id: 'snake', name: 'Snake', blurb: 'A smooth garden run: gold apples, stars, and rocks.', how: 'Arrow keys, the pad, or swipe. Rocks grow in as you eat.', pad: ['left', 'up', 'down', 'right'], pointer: true,
  make: (g) => {
    const cw = g.w / 24, ch = (g.h - 22) / 15, top = 22
    type P = { x: number; y: number }
    let body: P[] = [{ x: 8, y: 7 }, { x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }]
    let prev: P[] = body.map((b) => ({ ...b }))
    let dir: P = { x: 1, y: 0 }, want = dir, t = 0, eaten = 0, boost = 0, tongue = 0
    let gold: (P & { life: number }) | null = null
    let star: (P & { life: number }) | null = null
    let rocks: P[] = []
    let bulges: number[] = []
    let sx = 0, sy = 0, swiping = false
    const occupied = (p: P) => body.some((b) => b.x === p.x && b.y === p.y) || rocks.some((r) => r.x === p.x && r.y === p.y)
    const free = (near = false): P => { for (let i = 0; i < 200; i++) { const p = { x: Math.floor(Math.random() * 24), y: Math.floor(Math.random() * 15) }; if (!occupied(p) && !(near && Math.abs(p.x - body[0].x) + Math.abs(p.y - body[0].y) < 5)) return p } return { x: 0, y: 0 } }
    let food = free()
    g.lives = 0
    const px = (v: number) => v * cw + cw / 2, py = (v: number) => top + v * ch + ch / 2
    g.banner('SNAKE', 'mind the rocks')
    return (dt) => {
      for (let y = 0; y < 15; y++) for (let x = 0; x < 24; x++) { g.c.globalAlpha = (x + y) % 2 ? 0.06 : 0.025; g.rect(x * cw, top + y * ch, cw, ch, g.pal.ok) }
      g.c.globalAlpha = 1
      g.rect(0, top - 1, g.w, 1, g.pal.ink2)
      if (g.ptr.down && !swiping) { swiping = true; sx = g.ptr.x; sy = g.ptr.y }
      if (!g.ptr.down) swiping = false
      if (swiping) { const dx = g.ptr.x - sx, dy = g.ptr.y - sy; if (Math.hypot(dx, dy) > 22) { if (Math.abs(dx) > Math.abs(dy)) { if (dir.x === 0) want = { x: Math.sign(dx), y: 0 } } else if (dir.y === 0) want = { x: 0, y: Math.sign(dy) }; sx = g.ptr.x; sy = g.ptr.y } }
      if (g.tap.has('left') && dir.x === 0) want = { x: -1, y: 0 }
      if (g.tap.has('right') && dir.x === 0) want = { x: 1, y: 0 }
      if (g.tap.has('up') && dir.y === 0) want = { x: 0, y: -1 }
      if (g.tap.has('down') && dir.y === 0) want = { x: 0, y: 1 }
      boost = Math.max(0, boost - dt); tongue = (tongue + dt) % 2.4
      g.mult = boost > 0 ? 2 : 1
      if (gold) { gold.life -= dt; if (gold.life <= 0) gold = null }
      if (star) { star.life -= dt; if (star.life <= 0) star = null }
      const every = Math.max(0.062, 0.14 - body.length * 0.0011) * (boost > 0 ? 0.8 : 1)
      t += dt
      if (t >= every) {
        t -= every; dir = want
        prev = body.map((b) => ({ ...b }))
        const h = { x: body[0].x + dir.x, y: body[0].y + dir.y }
        if (h.x < 0 || h.y < 0 || h.x >= 24 || h.y >= 15 || body.slice(0, -1).some((b) => b.x === h.x && b.y === h.y) || rocks.some((r) => r.x === h.x && r.y === h.y)) { g.end(px(body[0].x), py(body[0].y)); return }
        body = [h, ...body]; bulges = bulges.map((i) => i + 1).filter((i) => i < body.length)
        let grew = false
        if (h.x === food.x && h.y === food.y) {
          grew = true; eaten++; const pts = 10 * g.mult; g.score += pts; g.sfx('coin'); g.note(eaten % 8 * 2); g.burst(px(h.x), py(h.y), g.pal.hot, 10, 130, 3, 'circ'); g.pop(`+${pts}`, px(h.x), py(h.y) - 12, g.pal.hot); g.shockwave(px(h.x), py(h.y), g.pal.hot, 30); bulges.push(0)
          food = free()
          if (!gold && Math.random() < 0.2) gold = { ...free(), life: 6 }
          if (!star && Math.random() < 0.12) star = { ...free(), life: 7 }
          if (eaten % 4 === 0) { rocks.push(free(true)); g.banner('ROCKS', 'a new one grows'); g.flash(g.pal.warn, 0.12) }
        } else if (gold && h.x === gold.x && h.y === gold.y) { grew = true; const pts = 40 * g.mult; g.score += pts; g.sfx('win'); g.burst(px(h.x), py(h.y), g.pal.signal, 16, 160, 3, 'line'); g.pop(`+${pts}`, px(h.x), py(h.y) - 12, g.pal.signal); g.freeze(0.04); gold = null }
        else if (star && h.x === star.x && h.y === star.y) { boost = 8; g.sfx('win'); g.pop('double score', px(h.x), py(h.y) - 12, g.pal.ice); g.flash(g.pal.ice, 0.2); star = null }
        if (!grew) body.pop()
        g.intensity = clamp(0.25 + body.length / 40 + (boost > 0 ? 0.3 : 0), 0, 1)
      }
      const k = ease(clamp(t / every, 0, 1))
      const pos = (i: number): P => { const a = body[i], b0 = prev[i] ?? a; return { x: b0.x + (a.x - b0.x) * k, y: b0.y + (a.y - b0.y) * k } }
      for (const r of rocks) { drop(g, r.x * cw + 2, top + r.y * ch + 4, cw - 4, ch - 6, 7); g.rrect(r.x * cw + 2, top + r.y * ch + 3, cw - 4, ch - 6, 7, mix(g.pal.ink2, g.pal.bg, 0.35)); g.rrect(r.x * cw + 4, top + r.y * ch + 5, cw - 12, 5, 3, g.hi); g.rect(r.x * cw + 8, top + r.y * ch + 12, 6, 1, g.lo) }
      const bob = Math.sin(g.time * 6) * 1.5
      g.circ(px(food.x), py(food.y) + 3, 7, g.lo); g.circ(px(food.x), py(food.y) + bob, 8, g.pal.hot); g.circ(px(food.x) - 3, py(food.y) - 3 + bob, 2.4, g.hi); g.rect(px(food.x) - 1, py(food.y) - 12 + bob, 2, 5, '#6b4f2a'); g.tri(px(food.x), py(food.y) - 10 + bob, px(food.x) + 7, py(food.y) - 13 + bob, px(food.x) + 3, py(food.y) - 7 + bob, g.pal.ok)
      if (gold) { const f = gold.life < 2 && Math.floor(g.time * 8) % 2; if (!f) { g.circ(px(gold.x), py(gold.y) + bob, 8, g.pal.signal); g.circ(px(gold.x) - 3, py(gold.y) - 3 + bob, 2.4, g.hi); g.ring(px(gold.x), py(gold.y) + bob, 11 + Math.sin(g.time * 12), g.pal.signal, 1.5) } }
      if (star) { g.c.save(); g.c.translate(px(star.x), py(star.y) + bob); g.c.rotate(g.time * 2); for (let i = 0; i < 5; i++) { g.c.rotate((Math.PI * 2) / 5); g.tri(-3, -3, 3, -3, 0, -10, g.pal.ice) } g.circ(0, 0, 4, g.pal.ice); g.c.restore() }
      // the body: a tube drawn as thick strokes with a lighter spine
      const pts = body.map((_, i) => pos(i))
      const c = g.c
      c.lineJoin = 'round'; c.lineCap = 'round'
      const stroke = (w: number, col: string, dy = 0) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(px(p.x), py(p.y) + dy) : c.moveTo(px(p.x), py(p.y) + dy))); c.stroke() }
      stroke(cw - 3, g.lo, 3); stroke(cw - 3, mix(g.pal.ok, g.pal.bg, 0.25)); stroke(cw - 9, g.pal.ok); stroke(3, g.hi, -2)
      pts.forEach((p, i) => { if (i % 3 === 1 && i < pts.length - 1) g.circ(px(p.x), py(p.y), 2, mix(g.pal.ok, g.pal.bg, 0.4)) })
      for (const bi of bulges) { const p = pts[Math.min(bi, pts.length - 1)]; g.circ(px(p.x), py(p.y), cw / 2 - 1, g.pal.ok) }
      const hd = pts[0]
      const hx = px(hd.x), hy = py(hd.y)
      const hl = Math.atan2(dir.y, dir.x)
      g.c.save(); g.c.translate(hx, hy); g.c.rotate(hl)
      if (tongue > 2 && tongue < 2.25) { g.line(8, 0, 16, 0, g.pal.hot, 2); g.line(16, 0, 20, -3, g.pal.hot, 1.5); g.line(16, 0, 20, 3, g.pal.hot, 1.5) }
      g.circ(0, 0, cw / 2 + 1, g.pal.signal); g.circ(-1, -2, 4, g.hi)
      const blink = tongue > 1.2 && tongue < 1.3
      const ex = Math.cos(Math.atan2(py(food.y) - hy, px(food.x) - hx) - hl) * 1.2, ey = Math.sin(Math.atan2(py(food.y) - hy, px(food.x) - hx) - hl) * 1.2
      for (const s of [-1, 1]) { g.circ(3, s * 4.5, 3, '#fff'); if (!blink) g.circ(3.5 + ex, s * 4.5 + ey, 1.6, '#111'); else g.rect(1, s * 4.5, 5, 1, '#111') }
      g.c.restore()
      if (boost > 0) g.text(`x2 ${Math.ceil(boost)}`, g.w - 10, 26, g.pal.ice, 14, 'right')
      g.text(`${body.length} long`, g.w / 2, 4, g.pal.ink2, 13, 'center')
    }
  },
}
