import { useEffect, useState } from 'react'
import { useStore } from './store'
import { notify } from './notify'

/**
 * How hard a lock-in holds you, for people who know they will wander. Chosen before a session and kept for it (`session.lock`):
 * it cannot be lowered while the session runs. A paid Break lets go of all of it; a Pomodoro rest does not (it is a rest from
 * screens, not a trip to another tab).
 *   0 Low: as always. Leaving the tab is a drift.
 *   1 Medium: full screen. Leaving it is a drift, and the app waits behind a Back to full screen button until you return.
 *   2 High: full screen with the keyboard held where the browser allows it (Escape must be held to leave), a warning before the
 *      tab closes or reloads, switching to another window counts as a drift, the right-click menu and the save, print and
 *      view-source keys are blocked, a second screen is pointed out, the Browser window shuts, and ending early is a long hold.
 * A web page cannot stop someone closing the browser or switching off the device, and says so; this is friction, not a cage.
 */
export const LEVELS = [
  { name: 'Low', line: 'Leaving the tab is a drift.' },
  { name: 'Medium', line: 'Full screen. Leaving it is a drift.' },
  { name: 'High', line: 'Full screen, keys held, a warning before closing, other windows count as drifts, the Browser shuts, ending early is a 10 second hold.' },
]

type KeyboardLock = { lock?: (keys?: string[]) => Promise<void>; unlock?: () => void }
const kb = () => (navigator as unknown as { keyboard?: KeyboardLock }).keyboard
export const canFull = () => typeof document !== 'undefined' && !!document.documentElement.requestFullscreen && document.fullscreenEnabled !== false

/** called from the Lock in press itself, because full screen needs a press */
export async function enterLock(level: number) {
  if (level < 1 || !canFull()) return
  try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }) } catch { /* refused: the overlay asks again */ }
  if (level >= 2) { try { await kb()?.lock?.() } catch { /* not this browser */ } }
}
export function exitLock() {
  try { kb()?.unlock?.() } catch { /* nothing held */ }
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
}

/** the guard, while a session runs: returns whether the app is waiting for full screen to come back */
export function useLockdown(): { waiting: boolean; level: number } {
  const level = useStore((s) => s.session?.lock ?? 0)
  const live = useStore((s) => !!s.session && !s.session.paused) // a paid break lets go of everything
  const running = useStore((s) => !!s.session)
  const [waiting, setWaiting] = useState(false)

  // the session ended: let go of full screen and the keys
  useEffect(() => { if (!running) { exitLock(); setWaiting(false) } }, [running])

  useEffect(() => {
    if (!live || level < 1 || !canFull()) { setWaiting(false); return }
    let timer = 0
    const check = () => {
      clearTimeout(timer)
      if (document.fullscreenElement) { setWaiting(false); return }
      setWaiting(true)
      // leaving full screen is a drift, unless the tab went away too (that one is counted by the engine already)
      timer = window.setTimeout(() => { if (!document.fullscreenElement && !document.hidden && useStore.getState().session && !useStore.getState().session?.paused) useStore.getState().addLapse() }, 1500)
    }
    const onFs = () => { if (!document.fullscreenElement) check(); else { clearTimeout(timer); setWaiting(false) } }
    // back from a break or a reload without full screen: wait for it, no drift for that
    setWaiting(!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => { clearTimeout(timer); document.removeEventListener('fullscreenchange', onFs) }
  }, [live, level])

  useEffect(() => {
    if (!live || level < 2) return
    const before = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    const menu = (e: Event) => e.preventDefault()
    const keys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && /^[spuo]$/i.test(e.key)) e.preventDefault()
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && /^[ijc]$/i.test(e.key))) e.preventDefault()
    }
    // another window in front for more than three seconds is a drift; focus moving into one of our own frames is not (the
    // page still has the focus then), and a hidden tab is the engine's to count
    let blurAt = 0, hid = false
    const blur = () => { setTimeout(() => { if (!document.hasFocus() && !document.hidden) { blurAt = Date.now(); hid = false } }, 50) }
    const vis = () => { if (document.hidden) hid = true }
    const focus = () => { if (blurAt && !hid && Date.now() - blurAt > 3000 && useStore.getState().session && !useStore.getState().session?.paused) useStore.getState().addLapse(); blurAt = 0 }
    addEventListener('beforeunload', before)
    document.addEventListener('contextmenu', menu)
    document.addEventListener('keydown', keys, true)
    addEventListener('blur', blur); addEventListener('focus', focus); document.addEventListener('visibilitychange', vis)
    // a second screen is where a feed waits: say so once
    const scr = window.screen as Screen & { isExtended?: boolean }
    if (scr.isExtended) notify('session', 'A second screen is connected. High lock-in cannot see it, so it is up to you.', 'Second screen')
    return () => {
      removeEventListener('beforeunload', before)
      document.removeEventListener('contextmenu', menu)
      document.removeEventListener('keydown', keys, true)
      removeEventListener('blur', blur); removeEventListener('focus', focus); document.removeEventListener('visibilitychange', vis)
    }
  }, [live, level])

  return { waiting, level }
}

/** High: the Browser window shuts while a session runs (not on a paid break) */
export const useBrowserShut = () => useStore((s) => (s.session?.lock ?? 0) >= 2 && !!s.session && !s.session.paused)

/** High lock-in keeps you on Focus: another screen (Learn, TV, Radio...) is a distraction, so a live session refuses to go there. A paid Break lets go. */
export const navShut = (to: string) => {
  const a = useStore.getState().session
  return !!a && !a.paused && (a.lock ?? 0) >= 2 && to !== 'focus' && to !== 'home'
}
export const useNavShut = () => useStore((s) => !!s.session && !s.session.paused && (s.session.lock ?? 0) >= 2)
export const SHUT_NOTE = 'High lock-in keeps you on Focus. End the session (hold the button ten seconds) or take a Break to go elsewhere.'
