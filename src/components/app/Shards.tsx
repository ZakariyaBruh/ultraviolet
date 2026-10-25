import { cn } from '@/lib/utils'

/**
 * A burst of overlapping, flat-faceted shards flying up and to the right: the retro half's emblem,
 * after the angular action graphics of the late eighties. Drawn from the theme's own colours.
 */
export function Shards({ className, drift = false }: { className?: string; drift?: boolean }) {
  const f = (v: string, o = 1) => ({ fill: `var(${v})`, fillOpacity: o })
  return (
    <svg viewBox="0 0 400 400" aria-hidden className={cn('pointer-events-none select-none', drift && 'shard-drift', className)}>
      <polygon points="0,400 150,110 215,250" style={f('--hot', 0.95)} />
      <polygon points="40,400 240,150 300,280" style={f('--signal', 0.9)} />
      <polygon points="95,340 190,40 260,200" style={f('--ink', 0.9)} />
      <polygon points="170,300 400,20 335,240" style={f('--hot', 0.85)} />
      <polygon points="150,260 400,110 285,320" style={f('--signal', 0.85)} />
      <polygon points="215,345 400,170 345,345" style={f('--ink', 0.4)} />
      <polygon points="0,290 80,190 120,330" style={f('--signal', 0.8)} />
      <polygon points="120,250 250,60 270,220" style={f('--hot', 0.6)} />
      <polygon points="260,260 400,60 380,200" style={f('--ink', 0.7)} />
      <polygon points="60,360 130,300 190,390" style={f('--ink', 0.55)} />
    </svg>
  )
}
