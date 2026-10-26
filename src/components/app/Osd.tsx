import { useStore } from '@/lib/store'
import { usePlayer } from '@/lib/player'
import { fmtClock } from '@/lib/dates'
import type { View } from '@/lib/route'

const CH: Record<View, string> = { focus: '01', radio: '02', tv: '03', podcasts: '04', news: '05', learn: '06', together: '07', leaders: '08', books: '09', arcade: '10', insights: '11', debrief: '12', settings: '13' }
const NAME: Record<View, string> = { focus: 'Focus', radio: 'Radio', tv: 'TV', podcasts: 'Pods', news: 'News', learn: 'Learn', together: 'Together', leaders: 'Leaders', books: 'Books', arcade: 'Arcade', insights: 'Stats', debrief: 'Debrief', settings: 'Setup' }

/** An on-screen display like an old set's: the channel you are on, and REC while you are locked in. */
export function Osd({ view }: { view: View }) {
  const left = useStore((s) => (s.session ? Math.max(0, Math.round(s.session.goalMin * 60 - s.session.elapsedSec)) : null))
  const paused = useStore((s) => !!s.session?.paused)
  const status = usePlayer((s) => s.status)
  return (
    <div className="osd osd-wrap items-center gap-4 max-md:!hidden" aria-hidden>
      <span>CH {CH[view]} {NAME[view]}</span>
      {left !== null ? <span className={paused ? '' : 'rec'}>{paused ? 'Break' : 'Rec'} {fmtClock(left)}</span> : status === 'playing' ? <span>▶ Play</span> : <span className="opacity-60">■ Stby</span>}
    </div>
  )
}
