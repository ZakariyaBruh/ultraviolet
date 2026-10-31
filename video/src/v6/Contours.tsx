import { useMemo } from 'react'
import { noise3D } from '@remotion/noise'
import { P } from './kit'

/** the app's contour field: nested curves that slowly breathe, in the ice colour, very low contrast */
export const Contours = ({ t, opacity = 1, cx = 960, cy = 540, levels = 15 }: { t: number; opacity?: number; cx?: number; cy?: number; levels?: number }) => {
  const paths = useMemo(() => Array.from({ length: levels }, (_, l) => l), [levels])
  const M = 120
  return (
    <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0, opacity }}>
      {paths.map((l) => {
        const base = 120 + l * 92
        let d = ''
        for (let i = 0; i <= M; i++) {
          const a = (i / M) * Math.PI * 2
          const n = noise3D('c6', Math.cos(a) * 0.9 + l * 0.08, Math.sin(a) * 0.9, t * 0.07 + l * 0.02)
          const r = base * (1 + 0.28 * n)
          d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r * 1.35).toFixed(1)} ${(cy + Math.sin(a) * r * 0.85).toFixed(1)} `
        }
        return <path key={l} d={d + 'Z'} fill="none" stroke={P.ice} strokeWidth={1.6} opacity={0.05 + 0.1 * (1 - l / levels)} />
      })}
    </svg>
  )
}
