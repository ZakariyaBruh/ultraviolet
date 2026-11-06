import type { CSSProperties, ReactNode } from 'react'

/**
 * The tablet the app is shown on. Drawn in css pixels around a 1280 x 720 screen, so the app's own page drops straight in.
 * It is the site's colours: a blue-black body (the ground), a thin aluminium rim, a tiny front camera,
 * flat all over. The screen has the small radius a tablet has, so the page never meets a square corner.
 */
export const SW = 1280
export const SH = 720
export const BZ = 26                 // bezel thickness: thin and even, as on a modern tablet
export const R_OUT = 50              // body corner radius
export const R_IN = 24               // screen corner radius

/** the body behind the screen: put it first, then the screen on top. Positioned at (-BZ, -BZ) of the screen's own origin. */
export const Body = ({ shade = 1 }: { shade?: number }) => (
  <div style={{ position: 'absolute', left: -BZ, top: -BZ, width: SW + BZ * 2, height: SH + BZ * 2, borderRadius: R_OUT, background: '#0b0c0f', boxShadow: `0 0 0 3px rgba(196,200,208,${0.5 * shade}), 0 0 0 4px #040507, 0 40px 80px rgba(0,0,0,0.55)` }}>
    {/* the front camera, in the middle of the top bezel */}
    <div style={{ position: 'absolute', left: '50%', top: BZ / 2 - 4, width: 8, height: 8, marginLeft: -4, borderRadius: 4, background: '#030405', boxShadow: 'inset 0 0 0 1.5px #1a1c22' }} />
  </div>
)

/** the screen: a clipped 1280 x 720 box at the origin; everything shown on the device goes inside it */
export const Screen = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: SW, height: SH, borderRadius: R_IN, overflow: 'hidden', background: '#05070c', ...style }}>{children}</div>
)

/** no glass sheen: the design is flat, and a diagonal wash across the corner read as a bug */
export const Sheen = (_: { opacity?: number }) => null

/** a whole device (body, screen, sheen) at 1280 x 720 with its centre at the middle of the screen; place and scale it with a wrapper */
export const Device = ({ children, shade = 1 }: { children: ReactNode; shade?: number }) => (
  <div style={{ position: 'relative', width: SW, height: SH }}>
    <Body shade={shade} />
    <Screen>{children}</Screen>
    <Sheen />
  </div>
)
