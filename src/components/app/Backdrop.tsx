import { DotField } from '@/components/ui/dot-field'
import { Meteors } from '@/components/ui/meteors'
import { ShootingStars } from '@/components/ui/shooting-stars'
import { SpeedWarp } from '@/components/ui/speed-warp'
import { useStore } from '@/lib/store'

/** Layered motion: aurora → dots → stars → meteors → warp tunnel while you are locked in. */
export function Backdrop({ reduced }: { reduced: boolean }) {
  const level = useStore((s) => (reduced ? 0 : s.settings.motion))
  const running = useStore((s) => !!s.session && !s.session.paused)

  return (
    <div aria-hidden className={`fixed inset-0 overflow-hidden bg-[#07040f] grain ${level === 0 ? 'motion-calm' : ''}`}>
      <div className="aurora">
        <i />
        <i />
        <i />
      </div>
      {level >= 1 && (
        <DotField
          className="opacity-70"
          dotRadius={1.3}
          dotSpacing={22}
          gradientFrom="rgba(168,85,247,0.55)"
          gradientTo="rgba(200,255,61,0.35)"
        />
      )}
      {level >= 2 && (
        <ShootingStars
          background="transparent"
          nebula={false}
          starCount={90}
          starColors={['#ffffff', '#c4b5fd', '#e9d5ff', '#d9f99d']}
          trailColor="#c084fc"
          headColor="#f5d0fe"
          interval={1400}
          maxActiveShootingStars={3}
        />
      )}
      {level >= 1 && (
        <Meteors
          number={level >= 2 ? 16 : 6}
          color="#e9d5ff"
          trailColor="#a855f7"
          tailLength={90}
          className="opacity-60"
        />
      )}
      {level >= 2 && running && (
        <div className="absolute inset-0 opacity-40 mix-blend-screen">
          <SpeedWarp speed={9} starCount={380} />
        </div>
      )}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#07040f_100%)]" />
    </div>
  )
}
