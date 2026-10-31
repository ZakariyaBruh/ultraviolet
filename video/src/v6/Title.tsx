import { interpolate, useCurrentFrame } from 'remotion'
import { Dial } from './Dial'
import { Contours } from './Contours'
import { Ascii, COLS, ROWS } from '../Ascii'
import { Bars, E, FPS, Fill, Grain, P, Vignette, clamp, shake, sp, spr, useLetters } from './kit'

export const A_T = 1440, TAU = 0.55
/** the same law the score's ratchet clicks follow (score6.py): the dial is thrown and friction brings it to rest */
export const angle = (t: number) => (t <= 0 ? 0 : A_T * (1 - Math.exp(-t / TAU)))

const SIZE = 205
const WORD = 'FRICTION'
const TAG = 'Put the friction back.'
export const DIVE0 = 4.2, SWAP = 0.28, GROW0 = 4.4, GROW1 = 5.95
const S_END = 450                 // columns of reach when the hole has left the frame
const END_Y = 685                 // where the hole ends up: over the Lock in button, so the camera goes through the doughnut and lands on the first thing to press

/** how large the text doughnut is, in columns of reach, `now` seconds into the scene: it starts the size of the O and falls toward you */
export const torusSize = (now: number, s0: number) => {
  const u = interpolate(now, [GROW0, GROW1], [0, 1], clamp)
  return s0 * Math.pow(S_END / s0, Math.pow(u, 1.55))
}
/** the hole in the doughnut, in pixels: what the picture behind shows through (about a third of the reach, a cell is 8 px) */
export const holeRadius = (size: number) => size * 8 * 0.335

/** Seven to thirteen seconds: the dial is thrown, slows, becomes the O of FRICTION; the line lands; the O turns into the text doughnut and the camera flies through its hole into the app. */
export const Title = () => {
  const f = useCurrentFrame()
  const now = f / FPS
  const m = useLetters(WORD, SIZE)
  if (!m) return <Fill style={{ background: P.ground }} />
  const left = (1920 - m.total) / 2
  const ox = left + m.x[6] + m.w[6] / 2
  const oy = 520
  const dO = m.w[6] * 1.0
  const D0 = 760

  const go = 1.05
  const tx = sp(now, go, 960, ox, 0.85, 0.88)
  const ty = sp(now, go, 540, oy, 0.85, 0.88)
  const dd = sp(now, go, D0, dO, 0.85, 0.88)
  const pop = 1 + 0.2 * (1 - spr(now, 0.42, 0.62))
  const s = shake(now, 0.0, 9)

  const wordIn = (i: number) => spr(now - (go + 0.1 + i * 0.055), 0.6, 0.85)
  // the tagline types itself in the station's stepped way, with a block caret
  const typed = Math.max(0, Math.min(TAG.length, Math.floor((now - 2.5) * 20)))
  const caret = typed < TAG.length || Math.floor(now * 2.4) % 2 === 0
  const barsP = interpolate(now, [0.15, 1.3], [0, 1], { ...clamp, easing: E.out })
  const push = 1 + 0.045 * interpolate(now, [1.8, DIVE0], [0, 1], clamp)

  // the dial hands over to the text doughnut, which then grows through the screen
  const swap = interpolate(now, [DIVE0, DIVE0 + SWAP], [0, 1], { ...clamp, easing: E.out })
  const size0 = (dO / 2) / 8
  const size = torusSize(now, size0)
  const u = interpolate(now, [GROW0, GROW1], [0, 1], clamp)
  const colX = (ox + (960 - ox) * Math.pow(u, 1.6)) / 7.98
  const rowY = (oy + 4) / 16 + (END_Y - oy) / 16 * Math.pow(u, 1.6)
  // face on at the start (it is the O), a slow tumble while it grows, face on again as the camera goes through
  const wob = Math.sin(Math.PI * Math.min(1, u * 1.04))
  const A = Math.PI / 2 + 0.85 * wob * Math.sin(now * 2.3), B = 0.85 * wob * Math.sin(now * 1.7 + 1), C = 0.5 * wob * Math.sin(now * 1.3 + 2)
  const hole = swap > 0.99 ? holeRadius(size) : 0
  const fadeText = interpolate(now, [DIVE0 + 0.05, DIVE0 + 0.7], [1, 0], { ...clamp, easing: E.in })
  const spread = 1 + 0.35 * interpolate(now, [DIVE0, DIVE0 + 0.8], [0, 1], { ...clamp, easing: E.in })
  const dialOut = 1 - swap
  const edge = interpolate(hole, [0, 1100], [1, 0], clamp)

  return (
    <Fill style={{ background: 'transparent' }}>
      <Fill style={{ background: P.ground, WebkitMaskImage: hole > 0 ? `radial-gradient(circle at ${960 + (colX * 7.98 - 960)}px ${rowY * 16 - 4}px, transparent ${hole}px, #000 ${hole + 1.5}px)` : undefined }}>
        <Fill style={{ transform: `translate(${s.x}px, ${s.y}px) scale(${push})`, transformOrigin: `${tx}px ${ty}px` }}>
          <Contours t={now} opacity={0.9} cx={960} cy={560} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, opacity: fadeText }}><Bars progress={barsP} height={14} /></div>
          <div style={{ position: 'absolute', inset: 0, transform: `scale(${spread})`, transformOrigin: `${ox}px ${oy}px`, opacity: fadeText }}>
            <div style={{ position: 'absolute', left, top: oy - SIZE * 0.52, width: m.total, height: SIZE, fontFamily: 'Unbounded', fontSize: SIZE, lineHeight: 1, letterSpacing: '-0.02em', color: P.ink }}>
              {WORD.split('').map((c, i) => i === 6 ? null : (
                <span key={i} style={{ position: 'absolute', left: m.x[i], width: m.w[i], top: 0, textAlign: 'center', whiteSpace: 'nowrap', opacity: Math.min(1, wordIn(i) * 1.6), transform: `translateY(${(1 - wordIn(i)) * 90}px)`, fontWeight: Math.round(200 + 600 * Math.min(1, Math.max(0, wordIn(i)))) }}>{c}</span>
              ))}
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, top: oy + SIZE * 0.72, display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'Barlow', fontWeight: 700, fontSize: 46, lineHeight: 1, letterSpacing: '0.34em', textTransform: 'uppercase', color: P.ink, whiteSpace: 'pre' }}>
              {TAG.slice(0, typed).split(/(friction)/i).map((part, i) => <span key={i} style={{ color: /friction/i.test(part) ? P.signal : P.ink }}>{part}</span>)}
              <span style={{ display: 'inline-block', width: 22, height: 40, marginLeft: 8, background: P.signal, opacity: caret && now > 2.4 ? 1 : 0 }} />
            </div>
          </div>
          {dialOut > 0.001 && (
            <div style={{ position: 'absolute', left: tx - dd / 2, top: ty - dd / 2, width: dd, height: dd, transform: `scale(${pop})`, opacity: dialOut }}>
              <Dial size={dd} deg={angle(now)} travel={Math.min(70, ((A_T / TAU) * Math.exp(-now / TAU) * 0.5) / FPS)} />
            </div>
          )}
        </Fill>
      </Fill>
      {swap > 0.001 && <Ascii shape="torus" cx={colX} cy={rowY} size={size} a={A} b={B} c={C} color={P.signal} opacity={swap} />}
      <Vignette k={0.55 * edge} />
      <Grain opacity={0.05} />
    </Fill>
  )
}
