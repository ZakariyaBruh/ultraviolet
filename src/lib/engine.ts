import { useEffect, useRef } from 'react'
import { useFx } from './fx'
import { notify } from './notify'
import { useStore } from './store'
import { fmtClock } from './dates'

/** Drives the focus timer and notices when you wander off to another tab. */
export function useSessionEngine() {
  const active = useStore((s) => !!s.session && !s.session.paused)
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return
    let prev = performance.now()
    const t = setInterval(() => {
      const now = performance.now()
      const gap = (now - prev) / 1000
      prev = now
      // time only counts while you are locked in and looking at it: a long gap (sleep, a throttled background tab) is never credited
      if (document.visibilityState === 'visible' && document.hasFocus() && gap < 3) useStore.getState().tick(Math.min(1.5, gap))
    }, 1000)
    return () => clearInterval(t)
  }, [active])

  // a paid break ends by itself
  const breakUntil = useStore((s) => s.session?.breakUntil)
  useEffect(() => {
    if (!breakUntil) return
    const check = () => {
      if (Date.now() < breakUntil) return
      useStore.getState().endBreak()
      notify('session', 'Your break is over. The timer is running again.', 'Back to it')
    }
    const t = setInterval(check, 1000)
    document.addEventListener('visibilitychange', check)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', check) }
  }, [breakUntil])

  // the page's own title, put back when you return (it says the timer is waiting while you are away from a running session)
  const title = useRef<string | null>(null)
  useEffect(() => {
    const onVis = () => {
      const s = useStore.getState().session
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = s && !s.paused ? Date.now() : null
        // the tab strip is the one place still in view from another tab: it says the truth, that the timer has stopped and is waiting
        if (s && !s.paused && title.current === null) {
          title.current = document.title
          document.title = `Waiting for you · ${fmtClock(Math.max(0, s.goalMin * 60 - s.elapsedSec))} left · Friction`
        }
        return
      }
      if (title.current !== null) { document.title = title.current; title.current = null }
      const at = hiddenAt.current
      hiddenAt.current = null
      if (!at || !useStore.getState().session) return
      const away = Math.round((Date.now() - at) / 1000)
      if (away >= 6) {
        useStore.getState().addLapse()
        useFx.getState().say({
          title: 'You wandered off',
          description: `${away}s away from your session. The timer waited for you.`,
          variant: 'warning',
        })
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
}
