import type { CSSProperties, ReactNode } from 'react'
import { P } from './kit'

/**
 * The tablet the app is shown on. Drawn in css pixels around a 1280 x 720 screen, so the app's own page drops straight in.
 * It is the site's colours: a blue-black body (the ground), a hairline rim in the ink at low strength, a yellow standby dot (the one accent),
 * flat all over. The screen has the small radius a tablet has, so the page never meets a square corner.
 */
export const SW = 1280
export const SH = 720
export const BZ = 38                 // bezel thickness
export const R_OUT = 64              // body corner radius
export const R_IN = 26               // screen corner radius

/** the body behind the screen: put it first, then the screen on top. Positioned at (-BZ, -BZ) of the screen's own origin. */
export const Body = ({ shade = 1 }: { shade?: number }) => (
  <div style={{ position: 'absolute', left: -BZ, top: -BZ, width: SW + BZ * 2, height: SH + BZ * 2, borderRadius: R_OUT, background: '#0a0f19', boxShadow: `0 0 0 2px rgba(243,241,234,${0.13 * shade}), 0 0 0 4px #03050a, 0 70px 140px rgba(0,0,0,0.7)` }}>
    {/* the inner rim: the screen sits a hair below the bezel */}
    <div style={{ position: 'absolute', left: BZ - 4, top: BZ - 4, width: SW + 8, height: SH + 8, borderRadius: R_IN + 4, background: '#020409', boxShadow: `inset 0 0 0 1px rgba(127,211,255,${0.14 * shade})` }} />
    {/* the front camera and the standby dot, in the top bezel */}
    <div style={{ position: 'absolute', left: '50%', top: BZ / 2 - 6, width: 12, height: 12, marginLeft: -6, borderRadius: 6, background: '#04060c', boxShadow: 'inset 0 0 0 2px #121a28' }} />
    <div style={{ position: 'absolute', left: '50%', top: BZ / 2 - 3, width: 6, height: 6, marginLeft: 26, borderRadius: 3, background: P.signal, opacity: 0.85 }} />
    {/* the side buttons */}
    <div style={{ position: 'absolute', right: -6, top: 150, width: 6, height: 96, borderRadius: '0 4px 4px 0', background: '#0d1420', boxShadow: '0 0 0 1px #03050a' }} />
    <div style={{ position: 'absolute', right: -6, top: 270, width: 6, height: 52, borderRadius: '0 4px 4px 0', background: '#0d1420', boxShadow: '0 0 0 1px #03050a' }} />
  </div>
)

/** the screen: a clipped 1280 x 720 box at the origin; everything shown on the device goes inside it */
export const Screen = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: SW, height: SH, borderRadius: R_IN, overflow: 'hidden', background: '#05070c', ...style }}>{children}</div>
)

/** a screen-only sheen, as glass has: one faint diagonal, no more */
export const Sheen = ({ opacity = 1 }: { opacity?: number }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: SW, height: SH, borderRadius: R_IN, pointerEvents: 'none', opacity, background: 'linear-gradient(115deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.015) 24%, rgba(255,255,255,0) 38%)' }} />
)

/** a whole device (body, screen, sheen) at 1280 x 720 with its centre at the middle of the screen; place and scale it with a wrapper */
export const Device = ({ children, shade = 1 }: { children: ReactNode; shade?: number }) => (
  <div style={{ position: 'relative', width: SW, height: SH }}>
    <Body shade={shade} />
    <Screen>{children}</Screen>
    <Sheen />
  </div>
)
