import { Easing, interpolate, useCurrentFrame } from 'remotion'
import type { CSSProperties, ReactNode } from 'react'
import '../ui'

export const FPS = 30
export const W = 1920
export const H = 1080
export const P = { ground: '#05070c', deep: '#02040a', ink: '#f3f1ea', signal: '#ffd23f', ice: '#7fd3ff', dim: '#8a93a6', rule: '#262c3a' }
export const BARS = ['#f3f1ea', '#ffd23f', '#7fd3ff', '#5fd38d', '#ff5d8f', '#4f6bff', '#05070c']
export const sec = (s: number) => Math.round(s * FPS)
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
export const E = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
}

/** Apple's two spring knobs, response (seconds to travel most of the way) and damping ratio, solved exactly for a spring that starts at rest.
 *  Returns 0 to 1, overshooting only when the ratio is under 1. `t` is in seconds. */
export const spr = (t: number, response = 0.5, zeta = 0.9) => {
  if (t <= 0) return 0
  const w = (2 * Math.PI) / response
  if (zeta >= 1) return 1 - (1 + w * t) * Math.exp(-w * t)
  const wd = w * Math.sqrt(1 - zeta * zeta)
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t))
}
/** a spring from a to b that begins at time t0 (seconds) */
export const sp = (now: number, t0: number, a: number, b: number, response = 0.5, zeta = 0.9) => a + (b - a) * spr(now - t0, response, zeta)

/** current time in seconds on the master clock (the composition's frame, since scenes are placed with Sequence we pass an offset) */
export const useSec = (offset = 0) => useCurrentFrame() / FPS + offset

export const Fill = ({ children, style }: { children?: ReactNode; style?: CSSProperties }) => (
  <div style={{ position: 'absolute', inset: 0, ...style }}>{children}</div>
)

/** the test-card strip: the one place the whole spectrum lives */
export const Bars = ({ progress = 1, height = 14, style }: { progress?: number; height?: number; style?: CSSProperties }) => (
  <div style={{ display: 'flex', width: '100%', height, ...style }}>
    {BARS.map((c, i) => <div key={c} style={{ flex: 1, background: c, scale: `${interpolate(progress, [i / 9, i / 9 + 0.4], [0, 1], clamp)} 1`, transformOrigin: 'left' }} />)}
  </div>
)

export const Grain = ({ opacity = 0.05 }: { opacity?: number }) => {
  const f = useCurrentFrame()
  return <Fill style={{ opacity, mixBlendMode: 'overlay', pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='360' height='360'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' seed='${f % 13}'/></filter><rect width='360' height='360' filter='url(%23n)'/></svg>")` }} />
}
export const Vignette = ({ k = 0.5 }: { k?: number }) => (
  <Fill style={{ background: `radial-gradient(ellipse at 50% 50%, transparent 58%, rgba(0,0,0,${k}) 100%)`, pointerEvents: 'none' }} />
)

/** the decaying shake after an impact at second `at`: translation only, a few pixels, gone in a third of a second */
export const shake = (now: number, at: number, power = 7) => {
  const t = now - at
  if (t < 0 || t > 0.36) return { x: 0, y: 0 }
  const k = Math.pow(1 - t / 0.36, 2) * power
  return { x: Math.sin(t * 95) * k, y: Math.cos(t * 123) * k * 0.7 }
}

/** n copies of a scene drawn a little apart in time and blended additively, so it is the average of its own motion over the shutter */
export const Blur = ({ n, children }: { n: number; children: (k: number) => ReactNode }) => {
  if (n <= 1) return <>{children(0)}</>
  return (
    <Fill style={{ background: '#000' }}>
      {Array.from({ length: n }, (_, k) => (
        <Fill key={k} style={{ opacity: 1 / n, mixBlendMode: 'plus-lighter' }}>{children(k / (n - 1) - 0.5)}</Fill>
      ))}
    </Fill>
  )
}

/** Barlow Condensed in capitals, the station's voice */
export const Cond = ({ children, size, color = P.ink, style }: { children: ReactNode; size: number; color?: string; style?: CSSProperties }) => (
  <div style={{ fontFamily: 'Barlow', fontWeight: 700, fontSize: size, lineHeight: 0.9, letterSpacing: '0.01em', textTransform: 'uppercase', color, ...style }}>{children}</div>
)
