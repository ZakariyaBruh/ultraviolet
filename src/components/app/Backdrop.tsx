import { useEffect } from 'react'
import { Shards } from '@/components/app/Shards'
import { FieldLines } from '@/components/app/FieldLines'
import { SpeedWarp } from '@/components/ui/speed-warp'
import { useStore } from '@/lib/store'
import { isLightTheme } from '@/lib/themes'

/** Back to front: black ground, a morphing dot matrix (or the live TV picture), speed warp while locked in. */
export function Backdrop({ reduced }: { reduced: boolean }) {
  const motion = useStore((s) => s.settings.motion)
  const level = (reduced ? 0 : motion) as 0 | 1 | 2
  const running = useStore((s) => !!s.session && !s.session.paused)
  const theme = useStore((s) => s.settings.theme)
  const light = isLightTheme(theme)
  // while locked in, panels turn part-transparent so the rush of stars shows through them
  useEffect(() => {
    document.documentElement.toggleAttribute('data-locked', level >= 1 && running)
    return () => document.documentElement.removeAttribute('data-locked')
  }, [level, running])

  return (
    <div aria-hidden className={`fixed inset-0 overflow-hidden bg-ground bp-ground ${level === 0 ? 'motion-calm' : ''}`}>
      <FieldLines level={level} />
      {theme === 'paper' && <><div className="screentone" /><div className="paper-grain" /></>}
      <Shards drift className="absolute -right-[6vmax] -top-[5vmax] w-[38vmax] max-w-none opacity-[0.13]" />
      <Shards drift className="absolute -bottom-[8vmax] -left-[7vmax] w-[30vmax] max-w-none rotate-180 opacity-[0.09]" />
      {theme === 'sunset' && <div className="sun" />}
      {level >= 1 && running && (
        <div className={`absolute inset-0 ${light ? 'invert' : ''}`}>
          <SpeedWarp speed={level === 2 ? 26 : 16} starCount={level === 2 ? 700 : 420} />
        </div>
      )}
    </div>
  )
}
