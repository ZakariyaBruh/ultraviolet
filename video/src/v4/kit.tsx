import { Easing, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from 'remotion'
import type { CSSProperties, ReactNode } from 'react'
import '../ui'

export const FPS = 24
export const W = 1920
export const H = 1080
export const P = {
  ground: '#05070c', deep: '#02040a', ink: '#f3f1ea', signal: '#ffd23f', ice: '#7fd3ff', dim: '#8a93a6', rule: '#262c3a',
}
export const sec = (s: number) => Math.round(s * FPS)

export const E = {
  out: Easing.bezier(0.16, 1, 0.3, 1),       // futuristic: long glide
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
  cam: Easing.bezier(0.45, 0, 0.15, 1),      // camera moves between panes
}
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** 0 to 1 between two seconds on the master clock (absolute frame inside a Sequence-less scene) */
export const ramp = (frame: number, a: number, b: number, easing = E.out) => interpolate(frame, [sec(a), sec(b)], [0, 1], { ...clamp, easing })

/** the rectangle of a recording that a pane shows, in the recording's own pixels (2560 x 1440) */
export type Crop = { x: number; y: number; w: number; h: number }
export const FULL: Crop = { x: 0, y: 0, w: 2560, h: 1440 }

/** a cropped, scaled view into a screen recording; `from` is seconds into the recording */
export const Rec = ({ src, crop, width, from = 0, rate = 1, style }: { src: string; crop: Crop; width: number; from?: number; rate?: number; style?: CSSProperties }) => {
  const s = width / crop.w
  const height = crop.h * s
  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden', background: P.ground, ...style }}>
      <OffthreadVideo
        src={staticFile(src)}
        startFrom={sec(from)}
        playbackRate={rate}
        muted
        style={{ position: 'absolute', width: 2560 * s, height: 1440 * s, left: -crop.x * s, top: -crop.y * s, maxWidth: 'none' }}
      />
    </div>
  )
}

/** the dial, from above, as rendered in Blender (transparent PNG); `deg` is its angle */
export const Dial = ({ size, deg = 0, style }: { size: number; deg?: number; style?: CSSProperties }) => (
  <Img src={staticFile('v4/run/top.png')} style={{ width: size, height: size, rotate: `${deg}deg`, ...style }} />
)

export const Fill = ({ children, style }: { children?: ReactNode; style?: CSSProperties }) => (
  <div style={{ position: 'absolute', inset: 0, ...style }}>{children}</div>
)

/** film grain, kept very light: it only breaks up banding in the dark */
export const Grain = ({ opacity = 0.06 }: { opacity?: number }) => {
  const f = useCurrentFrame()
  return <Fill style={{ opacity, mixBlendMode: 'overlay', pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='${f % 11}'/></filter><rect width='320' height='320' filter='url(%23n)'/></svg>")` }} />
}
