import { FieldLines } from '@/components/app/FieldLines'
import { SpeedWarp } from '@/components/ui/speed-warp'
import { useStore } from '@/lib/store'
import { isLightTheme } from '@/lib/themes'

/** Back to front: black ground, a morphing dot matrix (or the live TV picture), speed warp while locked in. */
export function Backdrop({ reduced }: { reduced: boolean }) {
  const motion = useStore((s) => s.settings.motion)
  const level = (reduced ? 0 : motion) as 0 | 1 | 2
  const running = useStore((s) => !!s.session && !s.session.paused)
  const light = useStore((s) => isLightTheme(s.settings.theme))

  return (
    <div aria-hidden className={`fixed inset-0 overflow-hidden bg-ground ${level === 0 ? 'motion-calm' : ''}`}>
      <FieldLines level={level} />
      {level >= 1 && running && (
        <div className={`absolute inset-0 opacity-60 ${light ? 'invert' : ''}`}>
          <SpeedWarp speed={level === 2 ? 14 : 7} starCount={level === 2 ? 380 : 180} />
        </div>
      )}
    </div>
  )
}
