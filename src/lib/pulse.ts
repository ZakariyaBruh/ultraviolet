import { useStore } from './store'

/** Steadiness, 0–100: climbs 1.5 a second while you are locked in, eases down while idle, and drops 9 each time you wander off. No noise is added. */
let value = 50

export const getPulse = () => value

if (typeof window !== 'undefined') {
  setInterval(() => {
    const s = useStore.getState().session
    const drift = s && !s.paused ? 1.5 : -0.5
    value = Math.min(100, Math.max(6, value + drift))
  }, 1000)
  useStore.subscribe((s, p) => {
    if ((s.session?.lapses ?? 0) > (p.session?.lapses ?? 0)) value = Math.max(4, value - 9)
  })
}
