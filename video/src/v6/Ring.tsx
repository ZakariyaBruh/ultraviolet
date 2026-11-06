import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { Contours } from './Contours'
import { Body, Screen, Sheen, SH, SW } from './Device'
import { E, FPS, Fill, Grain, Kicker, P, Ticks, Vignette, clamp, shake, spr } from './kit'

/** the third 3D piece, in the middle: the tablet the app was on is one of six, turning on a ring in the app's own space; the screens go past (Radio, TV, Learn, the Arcade, Focus)
 *  and the one you started on comes round to the front and fills the frame again, which is where the app picks up. */
export const RING_S = 4.0
export const RING_FRAMES = Math.round(RING_S * FPS)
const N = 6
const R = 1330                      // ring radius in css pixels (the screens are 1280 wide, so the neighbours just clear one another)
const P_DEPTH = 3200                // perspective, in pixels
/** what is on each tablet, front first, then round the ring in the direction it turns */
const SCREENS = ['v6/looks.jpg', 'shots/radio.png', 'shots/tv.png', 'shots/new-learn.png', 'shots/new-arcade.png', 'shots/new-focus.png']

export const Ring = () => {
  const f = useCurrentFrame()
  const now = f / FPS
  const s = shake(now, 3.6, 5)
  // the turn: one full revolution, a whip in and a settle out
  const th = 360 * interpolate(now, [0.25, 3.1], [0, 1], { ...clamp, easing: E.inOut })
  // the camera: starts as close as the app's last frame (the screen fills the frame), pulls back to see the ring, and comes back in to the front tablet
  const out = spr(now - 0.15, 0.7, 0.9) * (1 - spr(now - 3.05, 0.6, 0.92))
  const near = (P_DEPTH * (1 - 1 / 1.52))     // z of the front plane that makes it 1.52 times life size
  const dz = near + (-620 - near) * out
  const tilt = -9 * Math.sin(Math.PI * Math.min(1, Math.max(0, (now - 0.2) / 3.0)))
  const cap = spr(now - 0.95, 0.5, 0.88), capOut = interpolate(now, [2.9, 3.15], [0, 1], { ...clamp, easing: E.in })
  const hold = 1 - out
  return (
    <Fill style={{ background: P.deep }}>
      <Contours t={now * 2 + 40} opacity={0.55} cx={960} cy={540} />
      <Fill style={{ transform: `translate(${s.x}px, ${s.y}px)`, perspective: P_DEPTH, perspectiveOrigin: '960px 540px' }}>
        {/* the floor under the ring: a ring of ice and a soft shadow, laid flat */}
        <div style={{ position: 'absolute', left: 960, top: 540, width: 0, height: 0, transformStyle: 'preserve-3d', transform: `translateZ(${-R + dz}px) rotateX(${tilt}deg)` }}>
          <div style={{ position: 'absolute', left: -R, top: 520, width: R * 2, height: R * 2, borderRadius: '50%', transform: 'rotateX(90deg)', border: `3px solid ${P.ice}`, opacity: 0.22 * (1 - hold) }} />
          <div style={{ position: 'absolute', left: -R * 0.97, top: 520, width: R * 1.94, height: R * 1.94, borderRadius: '50%', transform: 'rotateX(90deg)', border: `1px solid ${P.ice}`, opacity: 0.12 * (1 - hold) }} />
          <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateY(${-th}deg)` }}>
            {SCREENS.slice(0, N).map((src, i) => (
              <div key={src} style={{ position: 'absolute', left: -SW / 2, top: -SH / 2, width: SW, height: SH, transformStyle: 'preserve-3d', transform: `rotateY(${i * (360 / N)}deg) translateZ(${R}px)`, backfaceVisibility: 'hidden' }}>
                <div style={{ position: 'relative', width: SW, height: SH }}>
                  <Body />
                  <Screen>
                    <Img src={staticFile(src)} style={{ width: SW, height: SH, objectFit: 'cover' }} />
                  </Screen>
                  <Sheen />
                </div>
              </div>
            ))}
          </div>
        </div>
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
