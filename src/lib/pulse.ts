import { useFx } from './fx'
import { useStore } from './store'

/** A live 0–100 "attention pulse": climbs while you are locked in, dips each time you reach for the scroll. */
let value = 50

export const getPulse = () => value

if (typeof window !== 'undefined') {
  setInterval(() => {
    const s = useStore.getState().session
    const drift = s && !s.paused ? 1.6 : -0.5
    value = Math.min(100, Math.max(6, value + drift + (Math.random() - 0.5) * 1.4))
  }, 1000)
  useFx.subscribe((s, p) => {
    if (s.flash !== p.flash) value = Math.max(4, value - 9)
  })
}
