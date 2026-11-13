import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { E, FPS, Fill, Grain, P, Vignette, clamp, shake, spr } from './kit'

export const LOCK_FRAMES = 120
export const LOCK_S = 4.0
/** seconds into the segment of the dial's clicks: five that each raise a ring, and the sixth that locks (Blender: lock7.py) */
export const LOCK_CLICKS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]

/** The second photoreal shot. The dial locks in: it clicks round, and each click raises a ring of glowing ridges, the friction of the opening, now holding it in place.
 *  The camera starts on the knurled edge, backs away and climbs, and ends straight down on a target of rings. */
const WORDS = ['Each', 'click', 'puts', 'friction', 'back.']

export const LockSegment = () => {
  const f = useCurrentFrame()
  const now = f / FPS
  const idx = Math.min(LOCK_FRAMES, f + 1)
  const s = shake(now, 3.0, 7)
  const out = interpolate(now, [3.55, 3.8], [0, 1], { ...clamp, easing: E.in })
  return (
    <Fill style={{ background: P.deep }}>
      <svg width="0" height="0" style={{ position: 'absolute' }}><defs><filter id="locksharp" x="0" y="0" width="100%" height="100%"><feConvolveMatrix order="3" kernelMatrix="0 -0.45 0 -0.45 2.8 -0.45 0 -0.45 0" preserveAlpha="true" /></filter></defs></svg>
      <Fill style={{ transform: `translate(${s.x}px, ${s.y}px) scale(1.012)`, filter: 'url(#locksharp)' }}>
        <Img src={staticFile(`v6/lock/l_${String(idx).padStart(4, '0')}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </Fill>
      {/* one word for each click, on its own strip of tape; the last click turns them all yellow */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 96, display: 'flex', justifyContent: 'center', gap: 16, opacity: 1 - out }}>
        {WORDS.map((w, i) => {
          const q = spr(now - LOCK_CLICKS[i], 0.3, 0.62)
          const locked = now >= LOCK_CLICKS[5]
          return (
            <div key={w} style={{ opacity: now >= LOCK_CLICKS[i] ? 1 : 0, transform: `translateY(${(1 - q) * 46}px) scale(${1.25 - 0.25 * q})`, background: locked ? P.signal : P.deep, color: locked ? P.deep : P.ink, padding: '14px 26px 8px', fontFamily: 'Barlow', fontWeight: 700, fontSize: 112, lineHeight: 0.9, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{w}</div>
          )
        })}
      </div>
      <Vignette k={0.4} />
      <Grain opacity={0.05} />
    </Fill>
  )
}
