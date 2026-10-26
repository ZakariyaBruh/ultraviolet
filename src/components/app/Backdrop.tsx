import { useEffect } from 'react'
import { FieldLines } from '@/components/app/FieldLines'
import { SpeedWarp } from '@/components/ui/speed-warp'
import { useStore } from '@/lib/store'
import { eraStage } from '@/lib/theme'
import { isLightTheme } from '@/lib/themes'
import { AsciiScene } from '@/components/app/AsciiScene'

/** Back to front: black ground, a morphing dot matrix (or the live TV picture), speed warp while locked in. */
export function Backdrop({ reduced }: { reduced: boolean }) {
  const motion = useStore((s) => s.settings.motion)
  const level = (reduced ? 0 : motion) as 0 | 1 | 2
  const running = useStore((s) => !!s.session && !s.session.paused)
  const theme = useStore((s) => s.settings.theme)
  const light = isLightTheme(theme)
  const stage = useStore((s) => eraStage(s.settings.era))
  // while locked in, panels turn part-transparent so the rush of stars shows through them
  useEffect(() => {
    document.documentElement.toggleAttribute('data-locked', level >= 1 && running)
    return () => document.documentElement.removeAttribute('data-locked')
  }, [level, running])

  return (
    <div aria-hidden className={`fixed inset-0 overflow-hidden bg-ground bp-ground ${level === 0 ? 'motion-calm' : ''}`}>
      <FieldLines level={level} />
      {stage >= 1 && <AsciiScene stage={stage} level={level} />}
      {theme === 'paper' && <><div className="screentone" /><div className="paper-grain" /></>}
      {theme === 'sunset' && <div className="sun" />}
      {level >= 1 && running && (
        <div className={`absolute inset-0 ${light ? 'invert' : ''}`}>
          <SpeedWarp speed={level === 2 ? 26 : 16} starCount={level === 2 ? 700 : 420} />
        </div>
      )}
    </div>
  )
}
