import { clamp, cursor, drop, hearts, hit, hurt, lerp, type Cur, type Game } from './engine'

export const gravity: Game = {
  id: 'gravity', name: 'Flip', blurb: 'Run the floor and the ceiling. Dodge the spikes, grab the coins.', how: 'Tap, click or space to flip gravity.', pad: ['act'], pointer: true,
  make: (g) => {
    const top = 34, bot = g.h - 30
    let y = bot - 22, side = 1, t = 1, ct = 2, rot = 0, sx = 0
    let os: { x: number; w: number; up: boolean; k: 'spikes' | 'block'; h: number }[] = []
    let cs: { x: number; y: number }[] = []
    g.lives = 0
    return (dt) => {
      const sp = 200 + g.time * 3.2
      sx = (sx - sp * 0.25 * dt) % 60
      g.c.globalAlpha = 0.07
      for (let x = sx - 60; x < g.w + 60; x += 60) { g.rect(x, bot - 70 - (x % 3) * 8, 36, 70, g.pal.ink); g.rect(x + 8, top, 20, 50 + (x % 5) * 6, g.pal.ink) }
      g.c.globalAlpha = 1
      if (g.tap.has('act') || g.ptr.hit || g.tap.has('up') || g.tap.has('down')) { side = -side; g.sfx('jump'); g.burst(70, y + 11, g.pal.ice, 5, 70, 2) }
      const ty = side > 0 ? bot - 22 : top
      y = lerp(y, ty, Math.min(1, dt * 16))
      rot = lerp(rot, side > 0 ? 0 : Math.PI, Math.min(1, dt * 14))
      t -= dt
      if (t <= 0) { t = g.rnd(0.55, 1.15) * Math.max(0.55, 1 - g.time * 0.006) * (210 / sp) * 1.5; const up = Math.random() < 0.5; os.push(Math.random() < 0.55 ? { x: g.w + 10, w: 18 * (1 + Math.floor(Math.random() * 3)), up, k: 'spikes', h: 22 } : { x: g.w + 10, w: g.rnd(22, 36), up, k: 'block', h: g.rnd(30, 62) }) }
      ct -= dt
      if (ct <= 0) { ct = g.rnd(2, 3.5); const up = Math.random() < 0.5; for (let i = 0; i < 3; i++) cs.push({ x: g.w + 10 + i * 24, y: up ? top + 14 : bot - 14 }) }
      g.rect(0, top - 2, g.w, 2, g.pal.ink2); g.rect(0, bot, g.w, 2, g.pal.ink2)
      for (const o of os) {
        o.x -= sp * dt
        const oy = o.up ? top : bot - o.h
        if (o.k === 'spikes') { for (let i = 0; i < o.w / 18; i++) o.up ? g.tri(o.x + i * 18, top, o.x + i * 18 + 18, top, o.x + i * 18 + 9, top + o.h, g.pal.hot) : g.tri(o.x + i * 18, bot, o.x + i * 18 + 18, bot, o.x + i * 18 + 9, bot - o.h, g.pal.hot) }
        else { drop(g, o.x, oy, o.w, o.h, 3); g.rrect(o.x, oy, o.w, o.h, 3, '#c84a6a'); g.rect(o.x + 3, oy + 3, 4, o.h - 6, 'rgba(255,255,255,.22)') }
        const hb = o.k === 'spikes' ? { y: o.up ? top : bot - o.h * 0.8, h: o.h * 0.8 } : { y: oy, h: o.h }
        if (hit(66, y + 3, 16, 16, o.x + 3, hb.y, o.w - 6, hb.h)) { g.end(74, y + 11); return }
      }
      os = os.filter((o) => o.x > -80)
      for (const c of cs) { c.x -= sp * dt; g.circ(c.x, c.y, 6, g.pal.signal); g.circ(c.x - 1.5, c.y - 1.5, 2, '#fff3b0'); if (Math.hypot(c.x - 74, c.y - (y + 11)) < 15) { c.x = -99; g.score += 10; g.sfx('coin'); g.pop('+10', 74, y - 10) } }
      cs = cs.filter((c) => c.x > -20)
      g.c.save(); g.c.translate(74, y + 11); g.c.rotate(rot)
      g.rrect(-11, -11, 22, 22, 5, g.pal.signal); g.rect(2, -5, 4, 4, g.pal.bg); g.rect(-7, -5, 4, 4, g.pal.bg); g.rect(-6, 4, 12, 3, g.pal.bg)
      g.c.restore()
      g.score += dt * 8
    }
  },
}

export const slash: Game = {
  id: 'slash', name: 'Slash', blurb: 'Cut the fruit, spare the bombs. Multi-cuts pay extra.', how: 'Swipe across the fruit, or steer with the arrows. A bomb costs a heart.', pad: ['left', 'right', 'up', 'down'], pointer: true,
  make: (g) => {
    g.lives = 3
    const cur: Cur = { x: g.w / 2, y: g.h / 2, px: g.w / 2, py: g.h / 2 }
    interface F { x: number; y: number; vx: number; vy: number; bomb: boolean; r: number; c: string; a: number; w: number }
    interface Half { x: number; y: number; vx: number; vy: number; r: number; c: string; a: number; w: number; s: number }
    let fs: F[] = [], hs: Half[] = [], trail: { x: number; y: number; t: number }[] = []
    let t = 0.4
    const kinds = [{ c: g.pal.hot, in: '#ffd6dc' }, { c: g.pal.warn, in: '#ffe3b0' }, { c: g.pal.ok, in: '#e8ff9f' }, { c: '#a06fe0', in: '#f0dcff' }]
    return (dt) => {
      g.stars(0, 0, 25)
      cursor(g, cur, dt, 460)
      t -= dt
      if (t <= 0) { t = Math.max(0.35, 0.95 - g.time * 0.01); for (let i = 0; i < 1 + Math.floor(Math.random() * (g.time > 20 ? 3 : 2)); i++) { const bomb = Math.random() < 0.16; fs.push({ x: g.rnd(70, g.w - 70), y: g.h + 20, vx: g.rnd(-70, 70), vy: -g.rnd(340, 430), bomb, r: 18, c: bomb ? '#1a1426' : String(Math.floor(Math.random() * 4)), a: 0, w: g.rnd(-5, 5) }) } }
      const speed = Math.hypot(cur.x - cur.px, cur.y - cur.py) / Math.max(dt, 0.001) / 60
      trail.push({ x: cur.x, y: cur.y, t: 0.18 }); trail = trail.filter((p) => (p.t -= dt) > 0)
      let cuts = 0
      for (const f of fs) {
        f.vy += 540 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.a += f.w * dt
        if (f.bomb) { g.circ(f.x, f.y, f.r, '#1a1426'); g.ring(f.x, f.y, f.r, g.pal.hot, 2); g.line(f.x + 8, f.y - 14, f.x + 13, f.y - 20, g.pal.warn, 2); g.circ(f.x + 14 + Math.random() * 2, f.y - 21, 2.5, g.pal.warn); g.text('×', f.x, f.y - 9, g.pal.hot, 18, 'center') }
        else { const k = kinds[Number(f.c)]; g.circ(f.x, f.y, f.r, k.c); g.circ(f.x - 6, f.y - 6, 5, 'rgba(255,255,255,.3)'); g.rect(f.x - 1, f.y - f.r - 3, 2, 5, '#6b4f2a') }
        if (speed > 5 && Math.hypot(cur.x - f.x, cur.y - f.y) < f.r + 6) {
          if (f.bomb) { hurt(g, f.x, f.y); g.shake(10); g.burst(f.x, f.y, g.pal.warn, 22, 220, 4); f.y = 9999 }
          else { const k = kinds[Number(f.c)]; cuts++; g.score += 10; g.sfx('pop'); g.burst(f.x, f.y, k.c, 12, 150); for (const s of [-1, 1]) hs.push({ x: f.x, y: f.y, vx: f.vx + s * 80, vy: f.vy * 0.4 - 40, r: f.r, c: k.in, a: f.a, w: s * 6, s: Math.PI * (s < 0 ? 0 : 1) }); f.y = 9999 }
        }
      }
      if (cuts >= 2) { g.score += cuts * 10; g.pop(`${cuts} cuts +${cuts * 10}`, cur.x, cur.y - 22, g.pal.signal); g.sfx('win') }
      fs = fs.filter((f) => f.y < g.h + 40 || f.vy < 0)
      for (const h of hs) { h.vy += 540 * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.a += h.w * dt; g.c.save(); g.c.translate(h.x, h.y); g.c.rotate(h.a); g.c.fillStyle = h.c; g.c.beginPath(); g.c.arc(0, 0, h.r, h.s, h.s + Math.PI); g.c.fill(); g.c.restore() }
      hs = hs.filter((h) => h.y < g.h + 40)
      if (trail.length > 1) for (let i = 1; i < trail.length; i++) { g.c.globalAlpha = Math.max(0, trail[i].t / 0.18); g.line(trail[i - 1].x, trail[i - 1].y, trail[i].x, trail[i].y, speed > 5 ? g.pal.ink : g.pal.ink2, 1 + (i / trail.length) * 4) }
      g.c.globalAlpha = 1
      hearts(g)
    }
  },
}

export const turret: Game = {
  id: 'turret', name: 'Turret', blurb: 'Hold the core against the swarm. Tanks need more hits.', how: 'Aim with the pointer and hold to fire, or turn with the arrows and press space.', pad: ['left', 'right', 'act'], pointer: true,
  make: (g) => {
    const cx = g.w / 2, cy = g.h / 2 + 8
    let a = -Math.PI / 2, cd = 0, t = 0.8, kick = 0
    interface E { x: number; y: number; hp: number; max: number; sp: number; r: number; c: string; pts: number }
    let es: E[] = []
    let bs: { x: number; y: number; vx: number; vy: number; l: number }[] = []
    return (dt) => {
      g.stars(0, 0, 30)
      if (g.keys.has('left')) a -= 3.4 * dt
      else if (g.keys.has('right')) a += 3.4 * dt
      else if (g.ptr.x !== g.ptr.px || g.ptr.down) a = Math.atan2(g.ptr.y - cy, g.ptr.x - cx)
      cd -= dt; kick = Math.max(0, kick - dt * 12)
      if ((g.ptr.down || g.keys.has('act')) && cd <= 0) { bs.push({ x: cx + Math.cos(a) * 26, y: cy + Math.sin(a) * 26, vx: Math.cos(a) * 460, vy: Math.sin(a) * 460, l: 1.2 }); cd = 0.17; kick = 1; g.sfx('shoot'); g.burst(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30, g.pal.warn, 2, 60, 2) }
      t -= dt
      if (t <= 0) {
        t = Math.max(0.28, 0.95 - g.time * 0.009)
        const s = Math.random() * 6.28, r = Math.random()
        const k: E = r < 0.18 && g.time > 25 ? { x: 0, y: 0, hp: 4, max: 4, sp: 28, r: 15, c: g.pal.warn, pts: 40 } : r < 0.4 && g.time > 12 ? { x: 0, y: 0, hp: 1, max: 1, sp: 95, r: 7, c: g.pal.ice, pts: 20 } : { x: 0, y: 0, hp: 1, max: 1, sp: g.rnd(40, 58) + g.time * 0.5, r: 10, c: g.pal.hot, pts: 10 }
        k.x = cx + Math.cos(s) * 300; k.y = cy + Math.sin(s) * 260
        es.push(k)
      }
      for (const b of bs) { b.x += b.vx * dt; b.y += b.vy * dt; b.l -= dt; g.line(b.x, b.y, b.x - b.vx * 0.02, b.y - b.vy * 0.02, g.pal.ink, 3) }
      for (const e of es) {
        const m = Math.hypot(cx - e.x, cy - e.y) || 1
        e.x += ((cx - e.x) / m) * e.sp * dt; e.y += ((cy - e.y) / m) * e.sp * dt
        g.circ(e.x, e.y, e.r, e.c)
        const ang = Math.atan2(cy - e.y, cx - e.x)
        for (let i = 0; i < 6; i++) { const aa = ang + (i / 6) * 6.28 + g.time * 2; g.tri(e.x + Math.cos(aa) * e.r, e.y + Math.sin(aa) * e.r, e.x + Math.cos(aa + 0.3) * e.r * 1.0, e.y + Math.sin(aa + 0.3) * e.r, e.x + Math.cos(aa + 0.15) * (e.r + 5), e.y + Math.sin(aa + 0.15) * (e.r + 5), e.c) }
        g.circ(e.x - Math.cos(ang) * 0 + 3, e.y - 2, 2, g.pal.bg)
        if (e.max > 1) { g.rect(e.x - 12, e.y - e.r - 8, 24, 3, g.pal.ink2); g.rect(e.x - 12, e.y - e.r - 8, 24 * (e.hp / e.max), 3, g.pal.ok) }
        for (const b of bs) if (b.l > 0 && Math.hypot(b.x - e.x, b.y - e.y) < e.r + 3) { b.l = 0; e.hp -= 1; g.burst(b.x, b.y, e.c, 3, 80, 2); g.sfx('blip'); if (e.hp <= 0) { e.x = 9999; g.score += e.pts; g.sfx('boom'); g.burst(b.x, b.y, e.c, 14, 160); g.pop(`+${e.pts}`, b.x, b.y - 10) } }
        if (m < 22 && e.x < 9000) { const ex = e.x, ey = e.y; e.x = 9999; hurt(g, ex, ey); g.shake(9) }
      }
      es = es.filter((e) => e.x < 9000); bs = bs.filter((b) => b.l > 0)
      g.ring(cx, cy, 24, g.pal.ink2, 1)
      g.c.save(); g.c.translate(cx, cy); g.c.rotate(a)
      g.rrect(8 - kick * 4, -5, 24, 10, 3, g.pal.ink); g.rrect(-22, -14, 36, 28, 6, g.pal.signal)
      g.c.restore()
      g.circ(cx, cy, 10, g.pal.bg); g.circ(cx, cy, 5, g.pal.hot)
      hearts(g)
    }
  },
}

const MAZE = [
  '###################',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.### # ###.####',
  '#....#       #....#',
  '#.####.## ##.####.#',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#..#.....P.....#..#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '###################',
]
export const maze: Game = {
  id: 'maze', name: 'Chomp', blurb: 'Eat every dot. Power pellets turn the ghosts blue.', how: 'Arrow keys or the pad. Plan your turns early.', pad: ['left', 'up', 'down', 'right'],
  make: (g) => {
    const rows = MAZE.length, cols = MAZE[0].length
    const cw = Math.min(g.w / cols, (g.h - 22) / rows)
    const ox = (g.w - cw * cols) / 2, oy = 22
    const STEP = 0.15
    let cells: string[][] = []
    let p = { x: 9, y: 11, fx: 9, fy: 11 }
    let dir = { x: 0, y: 0 }, want = dir, t = 0, gt = 0, power = 0, mouth = 0, level = 0, chain = 0
    interface Gh { x: number; y: number; fx: number; fy: number; c: string; wait: number }
    let ghosts: Gh[] = []
    const reset = (full: boolean) => {
      if (full) { cells = MAZE.map((r) => r.split('').map((c) => (c === '.' ? '.' : c === '#' ? '#' : ' '))); for (const [x, y] of [[1, 1], [17, 1], [1, 13], [17, 13]]) cells[y][x] = 'o' }
      p = { x: 9, y: 11, fx: 9, fy: 11 }; dir = want = { x: 0, y: 0 }; power = 0; chain = 0
      ghosts = [{ x: 9, y: 7, fx: 9, fy: 7, c: g.pal.hot, wait: 0 }, { x: 8, y: 7, fx: 8, fy: 7, c: g.pal.ice, wait: 1.5 }, { x: 10, y: 7, fx: 10, fy: 7, c: g.pal.warn, wait: 3 }]
    }
    reset(true)
    const free = (x: number, y: number) => cells[y]?.[x] !== undefined && cells[y][x] !== '#'
    const px = (v: number) => ox + v * cw + cw / 2, py = (v: number) => oy + v * cw + cw / 2
    const eat = () => {
      const c = cells[p.y][p.x]
      if (c === '.') { cells[p.y][p.x] = ' '; g.score += 10; if (g.rnd() < 0.4) g.sfx('blip') }
      else if (c === 'o') { cells[p.y][p.x] = ' '; g.score += 50; power = 7; chain = 0; g.sfx('win'); g.burst(px(p.x), py(p.y), g.pal.signal, 10, 120) }
      if (!cells.some((r) => r.some((q) => q === '.' || q === 'o'))) { level++; g.score += 100; g.pop(`level ${level + 1}`, g.w / 2, 130, g.pal.signal); g.sfx('win'); reset(true) }
    }
    return (dt) => {
      if (g.tap.has('left')) want = { x: -1, y: 0 }
      if (g.tap.has('right')) want = { x: 1, y: 0 }
      if (g.tap.has('up')) want = { x: 0, y: -1 }
      if (g.tap.has('down')) want = { x: 0, y: 1 }
      t += dt; gt += dt; mouth += dt * 12; power = Math.max(0, power - dt)
      const gs = Math.max(0.16, 0.26 - level * 0.015 - g.time * 0.0007) * (power > 0 ? 1.4 : 1)
      if (t >= STEP) {
        t -= STEP
        p.fx = p.x; p.fy = p.y
        if (free(p.x + want.x, p.y + want.y)) dir = want
        if (free(p.x + dir.x, p.y + dir.y)) { p.x += dir.x; p.y += dir.y; eat() }
      }
      if (gt >= gs) {
        gt -= gs
        for (const gh of ghosts) {
          gh.fx = gh.x; gh.fy = gh.y
          if (gh.wait > 0) { gh.wait -= gs; continue }
          const opts = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].filter((d) => free(gh.x + d.x, gh.y + d.y))
          if (!opts.length) continue
          const dist = (d: { x: number; y: number }) => Math.abs(gh.x + d.x - p.x) + Math.abs(gh.y + d.y - p.y)
          opts.sort((a, b) => dist(a) - dist(b))
          const pick = power > 0 ? (Math.random() < 0.75 ? opts[opts.length - 1] : opts[Math.floor(Math.random() * opts.length)]) : (Math.random() < 0.65 ? opts[0] : opts[Math.floor(Math.random() * opts.length)])
          gh.x += pick.x; gh.y += pick.y
        }
      }
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const c = cells[y][x]
        if (c === '#') { g.c.globalAlpha = 0.35; g.rrect(ox + x * cw + 1, oy + y * cw + 1, cw - 2, cw - 2, 3, g.pal.ice); g.c.globalAlpha = 1 }
        else if (c === '.') g.circ(px(x), py(y), 2, g.pal.ink)
        else if (c === 'o') g.circ(px(x), py(y), 5 + Math.sin(g.time * 8), g.pal.signal)
      }
      const f = clamp(t / STEP, 0, 1)
      const ppx = lerp(px(p.fx), px(p.x), dir.x || dir.y ? f : 1), ppy = lerp(py(p.fy), py(p.y), dir.x || dir.y ? f : 1)
      const gf = clamp(gt / gs, 0, 1)
      for (const gh of ghosts) {
        const gx = lerp(px(gh.fx), px(gh.x), gf), gy = lerp(py(gh.fy), py(gh.y), gf)
        const scared = power > 0, blink = scared && power < 2 && Math.floor(g.time * 8) % 2
        const col = scared ? (blink ? g.pal.ink : '#3b4fd9') : gh.c
        const r = cw / 2 - 2
        g.c.fillStyle = col; g.c.beginPath(); g.c.arc(gx, gy - 1, r, Math.PI, 0); g.c.lineTo(gx + r, gy + r); for (let i = 0; i < 3; i++) g.c.lineTo(gx + r - (i + 0.5) * ((2 * r) / 3), gy + r - 3 * (i % 2 ? 0 : 1)); g.c.lineTo(gx - r, gy + r); g.c.closePath(); g.c.fill()
        if (!scared) { g.circ(gx - 3, gy - 2, 2.5, '#fff'); g.circ(gx + 3, gy - 2, 2.5, '#fff'); g.circ(gx - 3 + dir.x, gy - 2, 1.2, '#111'); g.circ(gx + 3 + dir.x, gy - 2, 1.2, '#111') } else { g.rect(gx - 4, gy - 3, 2, 2, '#fff'); g.rect(gx + 2, gy - 3, 2, 2, '#fff') }
        if (Math.hypot(gx - ppx, gy - ppy) < cw * 0.6) {
          if (scared) { chain++; const pts = 100 * 2 ** (chain - 1); g.score += pts; g.pop(`+${pts}`, gx, gy - 10, g.pal.ice); g.sfx('boom'); g.burst(gx, gy, g.pal.ice, 12, 120); gh.x = gh.fx = 9; gh.y = gh.fy = 7; gh.wait = 2.5 }
          else { hurt(g, ppx, ppy); reset(false); return }
        }
      }
      const ang = Math.atan2(dir.y, dir.x || (dir.y ? 0 : 1)), open = Math.abs(Math.sin(mouth)) * 0.6 + 0.05
      g.c.fillStyle = g.pal.signal; g.c.beginPath(); g.c.moveTo(ppx, ppy); g.c.arc(ppx, ppy, cw / 2 - 2, ang + open, ang + Math.PI * 2 - open); g.c.closePath(); g.c.fill()
      if (power > 0) g.text(`${Math.ceil(power)}`, g.w - 10, 26, g.pal.ice, 14, 'right')
      hearts(g)
    }
  },
}

export const lander: Game = {
  id: 'lander', name: 'Lander', blurb: 'Touch down soft on the pad. The pads get smaller.', how: 'Left and right turn, up fires the engine. Land slow and upright.', pad: ['left', 'up', 'right'],
  make: (g) => {
    let x = 60, y = 50, vx = 20, vy = 0, a = -Math.PI / 2, fuel = 100, level = 0
    let ter: number[] = [], padX = 300, padW = 80
    const N = Math.ceil(g.w / 20) + 1
    const h = (px: number) => { const i = clamp(px / 20, 0, N - 1.001); const j = Math.floor(i); return lerp(ter[j], ter[j + 1], i - j) }
    const land = () => {
      padW = Math.max(46, 80 - level * 6); padX = g.rnd(80, g.w - 80 - padW)
      ter = []; let hh = g.rnd(g.h - 80, g.h - 40)
      for (let i = 0; i < N; i++) { hh = clamp(hh + g.rnd(-22, 22), g.h - 120, g.h - 24); ter.push(hh) }
      const pi = Math.round(padX / 20)
      for (let i = pi; i <= pi + Math.ceil(padW / 20); i++) if (i < N) ter[i] = ter[pi]
      padX = pi * 20; padW = Math.ceil(padW / 20) * 20
      x = g.rnd(40, g.w - 40); y = 50; vx = g.rnd(-25, 25); vy = 0; a = -Math.PI / 2; fuel = 100
    }
    land()
    return (dt) => {
      g.stars(0, 0, 40)
      vy += 42 * dt
      if (g.keys.has('left')) a -= 2.6 * dt
      if (g.keys.has('right')) a += 2.6 * dt
      const thrust = g.keys.has('up') && fuel > 0
      if (thrust) { vx += Math.cos(a) * 130 * dt; vy += Math.sin(a) * 130 * dt; fuel -= 20 * dt; g.burst(x - Math.cos(a) * 10, y - Math.sin(a) * 10, g.pal.warn, 1, 70, 3) }
      x += vx * dt; y += vy * dt
      if (x < 8 || x > g.w - 8) { vx = -vx * 0.4; x = clamp(x, 8, g.w - 8) }
      g.c.fillStyle = g.pal.ink; g.c.globalAlpha = 0.1; g.c.beginPath(); g.c.moveTo(0, g.h); ter.forEach((v, i) => g.c.lineTo(i * 20, v)); g.c.lineTo(g.w, g.h); g.c.closePath(); g.c.fill(); g.c.globalAlpha = 1
      g.c.strokeStyle = g.pal.ink2; g.c.lineWidth = 2; g.c.beginPath(); ter.forEach((v, i) => (i ? g.c.lineTo(i * 20, v) : g.c.moveTo(0, v))); g.c.stroke()
      g.rect(padX, ter[Math.round(padX / 20)] - 3, padW, 5, g.pal.ok)
      g.text('PAD', padX + padW / 2, ter[Math.round(padX / 20)] + 4, g.pal.ok, 11, 'center')
      const gy = h(x)
      if (y + 10 >= gy) {
        const onPad = x > padX && x < padX + padW
        const upright = Math.abs(((a + Math.PI / 2 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.25
        if (onPad && vy < 50 && Math.abs(vx) < 32 && upright) { const b = 100 + Math.round(fuel); g.score += b; g.pop(`landed +${b}`, x, y - 24, g.pal.ok); g.sfx('win'); g.burst(x, y + 10, g.pal.ok, 16, 120); level++; land() }
        else { g.burst(x, y, g.pal.warn, 24, 220, 4); g.burst(x, y, g.pal.hot, 14, 160); g.shake(12); hurt(g, x, y); if (g.lives > 0) land(); return }
      }
      g.c.save(); g.c.translate(x, y); g.c.rotate(a + Math.PI / 2)
      if (thrust) g.tri(-4, 8, 4, 8, 0, 16 + Math.random() * 8, g.pal.warn)
      g.line(-7, 6, -11, 12, g.pal.signal, 2); g.line(7, 6, 11, 12, g.pal.signal, 2); g.rrect(-8, -8, 16, 14, 4, g.pal.signal); g.rrect(-4, -5, 8, 5, 2, g.pal.bg)
      g.c.restore()
      g.text(`fuel ${Math.max(0, Math.round(fuel))}`, 10, 34, fuel < 20 ? g.pal.hot : g.pal.ink2, 13)
      g.text(`speed ${Math.round(vy)}`, 10, 48, vy < 50 ? g.pal.ok : g.pal.hot, 13)
      hearts(g)
    }
  },
}
