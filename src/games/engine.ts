/** A tiny arcade engine: a 480x320 canvas, keys and pointer, a score, and a round that always ends. */
export const W = 480
export const H = 320
export const ROUND = 75 // seconds, the most any round lasts

export type Key = 'left' | 'right' | 'up' | 'down' | 'act'
export interface Pal { bg: string; ink: string; ink2: string; signal: string; ice: string; hot: string; ok: string; warn: string }

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
  end: () => void
  rnd: (a?: number, b?: number) => number
  rect: (x: number, y: number, w: number, h: number, c: string) => void
  circ: (x: number, y: number, r: number, c: string) => void
  line: (x1: number, y1: number, x2: number, y2: number, c: string, w?: number) => void
  text: (s: string, x: number, y: number, c?: string, size?: number, align?: CanvasTextAlign) => void
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
}

const KEYMAP: Record<string, Key> = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ' ': 'act', Enter: 'act', z: 'act', Z: 'act' }

export function palette(): Pal {
  const cs = getComputedStyle(document.documentElement)
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d
  return { bg: v('--ground', '#07090f'), ink: v('--ink', '#f4efe6'), ink2: v('--ink-2', '#b7b3aa'), signal: v('--signal', '#ffd23f'), ice: v('--ice', '#7fd6ff'), hot: v('--hot', '#ff5d73'), ok: v('--ok', '#4be08a'), warn: v('--warn', '#ffb347') }
}

export function runGame(canvas: HTMLCanvasElement, game: Game, onEnd: (score: number) => void) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = W * dpr
  canvas.height = H * dpr
  const c = canvas.getContext('2d')!
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  const pal = palette()
  const keys = new Set<Key>()
  const tap = new Set<Key>()
  const ptr = { x: W / 2, y: H / 2, down: false, hit: false, px: W / 2, py: H / 2 }
  let done = false
  let raf = 0
  const g: G = {
    w: W, h: H, pal, keys, tap, ptr, score: 0, time: 0, over: false, lives: 3, c,
    end: () => { g.over = true },
    rnd: (a = 1, b?: number) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
    rect: (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)) },
    circ: (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2); c.fill() },
    line: (x1, y1, x2, y2, col, w = 2) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke() },
    text: (s, x, y, col = pal.ink, size = 14, align = 'left') => { c.fillStyle = col; c.font = `${size}px 'Barlow Condensed', system-ui, sans-serif`; c.textAlign = align; c.textBaseline = 'top'; c.fillText(s, x, y) },
    clear: () => { c.fillStyle = pal.bg; c.fillRect(0, 0, W, H) },
  }
  const step = game.make(g)
  const at = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); ptr.x = ((e.clientX - r.left) / r.width) * W; ptr.y = ((e.clientY - r.top) / r.height) * H }
  const pd = (e: PointerEvent) => { at(e); ptr.down = true; ptr.hit = true; canvas.setPointerCapture?.(e.pointerId) }
  const pm = (e: PointerEvent) => at(e)
  const pu = () => { ptr.down = false }
  const kd = (e: KeyboardEvent) => {
    const k = KEYMAP[e.key]
    if (!k || (e.target as HTMLElement | null)?.closest?.('input,textarea,select')) return
    e.preventDefault()
    if (!keys.has(k)) tap.add(k)
    keys.add(k)
  }
  const ku = (e: KeyboardEvent) => { const k = KEYMAP[e.key]; if (k) keys.delete(k) }
  canvas.addEventListener('pointerdown', pd)
  canvas.addEventListener('pointermove', pm)
  canvas.addEventListener('pointerup', pu)
  canvas.addEventListener('pointercancel', pu)
  window.addEventListener('keydown', kd)
  window.addEventListener('keyup', ku)
  let last = performance.now()
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (!done) {
      if (document.visibilityState === 'visible') {
        g.time += dt
        if (g.time >= ROUND) g.over = true
        if (!g.over) {
          g.clear()
          step(dt)
          g.text(`${Math.floor(g.score)}`, 8, 6, pal.signal, 20)
          g.text(`${Math.max(0, Math.ceil(ROUND - g.time))}s`, W - 8, 6, pal.ink2, 16, 'right')
        }
      }
      tap.clear()
      ptr.hit = false
      ptr.px = ptr.x
      ptr.py = ptr.y
      if (g.over) {
        done = true
        onEnd(Math.floor(g.score))
        return
      }
    }
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  return {
    /** virtual keys for touch */
    press: (k: Key, down: boolean) => { if (down) { if (!keys.has(k)) tap.add(k); keys.add(k) } else keys.delete(k) },
    stop: () => {
      done = true
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', pd)
      canvas.removeEventListener('pointermove', pm)
      canvas.removeEventListener('pointerup', pu)
      canvas.removeEventListener('pointercancel', pu)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
    },
  }
}

export const hit = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
/** Move along x with the arrow keys, or follow the pointer when it moves. */
export const steer = (g: G, x: number, sp: number, dt: number) => (g.keys.has('left') ? x - sp * dt : g.keys.has('right') ? x + sp * dt : g.ptr.x !== g.ptr.px ? g.ptr.x : x)
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
/** lose a life; ends the round at none */
export const hurt = (g: G) => { g.lives -= 1; if (g.lives <= 0) g.end() }
export const hearts = (g: G) => g.text('♥'.repeat(Math.max(0, g.lives)), g.w / 2, 6, g.pal.hot, 16, 'center')
