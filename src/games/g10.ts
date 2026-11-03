import { clamp, drop, mix, type G, type Game } from './engine'

/** Descent: a roguelite. Clear a room, pick one of three upgrades, go deeper. Every third room has a boss. */
type Kind = 'grunt' | 'swarm' | 'spitter' | 'charger' | 'brute' | 'warden'
interface Enemy { id: number; k: Kind; x: number; y: number; vx: number; vy: number; hp: number; max: number; r: number; hit: number; t: number; st: 'move' | 'aim' | 'dash' | 'rest'; ax: number; ay: number; blade: number }
interface Shot { x: number; y: number; vx: number; vy: number; dmg: number; pierce: number; bounce: number; r: number; life: number; seen: number[] }
interface Orb { x: number; y: number; vx: number; vy: number }
interface Stats { dmg: number; rate: number; shots: number; pierce: number; bounce: number; speed: number; blades: number; vamp: number; dashBlast: boolean; big: number; nova: boolean; max: number }
interface Card { name: string; text: string; tone: 'ok' | 'ice' | 'warn' | 'hot' | 'signal'; take: (s: Stats, heal: () => void) => void }

const L = 14, T = 36, RT = 466, B = 308

const CARDS: Card[] = [
  { name: 'Sharper', text: '+40% damage', tone: 'hot', take: (s) => { s.dmg *= 1.4 } },
  { name: 'Rapid', text: 'Fire 25% faster', tone: 'warn', take: (s) => { s.rate *= 0.75 } },
  { name: 'Twin shot', text: '+1 projectile', tone: 'ice', take: (s) => { s.shots += 1 } },
  { name: 'Piercing', text: 'Shots go through 1 more', tone: 'ice', take: (s) => { s.pierce += 1 } },
  { name: 'Ricochet', text: 'Shots bounce twice', tone: 'ok', take: (s) => { s.bounce += 2 } },
  { name: 'Swift boots', text: '+18% move speed', tone: 'ok', take: (s) => { s.speed *= 1.18 } },
  { name: 'Heart', text: '+2 max health, heal 2', tone: 'hot', take: (s, h) => { s.max += 2; h(); h() } },
  { name: 'Blades', text: 'A blade orbits you', tone: 'signal', take: (s) => { s.blades += 1 } },
  { name: 'Vampiric', text: 'Kills sometimes heal', tone: 'hot', take: (s) => { s.vamp += 0.1 } },
  { name: 'Dash bomb', text: 'Dashing blasts what is near', tone: 'warn', take: (s) => { s.dashBlast = true } },
  { name: 'Heavy shot', text: 'Bigger, harder shots', tone: 'signal', take: (s) => { s.big += 1; s.dmg *= 1.15 } },
  { name: 'Nova', text: 'Taking a hit blasts the room', tone: 'ice', take: (s) => { s.nova = true } },
]

export const rogue: Game = {
  id: 'rogue', name: 'Descent', blurb: 'A roguelite: clear rooms, pick upgrades, beat the bosses.', how: 'Move with the arrows. You aim for yourself. Space dashes. Pick a card with left, right and space.',
  pad: ['left', 'right', 'up', 'down', 'act'], pointer: true, cost: 6, round: 150, noContinue: true,
  make: (g: G) => {
    const st: Stats = { dmg: 1, rate: 0.44, shots: 1, pierce: 0, bounce: 0, speed: 128, blades: 0, vamp: 0, dashBlast: false, big: 0, nova: false, max: 6 }
    const P = { x: 240, y: 190, hp: 6, inv: 0, dash: 0, dcd: 0, fx: 0, fy: -1, fire: 0, flash: 0, blade: 0 }
    let room = 0, id = 1, enemies: Enemy[] = [], shots: Shot[] = [], orbs: Orb[] = [], marks: { x: number; y: number; t: number; k: Kind }[] = []
    let hearts: { x: number; y: number }[] = [], pick: Card[] | null = null, sel = 1, clearT = 0, chain = 0, chainT = 0, torch = 0, waveLeft = 0, waveT = 0, bossRoom = false
    g.lives = 0
    const heal = () => { P.hp = Math.min(st.max, P.hp + 1) }
    const edge = (): [number, number] => { const s = Math.floor(Math.random() * 4); return s === 0 ? [g.rnd(L + 12, RT - 12), T + 12] : s === 1 ? [g.rnd(L + 12, RT - 12), B - 12] : s === 2 ? [L + 12, g.rnd(T + 12, B - 12)] : [RT - 12, g.rnd(T + 12, B - 12)] }
    const mark = (k: Kind, x?: number, y?: number) => { const [ex, ey] = edge(); marks.push({ x: x ?? ex, y: y ?? ey, t: 0.8, k }) }
    const make = (k: Kind, x: number, y: number): Enemy => {
      const hp = { grunt: 2 + room * 0.25, swarm: 1, spitter: 2 + room * 0.2, charger: 3 + room * 0.3, brute: 9 + room, warden: 28 + room * 6 }[k]
      const r = { grunt: 9, swarm: 5, spitter: 8, charger: 9, brute: 14, warden: 22 }[k]
      return { id: id++, k, x, y, vx: 0, vy: 0, hp, max: hp, r, hit: 0, t: g.rnd(0.5, 2), st: 'move', ax: 0, ay: 0, blade: 0 }
    }
    const startRoom = () => {
      room++; bossRoom = room % 3 === 0
      enemies = []; shots = []; orbs = []; hearts = []; P.x = 240; P.y = 250; P.inv = 1
      if (bossRoom) { mark('warden', 240, 90); waveLeft = 0; g.banner(`ROOM ${room}`, 'a boss guards the door'); g.flash(g.pal.hot, 0.2) }
      else {
        const n = 3 + Math.floor(room * 1.2)
        const pool: Kind[] = room < 2 ? ['grunt'] : room < 4 ? ['grunt', 'grunt', 'swarm'] : room < 6 ? ['grunt', 'spitter', 'charger', 'swarm'] : ['grunt', 'spitter', 'charger', 'brute', 'swarm']
        for (let i = 0; i < Math.min(5, n); i++) mark(pool[Math.floor(Math.random() * pool.length)])
        waveLeft = Math.max(0, n - 5); waveT = 3
        g.banner(`ROOM ${room}`, room === 1 ? 'clear the room' : `${n} to go`)
      }
    }
    const offer = () => { const pool = [...CARDS]; const out: Card[] = []; while (out.length < 3) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); pick = out; sel = 1 }
    startRoom()

    const nearest = () => { let best: Enemy | null = null, bd = 1e9; for (const e of enemies) { const d = Math.hypot(e.x - P.x, e.y - P.y); if (d < bd && d < 230) { bd = d; best = e } } return best }
    const shoot = (ang: number) => {
      const n = st.shots
      for (let i = 0; i < n; i++) {
        const a = ang + (i - (n - 1) / 2) * 0.16
        shots.push({ x: P.x, y: P.y, vx: Math.cos(a) * 270, vy: Math.sin(a) * 270, dmg: st.dmg, pierce: st.pierce, bounce: st.bounce, r: 3 + st.big * 1.5, life: 1.2, seen: [] })
      }
      g.sfx('shoot')
    }
    const hurtP = (n: number, fromX: number, fromY: number) => {
      if (P.inv > 0 || P.dash > 0) return
      P.hp -= n; P.inv = 1; P.flash = 0.2; g.shake(7); g.sfx('hit'); g.freeze(0.05); g.flash(g.pal.hot, 0.25)
      g.burst(P.x, P.y, g.pal.hot, 12, 160)
      const d = Math.hypot(P.x - fromX, P.y - fromY) || 1; P.x += ((P.x - fromX) / d) * 14; P.y += ((P.y - fromY) / d) * 14
      if (st.nova) { g.shockwave(P.x, P.y, g.pal.ice, 90); for (const e of enemies) if (Math.hypot(e.x - P.x, e.y - P.y) < 90) { e.hp -= 2 * st.dmg; e.hit = 0.12 } }
      if (P.hp <= 0) g.end(P.x, P.y)
    }
    const kill = (e: Enemy) => {
      chain++; chainT = 1.5; g.mult = 1 + Math.min(4, Math.floor(chain / 4))
      const pts = ({ grunt: 10, swarm: 4, spitter: 15, charger: 18, brute: 30, warden: 400 }[e.k] + room * 2) * g.mult
      g.score += pts; g.pop(`+${pts}`, e.x, e.y - e.r - 6, g.pal.ink)
      g.burst(e.x, e.y, e.k === 'warden' ? g.pal.hot : g.pal.warn, e.k === 'warden' ? 40 : 10, e.k === 'warden' ? 260 : 150, 3)
      g.burst(e.x, e.y, g.pal.ink, 4, 120, 2, 'line'); g.sfx('boom'); g.shake(e.k === 'warden' ? 14 : 2)
      if (e.k === 'warden') { g.freeze(0.12); g.flash(g.pal.ink, 0.5); P.hp = st.max; g.pop('full health', P.x, P.y - 20, g.pal.ok); orbs = [] }
      if (Math.random() < st.vamp) { heal(); g.pop('+1', P.x, P.y - 16, g.pal.ok) }
    }

    return (dt) => {
      torch += dt; chainT -= dt; if (chainT <= 0) { chain = 0; g.mult = 1 }
      P.inv -= dt; P.flash -= dt; P.fire -= dt; P.dcd -= dt; P.blade += dt * 4
      // the room
      for (let y = 0; y < 14; y++) for (let x = 0; x < 23; x++) { g.c.globalAlpha = (x + y) % 2 ? 0.07 : 0.03; g.rect(L + x * 20, T + y * 20, 20, 20, g.pal.ink) }
      g.c.globalAlpha = 1
      g.rect(0, 22, g.w, T - 22, mix(g.pal.bg, g.pal.ink, 0.08)); g.rect(0, B, g.w, g.h - B, mix(g.pal.bg, g.pal.ink, 0.08)); g.rect(0, T, L, B - T, mix(g.pal.bg, g.pal.ink, 0.08)); g.rect(RT, T, g.w - RT, B - T, mix(g.pal.bg, g.pal.ink, 0.08))
      g.rect(L - 2, T - 2, RT - L + 4, 2, g.pal.ink2); g.rect(L - 2, B, RT - L + 4, 2, g.pal.ink2)
      for (const [tx, ty] of [[L + 6, T + 6], [RT - 6, T + 6], [L + 6, B - 6], [RT - 6, B - 6]]) { g.c.globalAlpha = 0.25; g.circ(tx, ty, 11 + Math.sin(torch * 9 + tx) * 2, g.pal.warn); g.c.globalAlpha = 1; g.circ(tx, ty, 3.5, g.pal.warn) }
      const cleared = enemies.length === 0 && marks.length === 0 && waveLeft <= 0
      // the door at the top
      g.rect(220, T - 6, 40, 6, cleared ? g.pal.ok : g.pal.ink2)

      if (pick) {
        // between rooms: choose a card
        if (g.tap.has('left')) sel = (sel + 2) % 3
        if (g.tap.has('right')) sel = (sel + 1) % 3
        const cw = 132, gap = 14, x0 = (g.w - (cw * 3 + gap * 2)) / 2
        pick.forEach((c, i) => {
          const x = x0 + i * (cw + gap), y = 96 + (i === sel ? -6 : 0), col = g.pal[c.tone]
          drop(g, x, y, cw, 128, 4); g.rrect(x, y, cw, 128, 4, g.pal.ground2); g.rect(x, y, cw, 4, col)
          g.ring(x + cw / 2, y + 44, 17, col, 3); g.circ(x + cw / 2, y + 44, 7, col)
          g.text(c.name, x + cw / 2, y + 72, g.pal.ink, 17, 'center'); g.text(c.text, x + cw / 2, y + 96, g.pal.ink2, 12, 'center')
          if (i === sel) g.rect(x, y + 124, cw, 4, col)
          if (g.ptr.hit && g.ptr.x > x && g.ptr.x < x + cw && g.ptr.y > y && g.ptr.y < y + 128) { sel = i; g.tap.add('act') }
        })
        g.text('choose an upgrade', g.w / 2, 62, g.pal.signal, 18, 'center')
        if (g.tap.has('act')) { pick[sel].take(st, heal); g.sfx('win'); g.pop(pick[sel].name, P.x, P.y - 24, g.pal[pick[sel].tone]); pick = null; startRoom() }
        hud()
        return
      }

      // moving
      const dx = (g.keys.has('right') ? 1 : 0) - (g.keys.has('left') ? 1 : 0), dy = (g.keys.has('down') ? 1 : 0) - (g.keys.has('up') ? 1 : 0)
      const m = Math.hypot(dx, dy) || 1
      if (dx || dy) { P.fx = dx / m; P.fy = dy / m }
      if (g.tap.has('act') && P.dcd <= 0) { P.dash = 0.16; P.dcd = 1.1; g.sfx('jump'); g.burst(P.x, P.y, g.pal.ice, 8, 90, 2, 'line') }
      const sp = P.dash > 0 ? st.speed * 3.6 : st.speed
      const mvx = P.dash > 0 && !(dx || dy) ? P.fx : dx / m, mvy = P.dash > 0 && !(dx || dy) ? P.fy : dy / m
      P.x = clamp(P.x + mvx * sp * dt, L + 8, RT - 8); P.y = clamp(P.y + mvy * sp * dt, T + 8, B - 8)
      if (P.dash > 0) { P.dash -= dt; if (P.dash <= 0 && st.dashBlast) { g.shockwave(P.x, P.y, g.pal.warn, 70); g.shake(4); for (const e of enemies) if (Math.hypot(e.x - P.x, e.y - P.y) < 70) { e.hp -= 3 * st.dmg; e.hit = 0.12 } } }
      // firing: it aims for you
      const tgt = nearest()
      if (tgt && P.fire <= 0) { P.fire = st.rate; shoot(Math.atan2(tgt.y - P.y, tgt.x - P.x)) }

      // spawns
      for (const mk of marks) { mk.t -= dt; g.c.globalAlpha = 0.4 + 0.4 * Math.sin(torch * 22); g.ring(mk.x, mk.y, 12 + mk.t * 8, mk.k === 'warden' ? g.pal.hot : g.pal.warn, 2); g.line(mk.x - 6, mk.y - 6, mk.x + 6, mk.y + 6, g.pal.hot, 2); g.line(mk.x + 6, mk.y - 6, mk.x - 6, mk.y + 6, g.pal.hot, 2); g.c.globalAlpha = 1; if (mk.t <= 0) { enemies.push(make(mk.k, mk.x, mk.y)); g.burst(mk.x, mk.y, g.pal.hot, 6, 90) } }
      marks = marks.filter((q) => q.t > 0)
      if (waveLeft > 0 && !bossRoom) { waveT -= dt; if (waveT <= 0) { waveT = 3; const k: Kind[] = room < 2 ? ['grunt'] : ['grunt', 'swarm', 'spitter', 'charger']; for (let i = 0; i < Math.min(3, waveLeft); i++) mark(k[Math.floor(Math.random() * k.length)]); waveLeft -= Math.min(3, waveLeft) } }

      // enemies
      for (const e of enemies) {
        e.t -= dt; e.hit = Math.max(0, e.hit - dt); e.blade -= dt
        const ang = Math.atan2(P.y - e.y, P.x - e.x), d = Math.hypot(P.x - e.x, P.y - e.y)
        let sx = 0, sy = 0
        if (e.k === 'grunt' || e.k === 'swarm' || e.k === 'brute') { const v = { grunt: 46 + room * 2, swarm: 88, brute: 30, spitter: 0, charger: 0, warden: 0 }[e.k]; sx = Math.cos(ang) * v; sy = Math.sin(ang) * v }
        else if (e.k === 'spitter') { const dir = d > 160 ? 1 : d < 100 ? -1 : 0; sx = Math.cos(ang) * 44 * dir; sy = Math.sin(ang) * 44 * dir; if (e.t <= 0) { e.t = 2.2; orbs.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 95, vy: Math.sin(ang) * 95 }); g.sfx('blip') } }
        else if (e.k === 'charger') {
          if (e.st === 'move') { sx = Math.cos(ang + 1.2) * 30; sy = Math.sin(ang + 1.2) * 30; if (e.t <= 0) { e.st = 'aim'; e.t = 0.6; e.ax = Math.cos(ang); e.ay = Math.sin(ang) } }
          else if (e.st === 'aim') { g.c.globalAlpha = 0.5; g.line(e.x, e.y, e.x + e.ax * 150, e.y + e.ay * 150, g.pal.hot, 2); g.c.globalAlpha = 1; if (e.t <= 0) { e.st = 'dash'; e.t = 0.5 } }
          else if (e.st === 'dash') { sx = e.ax * 250; sy = e.ay * 250; if (e.t <= 0) { e.st = 'rest'; e.t = 0.7 } }
          else if (e.t <= 0) { e.st = 'move'; e.t = g.rnd(1.2, 2.2) }
        } else if (e.k === 'warden') {
          const low = e.hp < e.max / 2
          sx = Math.cos(ang) * (low ? 34 : 22); sy = Math.sin(ang) * (low ? 34 : 22)
          if (e.t <= 0) { e.t = low ? 1.5 : 2.1; const n = low ? 14 : 10; const o = Math.random() * 6; for (let i = 0; i < n; i++) orbs.push({ x: e.x, y: e.y, vx: Math.cos(o + (i / n) * 6.28) * 90, vy: Math.sin(o + (i / n) * 6.28) * 90 }); g.sfx('shoot'); g.shake(3); if (Math.random() < 0.4) { mark('grunt'); mark('grunt') } }
        }
        e.x = clamp(e.x + sx * dt, L + e.r, RT - e.r); e.y = clamp(e.y + sy * dt, T + e.r, B - e.r)
        for (const o of enemies) if (o !== e) { const dd = Math.hypot(o.x - e.x, o.y - e.y), mn = o.r + e.r - 2; if (dd < mn && dd > 0.01) { e.x += ((e.x - o.x) / dd) * 24 * dt; e.y += ((e.y - o.y) / dd) * 24 * dt } }
        // touching the player
        if (d < e.r + 7 && !(e.k === 'charger' && e.st === 'rest')) hurtP(e.k === 'brute' || e.k === 'warden' ? 2 : 1, e.x, e.y)
        // orbiting blades
        for (let b = 0; b < st.blades; b++) { const a = P.blade + (b / st.blades) * 6.28, bx = P.x + Math.cos(a) * 30, by = P.y + Math.sin(a) * 30; if (Math.hypot(bx - e.x, by - e.y) < e.r + 5 && e.blade <= 0) { e.blade = 0.4; e.hp -= 1.5 * st.dmg; e.hit = 0.1; g.burst(bx, by, g.pal.ink, 3, 80, 2, 'line'); g.sfx('blip') } }
      }
      // shots
      for (const s of shots) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt
        if (s.x < L || s.x > RT) { if (s.bounce > 0) { s.vx = -s.vx; s.bounce--; s.x = clamp(s.x, L, RT) } else s.life = 0 }
        if (s.y < T || s.y > B) { if (s.bounce > 0) { s.vy = -s.vy; s.bounce--; s.y = clamp(s.y, T, B) } else s.life = 0 }
        for (const e of enemies) if (s.life > 0 && !s.seen.includes(e.id) && Math.hypot(s.x - e.x, s.y - e.y) < e.r + s.r) {
          e.hp -= s.dmg; e.hit = 0.1; s.seen.push(e.id); e.x += (s.vx > 0 ? 1 : -1) * 2; g.burst(s.x, s.y, g.pal.warn, 3, 100, 2); g.sfx('blip')
          if (s.pierce > 0) s.pierce--; else s.life = 0
        }
        g.line(s.x - s.vx * 0.02, s.y - s.vy * 0.02, s.x, s.y, g.pal.signal, s.r * 1.6); g.circ(s.x, s.y, s.r, g.pal.ink)
      }
      shots = shots.filter((s) => s.life > 0)
      for (const e of enemies) if (e.hp <= 0) kill(e)
      enemies = enemies.filter((e) => e.hp > 0)
      // enemy projectiles
      for (const o of orbs) { o.x += o.vx * dt; o.y += o.vy * dt; g.circ(o.x, o.y, 5, g.pal.hot); g.circ(o.x - 1, o.y - 1, 2, g.hi); if (Math.hypot(o.x - P.x, o.y - P.y) < 9) { o.x = -999; hurtP(1, o.x, o.y) } }
      orbs = orbs.filter((o) => o.x > L - 10 && o.x < RT + 10 && o.y > T - 10 && o.y < B + 10)
      for (const h of hearts) { g.heart(h.x, h.y, 6, g.pal.hot); if (Math.hypot(h.x - P.x, h.y - P.y) < 14) { h.x = -999; heal(); g.sfx('coin'); g.pop('+1', P.x, P.y - 16, g.pal.ok) } }
      hearts = hearts.filter((h) => h.x > 0)

      // drawing enemies
      for (const e of enemies) {
        const flash = e.hit > 0, base = { grunt: g.pal.ok, swarm: g.pal.warn, spitter: g.pal.ice, charger: g.pal.hot, brute: mix(g.pal.hot, g.pal.ink, 0.3), warden: mix(g.pal.hot, g.pal.ink, 0.15) }[e.k]
        g.c.globalAlpha = 0.35; g.circ(e.x, e.y + e.r * 0.7, e.r, '#000'); g.c.globalAlpha = 1
        g.circ(e.x, e.y, e.r, flash ? g.pal.ink : base)
        if (e.k === 'spitter') { g.circ(e.x, e.y, e.r * 0.45, g.pal.bg) } else if (e.k === 'charger') { g.tri(e.x - e.r, e.y - 2, e.x - e.r - 5, e.y - e.r, e.x - 2, e.y - e.r + 2, base); g.tri(e.x + e.r, e.y - 2, e.x + e.r + 5, e.y - e.r, e.x + 2, e.y - e.r + 2, base) }
        else if (e.k === 'warden') { for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + torch * 0.8; g.tri(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, e.x + Math.cos(a + 0.35) * e.r, e.y + Math.sin(a + 0.35) * e.r, e.x + Math.cos(a + 0.17) * (e.r + 9), e.y + Math.sin(a + 0.17) * (e.r + 9), base) } }
        g.circ(e.x - e.r * 0.3, e.y - e.r * 0.15, Math.max(1.5, e.r * 0.2), g.pal.bg); g.circ(e.x + e.r * 0.3, e.y - e.r * 0.15, Math.max(1.5, e.r * 0.2), g.pal.bg)
        if (e.max > 3) { g.rect(e.x - e.r, e.y - e.r - 7, e.r * 2, 3, g.lo); g.rect(e.x - e.r, e.y - e.r - 7, e.r * 2 * clamp(e.hp / e.max, 0, 1), 3, g.pal.hot) }
      }
      // the player
      if (P.inv <= 0 || Math.floor(P.inv * 14) % 2) {
        g.c.globalAlpha = 0.35; g.circ(P.x, P.y + 7, 8, '#000'); g.c.globalAlpha = 1
        if (P.dash > 0) for (let i = 1; i < 4; i++) { g.c.globalAlpha = 0.25 / i; g.rrect(P.x - P.fx * i * 9 - 7, P.y - P.fy * i * 9 - 7, 14, 14, 4, g.pal.ice) } 
        g.c.globalAlpha = 1
        g.rrect(P.x - 7, P.y - 7, 14, 14, 4, P.flash > 0 ? g.pal.hot : g.pal.signal); g.rect(P.x - 4 + P.fx * 2, P.y - 3 + P.fy * 2, 3, 3, g.pal.bg); g.rect(P.x + 1 + P.fx * 2, P.y - 3 + P.fy * 2, 3, 3, g.pal.bg)
      }
      for (let b = 0; b < st.blades; b++) { const a = P.blade + (b / st.blades) * 6.28; g.tri(P.x + Math.cos(a) * 30 - 3, P.y + Math.sin(a) * 30, P.x + Math.cos(a) * 30 + 3, P.y + Math.sin(a) * 30, P.x + Math.cos(a) * 30, P.y + Math.sin(a) * 30 - 9, g.pal.ink) }
      if (P.dcd > 0) { g.rect(P.x - 8, P.y + 11, 16, 2, g.lo); g.rect(P.x - 8, P.y + 11, 16 * (1 - P.dcd / 1.1), 2, g.pal.ice) }

      // room cleared
      if (cleared && room > 0) {
        clearT += dt
        if (clearT > 0.8) {
          clearT = 0; g.score += 50 + room * 25; g.sfx('win'); g.flash(g.pal.signal, 0.15)
          if (!bossRoom && Math.random() < 0.4) hearts.push({ x: g.rnd(80, 400), y: g.rnd(120, 280) })
          if (hearts.length) { /* the heart waits in the room you are leaving: take it with the door */ }
          offer()
        }
      } else clearT = 0
      g.intensity = clamp(0.3 + room * 0.07 + enemies.length * 0.03 + (bossRoom ? 0.25 : 0), 0, 1)
      hud()
    }

    function hud() {
      for (let i = 0; i < st.max; i++) { const x = g.w / 2 - (st.max - 1) * 7 + i * 14; g.heart(x, 11, 5, i < P.hp ? g.pal.hot : g.lo) }
      g.text(`room ${room}`, g.w - 10, 24, g.pal.ink2, 13, 'right')
    }
  },
}
