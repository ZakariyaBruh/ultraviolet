import { Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { loadFont } from '@remotion/fonts'
import type { CSSProperties, ReactNode } from 'react'

loadFont({ family: 'Hanken', url: staticFile('fonts/hanken.woff2'), weight: '100 900' })
loadFont({ family: 'Barlow', url: staticFile('fonts/barlow700.woff2'), weight: '700' })
loadFont({ family: 'Unbounded', url: staticFile('fonts/unbounded.woff2'), weight: '200 900' })
loadFont({ family: 'GeistMono', url: staticFile('fonts/geistmono.woff2'), weight: '100 900' })

/** the station palette, from lib/themes.ts */
export const C = { ground: '#05070c', signal: '#ffd23f', ink: '#f3f1ea', ice: '#7fd3ff', dim: '#8a93a6', rule: '#262c3a' }
export const BARS = ['#f3f1ea', '#ffd23f', '#7fd3ff', '#5fd38d', '#ff5d8f', '#4f6bff', '#05070c']
export const OUT = Easing.bezier(0.16, 1, 0.3, 1)
export const IN = Easing.bezier(0.7, 0, 0.84, 0)
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** 0 to 1 over `dur` frames starting at `at` (relative to the scene), settling gently */
export const useT = (at: number, dur: number, easing = OUT) => interpolate(useCurrentFrame(), [at, at + dur], [0, 1], { ...clamp, easing })

/** a springy 0 to 1 that overshoots a little, for slams */
export const useSlam = (at: number, damping = 11, stiffness = 180) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - at, fps, config: { damping, stiffness, mass: 0.7 } })
}

/** the decaying shake that follows an impact at frame `at` */
export const useShake = (at: number, power = 18) => {
  const f = useCurrentFrame() - at
  if (f < 0 || f > 14) return { x: 0, y: 0, r: 0 }
  const k = Math.pow(1 - f / 14, 2) * power
  return { x: Math.sin(f * 7.1) * k, y: Math.cos(f * 9.3) * k * 0.7, r: Math.sin(f * 5.3) * k * 0.02 }
}

export const Fill = ({ children, style }: { children?: ReactNode; style?: CSSProperties }) => {
  const placed = style && ['top', 'bottom', 'left', 'right'].some((k) => k in style)
  return <div style={{ position: 'absolute', ...(placed ? {} : { inset: 0 }), ...style }}>{children}</div>
}

/** the test-card bar strip: the one place the full spectrum lives */
export const Bars = ({ progress = 1, height = 14 }: { progress?: number; height?: number }) => (
  <div style={{ display: 'flex', width: '100%', height }}>
    {BARS.map((c, i) => <div key={c} style={{ flex: 1, background: c, scale: `${interpolate(progress, [i / 9, i / 9 + 0.4], [0, 1], clamp)} 1`, transformOrigin: 'left' }} />)}
  </div>
)

/** a fine dot grid, as on the front page */
export const Dots = ({ opacity = 0.35, size = 36 }: { opacity?: number; size?: number }) => (
  <Fill style={{ opacity, backgroundImage: `radial-gradient(${C.dim} 1.2px, transparent 1.6px)`, backgroundSize: `${size}px ${size}px` }} />
)

export const Grain = () => {
  const f = useCurrentFrame()
  return <Fill style={{ opacity: 0.07, mixBlendMode: 'overlay', backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${f % 7}'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>")`, pointerEvents: 'none' }} />
}

export const Vignette = () => <Fill style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none' }} />

/** a kicker line in the condensed face */
export const Kicker = ({ children, color = C.signal, size = 34, style }: { children: ReactNode; color?: string; size?: number; style?: CSSProperties }) => (
  <div style={{ fontFamily: 'Barlow', fontWeight: 700, fontSize: size, letterSpacing: '0.22em', textTransform: 'uppercase', color, ...style }}>{children}</div>
)

/** big type that slams in word by word */
export const Slam = ({ words, at = 0, gap = 6, size = 200, color = C.ink, accent, font = 'Hanken', weight = 900, style }: { words: string[]; at?: number; gap?: number; size?: number; color?: string; accent?: number[]; font?: string; weight?: number; style?: CSSProperties }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: `0 ${size * 0.22}px`, fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 0.95, letterSpacing: '-0.03em', textTransform: 'uppercase', ...style }}>
    {words.map((w, i) => <SlamWord key={i} at={at + i * gap} color={accent?.includes(i) ? C.signal : color}>{w}</SlamWord>)}
  </div>
)
const SlamWord = ({ at, color, children }: { at: number; color: string; children: ReactNode }) => {
  const s = useSlam(at, 13, 210)
  const t = useT(at, 8)
  return <span style={{ display: 'inline-block', color, opacity: t, scale: `${interpolate(s, [0, 1], [1.5, 1])}`, translate: `0 ${interpolate(s, [0, 1], [40, 0])}px` }}>{children}</span>
}

/** the app's own screen, in a thin ruled frame */
export const Screen = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ position: 'absolute', width: 1920, height: 1080, overflow: 'hidden', outline: `2px solid ${C.rule}`, background: C.ground, ...style }}>{children}</div>
)
