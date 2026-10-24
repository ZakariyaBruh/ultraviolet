import { useEffect, useRef } from 'react'
import { DotMorph } from '@/components/app/DotMorph'
import { SpeedWarp } from '@/components/ui/speed-warp'
import { usePlayer, video } from '@/lib/player'
import { useStore } from '@/lib/store'

/** The live picture sits behind everything. */
function VideoLayer() {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    el.prepend(video)
    return () => {
      if (video.parentNode === el) el.removeChild(video)
    }
  }, [])
  return <div ref={host} className="absolute inset-0 [&>video]:size-full [&>video]:object-cover [&>video]:grayscale-[0.35] [&>video]:contrast-125" />
}

/** Back to front: black ground, a morphing dot matrix (or the live TV picture), speed warp while locked in. */
export function Backdrop({ reduced }: { reduced: boolean }) {
  const motion = useStore((s) => s.settings.motion)
  const level = (reduced ? 0 : motion) as 0 | 1 | 2
  const running = useStore((s) => !!s.session && !s.session.paused)
  const light = useStore((s) => s.settings.theme === 'light')
  const current = usePlayer((s) => s.current)
  const status = usePlayer((s) => s.status)
  const tv = current?.kind === 'tv' && status !== 'error'

  return (
    <div aria-hidden className={`fixed inset-0 overflow-hidden bg-ground ${level === 0 ? 'motion-calm' : ''}`}>
      {tv ? (
        <>
          <VideoLayer />
          <div className="absolute inset-0 bg-black/60" />
        </>
      ) : (
        <DotMorph level={level} />
      )}
      {level >= 1 && running && (
        <div className={`absolute inset-0 opacity-60 ${light ? 'invert' : ''}`}>
          <SpeedWarp speed={level === 2 ? 14 : 7} starCount={level === 2 ? 380 : 180} />
        </div>
      )}
    </div>
  )
}
