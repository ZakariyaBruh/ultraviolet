import { interpolate, useCurrentFrame } from 'remotion'
import { useWordmark } from '../v4/Mark'
import { Dial } from './Dial'
import { Contours } from './Contours'
import { Bars, Blur, E, FPS, Fill, Grain, P, Vignette, clamp, shake, sp, spr } from './kit'

export const A_T = 1440, TAU = 0.55
/** the same law the score's ratchet clicks follow (score6.py): the dial is thrown and friction brings it to rest */
export const angle = (t: number) => (t <= 0 ? 0 : A_T * (1 - Math.exp(-t / TAU)))

const SIZE = 205
const LETTERS = ['F', 'R', 'I', 'C', 'T', 'I']
const TAG = ['Put', 'the', 'friction', 'back.']
export const DIVE0 = 4.2, DIVE1 = 5.62

/** zoom of the dive: slow at first, then falling into the dial */
const ZMAX = 80
const zoomAt = (now: number) => {
  const u = interpolate(now, [DIVE0, DIVE1], [0, 1], clamp)
  return Math.exp(Math.log(ZMAX) * Math.pow(u, 2.3))
}

/** Seven to thirteen seconds: the dial is thrown, slows, becomes the O of FRICTION; the line lands; the camera falls into the dial. */
export const Title = () => {
  const f = useCurrentFrame()
  const now = f / FPS
  const m = useWordmark(SIZE)
  if (!m) return <Fill style={{ background: P.ground }} />
  const total = m.a + m.o + m.b
  const left = (1920 - total) / 2
  const ox = left + m.a + m.o / 2
  const oy = 520
  const dO = m.o * 1.0
  const D0 = 760

  // position and size of the dial: thrown big at the centre, then travelling into the O
  const go = 1.05
  const tx = sp(now, go, 960, ox, 0.85, 0.88)
  const ty = sp(now, go, 540, oy, 0.85, 0.88)
  const dd = sp(now, go, D0, dO, 0.85, 0.88)
  const pop = 1 + 0.2 * (1 - spr(now, 0.42, 0.62))      // the hit: it lands a little big and settles
  const ang = angle(now)
  const rate = (A_T / TAU) * Math.exp(-now / TAU)
  const s = shake(now, 0.0, 9)

  const wordIn = (i: number) => spr(now - (go + 0.1 + i * 0.055), 0.6, 0.85)
  const tagIn = (i: number) => spr(now - (2.55 + i * 0.1), 0.55, 0.86)
  const barsP = interpolate(now, [0.15, 1.3], [0, 1], { ...clamp, easing: E.out })
  const push = 1 + 0.045 * interpolate(now, [1.8, DIVE0], [0, 1], clamp)   // a slow push while it holds, so the frame is never still

  const diveK = interpolate(now, [DIVE0, DIVE1], [0, 1], clamp)
  const fade = interpolate(now, [DIVE0, DIVE0 + 0.55], [1, 0], { ...clamp, easing: E.in })
  const speed = interpolate(now, [DIVE0 + 0.2, DIVE1 - 0.3], [0, 1], clamp)
  const samples = now > DIVE0 ? Math.round(2 + 8 * Math.sin(Math.PI * Math.min(1, speed))) : 1

  const scene = (k: number) => {
    const tt = now + (k * 0.9) / FPS
    const z = (tt > DIVE0 ? zoomAt(tt) : 1) * push
    const a = angle(tt)
    return (
      <Fill style={{ background: P.ground, transform: `translate(${s.x}px, ${s.y}px) scale(${z})`, transformOrigin: `${tx}px ${ty}px` }}>
        <Contours t={tt} opacity={0.9 * (1 - diveK * 0.8)} cx={960} cy={560} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, opacity: fade }}><Bars progress={barsP} height={14} /></div>
        {/* the line */}
        <div style={{ position: 'absolute', left, top: oy - SIZE * 0.52, display: 'flex', fontFamily: 'Unbounded', fontWeight: 800, fontSize: SIZE, lineHeight: 1, letterSpacing: '-0.02em', color: P.ink, opacity: fade }}>
          {LETTERS.map((c, i) => (
            <span key={i} style={{ display: 'inline-block', opacity: Math.min(1, wordIn(i) * 1.4), transform: `translateY(${(1 - wordIn(i)) * 120}px)` }}>{c}</span>
          ))}
          <span style={{ display: 'inline-block', width: m.o }} />
          <span style={{ display: 'inline-block', opacity: Math.min(1, wordIn(6) * 1.4), transform: `translateY(${(1 - wordIn(6)) * 120}px)` }}>N</span>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: oy + SIZE * 0.6, display: 'flex', justifyContent: 'center', gap: 26, fontFamily: 'Hanken', fontWeight: 500, fontSize: 84, letterSpacing: '-0.015em', color: P.ink, opacity: fade }}>
          {TAG.map((w, i) => (
            <span key={w} style={{ display: 'inline-block', color: w === 'friction' ? P.signal : P.ink, opacity: Math.min(1, tagIn(i) * 1.3), transform: `translateY(${(1 - tagIn(i)) * 36}px)` }}>{w}</span>
          ))}
        </div>
        {/* the dial */}
        <div style={{ position: 'absolute', left: tx - dd / 2, top: ty - dd / 2, width: dd, height: dd, transform: `scale(${pop})` }}>
          <Dial size={dd} deg={a} travel={Math.min(70, ((A_T / TAU) * Math.exp(-tt / TAU) * 0.5) / FPS)} />
        </div>
        {/* the throw: one ring leaves the dial as it lands */}
        <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity: fade }}>
          <circle cx={960} cy={540} r={D0 / 2 * (1 + 1.6 * spr(now, 0.5, 1))} fill="none" stroke={P.signal} strokeWidth={4} opacity={Math.max(0, 0.6 * (1 - now / 0.6))} />
        </svg>
      </Fill>
    )
  }
  return (
    <Fill style={{ background: '#000' }}>
      <Blur n={samples}>{scene}</Blur>
      <Vignette k={0.55} />
      <Grain opacity={0.05} />
    </Fill>
  )
}
