import { useEffect, useRef } from 'react'
import { DotField } from '@/components/ui/dot-field'
import { ShootingStars } from '@/components/ui/shooting-stars'
import { SpeedWarp } from '@/components/ui/speed-warp'
import { usePlayer, video } from '@/lib/player'
import { useStore } from '@/lib/store'

/** The live picture sits behind everything: glass above it blurs and tints from it. */
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
  return <div ref={host} className="absolute inset-0 [&>video]:size-full [&>video]:scale-[1.02] [&>video]:object-cover [&>video]:brightness-[0.8] [&>video]:saturate-[1.15]" />
}

/**
 * Content layer, back to front: ground → drifting colour fields → (live TV picture | dot field) →
 * stars while radio plays → warp while locked in → a 35% dimming scrim when video is behind the glass.
 */
export function Backdrop({ reduced }: { reduced: boolean }) {
  const level = useStore((s) => (reduced ? 0 : s.settings.motion))
  const running = useStore((s) => !!s.session && !s.session.paused)
  const current = usePlayer((s) => s.current)
  const status = usePlayer((s) => s.status)
  const tv = current?.kind === 'tv' && status !== 'error'
  const radioLive = current?.kind === 'radio' && status === 'playing'

  return (
    <div aria-hidden className={`fixed inset-0 overflow-hidden bg-ground ${level === 0 ? 'motion-calm' : ''}`}>
      <div className="aether">
        <i />
        <i />
        <i />
      </div>
      {tv ? (
        <>
          <VideoLayer />
          <div className="absolute inset-0 bg-black/35" />
        </>
      ) : (
        level >= 1 && <DotField className="opacity-60" dotRadius={1.2} dotSpacing={22} gradientFrom="rgba(110,231,255,0.5)" gradientTo="rgba(167,139,250,0.35)" />
      )}
      {level >= 2 && radioLive && (
        <ShootingStars background="transparent" nebula={false} starCount={70} starColors={['#ffffff', '#a5f3fc', '#c4b5fd']} trailColor="#67e8f9" headColor="#ecfeff" interval={1800} maxActiveShootingStars={2} />
      )}
      {level >= 2 && running && (
        <div className="absolute inset-0 opacity-50 mix-blend-screen">
          <SpeedWarp speed={8} starCount={320} />
        </div>
      )}
      <div className="vignette absolute inset-0" />
    </div>
  )
}
