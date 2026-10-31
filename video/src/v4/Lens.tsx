import { interpolate, useCurrentFrame } from 'remotion'
import type { ReactNode } from 'react'
import { Fill, clamp } from './kit'

/** The things a lens does to light, kept small: a halation round the brightest parts and one soft horizontal streak, both made from the picture itself. */
export const Glow = ({ children, bloom = 0.35, streak = 0.2 }: { children: ReactNode; bloom?: number; streak?: number }) => (
  <Fill>
    {children}
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <filter id="fx-streak" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="90 2.5" /></filter>
    </svg>
    <Fill style={{ mixBlendMode: 'screen', opacity: bloom, filter: 'brightness(0.5) contrast(3.6) blur(28px) saturate(1.2)', pointerEvents: 'none' }}>{children}</Fill>
    <Fill style={{ mixBlendMode: 'screen', opacity: streak, filter: 'brightness(0.6) contrast(3) url(#fx-streak)', pointerEvents: 'none' }}>{children}</Fill>
  </Fill>
)

/** a few motes of dust hanging in the light, soft and slow, each at its own depth (the nearer ones are larger and blurrier) */
export const Dust = ({ count = 34, seed = 1, opacity = 0.5, area = { x: 0, y: 0, w: 1920, h: 1080 } }: { count?: number; seed?: number; opacity?: number; area?: { x: number; y: number; w: number; h: number } }) => {
  const f = useCurrentFrame()
  const r = (i: number, n: number) => { const x = Math.sin((i + seed * 31) * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x) }
  return (
    <Fill style={{ pointerEvents: 'none', opacity }}>
      {Array.from({ length: count }, (_, i) => {
        const depth = r(i, 1)
        const size = 2 + depth * 7
        const x = area.x + ((r(i, 2) * area.w + f * (0.35 + depth * 0.7) * (r(i, 5) > 0.5 ? 1 : -1)) % area.w + area.w) % area.w
        const y = area.y + ((r(i, 3) * area.h - f * (0.25 + depth * 0.45)) % area.h + area.h) % area.h
        const tw = 0.55 + 0.45 * Math.sin(f * 0.07 + i * 3.1)
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: '50%', background: 'rgba(205,232,255,0.9)', opacity: (0.18 + depth * 0.45) * tw, filter: `blur(${depth * depth * 3.2}px)` }} />
      })}
    </Fill>
  )
}

/** a sideways smear whose strength follows how fast the camera is moving, so the glides read as film and not as slides */
export const MotionBlur = ({ px, children }: { px: number; children: ReactNode }) => {
  const sd = Math.min(24, Math.max(0, px) * 0.15)       // about a 180 degree shutter: a box blur half the frame's travel is a Gaussian of ~0.15 x that travel
  return (
    <Fill style={{ filter: sd > 0.4 ? 'url(#fx-motion)' : undefined }}>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id="fx-motion" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={`${sd} 0`} /></filter>
      </svg>
      {children}
    </Fill>
  )
}

export const sm = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp)
