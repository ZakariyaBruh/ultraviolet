import { useEffect } from 'react'
import { useStore } from './store'

/**
 * Keeping the screen awake while locked in. A phone or tablet dims and locks itself after a minute or so without a touch, and to
 * the browser a locked screen is the same as leaving the tab: the timer stopped and the session got a drift it had not earned,
 * so on a phone a session was only possible if you kept touching it. While a session is running (not on a break) this asks the
 * browser to keep the screen on, and lets go the moment the session ends, a break starts or the tab is put away. There is no
 * switch for it: time only counts while the screen is on, so a session with a sleeping screen is not something anyone can want.
 * Where the browser has no such thing (some older ones) nothing happens and nothing is promised.
 */
interface Sentinel { release: () => Promise<void>; addEventListener: (type: 'release', cb: () => void) => void }
type WakeLock = { request: (type: 'screen') => Promise<Sentinel> }
const api = (): WakeLock | null => (typeof navigator !== 'undefined' && 'wakeLock' in navigator ? (navigator as unknown as { wakeLock: WakeLock }).wakeLock : null)

export function useWakeLock() {
  const on = useStore((s) => !!s.session && !s.session.paused)
  useEffect(() => {
    const wl = api()
    if (!on || !wl) return
    let lock: Sentinel | null = null
    let asking = false
    let done = false
    const ask = () => {
      // the browser only grants it to a tab that is in front, and takes it back by itself when the tab is put away
      if (done || lock || asking || document.visibilityState !== 'visible') return
      asking = true
      wl.request('screen').then((l) => {
        asking = false
        if (done) { void l.release().catch(() => undefined); return }
        lock = l
        l.addEventListener('release', () => { if (lock === l) lock = null })
      }, () => { asking = false }) // refused (battery saver, no permission): the session carries on as it always did
    }
    ask()
    document.addEventListener('visibilitychange', ask)
    return () => {
      done = true
      document.removeEventListener('visibilitychange', ask)
      void lock?.release().catch(() => undefined)
      lock = null
    }
  }, [on])
}
