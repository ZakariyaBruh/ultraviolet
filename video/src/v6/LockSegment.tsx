import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { E, FPS, Fill, Grain, Kicker, P, Ticks, Vignette, clamp, shake, spr } from './kit'

export const LOCK_FRAMES = 120
export const LOCK_S = 4.0
/** seconds into the segment of the dial's clicks: five that each raise a ring, and the sixth that locks (Blender: lock7.py) */
export const LOCK_CLICKS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]

/** The second photoreal shot. The dial locks in: it clicks round, and each click raises a ring of glowing ridges, the friction of the opening, now holding it in place.
 *  The camera starts on the knurled edge, backs away and climbs, and ends straight down on a target of rings. */
export const LockSegment = () => {
  const f = useCurrentFrame()
  const now = f / FPS
  const idx = Math.min(LOCK_FRAMES, f + 1)
  const s = shake(now, 3.0, 7)
  const p = spr(now - 0.75, 0.5, 0.88)
  const out = interpolate(now, [3.0, 3.3], [0, 1], { ...clamp, easing: E.in })
  return (
    <Fill style={{ background: P.deep }}>
      <svg width="0" height="0" style={{ position: 'absolute' }}><defs><filter id="locksharp" x="0" y="0" width="100%" height="100%"><feConvolveMatrix order="3" kernelMatrix="0 -0.45 0 -0.45 2.8 -0.45 0 -0.45 0" preserveAlpha="true" /></filter></defs></svg>
      <Fill style={{ transform: `translate(${s.x}px, ${s.y}px) scale(1.012)`, filter: 'url(#locksharp)' }}>
        <Img src={staticFile(`v6/lock/l_${String(idx).padStart(4, '0')}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </Fill>
      {now > 0.7 && now < 3.35 && (
        <div style={{ position: 'absolute', left: 104, bottom: 104, transform: `translateY(${(1 - p) * 26 + out * 18}px)`, opacity: Math.min(1, p * 1.5) * (1 - out) }}>
          <div style={{ position: 'relative', background: 'rgba(5,7,12,0.94)', border: `1px solid ${P.rule}`, padding: '24px 40px 26px 34px' }}>
            <Ticks />
            <Kicker size={25} style={{ marginBottom: 14 }}>Lock in</Kicker>
            <div style={{ fontFamily: 'Hanken', fontWeight: 700, fontSize: 56, lineHeight: 1.04, letterSpacing: '-0.03em', color: P.ink, whiteSpace: 'nowrap' }}>Each click puts friction back.</div>
          </div>
        </div>
      )}
      <Vignette k={0.4} />
      <Grain opacity={0.05} />
    </Fill>
  )
}
