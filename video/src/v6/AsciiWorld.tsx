import { interpolate, useCurrentFrame } from 'remotion'
import { RAMP, clearGrid, density, makeGrid, plot, type Grid, type Shape } from '../ascii3d'
import { E, FPS, Fill, Grain, Kicker, P, Ticks, Vignette, clamp, spr } from './kit'

/** The app's ASCII dial, turned all the way up, as a place you fly through. This is the app's own text-drawn 3D engine (ascii3d.ts), the one behind the Focus
 *  timer and the front page: solids that are point clouds, a z-buffer, one light, a ramp of characters ordered by ink. Here it has a camera.
 *  The dial has six stops, the app's own names for them (Off, Drift, A few, Floor, Stars, World); each click of it puts more of the world in. */
export const WCOLS = 320, WROWS = 90        // 6 x 12 px cells: 1920 x 1080
const F = 170                                 // focal length in columns
const CELL_W = 6, CELL_H = 12
export const STOPS = ['Off', 'Drift', 'A few', 'Floor', 'Stars', 'World']
/** seconds from the start of the segment at which the dial clicks to stops 1 to 5, one on each beat of the score */
export const STOP_AT = [1.0, 1.5, 2.0, 2.5, 3.0]
export const WORLD_S = 5.4

const SHAPES: Shape[] = ['knot', 'cube', 'pyramid', 'helix', 'sphere']
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
type Item = { shape: Shape; X: number; Y: number; Z: number; R: number; need: number; seed: number }
const ITEMS: Item[] = (() => {
  const out: Item[] = [{ shape: 'knot', X: 0, Y: 3.2, Z: 24, R: 3.6, need: 1, seed: 1 }]
  const kinds: Shape[] = ['cube', 'pyramid', 'knot', 'helix', 'sphere']
  for (let i = 1; i < 30; i++) {
    const side = i % 2 ? 1 : -1
    out.push({ shape: kinds[(i * 2 + 1) % 5], X: side * (9 + 6 * hash(i)), Y: 2.2 + 3 * hash(i + 7), Z: 20 + i * 15 + 6 * hash(i + 3), R: 2.8 + 1.8 * hash(i + 11), need: i < 2 ? 2 : i < 5 ? 3 : i < 9 ? 4 : 5, seed: i + 1 })
  }
  return out
})()
const STARS = Array.from({ length: 220 }, (_, i) => ({ c: Math.floor(hash(i * 3.1) * WCOLS), r: Math.floor(hash(i * 7.7 + 1) * WROWS * 0.5), ch: ['.', '.', '+', '*', "'"][Math.floor(hash(i * 1.9) * 5)], p: hash(i + 99) }))

/** where the dial is at `t` seconds: a float from 0 to 5, each click a short spring */
export const stopAt = (t: number) => {
  let s = 0
  for (let i = 0; i < STOP_AT.length; i++) s += spr(t - STOP_AT[i], 0.22, 0.7)
  return s
}
/** how far the camera has flown, in world units, and how fast it is going */
const speed = (t: number) => 1.2 + 2.2 * Math.max(0, Math.min(1, (t - 1) / 0.5)) + 3 * Math.max(0, Math.min(1, (t - 1.5) / 0.5)) + 5 * Math.max(0, Math.min(1, (t - 2) / 0.5)) + 8 * Math.max(0, Math.min(1, (t - 2.5) / 0.5)) + (t > 3 ? 8 + 26 * Math.pow(Math.min(1, (t - 3) / 2.4), 1.6) : 0)
const distance = (t: number) => { let z = 0; const dt = 0.02; for (let u = 0; u < t; u += dt) z += speed(u) * dt; return z }

const rampChar = (lum: number) => (lum < 0 ? ' ' : RAMP[Math.min(RAMP.length - 1, Math.floor(Math.pow(Math.max(0, Math.min(1, lum)), 1.6) * RAMP.length))])

/** the ground: ridges that run across your path (the friction ridges of the opening, grown into country) and mountains standing away from a valley down the middle */
const vnoise = (x: number, z: number) => {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf)
  const a = hash(xi * 57.3 + zi * 131.7), b = hash((xi + 1) * 57.3 + zi * 131.7), c = hash(xi * 57.3 + (zi + 1) * 131.7), d = hash((xi + 1) * 57.3 + (zi + 1) * 131.7)
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v
}
const groundH = (x: number, z: number, amp: number) => {
  const ridge = Math.pow(Math.abs(Math.sin(z * 0.26)), 1.8) * 2.7 * (0.6 + 0.4 * Math.sin(x * 0.09 + z * 0.02))
  const far = Math.max(0, Math.abs(x) - 16)
  const mount = (vnoise(x * 0.05, z * 0.04) * 0.8 + vnoise(x * 0.12, z * 0.09) * 0.2) * Math.min(1, far / 22) * 13
  return amp * (ridge + mount)
}

const buildFrame = (t: number) => {
  const st = stopAt(t)
  const camZ = distance(t)
  const camX = Math.sin(t * 0.7) * 2.2
  const camY = 4.6 + 0.3 * Math.sin(t * 0.9)
  const roll = 0.035 * Math.sin(t * 0.8 + 1) * Math.min(1, Math.max(0, st - 2.5))   // a gentle bank, in rows per column
  const r0 = WROWS * 0.46 - 2 - 2 * Math.max(0, Math.min(1, (t - 3) / 2))      // the horizon
  const c0 = WCOLS / 2
  const rollRow = (col: number) => (col - c0) * roll * 0.5
  const solids = makeGrid(WCOLS, WROWS, 0.5)
  const tmp = makeGrid(WCOLS, WROWS, 0.5)
  const zbuf = new Float32Array(WCOLS * WROWS).fill(1e9)           // depth of whatever is drawn in each cell
  const lines: string[][] = Array.from({ length: WROWS }, () => Array(WCOLS).fill(' '))
  const surf: string[][] = Array.from({ length: WROWS }, () => Array(WCOLS).fill(' '))
  const sky: string[][] = Array.from({ length: WROWS }, () => Array(WCOLS).fill(' '))
  // stars from the fourth click, twinkling
  const starK = Math.max(0, Math.min(1, st - 3))
  if (starK > 0.01) {
    for (const s of STARS) {
      if (hash(s.p * 50 + Math.floor(t * 4)) > 0.2 + 0.5 * (1 - starK)) continue
      const col = (s.c + Math.floor(camX * 0.5) + WCOLS) % WCOLS
      const row = Math.floor(s.r * (r0 / (WROWS * 0.5)) + rollRow(col))
      if (row >= 0 && row < r0 - 1) sky[row][col] = s.ch
    }
  }
  // the ground, drawn the way a voxel engine does: slices from near to far, each one filling the part of every column not already covered
  const groundK = Math.max(0, Math.min(1, st - 2))
  const amp = groundK * (0.25 + 0.75 * Math.max(0, Math.min(1, st - 3)))
  const ymin = new Float32Array(WCOLS).fill(WROWS)
  if (groundK > 0.01) {
    const GX = 8, GZ = 8
    for (let z = 2.2; z < 150; z += 0.22 + z * 0.018) {
      const zAbs = camZ + z
      const wZ = Math.min(1.1, (z * z) / (0.5 * F * Math.max(0.5, camY)) * 0.42)
      const dzl = (((zAbs % GZ) + GZ) % GZ)
      const onZ = Math.min(dzl, GZ - dzl) < wZ
      for (let c = 0; c < WCOLS; c++) {
        const x = camX + ((c - c0) * z) / F
        const h = groundH(x, zAbs, amp)
        const y = r0 + ((camY - h) * F * 0.5) / z + rollRow(c)
        if (y >= ymin[c]) continue
        const wX = Math.max(0.2, (z / F) * 1.5)
        const dxl = ((x % GX) + GX) % GX
        const onX = Math.min(dxl, GX - dxl) < wX
        // light from the left and behind: a face turned toward it is brighter
        const dhz = groundH(x, zAbs + 0.6, amp) - h, dhx = groundH(x + 0.6, zAbs, amp) - h
        const lit = Math.max(0, Math.min(1, 0.5 + (-dhx * 0.9 - dhz * 1.2) * 0.9))
        const fog = Math.exp(-z / 80)
        const top = Math.max(0, Math.floor(y))
        for (let row = top; row < ymin[c]; row++) {
          if (row >= WROWS) break
          const edge = row === top
          const bright = (onX || onZ || edge) ? 1 : 0
          if (bright) lines[row][c] = z > 85 ? '.' : z > 42 ? '-' : z > 18 ? '=' : '#'
          else surf[row][c] = lit * fog > 0.62 ? '.' : ' '
          zbuf[c + row * WCOLS] = z
          if (bright) surf[row][c] = ' '
          else lines[row][c] = ' '
        }
        ymin[c] = top
      }
    }
  }
  // the sun: a big sphere on the horizon with slits across its lower half; the ground hides what it covers
  const sunK = Math.max(0, Math.min(1, st - 4))
  if (sunK > 0.01) {
    clearGrid(tmp)
    const sunSize = 26 + 8 * sunK + 8 * Math.max(0, Math.min(1, (t - 3) / 2.4))
    plot(tmp, 'sphere', c0 + 6, r0 - 9, sunSize * sunK, 0.4, t * 0.2, 0, density(sunSize))
    for (let y = 0; y < WROWS; y++) for (let x = 0; x < WCOLS; x++) {
      const o = x + y * WCOLS
      if (tmp.lum[o] < 0 || zbuf[o] < 1e8) continue
      const below = (r0 + rollRow(x)) - y
      if (below < 0) continue
      if (below < 17 && (y % 3 === 0) && below < 3 + 14 * (1 - below / 17)) continue
      solids.lum[o] = Math.max(0.4, Math.min(0.95, tmp.lum[o] * 1.2)); zbuf[o] = 900
    }
  }
  // the forms that stand about the country: the app's own solids, a few at a time
  const order = ITEMS.map((it) => it).filter((it) => st + 0.001 >= it.need)
  for (const it of order) {
    const relZ = it.Z - camZ
    if (relZ < 2 || relZ > 140) continue
    const appear = spr(t - (STOP_AT[Math.min(4, it.need - 1)] || 0), 0.5, 0.62)
    const gh = groundH(it.X, it.Z, amp)
    const relX = it.X - camX, relY = gh + it.Y * 0.6 + it.R * 0.4 + 0.35 * Math.sin(t * 1.1 + it.seed) - camY
    const col = c0 + (F * relX) / relZ
    const row = r0 - 0.5 * (F * relY) / relZ + rollRow(col)
    const size = ((F * it.R) / relZ) * appear
    if (size < 0.8) continue
    if (col < -size * 1.3 || col > WCOLS + size * 1.3 || row < -size || row > WROWS + size) continue
    clearGrid(tmp)
    plot(tmp, it.shape, col, row, size, it.seed * 1.7 + t * (0.5 + 0.1 * (it.seed % 4)), it.seed * 0.9 + t * 0.35, t * 0.12, density(size))
    const x0 = Math.max(0, Math.floor(col - size * 1.2)), x1 = Math.min(WCOLS - 1, Math.ceil(col + size * 1.2))
    const y0 = Math.max(0, Math.floor(row - size * 0.7)), y1 = Math.min(WROWS - 1, Math.ceil(row + size * 0.7))
    const fog = Math.exp(-relZ / 120)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const o = x + y * WCOLS
      if (tmp.lum[o] >= 0 && relZ < zbuf[o]) { solids.lum[o] = Math.max(0.14, tmp.lum[o] * (0.55 + 0.45 * fog)); zbuf[o] = relZ }
    }
  }
  const front = Array.from({ length: WROWS }, (_, r) => { let s = ''; for (let c = 0; c < WCOLS; c++) s += rampChar(solids.lum[c + r * WCOLS]); return s }).join('\n')
  const behind = lines.map((r, i) => r.map((ch, c) => (ch !== ' ' ? ch : sky[i][c])).join('')).join('\n')
  const faint = surf.map((r) => r.join('')).join('\n')
  return { front, behind, faint, st }
}

/** the plate for the app's ASCII dial: a ruler with six stops and a needle that clicks from one to the next */
const DialPlate = ({ t, st }: { t: number; st: number }) => {
  const p = spr(t - 0.4, 0.5, 0.88)
  const W = 640
  const needle = (st / 5) * (W - 60) + 30
  return (
    <div style={{ position: 'absolute', left: 104, bottom: 104, opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 26}px)` }}>
      <div style={{ position: 'relative', width: W, background: 'rgba(5,7,12,0.94)', border: `1px solid ${P.rule}`, padding: '24px 30px 22px' }}>
        <Ticks />
        <Kicker size={25} style={{ marginBottom: 12 }}>The ASCII dial</Kicker>
        <div style={{ fontFamily: 'Hanken', fontWeight: 700, fontSize: 56, lineHeight: 1.04, letterSpacing: '-0.03em', color: P.ink, whiteSpace: 'nowrap' }}>Turn it all the way up.</div>
        <div style={{ position: 'relative', height: 70, marginTop: 22 }}>
          {STOPS.map((n, i) => {
            const x = 30 + (i / 5) * (W - 60 - 60)
            const on = st >= i - 0.02
            return (
              <div key={n} style={{ position: 'absolute', left: x, top: 0, transform: 'translateX(-50%)', textAlign: 'center' }}>
                <div style={{ width: 2, height: 16, background: on ? P.signal : P.rule, margin: '0 auto' }} />
                <div style={{ marginTop: 8, fontFamily: 'Barlow', fontWeight: 700, fontSize: 21, letterSpacing: '0.14em', textTransform: 'uppercase', color: on ? P.ink : P.dim, whiteSpace: 'nowrap' }}>{n}</div>
              </div>
            )
          })}
          <div style={{ position: 'absolute', left: 30, right: 30 + 0, top: 6, height: 2, background: P.rule }} />
          <div style={{ position: 'absolute', left: 30 - 5 + (st / 5) * (W - 60 - 60) + 0, top: -6, width: 10, height: 26, background: P.signal }} />
        </div>
      </div>
    </div>
  )
}

export const AsciiWorld = () => {
  const f = useCurrentFrame()
  const t = f / FPS
  const { front, behind, faint, st } = buildFrame(t)
  const fadeIn = interpolate(t, [0, 0.3], [0, 1], clamp)
  return (
    <Fill style={{ background: P.ground }}>
      <Fill style={{ opacity: fadeIn }}>
        <pre style={{ margin: 0, position: 'absolute', left: 0, top: 0, fontFamily: 'GeistMono', fontWeight: 500, fontSize: 10, lineHeight: `${CELL_H}px`, letterSpacing: 0, color: P.ice, opacity: 0.35, whiteSpace: 'pre' }}>{faint}</pre>
        <pre style={{ margin: 0, position: 'absolute', left: 0, top: 0, fontFamily: 'GeistMono', fontWeight: 700, fontSize: 10, lineHeight: `${CELL_H}px`, letterSpacing: 0, color: P.ice, opacity: 0.95, whiteSpace: 'pre' }}>{behind}</pre>
        <pre style={{ margin: 0, position: 'absolute', left: 0, top: 0, fontFamily: 'GeistMono', fontWeight: 600, fontSize: 10, lineHeight: `${CELL_H}px`, letterSpacing: 0, color: P.signal, whiteSpace: 'pre' }}>{front}</pre>
      </Fill>
      <DialPlate t={t} st={st} />
      <Vignette k={0.55} />
      <Grain opacity={0.05} />
    </Fill>
  )
}
export { E }
