import { MorphingShapeLoader } from '@/components/ui/morphing-shape-loader'
import { useColours } from '@/lib/useColours'
import { cn } from '@/lib/utils'

/** A loading screen: the EasyUI morphing shape (circle, square, triangle, star) in the theme's accent, with a line saying what is loading. */
export function LoadingBlock({ label, className, size = 72 }: { label: string; className?: string; size?: number }) {
  const { signal } = useColours()
  return (
    <div role="status" aria-live="polite" className={cn('grid h-full min-h-[160px] place-content-center justify-items-center gap-3 text-ink', className)}>
      <MorphingShapeLoader shapes={['circle', 'square', 'triangle', 'star']} size={size} color={signal} duration={0.7} holdDuration={0.25} label={label} />
      <p className="hud">{label}</p>
    </div>
  )
}
