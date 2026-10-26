/** A small arcade engine: a 480x320 canvas, keys and pointer, particles, shake, sound, a countdown, pause, and a round that always ends. */
export const W = 480
export const H = 320
export const ROUND = 75 // seconds, the most any round lasts

export type Key = 'left' | 'right' | 'up' | 'down' | 'act'
export interface Pal { bg: string; ink: string; ink2: string; signal: string; ice: string; hot: string; ok: string; warn: string; ground2: string }
export type Sfx = 'coin' | 'hit' | 'shoot' | 'jump' | 'die' | 'pop' | 'blip' | 'win' | 'boom'

export interface Opts {
  /** `canContinue`: the round ended by losing with time left, and has not been continued yet */
  onEnd: (score: number, why: 'out' | 'time', canContinue: boolean) => void
  onPause?: (p: boolean) => void
  /** screen shake and particles: off when motion is calm or reduced */
  motion: boolean
  volume: number
  muted: boolean
  best: number
}

interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; s: number; g: number; txt?: string; k?: 'sq' | 'circ' | 'line' | 'ring'; rr?: number }

export interface G {
  w: number
  h: number
  pal: Pal
  keys: Set<Key>
  /** keys that went down this frame */
  tap: Set<Key>
  ptr: { x: number; y: number; down: boolean; hit: boolean; px: number; py: number }
  score: number
  time: number
  over: boolean
  lives: number
  best: number
  /** is the theme's ground light (paper)? Shadows and highlights follow. */
  light: boolean
  hi: string
  lo: string
  /** score multiplier shown by the hud */
  mult: number
  /** 0 to 1: how tense the round is. Drives the music. */
  intensity: number
  /** hit-stop: freeze the action for a beat */
  freeze: (sec: number) => void
  /** a quick wash of colour over the whole screen */
  flash: (c: string, a?: number) => void
  /** a big title that slides in, holds, and leaves */
  banner: (title: string, sub?: string) => void
  /** an expanding ring */
  shockwave: (x: number, y: number, c: string, r?: number) => void
  /** end the round (at x, y for the burst) */
  end: (x?: number, y?: number) => void
  rnd: (a?: number, b?: number) => number
  rect: (x: number, y: number, w: number, h: number, c: string) => void
  rrect: (x: number, y: number, w: number, h: number, r: number, c: string) => void
  circ: (x: number, y: number, r: number, c: string) => void
  ring: (x: number, y: number, r: number, c: string, w?: number) => void
  tri: (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, c: string) => void
  line: (x1: number, y1: number, x2: number, y2: number, c: string, w?: number) => void
  text: (s: string, x: number, y: number, c?: string, size?: number, align?: CanvasTextAlign) => void
  heart: (x: number, y: number, s: number, c: string) => void
  /** a field of stars or dots drifting by */
  stars: (vx: number, vy: number, n?: number) => void
  burst: (x: number, y: number, c: string, n?: number, sp?: number, size?: number, shape?: 'sq' | 'circ' | 'line') => void
  /** floating text that rises and fades */
  pop: (s: string, x: number, y: number, c?: string) => void
  shake: (m: number) => void
  sfx: (s: Sfx) => void
  /** a short tone at a pitch (semitones above A3), for runs that climb */
  note: (semi: number) => void
  clear: () => void
  c: CanvasRenderingContext2D
}
export type Step = (dt: number) => void
export interface Game {
  id: string
  name: string
  blurb: string
  /** how to play, one line */
  how: string
  /** on-screen buttons for touch */
  pad: Key[]
  /** also played with the pointer */
  pointer?: boolean
  make: (g: G) => Step
  /** credits a round costs (default 4) */
  cost?: number
  /** seconds a round can last (default 75) */
  round?: number
  /** a run that ends is over: no paid continue */
  noContinue?: boolean
}

const KEYMAP: Record<string, Key> = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ' ': 'act', Enter: 'act', z: 'act', Z: 'act' }

export function palette(): Pal {
  const cs = getComputedStyle(document.documentElement)
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d
  return { bg: v('--ground', '#07090f'), ink: v('--ink', '#f4efe6'), ink2: v('--ink-2', '#b7b3aa'), signal: v('--signal', '#ffd23f'), ice: v('--ice', '#7fd6ff'), hot: v('--hot', '#ff5d73'), ok: v('--ok', '#4be08a'), warn: v('--warn', '#ffb347'), ground2: v('--surface', '#10131c') }
}

/** Short synthesised blips: no files, and they follow the volume setting. */
function makeAudio(volume: number) {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  let ctx: AudioContext | null = null
  try { ctx = AC ? new AC() : null } catch { ctx = null }
  const tone = (f0: number, f1: number, dur: number, type: OscillatorType, vol = 1, delay = 0) => {
    if (!ctx) return
    const t = ctx.currentTime + delay
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.18 * volume * vol), t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(ctx.destination)
    o.start(t)
    o.stop(t + dur + 0.02)
  }
  const note = (f: number) => tone(f, f * 1.01, 0.16, 'triangle', 0.9)
  const play = (s: Sfx) => {
    switch (s) {
      case 'coin': tone(880, 1320, 0.12, 'square', 0.6); break
      case 'hit': tone(220, 70, 0.18, 'sawtooth', 0.9); break
      case 'shoot': tone(720, 180, 0.1, 'square', 0.4); break
      case 'jump': tone(260, 620, 0.14, 'sine', 0.9); break
      case 'pop': tone(520, 900, 0.09, 'triangle', 0.9); break
      case 'blip': tone(440, 440, 0.05, 'square', 0.4); break
      case 'boom': tone(140, 30, 0.35, 'sawtooth', 1); tone(90, 30, 0.3, 'square', 0.6); break
      case 'die': tone(380, 40, 0.6, 'sawtooth', 1); break
      case 'win': tone(523, 523, 0.1, 'square', 0.5); tone(659, 659, 0.1, 'square', 0.5, 0.1); tone(784, 784, 0.18, 'square', 0.5, 0.2); break
    }
  }
  let timer = 0
  const stopMusic = () => { if (timer) window.clearInterval(timer); timer = 0 }
  /** a small looping groove, made from the game's name, that gets busier as the round heats up */
  const startMusic = (seed: string, level: () => number) => {
    if (!ctx) return
    stopMusic()
    let h = 2166136261
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
    const rng = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296 }
    const bpm = 98 + Math.floor(rng() * 36)
    const root = [110, 98, 123.47, 130.81, 87.31, 103.83][Math.floor(rng() * 6)]
    const scale = [0, 3, 5, 7, 10, 12, 15]
    const bass = Array.from({ length: 8 }, () => [0, 0, 0, 7, 5, 3][Math.floor(rng() * 6)])
    const lead = Array.from({ length: 16 }, () => (rng() < 0.45 ? -1 : scale[Math.floor(rng() * scale.length)]))
    let next = ctx.currentTime + 0.1
    let n = 0
    const f = (semi: number, oct = 1) => root * oct * Math.pow(2, semi / 12)
    timer = window.setInterval(() => {
      if (!ctx) return
      while (next < ctx.currentTime + 0.18) {
        const d = next - ctx.currentTime
        const lv = level()
        if (lv >= 0) {
          if (n % 4 === 0) tone(130, 42, 0.14, 'sine', 0.5, d)
          if (n % 4 === 2 && lv > 0.35) tone(7000, 6500, 0.025, 'square', 0.1, d)
          if (n % 2 === 0) tone(f(bass[(n / 2) % 8]), f(bass[(n / 2) % 8]) * 0.97, 0.16, 'sawtooth', 0.22, d)
          if (lv > 0.45 && lead[n % 16] >= 0) tone(f(lead[n % 16], 4), f(lead[n % 16], 4), 0.09, 'square', 0.12, d)
        }
        next += (60 / bpm / 4) * (1 - Math.min(1, Math.max(0, lv)) * 0.16)
        n++
      }
    }, 40)
  }
  return {
    play,
    note,
    startMusic,
    stopMusic,
    close: () => { stopMusic(); ctx?.close().catch(() => undefined) },
    resume: () => { ctx?.resume().catch(() => undefined) },
    suspend: () => { ctx?.suspend().catch(() => undefined) },
  }
}

const HEART = (c: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  c.beginPath()
  c.moveTo(x, y + s * 0.9)
  c.bezierCurveTo(x - s * 1.3, y + s * 0.1, x - s * 0.7, y - s * 0.8, x, y - s * 0.2)
  c.bezierCurveTo(x + s * 0.7, y - s * 0.8, x + s * 1.3, y + s * 0.1, x, y + s * 0.9)
  c.fill()
}

/** dev only: lets screenshots run long without dying */
const god = () => import.meta.env.DEV && !!(globalThis as { __god?: boolean }).__god

export function runGame(canvas: HTMLCanvasElement, game: Game, o: Opts) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = W * dpr
  canvas.height = H * dpr
  const c = canvas.getContext('2d')!
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  const pal = palette()
  const lum = (() => { const m = /#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(pal.bg.replace(/\s/g, '')); if (m) return (parseInt(m[1], 16) * 0.3 + parseInt(m[2], 16) * 0.59 + parseInt(m[3], 16) * 0.11) / 255; const r = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(pal.bg); return r ? (+r[1] * 0.3 + +r[2] * 0.59 + +r[3] * 0.11) / 255 : 0 })()
  const light = lum > 0.55
  const audio = makeAudio(o.volume)
  let muted = o.muted
  const keys = new Set<Key>()
  const tap = new Set<Key>()
  const ptr = { x: W / 2, y: H / 2, down: false, hit: false, px: W / 2, py: H / 2 }
  const parts: Part[] = []
  let shakeM = 0
  let paused = false
  let countdown = 3
  let ending = -1
  let endWhy: 'out' | 'time' = 'out'
  let done = false
  let raf = 0
  let lastScore = 0
  let snapped = false
  let freezeT = 0
  let flashA = 0
  let flashC = '#fff'
  let bn: { t: number; title: string; sub?: string } | null = null
  let pulse = 0
  const star = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() * 0.7 }))
  const snap = document.createElement('canvas')
  snap.width = W * dpr
  snap.height = H * dpr
  // the last whole frame, kept so a round that ends part-way through drawing still shows a full scene
  const keep = document.createElement('canvas')
  keep.width = W * dpr
  keep.height = H * dpr
  const keepCtx = keep.getContext('2d')!

  const g: G = {
    w: W, h: H, pal, keys, tap, ptr, score: 0, time: 0, over: false, lives: 3, best: o.best, c, light, hi: light ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.28)', lo: light ? 'rgba(0,0,0,.18)' : 'rgba(0,0,0,.4)', mult: 1, intensity: 0.3,
    freeze: (sec) => { if (o.motion) freezeT = Math.max(freezeT, sec) },
    flash: (col, a = 0.35) => { if (o.motion) { flashC = col; flashA = a } },
    banner: (title, sub) => { bn = { t: 0, title, sub } },
    shockwave: (x, y, col, r = 60) => { if (o.motion) parts.push({ x, y, vx: 0, vy: 0, life: 0.45, max: 0.45, c: col, s: 2, g: 0, k: 'ring', rr: r }) },
    end: (x, y) => {
      if (ending >= 0 || g.over || god()) return
      ending = 0
      endWhy = 'out'
      audio.stopMusic()
      g.burst(x ?? W / 2, y ?? H / 2, pal.hot, 26, 220, 4)
      g.shake(12)
      g.sfx('die')
    },
    rnd: (a = 1, b?: number) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
    rect: (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)) },
    rrect: (x, y, w, h, r, col) => { c.fillStyle = col; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill() },
    circ: (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2); c.fill() },
    ring: (x, y, r, col, w = 2) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2); c.stroke() },
    tri: (x1, y1, x2, y2, x3, y3, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.closePath(); c.fill() },
    line: (x1, y1, x2, y2, col, w = 2) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke() },
    text: (s, x, y, col = pal.ink, size = 14, align = 'left') => { c.fillStyle = col; c.font = `600 ${size}px 'Barlow Condensed', system-ui, sans-serif`; c.textAlign = align; c.textBaseline = 'top'; c.fillText(s, x, y) },
    heart: (x, y, s, col) => { c.fillStyle = col; HEART(c, x, y, s) },
    stars: (vx, vy, n = 60) => {
      c.fillStyle = pal.ink
      for (let i = 0; i < Math.min(n, star.length); i++) {
        const s = star[i]
        s.x = (s.x + vx * s.z * 0.016 + W) % W
        s.y = (s.y + vy * s.z * 0.016 + H) % H
        c.globalAlpha = 0.12 + s.z * 0.28
        c.fillRect(Math.round(s.x), Math.round(s.y), s.z > 0.7 ? 2 : 1, s.z > 0.7 ? 2 : 1)
      }
      c.globalAlpha = 1
    },
    burst: (x, y, col, n = 12, sp = 140, size = 3, shape = 'sq') => {
      if (!o.motion) n = Math.ceil(n / 4)
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = sp * (0.35 + Math.random() * 0.65)
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.35, max: 0.7, c: col, s: size * (0.6 + Math.random() * 0.8), g: shape === 'line' ? 0 : 220, k: shape })
      }
    },
    pop: (s, x, y, col = pal.signal) => { parts.push({ x, y, vx: 0, vy: -38, life: 0.8, max: 0.8, c: col, s: 16, g: 0, txt: s }) },
    shake: (m) => { if (o.motion) shakeM = Math.max(shakeM, m) },
    sfx: (s) => { if (!muted) audio.play(s) },
    note: (semi) => { if (!muted) audio.note(220 * Math.pow(2, semi / 12)) },
    clear: () => { c.fillStyle = pal.bg; c.fillRect(-20, -20, W + 40, H + 40) },
  }

  const R = game.round ?? ROUND
  let step = game.make(g)
  let revivals = 0
  const at = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); ptr.x = ((e.clientX - r.left) / r.width) * W; ptr.y = ((e.clientY - r.top) / r.height) * H }
  const setPause = (p: boolean) => { if (done || ending >= 0 || p === paused) return; paused = p; o.onPause?.(p); if (p) audio.suspend(); else { audio.resume(); last = performance.now() } }
  const pd = (e: PointerEvent) => { audio.resume(); if (paused) { setPause(false); return } at(e); ptr.down = true; ptr.hit = true; canvas.setPointerCapture?.(e.pointerId) }
  const pm = (e: PointerEvent) => at(e)
  const pu = () => { ptr.down = false }
  const kd = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement | null)?.closest?.('input,textarea,select,button,a,[role="slider"]')) return
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); setPause(!paused); return }
    const k = KEYMAP[e.key]
    if (!k) return
    e.preventDefault()
    if (paused) { setPause(false); return }
    if (!keys.has(k)) tap.add(k)
    keys.add(k)
  }
  const ku = (e: KeyboardEvent) => { const k = KEYMAP[e.key]; if (k) keys.delete(k) }
  const vis = () => { if (document.visibilityState !== 'visible') setPause(true) }
  canvas.addEventListener('pointerdown', pd)
  canvas.addEventListener('pointermove', pm)
  canvas.addEventListener('pointerup', pu)
  canvas.addEventListener('pointercancel', pu)
  window.addEventListener('keydown', kd)
  window.addEventListener('keyup', ku)
  document.addEventListener('visibilitychange', vis)
  window.addEventListener('blur', vis)
  let last = performance.now()

  const tick = (dtIn: number) => {
    // hit-stop: the action holds still for a beat while the sparks play on slowly
    const frozen = freezeT > 0 && ending < 0
    const dt = frozen ? 0 : dtIn
    const pdt = frozen ? dtIn * 0.15 : dtIn
    if (freezeT > 0) freezeT -= dtIn
    // the world, shaken
    c.save()
    if (shakeM > 0.2) { c.translate((Math.random() - 0.5) * shakeM, (Math.random() - 0.5) * shakeM); shakeM *= Math.pow(0.0005, dtIn) } else shakeM = 0
    if (ending >= 0) {
      c.drawImage(snap, 0, 0, W, H)
    } else {
      g.clear()
      step(countdown > 0 ? 0 : dt)
      if (ending >= 0 && !snapped) { snap.getContext('2d')!.drawImage(keep, 0, 0); snapped = true; c.drawImage(snap, 0, 0, W, H) }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]
      p.life -= pdt
      if (p.life <= 0) { parts.splice(i, 1); continue }
      p.vy += p.g * pdt; p.x += p.vx * pdt; p.y += p.vy * pdt
      const k = p.life / p.max
      c.globalAlpha = Math.min(1, k * 1.6)
      if (p.txt) g.text(p.txt, p.x, p.y, p.c, p.s, 'center')
      else if (p.k === 'ring') { g.ring(p.x, p.y, (p.rr ?? 40) * (1 - k), p.c, 1 + 3 * k) }
      else if (p.k === 'circ') g.circ(p.x, p.y, (p.s / 2) * (0.4 + k), p.c)
      else if (p.k === 'line') g.line(p.x, p.y, p.x - p.vx * 0.06, p.y - p.vy * 0.06, p.c, Math.max(1, p.s * 0.6 * k))
      else { c.fillStyle = p.c; c.fillRect(Math.round(p.x - p.s / 2), Math.round(p.y - p.s / 2), Math.ceil(p.s * (0.5 + k)), Math.ceil(p.s * (0.5 + k))) }
    }
    c.globalAlpha = 1
    c.restore()
    if (ending < 0) keepCtx.drawImage(canvas, 0, 0)
    if (flashA > 0.01) { c.globalAlpha = flashA; c.fillStyle = flashC; c.fillRect(0, 0, W, H); c.globalAlpha = 1; flashA *= Math.pow(0.002, dtIn) }
    if (bn && ending < 0 && countdown <= 0) {
      if (!paused) bn.t += dtIn
      const t = bn.t, a = t < 0.25 ? t / 0.25 : t > 1.5 ? Math.max(0, 1 - (t - 1.5) / 0.3) : 1
      const slide = (1 - Math.min(1, t / 0.25)) * 40
      if (t > 1.8) bn = null
      else {
        c.globalAlpha = a * 0.92; c.fillStyle = pal.bg; c.fillRect(0, H / 2 - 38, W, 70); c.globalAlpha = a
        c.fillStyle = pal.signal; c.fillRect(0, H / 2 - 38, W, 2); c.fillRect(0, H / 2 + 30, W, 2)
        g.text(bn.title, W / 2 - slide, H / 2 - 30, pal.signal, 40, 'center')
        if (bn.sub) g.text(bn.sub, W / 2 + slide, H / 2 + 12, pal.ink2, 14, 'center')
        c.globalAlpha = 1
      }
    }
    if (ending < 0 && countdown <= 0) {
      // the hud does not shake
      if (g.score !== lastScore) { pulse = 1; lastScore = g.score }
      pulse = Math.max(0, pulse - dt * 5)
      g.text(`${Math.floor(g.score)}`, 10, 6 - pulse * 2, pulse > 0.2 ? pal.ink : pal.signal, 22 + pulse * 4)
      if (g.best > 0) g.text(`best ${g.best}`, 10, 30, pal.ink2, 12)
      if (g.mult > 1) { g.rrect(10, 44, 34, 18, 4, pal.signal); g.text(`x${g.mult}`, 27, 46, pal.bg, 14, 'center') }
      const left = Math.max(0, R - g.time)
      c.fillStyle = left < 10 ? pal.hot : pal.ink2
      c.globalAlpha = 0.5
      c.fillRect(0, H - 3, W * (left / R), 3)
      c.globalAlpha = 1
      g.text(`${Math.ceil(left)}`, W - 10, 6, left < 10 ? pal.hot : pal.ink2, 16, 'right')
    }
    if (countdown > 0) {
      const n = Math.ceil(countdown)
      const k = countdown - Math.floor(countdown)
      c.fillStyle = pal.bg; c.globalAlpha = 0.55; c.fillRect(0, 0, W, H); c.globalAlpha = 1
      g.text(String(n), W / 2, H / 2 - 36 * (0.8 + k * 0.4), pal.signal, 72 * (0.8 + k * 0.4), 'center')
      g.text(game.how, W / 2, H / 2 + 52, pal.ink2, 14, 'center')
    }
    if (paused) {
      c.fillStyle = pal.bg; c.globalAlpha = 0.7; c.fillRect(0, 0, W, H); c.globalAlpha = 1
      g.text('Paused', W / 2, H / 2 - 24, pal.ink, 36, 'center')
      g.text('Tap, click or press any key to go on', W / 2, H / 2 + 18, pal.ink2, 14, 'center')
    }
  }

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (!done) {
      if (paused) tick(0)
      else if (countdown > 0) {
        const n = Math.ceil(countdown)
        countdown -= dt
        if (Math.ceil(countdown) !== n && countdown > 0) g.sfx('blip')
        if (countdown <= 0) { countdown = 0; g.sfx('coin'); audio.startMusic(game.id, () => (muted ? -1 : g.intensity)) }
        tick(dt)
        tap.clear(); ptr.hit = false
      } else if (ending >= 0) {
        ending += dt
        tick(dt)
        if (ending > 0.9) { done = true; o.onEnd(Math.floor(g.score), endWhy, endWhy === 'out' && !game.noContinue && revivals < 1 && g.time < R - 8); return }
      } else {
        g.time += dt
        if (g.time >= R) {
          // time is up: freeze what is on screen
          ending = 0; endWhy = 'time'; audio.stopMusic(); g.sfx('win'); snap.getContext('2d')!.drawImage(canvas, 0, 0); snapped = true
        } else tick(dt)
      }
      tap.clear()
      ptr.hit = false
      ptr.px = ptr.x
      ptr.py = ptr.y
    }
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  ;(document.activeElement as HTMLElement | null)?.blur?.()
  return {
    /** virtual keys for touch */
    press: (k: Key, down: boolean) => { if (paused) { if (down) setPause(false); return } if (down) { if (!keys.has(k)) tap.add(k); keys.add(k) } else keys.delete(k) },
    pause: (p: boolean) => setPause(p),
    /** carry on after a game over: the same score and clock, a fresh set of lives and a cleared field */
    revive: () => {
      if (!done || ending < 0 || endWhy !== 'out' || revivals >= 1) return
      revivals++
      parts.length = 0
      ending = -1; snapped = false; done = false; shakeM = 0; freezeT = 0
      g.over = false; g.lives = 3; g.mult = 1; g.intensity = 0.3
      keys.clear(); tap.clear()
      step = game.make(g)
      countdown = 1.5
      audio.resume()
      last = performance.now()
      raf = requestAnimationFrame(frame)
    },
    mute: (m: boolean) => { muted = m },
    stop: () => {
      done = true
      audio.close()
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', pd)
      canvas.removeEventListener('pointermove', pm)
      canvas.removeEventListener('pointerup', pu)
      canvas.removeEventListener('pointercancel', pu)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      document.removeEventListener('visibilitychange', vis)
      window.removeEventListener('blur', vis)
    },
  }
}

export const hit = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
/** Move along x with the arrow keys, or follow the pointer when it moves. */
export const steer = (g: G, x: number, sp: number, dt: number) => (g.keys.has('left') ? x - sp * dt : g.keys.has('right') ? x + sp * dt : g.ptr.x !== g.ptr.px ? g.ptr.x : x)
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** lose a life; ends the round at none */
export const hurt = (g: G, x?: number, y?: number) => {
  if (!god()) g.lives -= 1
  g.shake(8); g.sfx('hit'); g.burst(x ?? g.w / 2, y ?? g.h / 2, g.pal.hot, 10, 150)
  if (g.lives <= 0) g.end(x, y)
}
export const hearts = (g: G) => {
  for (let i = 0; i < g.lives; i++) g.heart(g.w / 2 - (g.lives - 1) * 9 + i * 18, 10, 6, g.pal.hot)
}
/** a hard offset shadow, in the flat style of the app */
export const drop = (g: G, x: number, y: number, w: number, h: number, r = 3, dx = 2, dy = 3) => { g.c.globalAlpha = 0.4; g.rrect(x + dx, y + dy, w, h, r, '#000'); g.c.globalAlpha = 1 }
/** a faint grid behind the play field */
export const grid = (g: G, step = 24, off = 0, vertical = false) => {
  g.c.globalAlpha = 0.07
  g.c.fillStyle = g.pal.ink
  for (let x = ((off % step) + step) % step; x < g.w; x += step) g.c.fillRect(Math.round(x), 0, 1, g.h)
  if (!vertical) for (let y = ((off % step) + step) % step; y < g.h; y += step) g.c.fillRect(0, Math.round(y), g.w, 1)
  g.c.globalAlpha = 1
}

export interface Cur { x: number; y: number; px: number; py: number }
/** A cursor that follows the pointer, or the arrow keys when there is no pointer. */
export const cursor = (g: G, c: Cur, dt: number, sp = 300) => {
  c.px = c.x; c.py = c.y
  if (g.ptr.x !== g.ptr.px || g.ptr.y !== g.ptr.py) { c.x = g.ptr.x; c.y = g.ptr.y }
  c.x = clamp(c.x + ((g.keys.has('right') ? 1 : 0) - (g.keys.has('left') ? 1 : 0)) * sp * dt, 0, g.w)
  c.y = clamp(c.y + ((g.keys.has('down') ? 1 : 0) - (g.keys.has('up') ? 1 : 0)) * sp * dt, 0, g.h)
}

/** colour helpers: mix two #rrggbb colours, falling back to the first when a token is not hex */
const hex = (c: string) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c.trim())
  if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
  const r = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c.trim())
  return r ? [+r[1], +r[2], +r[3]] : null
}
export const mix = (a: string, b: string, t: number) => {
  const x = hex(a), y = hex(b)
  if (!x || !y) return t < 0.5 ? a : b
  const k = (i: number) => Math.round(x[i] + (y[i] - x[i]) * clamp(t, 0, 1))
  return `rgb(${k(0)},${k(1)},${k(2)})`
}
export const ease = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3)
export const easeBack = (t: number) => { const c = 1.70158, u = clamp(t, 0, 1) - 1; return 1 + (c + 1) * u * u * u + c * u * u }
