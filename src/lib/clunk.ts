import { useStore } from './store'

/** One heavy thud, for the Golden Brick. Made on the spot, like the arcade sounds. */
export function thud() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const v = useStore.getState().settings.volume
    const t = ctx.currentTime
    const tone = (type: OscillatorType, f0: number, f1: number, dur: number, gain: number) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = type
      o.frequency.setValueAtTime(f0, t)
      o.frequency.exponentialRampToValueAtTime(f1, t + dur)
      g.gain.setValueAtTime(gain * v, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + dur + 0.02)
    }
    tone('sine', 110, 42, 0.32, 0.5)
    tone('square', 1700, 900, 0.04, 0.08)
    setTimeout(() => void ctx.close(), 600)
  } catch { /* no sound: the brick still sits there */ }
}
