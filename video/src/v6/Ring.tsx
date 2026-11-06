import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { Contours } from './Contours'
import { E, FPS, Fill, Grain, Kicker, P, Ticks, Vignette, clamp, shake, spr } from './kit'

/** the third 3D piece, in the middle: the tablet the app was on is one of six, turning on a ring; the screens go past (Radio, TV, Learn, the Arcade, Focus) and the one you
 *  started on comes round to the front and fills the frame again, which is where the app picks up. The tablets are rendered in Blender (blender/ring8.py: thin even bezel,
 *  rounded aluminium body, a camera block on the back, no logo), 120 transparent frames in public/v6/ring; the contour field is behind them. */
export const RING_S = 4.0
export const RING_FRAMES = Math.round(RING_S * FPS)

export const Ring = () => {
  const f = useCurrentFrame()
  const now = f / FPS
  const s = shake(now, 3.6, 5)
  const n = Math.min(120, Math.max(1, f + 1))
  const cap = spr(now - 0.95, 0.5, 0.88), capOut = interpolate(now, [2.9, 3.15], [0, 1], { ...clamp, easing: E.in })
  return (
    <Fill style={{ background: P.deep }}>
      <Contours t={now * 2 + 40} opacity={0.55} cx={960} cy={540} />
      <Fill style={{ transform: `translate(${s.x}px, ${s.y}px)` }}>
        <Img src={staticFile(`v6/ring/r_${String(n).padStart(4, '0')}.png`)} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }} />
      </Fill>
      {now > 0.9 && now < 3.4 && (
        <div style={{ position: 'absolute', left: 104, bottom: 104, transform: `translateY(${(1 - cap) * 26 + capOut * 18}px)`, opacity: Math.min(1, cap * 1.5) * (1 - capOut) }}>
          <div style={{ position: 'relative', background: 'rgba(5,7,12,0.94)', border: `1px solid ${P.rule}`, padding: '24px 40px 26px 34px' }}>
            <Ticks />
            <Kicker size={25} style={{ marginBottom: 14 }}>One screen</Kicker>
            <div style={{ fontFamily: 'Hanken', fontWeight: 700, fontSize: 56, lineHeight: 1.04, letterSpacing: '-0.03em', color: P.ink, whiteSpace: 'nowrap' }}>Radio. TV. Lessons. Games.</div>
          </div>
        </div>
      )}
      <Vignette k={0.4} />
      <Grain opacity={0.04} />
    </Fill>
  )
}
