import { RAMP, clearGrid, density, makeGrid, plot } from '../ascii3d'
import { COLS, ROWS } from '../Ascii'
import { Fill } from './kit'

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
const ch = (lum: number) => (lum < 0 ? ' ' : RAMP[Math.min(RAMP.length - 1, Math.floor(Math.pow(Math.max(0, Math.min(1, lum)), 1.6) * RAMP.length))])

/** The dial, as the app's text engine would draw it: a lit ring, a dark insert, two grooves and the pointer. `deg` turns the pointer, R is the radius in pixels. */
const dialLum = (dx: number, dy: number, R: number, deg: number) => {
  const r = Math.hypot(dx, dy) / R
  if (r > 1) return -1
  if (r > 0.64) {
    const lit = (-dx * 0.45 - dy * 0.55) / (R * 0.9)
    return r > 0.94 ? 0.5 : 0.62 + 0.3 * lit
  }
  const th = Math.atan2(dx, -dy), pa = (deg * Math.PI) / 180
  const d = Math.abs(((th - pa + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
  const ang = Math.PI - d                                   // angular distance to the pointer
  if (r > 0.12 && r < 0.62 && ang < 0.075 / Math.max(r, 0.2)) return 0.92
  if (Math.abs(r - 0.48) < 0.025 || Math.abs(r - 0.31) < 0.025) return 0.03
  return 0.1
}

/** One picture that is the dial and then the doughnut: every cell of the 240 x 68 text screen is first a character of the dial's picture, then a character of the
 *  text doughnut, and a wave of scrambling characters runs outward from the middle to change one into the other. `p` runs 0 to 1. */
export const AsciiMorph = ({ colX, rowY, size, A, B, C, p, deg, frame, color }: { colX: number; rowY: number; size: number; A: number; B: number; C: number; p: number; deg: number; frame: number; color: string }) => {
  const torus = makeGrid(COLS, ROWS, 0.5)
  clearGrid(torus)
  plot(torus, 'torus', colX, rowY, size, A, B, C, density(size))
  const R = size * 8                                           // the dial's radius in pixels (cell: 8 x 16)
  const rows: string[] = []
  const reach = Math.ceil(size * 1.3)
  for (let r = 0; r < ROWS; r++) {
    let line = ''
    for (let c = 0; c < COLS; c++) {
      const dxc = c - colX, dyc = (r - rowY) * 2
      const inReach = Math.abs(dxc) <= reach && Math.abs(dyc) <= reach
      const lumT = torus.lum[c + r * COLS]
      if (!inReach) { line += ch(lumT); continue }
      const d = Math.hypot(dxc, dyc) / Math.max(1, size)           // 0 at the middle, 1 at the rim
      const key = 0.12 + 0.62 * Math.min(1.1, d) + 0.18 * hash(c * 7.13 + r * 3.31)
      const lumD = dialLum((c + 0.5 - colX) * 8, (r + 0.5 - rowY) * 16, R, deg)
      if (p > key + 0.07) line += ch(lumT)
      else if (p > key - 0.07 && (lumT >= 0 || lumD >= 0)) line += RAMP[1 + Math.floor(hash(c * 1.9 + r * 5.7 + frame * 3.1) * (RAMP.length - 1))]
      else line += ch(lumD)
    }
    rows.push(line)
  }
  return (
    <Fill style={{ opacity: Math.min(1, p * 9) }}>
      <pre style={{ margin: 0, fontFamily: 'GeistMono', fontWeight: 600, fontSize: 13.3, lineHeight: '16px', letterSpacing: 0, color, whiteSpace: 'pre', position: 'absolute', left: 0, top: (1080 - ROWS * 16) / 2 }}>{rows.join('\n')}</pre>
    </Fill>
  )
}
