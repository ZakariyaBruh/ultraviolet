import { useMemo } from 'react'
import { Fill } from './ui'
import { gridText, makeGrid, plot, type Shape } from './ascii3d'

/**
 * The app's own text-drawn 3D engine, full frame: 240 x 68 cells, each 8 x 16 px (a half-width cell, as in the app).
 * `size` is how many columns the solid's reach covers either side of its centre.
 */
export const COLS = 240
export const ROWS = 68
export const Ascii = ({ shape, cx = COLS / 2, cy = ROWS / 2, size, a, b, c = 0, color, opacity = 1 }: { shape: Shape; cx?: number; cy?: number; size: number; a: number; b: number; c?: number; color: string; opacity?: number }) => {
  const text = useMemo(() => {
    const g = makeGrid(COLS, ROWS, 0.5)
    plot(g, shape, cx, cy, size, a, b, c, Math.min(2.5, Math.max(1, Math.round(size / 9) / 2)))
    return gridText(g)
  }, [shape, cx, cy, size, a, b, c])
  return (
    <Fill style={{ opacity }}>
      <pre style={{ margin: 0, fontFamily: 'GeistMono', fontWeight: 600, fontSize: 13.3, lineHeight: '16px', letterSpacing: 0, color, whiteSpace: 'pre', position: 'absolute', left: 0, top: (1080 - ROWS * 16) / 2 }}>{text}</pre>
    </Fill>
  )
}
