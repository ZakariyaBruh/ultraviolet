import { useEffect, useRef } from 'react'
import { clearGrid, fbm, makeGrid, plot, RAMP, turn, type Shape, type Turn } from '@/lib/ascii3d'
import { usePerf } from '@/lib/perf'
import type { Stage } from '@/lib/stage'
import { useUI } from '@/lib/ui'

/**
 * The ASCII dial's main instrument. Solids drawn in text roam the whole screen, turning as they go: one drifting at Drift,
 * three wandering at A few, five circling the middle at Orbit. The floor of text lines running to the horizon is kept for the top
 * two stops: Stars adds it with text stars and seven solids, and World adds a sun on the horizon, shooting stars and nine solids.
 * The sun is the trailer's: a sphere with slits across its lower half, set behind the floor. The Sunset theme already has a sun of
 * its own (a CSS disc on the horizon), so there the scene leaves its own out and lets that one stand.
 * It sits behind everything and never takes the pointer. It is a layer on the shared backdrop canvas (lib/stage.ts), drawn over
 * the contour field in the same frame. When something is finished (the celebration card) they all speed up and swell for a few
 * seconds. At light detail (lib/perf.ts) it is drawn half as often; at still, once, and again only when a panel has moved.
 *
 * Where the panels and the lines of text are is measured only when the page has actually changed (a mutation, a scroll, the end
 * of a transition), with a slow check every few seconds behind that: measuring means asking the browser to lay the page out, and
 * doing it on a timer was a steady cost on every screen even when nothing moved.
 */
interface Spec { shape: Shape; x: number; y: number; r: number; ph: number; ax: number; ay: number; w: number; sa: number; sb: number }
/** a solid: where it lives (x, y as fractions of the screen), how big, how far it wanders and how fast it turns */
const T = (shape: Shape, x: number, y: number, r: number, ph: number, ax = 0.2, ay = 0.16, w = 0.17, sa = 0.7, sb = 0.4): Spec => ({ shape, x, y, r, ph, ax, ay, w, sa, sb })

/** every solid, in the order they join as the dial turns up */
const ALL: Spec[] = [
  T('torus', 0.78, 0.66, 0.15, 0, 0.2, 0.18, 0.15),
  T('cube', 0.16, 0.62, 0.1, 1, 0.14, 0.2, 0.2, 0.6, 0.75),
  T('knot', 0.5, 0.24, 0.1, 2, 0.28, 0.12, 0.13, 0.5, 0.55),
  T('sphere', 0.9, 0.22, 0.08, 3, 0.1, 0.22, 0.24, 0.3, 0.4),
  T('helix', 0.3, 0.84, 0.1, 4, 0.24, 0.1, 0.18, 0.2, 0.8),
  T('pyramid', 0.66, 0.14, 0.09, 5, 0.2, 0.16, 0.21, 0.55, 0.9),
  T('torus', 0.1, 0.2, 0.07, 6, 0.1, 0.24, 0.26, 0.9, 0.3),
  T('cube', 0.55, 0.88, 0.08, 7, 0.3, 0.08, 0.16, 0.8, 0.5),
  T('knot', 0.92, 0.56, 0.07, 8, 0.08, 0.26, 0.22, 0.4, 0.7),
]
/** how many solids at each stop, how big they are, and how strong the whole scene is */
const COUNT = [0, 1, 3, 5, 7, 9]
const GROW = [0, 0.9, 0.9, 0.92, 0.95, 0.98]
const GAIN = [0, 0.2, 0.24, 0.28, 0.33, 0.38]
/** how long the burst after a finish lasts */
const BURST_MS = 4800

/** small characters on a fine grid: the solids come out smooth rather than as a few big marks (it was 13px on a 15px line) */
const FONT = 9
const LINE = 10
/** characters are grouped by how strong they are into this many steps, so a whole run of them is one draw call */
const STEPS = 8
const TOP = 0.9
/** how much of the scene is left behind panels and behind lines of text, so reading never fights it */
const BEHIND_PANEL = 0.6
const BEHIND_TEXT = 0.28
const PANELS = '[data-movable], .material, .glass'
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
/** how strong the sun is next to the solids: it is far behind them, so it stays quieter */
const SUN_GAIN = 0.8
const FACE = `700 ${FONT}px "Geist Mono Variable", ui-monospace, Menlo, Consolas, monospace`
/** what a change to the page has to be for the panels to be measured again: not the solids' own text, and not anything hidden from readers */
const ignored = (n: Node | null) => { const e = n && (n.nodeType === 1 ? (n as Element) : n.parentElement); return !e || !!e.closest('pre, canvas, svg, [aria-hidden="true"]') }
/** a style or class change matters only on something that is a panel or holds one: a progress bar growing inside a panel moves nothing the scene sits behind */
const holdsPanel = (n: Node) => n.nodeType === 1 && ((n as Element).matches(PANELS) || !!(n as Element).querySelector(PANELS))

export function AsciiScene({ canvas, stage, level }: { canvas: Stage; stage: number; level: 0 | 1 | 2 }) {
  const tier = usePerf((s) => s.tier)
  // the scene's own time and each solid's turn outlive a change of detail level, so nothing jumps when the level steps down
  const mem = useRef<{ t: number; spin: number; rot: Turn[] }>({ t: 0, spin: 0, rot: [] })
  useEffect(() => {
    if (stage < 1) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const still = reduced || level === 0 || tier === 0
    let cols = 0, rows = 0, cw = 8, w = 0, h = 0
    let g = makeGrid(1, 1)
    let last = 0
    let { t, spin } = mem.current
    // each solid keeps its own turn, so one can slow while another speeds up
    const rot = mem.current.rot
    let signal = '#ffd23f', ink = '#ffffff'
    let mask = new Float32Array(0)
    // one row of characters per strength step, and where in the row each has anything
    let runs: string[][] = []
    const lo = new Array<number>(STEPS).fill(1e9), hi = new Array<number>(STEPS).fill(-1)
    let seen = ''
    // the page changed since the panels were last measured, and when that was
    let dirty = true, maskAt = 0
    // on a phone the page text fills the screen, so only the lower solids stay and they sit a little quieter
    const narrow = innerWidth < 640
    const st = Math.min(5, stage)
    const specs = ALL.slice(0, narrow ? Math.min(3, COUNT[st]) : COUNT[st])
    const gain = GAIN[st] * (narrow ? 0.8 : 1)
    const grow = GROW[st]
    // a finish (the celebration card) sets the shapes off: they speed up, swing wider and swell, then settle over a few seconds
    let burstAt = -1e9
    const unsub = useUI.subscribe((u, prev) => { if (u.celebrate && !prev.celebrate) burstAt = performance.now() })
    const energy = () => Math.max(0, 1 - (performance.now() - burstAt) / BURST_MS)
    const stars = Array.from({ length: stage >= 5 ? 150 : 100 }, (_, i) => ({ x: hash(i * 3.1), y: hash(i * 7.7 + 1), s: 0.25 + hash(i * 1.9 + 4) * 0.9, c: '..+*\''[Math.floor(hash(i * 5.3) * 5)] }))
    // which cells hold the sun, so it can be drawn quieter than the solids in front of it
    let isSun = new Uint8Array(0)
    let sunset = false

    // the width of a character in this face, measured once on a scrap canvas (the shared one is not ours to set up)
    const ruler = document.createElement('canvas').getContext('2d')
    const size = (W: number, H: number) => {
      w = W; h = H
      if (ruler) { ruler.font = FACE; cw = ruler.measureText('M').width || 8 }
      cols = Math.ceil(w / cw); rows = Math.ceil(h / LINE)
      g = makeGrid(cols, rows, cw / LINE)
      isSun = new Uint8Array(cols * rows)
      runs = Array.from({ length: STEPS }, () => new Array<string>(cols).fill(' '))
      lo.fill(1e9); hi.fill(-1)
      dirty = true
    }
    /** find panels and lines of text on screen and quieten the scene behind them; returns false when nothing moved */
    const panels = () => {
      // the cloud browser mounts a heavy live iframe; measuring ~500 range rects next to it forces a reflow that
      // freezes an iPad (one thread for the page and its frames). Keep the last mask while it is open — the scene is
      // behind the frame anyway and the solids keep turning. The measure resumes the moment it closes.
      if (useUI.getState().cloudOpen) return false
      dirty = false; maskAt = performance.now()
      const boxes: { r: DOMRect; v: number }[] = []
      document.querySelectorAll<HTMLElement>(PANELS).forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.width > 24 && r.height > 12) boxes.push({ r, v: BEHIND_PANEL })
      })
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          if (n.nodeType === 1) {
            const e = n as Element
            const tag = e.tagName.toUpperCase()
            return tag === 'PRE' || tag === 'CANVAS' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG' || e.getAttribute('aria-hidden') === 'true' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP
          }
          return (n.nodeValue ?? '').trim().length > 1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        },
      })
      const range = document.createRange()
      for (let n = walk.nextNode(), i = 0; n && i < 500; n = walk.nextNode(), i++) {
        range.selectNodeContents(n)
        const r = range.getBoundingClientRect()
        if (r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight) boxes.push({ r, v: BEHIND_TEXT })
      }
      const sig = `${cols}x${rows}|${boxes.map(({ r }) => `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`).join(';')}`
      if (sig === seen && mask.length === cols * rows) return false
      seen = sig
      mask = new Float32Array(cols * rows).fill(1)
      // panels first, then text over them, so a line of text always wins the lower value
      for (const pass of [BEHIND_PANEL, BEHIND_TEXT]) {
        for (const { r, v } of boxes) {
          if (v !== pass) continue
          const pad = v === BEHIND_TEXT ? 1 : 0
          const x0 = Math.max(0, Math.floor(r.left / cw) - pad), x1 = Math.min(cols, Math.ceil(r.right / cw) + pad)
          const y0 = Math.max(0, Math.floor(r.top / LINE)), y1 = Math.min(rows, Math.ceil(r.bottom / LINE))
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = x + y * cols; if (mask[o] > v) mask[o] = v }
        }
      }
      return true
    }
    const colours = () => {
      const cs = getComputedStyle(document.documentElement)
      signal = cs.getPropertyValue('--signal').trim() || signal
      ink = cs.getPropertyValue('--ink').trim() || ink
      sunset = document.documentElement.dataset.theme === 'sunset'
    }

    /** measure the panels again if the page has changed (not more often than the detail level allows), or if it has been a while */
    const remeasure = () => {
      const since = performance.now() - maskAt
      return (dirty ? since > (tier === 2 ? 600 : 1200) : since > 5000) ? panels() : false
    }
    const draw = (ctx: CanvasRenderingContext2D, now: number) => {
      if (!cols) return
      if (!still) {
        // the scene's own time: it runs faster for a few seconds after a finish
        const dt = last ? Math.min(0.2, (now - last) / 1000) : 0
        const en = energy()
        t += dt * (1 + 3 * en)
        spin += dt * (1 + 5 * en)
        specs.forEach((s, i) => turn((rot[i] ??= { a: 0, b: 0, c: 0 }), dt, t, s.ph, (0.7 + s.sa * 0.6) * (1 + 5 * en)))
        last = now
        mem.current.t = t; mem.current.spin = spin
        remeasure()
      }
      if (mask.length !== cols * rows) panels()
      ctx.font = FACE
      ctx.textBaseline = 'top'
      clearGrid(g)
      const base = Math.min(cols, rows * 2.2)
      const e = still ? 0 : energy()
      const swing = 1 + 0.8 * e
      // the floor and the stars belong to the top two stops; the sun to the last, unless the theme has a sun of its own
      const floor = stage >= 4
      const horizon = Math.floor(rows * 0.66)
      const sunOn = stage >= 5 && !sunset
      const orbit = stage >= 3
      // from Orbit on, the solids circle the middle of the screen (the Sunset theme has its own sun low on the screen, so its solids circle above it and never melt into it)
      const ccx = cols * 0.5
      // the sun: a disc on the horizon, its lower part below the ground
      const sunR = base * (0.235 + 0.012 * Math.sin(t * 0.5)) * grow
      const sunRows = sunR * g.aspect
      const sunY = horizon - sunRows * 0.55
      const ccy = sunOn ? sunY : rows * (sunset ? 0.37 : 0.46)
      const front: (() => void)[] = []
      const back: (() => void)[] = []
      for (const [i, s] of specs.entries()) {
        const r = (rot[i] ??= { a: 0, b: 0, c: 0 })
        let px: number, py: number, depth = 1, lit = true
        if (orbit) {
          // a loop of its own for each, wider and slower the further out: seen at an angle, so it is an ellipse, and the lower half is nearer
          const k = specs.length > 1 ? i / (specs.length - 1) : 0.5
          const th = s.ph * 1.7 + (still ? 0 : t) * (0.2 - 0.1 * k)
          // around the sun the loops start outside its face and lie flatter, like rings
          const rx = cols * (sunOn ? 0.24 + 0.22 * k : 0.15 + 0.27 * k) * swing, ry = rows * (sunOn ? 0.09 + 0.15 * k : 0.08 + 0.17 * k) * swing
          const tilt = (sunOn ? -0.1 : -0.2) + 0.12 * Math.sin(s.ph)
          const ex = rx * Math.cos(th), ey = ry * Math.sin(th)
          px = Math.min(cols * 0.95, Math.max(cols * 0.05, ccx + ex * Math.cos(tilt) - ey * Math.sin(tilt) + fbm(t * 0.2, s.ph) * cols * 0.02))
          py = Math.min(rows * 0.92, Math.max(rows * 0.08, ccy + ex * Math.sin(tilt) + ey * Math.cos(tilt) + fbm(t * 0.17, s.ph + 4) * rows * 0.02))
          depth = 1 + 0.22 * Math.sin(th)
          lit = Math.sin(th) > 0
        } else {
          // each solid wanders on its own slow loop (two waves, so it never retraces itself)
          const wx = fbm(t * s.w * 0.55, s.ph * 3.1) * 1.5
          const wy = fbm(t * s.w * 0.45, s.ph * 5.3 + 2) * 1.5
          px = Math.min(0.94, Math.max(0.06, s.x + s.ax * swing * wx)) * cols
          py = Math.min(0.9, Math.max(0.1, s.y + s.ay * swing * wy)) * rows
        }
        const breathe = (1 + 0.07 * fbm(t * 0.35, s.ph + 11) + 0.22 * e * Math.sin(spin * 3 + s.ph)) * depth
        const draw1 = () => plot(g, s.shape, px, py, s.r * grow * breathe * base * (sunOn ? 0.62 : 0.95), r.a + s.ph, r.b + s.ph * 0.7, r.c)
        ;(sunOn && !lit ? back : front).push(draw1)
      }
      back.forEach((f) => f())
      if (sunOn) {
        // a flat disc, brighter at the middle and sharp at the rim, with slits across its lower half that widen toward the ground
        isSun.fill(0)
        const x0 = Math.max(0, Math.floor(ccx - sunR)), x1 = Math.min(cols - 1, Math.ceil(ccx + sunR))
        for (let y = Math.max(0, Math.floor(sunY - sunRows)); y <= Math.min(horizon, rows - 1); y++) {
          const dy = (y - sunY) / sunRows
          if (dy > 0.12 && y % 4 < Math.min(3, Math.floor((dy - 0.05) * 8))) continue
          for (let x = x0; x <= x1; x++) {
            const dx = (x - ccx) / sunR
            const d2 = dx * dx + dy * dy
            if (d2 > 1) continue
            const o = x + y * cols
            g.lum[o] = 0.5 + 0.34 * (1 - d2) + (d2 > 0.88 ? 0.1 : 0)
            g.z[o] = 0
            isSun[o] = 1
          }
        }
      }
      front.forEach((f) => f())
      if (sunOn) {
        // a thin gap of dark round every solid that passes in front, so it stays a solid and does not melt into the sun
        const x0 = Math.max(2, Math.floor(ccx - sunR) - 2), x1 = Math.min(cols - 3, Math.ceil(ccx + sunR) + 2)
        for (let y = Math.max(1, Math.floor(sunY - sunRows) - 1); y <= Math.min(horizon, rows - 2); y++) {
          for (let x = x0; x <= x1; x++) {
            const o = x + y * cols
            if (!isSun[o] || g.z[o] !== 0) continue
            if ((g.lum[o - 1] >= 0 && g.z[o - 1] > 0) || (g.lum[o + 1] >= 0 && g.z[o + 1] > 0) || (g.lum[o - 2] >= 0 && g.z[o - 2] > 0) || (g.lum[o + 2] >= 0 && g.z[o + 2] > 0) || (g.lum[o - cols] >= 0 && g.z[o - cols] > 0) || (g.lum[o + cols] >= 0 && g.z[o + cols] > 0)) { g.lum[o] = -1; isSun[o] = 0 }
          }
        }
      }
      const cx = cols / 2
      const scroll = still ? 0 : t * 0.9
      ctx.fillStyle = signal
      // one row at a time: every cell goes into the run for its strength, and each run is drawn as one string
      for (let y = 0; y < rows; y++) {
        let used = 0
        for (let x = 0; x < cols; x++) {
          const o = x + y * cols
          const lum = g.lum[o]
          let ch = ''
          let a = 0
          if (lum >= 0) {
            // a curve on the light so the lit side, the shaded side and the edge read as different characters: the shape shows up, not a block
            const l = Math.pow(lum, 1.8)
            ch = RAMP[Math.min(RAMP.length - 1, Math.floor(l * RAMP.length))]
            a = gain * (0.2 + l * 3.2) * (isSun[o] && g.z[o] === 0 ? SUN_GAIN : 1)
          }
          else if (floor && y > horizon) {
            const d = y - horizon
            const depth = 9 / d
            const row = Math.abs(((depth * 2 - scroll) % 1 + 1) % 1) < 0.1
            const u = ((x - cx) / d) * 1.8
            const col = Math.abs(u - Math.round(u / 1.4) * 1.4) < 0.22
            if (row || col) { ch = row && col ? '+' : row ? '-' : x < cx - 1 ? '\\' : x > cx + 1 ? '/' : '|'; a = Math.min(1, d / (rows - horizon)) * gain * 2.4 }
          }
          if (ch && ch !== ' ') {
            const k = Math.floor((Math.min(TOP, a) * mask[o] / TOP) * STEPS)
            if (k > 0) { const b = Math.min(STEPS, k) - 1; runs[b][x] = ch; used |= 1 << b; if (x < lo[b]) lo[b] = x; if (x > hi[b]) hi[b] = x }
          }
        }
        for (let b = 0; b < STEPS; b++) {
          if (!(used & (1 << b))) continue
          ctx.globalAlpha = ((b + 1) / STEPS) * TOP
          ctx.fillText(runs[b].slice(lo[b], hi[b] + 1).join(''), lo[b] * cw, y * LINE)
          runs[b].fill(' ', lo[b], hi[b] + 1); lo[b] = 1e9; hi[b] = -1
        }
      }
      if (stage >= 4) {
        ctx.fillStyle = ink
        for (const s of stars) {
          const y = Math.floor(s.y * rows * 0.62), x = Math.floor(((s.x + (still ? 0 : t * 0.004 * s.s)) % 1) * cols)
          const o = x + y * cols
          if (g.lum[o] >= 0) continue
          ctx.globalAlpha = Math.min(0.9, gain * (0.9 + 0.8 * Math.sin(t * 2 + s.x * 40)) * s.s * mask[o])
          ctx.fillText(s.c, x * cw, y * LINE)
        }
        // at World, now and then, a star falls: a short bright streak that fades behind its head
        if (stage >= 5 && !still) {
          const cyc = (t % 9) / 1.3
          if (cyc < 1) {
            const n = Math.floor(t / 9)
            const hx = (0.15 + hash(n * 2.3) * 0.7) * cols - cyc * cols * 0.2
            const hy = (0.04 + hash(n * 5.1) * 0.22) * rows + cyc * rows * 0.16
            for (let k = 0; k < 8; k++) {
              const x = Math.floor(hx + k * 1.6), y = Math.floor(hy - k * 0.55)
              if (x < 0 || x >= cols || y < 0 || y >= rows || g.lum[x + y * cols] >= 0) continue
              ctx.globalAlpha = Math.min(0.9, gain * 2.4 * (1 - k / 8) * (1 - cyc * 0.6) * mask[x + y * cols])
              ctx.fillText(k === 0 ? '*' : '-', x * cw, y * LINE)
            }
          }
        }
      }
      ctx.globalAlpha = 1
    }
    colours()
    // the first frame builds each solid's cloud of points, which is real work on a slow device: it waits until the screen itself is up
    let off = () => {}
    const start = () => { off = canvas.add({ z: 1, step: () => (still ? 0 : tier === 2 ? 3 : 6), resize: size, draw }) }
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    const wait = ric ? 0 : window.setTimeout(start, 120)
    const idle = ric ? ric(start, { timeout: 700 }) : 0
    // colours follow the theme; a still scene is drawn again to show them
    const themed = new MutationObserver(() => { colours(); canvas.redraw() })
    themed.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })
    // anything that can move a panel or a line of text marks the page as changed
    const mark = () => { dirty = true }
    const changed = new MutationObserver((list) => {
      if (dirty) return
      for (const m of list) { if (!ignored(m.target) && (m.type === 'childList' || holdsPanel(m.target))) { dirty = true; return } }
    })
    changed.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'open'] })
    addEventListener('scroll', mark, { capture: true, passive: true })
    document.addEventListener('transitionend', mark, true)
    document.addEventListener('animationend', mark, true)
    // a still scene has no frames of its own, so it looks now and then and draws again only when the panels really have moved
    const watch = still ? window.setInterval(() => { if (!document.hidden && remeasure()) canvas.redraw() }, 700) : 0
    return () => {
      off(); clearTimeout(wait); if (idle) (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(idle)
      clearInterval(watch); unsub(); themed.disconnect(); changed.disconnect()
      removeEventListener('scroll', mark, { capture: true }); document.removeEventListener('transitionend', mark, true); document.removeEventListener('animationend', mark, true)
    }
  }, [canvas, stage, level, tier])
  return null
}
