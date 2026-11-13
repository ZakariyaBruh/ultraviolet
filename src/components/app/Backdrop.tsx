import { Suspense, useEffect, useState } from 'react'
import { FieldLines } from '@/components/app/FieldLines'
import { SpeedWarp } from '@/components/ui/speed-warp'
import { usePerf } from '@/lib/perf'
import { Stage } from '@/lib/stage'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { asciiStage, useThemeId } from '@/lib/theme'
import { isLightTheme, isPremiumTheme } from '@/lib/themes'
import { AsciiScene } from '@/components/app/AsciiScene'
import { part, PartBoundary } from '@/components/app/Part'

/** the pictures behind the supporter themes: only fetched when one of those themes is on */
const Scenery = part(() => import('@/components/app/Scenery').then((m) => m.Scenery))

/**
 * Back to front: the ground, the flowing contour field with the text solids over it, and the speed warp while locked in.
 * The field and the solids are layers on one canvas (lib/stage.ts) rather than a canvas each, and that canvas stops drawing while
 * something covers the whole screen (theatre mode) or a game is being played.
 */
export function Backdrop({ reduced }: { reduced: boolean }) {
  const motion = useStore((s) => s.settings.motion)
  const level = (reduced ? 0 : motion) as 0 | 1 | 2
  const running = useStore((s) => !!s.session && !s.session.paused)
  const theme = useThemeId()
  const light = isLightTheme(theme)
  const stage = useStore((s) => asciiStage(s.settings.ascii))
  const [canvas] = useState(() => new Stage())
  const covered = useUI((s) => s.theatre || s.playing)
  useEffect(() => { canvas.hold(covered) }, [canvas, covered])
  // the warp is the costliest thing on screen (a third full-screen canvas, sixty frames a second), so it follows the detail level
  // (lib/perf.ts): half the stars at thirty frames at light detail, and none at still
  const tier = usePerf((s) => s.tier)
  const warp = level >= 1 && running && tier > 0
  // while locked in, panels turn part-transparent so the rush of stars shows through them
  useEffect(() => {
    document.documentElement.toggleAttribute('data-locked', warp)
    return () => document.documentElement.removeAttribute('data-locked')
  }, [warp])

  return (
    <div aria-hidden className={`fixed inset-0 overflow-hidden bg-ground bp-ground ${level === 0 ? 'motion-calm' : ''}`}>
      {isPremiumTheme(theme) ? <PartBoundary quiet><Suspense fallback={null}><Scenery theme={theme} level={level} /></Suspense></PartBoundary> : <FieldLines stage={canvas} level={level} />}
      <canvas ref={canvas.attach} data-scene aria-hidden className="pointer-events-none absolute inset-0 size-full" />
      {stage >= 1 && <AsciiScene canvas={canvas} stage={stage} level={level} />}
      {theme === 'paper' && <><div className="screentone" /><div className="paper-grain" /></>}
      {theme === 'sunset' && <div className="sun" />}
      {warp && (
        <div className={`absolute inset-0 ${light ? 'invert' : ''}`}>
          <SpeedWarp speed={level === 2 ? 26 : 16} starCount={Math.round((level === 2 ? 700 : 420) * (tier === 2 ? 1 : 0.5))} fps={tier === 2 ? undefined : 30} />
        </div>
      )}
    </div>
  )
}
