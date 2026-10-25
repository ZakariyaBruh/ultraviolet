import type { ReactElement } from 'react'
import { cn } from '@/lib/utils'

/** Pixel art drawn as crisp squares, in the theme's colours. Each character picks a colour; a dot is empty. */
const COLOUR: Record<string, string> = { a: '--ink', b: '--signal', c: '--ice', d: '--hot', e: '--ok', f: '--warn', g: '--danger', k: '--ground' }

export function Sprite({ rows, px = 4, className, label }: { rows: string[]; px?: number; className?: string; label?: string }) {
  const w = Math.max(...rows.map((r) => r.length))
  const rects: ReactElement[] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x]
      if (c === '.' || c === ' ' || !COLOUR[c]) continue
      let n = 1
      while (row[x + n] === c) n++
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={n} height={1} style={{ fill: `var(${COLOUR[c]})` }} />)
      x += n - 1
    }
  })
  return (
    <svg viewBox={`0 0 ${w} ${rows.length}`} width={w * px} height={rows.length * px} className={cn('sprite shrink-0', className)} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {rects}
    </svg>
  )
}

export const TV = [
  '......a....a......',
  '.......a..a.......',
  '........aa........',
  'aaaaaaaaaaaaaaaaaa',
  'a................a',
  'a.aabbccddeeffgg.a',
  'a.aabbccddeeffgg.a',
  'a.aabbccddeeffgg.a',
  'a.aabbccddeeffgg.a',
  'a.aabbccddeeffgg.a',
  'a.aabbccddeeffgg.a',
  'a................a',
  'a.........a.a.a..a',
  'aaaaaaaaaaaaaaaaaa',
  '.aa............aa.',
]
export const INVADER = ['..a.....a..', '...a...a...', '..aaaaaaa..', '.aa.aaa.aa.', 'aaaaaaaaaaa', 'a.aaaaaaa.a', 'a.a.....a.a', '...aa.aa...'].map((r) => r.replace(/a/g, 'e'))
export const HEART = ['.dd.dd.', 'ddddddd', 'ddddddd', '.ddddd.', '..ddd..', '...d...']
export const STAR = ['...b...', '...b...', 'bbbbbbb', '.bbbbb.', '..bbb..', '.bb.bb.', '.b...b.']
