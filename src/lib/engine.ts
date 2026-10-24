import { useEffect, useRef } from 'react'
import { useFx } from './fx'
import { useStore } from './store'

/** Drives the focus timer and notices when you wander off to another tab. */
export function useSessionEngine() {
  const active = useStore((s) => !!s.session && !s.session.paused)
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return
    let prev = performance.now()
    const t = setInterval(() => {
      const now = performance.now()
      const dt = Math.min(5, (now - prev) / 1000)
      prev = now
      if (document.visibilityState === 'visible') useStore.getState().tick(dt)
    }, 1000)
    return () => clearInterval(t)
  }, [active])

  useEffect(() => {
    const onVis = () => {
      const s = useStore.getState().session
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = s && !s.paused ? Date.now() : null
        return
      }
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
