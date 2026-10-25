import { clamp, hearts, hit, hurt, type Game } from './engine'

export const gravity: Game = {
  id: 'gravity', name: 'Flip', blurb: 'Run the ceiling or the floor.', how: 'Tap, click or space to flip gravity.', pad: ['act'], pointer: true,
  make: (g) => {
    const top = 40, bot = g.h - 30
    let y = bot - 20, side = 1, t = 1
    let os: { x: number; w: number; up: boolean; h: number }[] = []
    return (dt) => {
      if (g.tap.has('act') || g.ptr.hit || g.tap.has('up')) side = -side
      const ty = side > 0 ? bot - 20 : top
      y += (ty - y) * Math.min(1, dt * 14)
      const sp = 200 + g.time * 3
      t -= dt
      if (t <= 0) { t = g.rnd(0.6, 1.3) * (200 / sp) * 1.5; os.push({ x: g.w + 10, w: g.rnd(18, 36), up: Math.random() < 0.5, h: g.rnd(26, 60) }) }
      g.rect(0, top - 2, g.w, 2, g.pal.ink2); g.rect(0, bot, g.w, 2, g.pal.ink2)
      for (const o of os) { o.x -= sp * dt; const oy = o.up ? top : bot - o.h; g.rect(o.x, oy, o.w, o.h, g.pal.hot); if (hit(70, y, 20, 20, o.x, oy, o.w, o.h)) g.end() }
      os = os.filter((o) => o.x > -50)
      g.rect(70, y, 20, 20, g.pal.signal)
      g.score = g.time * 12
    }
  },
}

export const slash: Game = {
  id: 'slash', name: 'Slash', blurb: 'Cut the fruit, spare the bombs.', how: 'Swipe across the fruit. A bomb costs a heart.', pad: [], pointer: true,
  make: (g) => {
    g.lives = 3
    let fs: { x: number; y: number; vx: number; vy: number; bomb: boolean; r: number; c: string }[] = []
    let t = 0.4
    const cols = [g.pal.hot, g.pal.warn, g.pal.ok, g.pal.signal]
    return (dt) => {
      t -= dt
      if (t <= 0) { t = Math.max(0.4, 1 - g.time * 0.01); for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) fs.push({ x: g.rnd(60, g.w - 60), y: g.h + 20, vx: g.rnd(-60, 60), vy: -g.rnd(330, 420), bomb: Math.random() < 0.18, r: 17, c: cols[Math.floor(Math.random() * 4)] }) }
      const speed = Math.hypot(g.ptr.x - g.ptr.px, g.ptr.y - g.ptr.py)
      if (speed > 6) g.line(g.ptr.px, g.ptr.py, g.ptr.x, g.ptr.y, g.pal.ink, 3)
      for (const f of fs) {
        f.vy += 560 * dt; f.x += f.vx * dt; f.y += f.vy * dt
        g.circ(f.x, f.y, f.r, f.bomb ? g.pal.ink2 : f.c)
        if (f.bomb) g.text('×', f.x, f.y - 9, g.pal.hot, 18, 'center')
        if (speed > 6 && Math.hypot(g.ptr.x - f.x, g.ptr.y - f.y) < f.r + 8) { if (f.bomb) hurt(g); else g.score += 10; f.y = 9999 }
      }
      fs = fs.filter((f) => f.y < g.h + 30 || f.vy < 0)
      hearts(g)
    }
  },
}

export const turret: Game = {
  id: 'turret', name: 'Turret', blurb: 'Hold the core against the swarm.', how: 'Aim with the pointer and hold to fire, or turn and fire with the keys.', pad: ['left', 'right', 'act'], pointer: true,
  make: (g) => {
    const cx = g.w / 2, cy = g.h / 2 + 8
    let a = -Math.PI / 2, cd = 0, t = 1
    let es: { x: number; y: number; hp: number; sp: number }[] = []
    let bs: { x: number; y: number; vx: number; vy: number; l: number }[] = []
    return (dt) => {
      if (g.keys.has('left')) a -= 3.2 * dt
      else if (g.keys.has('right')) a += 3.2 * dt
      else if (g.ptr.x !== g.ptr.px || g.ptr.down) a = Math.atan2(g.ptr.y - cy, g.ptr.x - cx)
      cd -= dt
      if ((g.ptr.down || g.keys.has('act')) && cd <= 0) { bs.push({ x: cx, y: cy, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, l: 1 }); cd = 0.18 }
      t -= dt
      if (t <= 0) { t = Math.max(0.3, 1 - g.time * 0.01); const s = Math.random() * 6.28; es.push({ x: cx + Math.cos(s) * 290, y: cy + Math.sin(s) * 250, hp: g.time > 30 ? 2 : 1, sp: g.rnd(40, 60) + g.time * 0.6 }) }
      for (const b of bs) { b.x += b.vx * dt; b.y += b.vy * dt; b.l -= dt; g.circ(b.x, b.y, 3, g.pal.ink) }
      for (const e of es) {
        const m = Math.hypot(cx - e.x, cy - e.y) || 1
        e.x += ((cx - e.x) / m) * e.sp * dt; e.y += ((cy - e.y) / m) * e.sp * dt
        g.circ(e.x, e.y, 10, e.hp > 1 ? g.pal.warn : g.pal.hot)
        for (const b of bs) if (b.l > 0 && Math.hypot(b.x - e.x, b.y - e.y) < 12) { b.l = 0; e.hp -= 1; if (e.hp <= 0) { e.x = 9999; g.score += 10 } }
        if (m < 18) { e.x = 9999; hurt(g) }
      }
      es = es.filter((e) => e.x < 9000); bs = bs.filter((b) => b.l > 0)
      g.circ(cx, cy, 16, g.pal.signal)
      g.line(cx, cy, cx + Math.cos(a) * 28, cy + Math.sin(a) * 28, g.pal.ink, 6)
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
  id: 'maze', name: 'Chomp', blurb: 'Eat every dot, outrun the ghosts.', how: 'Arrow keys or the pad.', pad: ['left', 'up', 'down', 'right'],
  make: (g) => {
    const rows = MAZE.length, cols = MAZE[0].length
    const cw = Math.min(g.w / cols, (g.h - 20) / rows)
    const ox = (g.w - cw * cols) / 2, oy = 20
    let cells: string[][] = []
    let px = 9, py = 11, dir = { x: 0, y: 0 }, want = dir, t = 0, gt = 0
    let ghosts: { x: number; y: number; c: string }[] = []
    const reset = (full: boolean) => {
      if (full) cells = MAZE.map((r) => r.split('').map((c) => (c === '.' ? '.' : c === '#' ? '#' : ' ')))
      px = 9; py = 11; dir = want = { x: 0, y: 0 }
      ghosts = [{ x: 9, y: 7, c: g.pal.hot }, { x: 8, y: 7, c: g.pal.ice }, { x: 10, y: 7, c: g.pal.warn }]
    }
    reset(true)
    const free = (x: number, y: number) => cells[y]?.[x] !== undefined && cells[y][x] !== '#'
    return (dt) => {
      if (g.tap.has('left')) want = { x: -1, y: 0 }
      if (g.tap.has('right')) want = { x: 1, y: 0 }
      if (g.tap.has('up')) want = { x: 0, y: -1 }
      if (g.tap.has('down')) want = { x: 0, y: 1 }
      t += dt; gt += dt
      if (t > 0.14) {
        t = 0
        if (free(px + want.x, py + want.y)) dir = want
        if (free(px + dir.x, py + dir.y)) { px += dir.x; py += dir.y }
        if (cells[py][px] === '.') { cells[py][px] = ' '; g.score += 10 }
        if (!cells.some((r) => r.includes('.'))) { g.score += 100; reset(true) }
      }
      if (gt > Math.max(0.17, 0.3 - g.time * 0.002)) {
        gt = 0
        for (const gh of ghosts) {
          const opts = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].filter((d) => free(gh.x + d.x, gh.y + d.y))
          if (!opts.length) continue
          opts.sort((a, b) => Math.abs(gh.x + a.x - px) + Math.abs(gh.y + a.y - py) - (Math.abs(gh.x + b.x - px) + Math.abs(gh.y + b.y - py)))
          const d = Math.random() < 0.6 ? opts[0] : opts[Math.floor(Math.random() * opts.length)]
          gh.x += d.x; gh.y += d.y
        }
      }
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const c = cells[y][x]
        if (c === '#') { g.c.globalAlpha = 0.35; g.rect(ox + x * cw, oy + y * cw, cw - 1, cw - 1, g.pal.ice); g.c.globalAlpha = 1 }
        else if (c === '.') g.circ(ox + x * cw + cw / 2, oy + y * cw + cw / 2, 2, g.pal.ink)
      }
      for (const gh of ghosts) { g.circ(ox + gh.x * cw + cw / 2, oy + gh.y * cw + cw / 2, cw / 2 - 2, gh.c); if (gh.x === px && gh.y === py) { hurt(g); reset(false) } }
      g.circ(ox + px * cw + cw / 2, oy + py * cw + cw / 2, cw / 2 - 2, g.pal.signal)
      hearts(g)
    }
  },
}

export const lander: Game = {
  id: 'lander', name: 'Lander', blurb: 'Touch down soft, on the pad.', how: 'Up fires the engine, left and right steer. Land slowly on the pad.', pad: ['left', 'up', 'right'],
  make: (g) => {
    let x = 60, y = 50, vx = 20, vy = 0, fuel = 100, padX = 300
    const land = () => { x = g.rnd(40, g.w - 40); y = 40; vx = g.rnd(-30, 30); vy = 0; fuel = 100; padX = g.rnd(60, g.w - 120) }
    land()
    const ground = g.h - 24
    return (dt) => {
      vy += 60 * dt
      if (g.keys.has('up') && fuel > 0) { vy -= 160 * dt; fuel -= 22 * dt }
      if (g.keys.has('left') && fuel > 0) { vx -= 70 * dt; fuel -= 8 * dt }
      if (g.keys.has('right') && fuel > 0) { vx += 70 * dt; fuel -= 8 * dt }
      x += vx * dt; y += vy * dt
      if (x < 8 || x > g.w - 8) { vx = -vx * 0.5; x = clamp(x, 8, g.w - 8) }
      g.rect(0, ground, g.w, 24, g.pal.ink2); g.rect(padX, ground - 3, 70, 5, g.pal.ok)
      if (y > ground - 12) {
        const onPad = x > padX && x < padX + 70
        if (onPad && Math.abs(vy) < 55 && Math.abs(vx) < 30) { g.score += 100 + Math.round(fuel); land() } else { hurt(g); land() }
      }
      g.rect(x - 8, y - 8, 16, 14, g.pal.signal); g.line(x - 8, y + 6, x - 12, y + 12, g.pal.signal); g.line(x + 8, y + 6, x + 12, y + 12, g.pal.signal)
      if (g.keys.has('up') && fuel > 0) g.rect(x - 3, y + 7, 6, 8 + Math.random() * 6, g.pal.warn)
      g.text(`fuel ${Math.max(0, Math.round(fuel))}`, 8, 30, g.pal.ink2, 14)
      g.text(`${Math.round(vy)} v`, 8, 46, Math.abs(vy) < 55 ? g.pal.ok : g.pal.hot, 14)
      hearts(g)
    }
  },
}
