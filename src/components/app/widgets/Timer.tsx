import { Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { fx_say } from '@/lib/actions'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { key } from './Window'

type Mode = 'stopwatch' | 'countdown'
interface T {
  mode: Mode
  /** countdown length in ms */
  target: number
  /** time already counted while it was paused */
  base: number
  /** when it last started, or 0 while it is paused */
  since: number
  setMode: (m: Mode) => void
  setTarget: (ms: number) => void
  start: () => void
  pause: () => void
  reset: () => void
}

const MIN = 60e3
let alarm = 0

/** a short bell, made on the spot, at the volume you set */
function beep() {
  const vol = useStore.getState().settings.volume
  if (!vol) return
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const c = new AC()
    for (let i = 0; i < 3; i++) {
      const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * 0.28
      o.type = 'sine'; o.frequency.value = 880
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25 * vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.25)
    }
    setTimeout(() => void c.close(), 1400)
  } catch { /* a silent timer is still a timer */ }
}

/**
 * The timer lives outside its window, so closing the window or changing screen does not stop it.
 * A countdown rings at the moment it ends, wherever you are in the app.
 */
export const useTimer = create<T>((set, get) => ({
  mode: 'countdown',
  target: 10 * MIN,
  base: 0,
  since: 0,
  setMode: (mode) => { clearTimeout(alarm); set({ mode, base: 0, since: 0 }) },
  setTarget: (ms) => { clearTimeout(alarm); set({ target: Math.min(180 * MIN, Math.max(MIN, ms)), base: 0, since: 0 }) },
  start: () => {
    const t = get()
    if (t.since) return
    const base = t.mode === 'countdown' && t.base >= t.target ? 0 : t.base
    set({ base, since: Date.now() })
    if (t.mode === 'countdown') {
      clearTimeout(alarm)
      alarm = window.setTimeout(() => {
        const s = get()
        if (s.mode !== 'countdown' || !s.since) return
        set({ base: s.target, since: 0 })
        beep()
        fx_say({ title: 'Timer done', description: `${Math.round(s.target / MIN)} minute${s.target === MIN ? '' : 's'} are up.`, variant: 'success' })
      }, Math.max(0, t.target - base))
    }
  },
  pause: () => { clearTimeout(alarm); const t = get(); if (t.since) set({ base: t.base + Date.now() - t.since, since: 0 }) },
  reset: () => { clearTimeout(alarm); set({ base: 0, since: 0 }) },
}))

const clock = (ms: number, tenths: boolean) => {
  const s = Math.max(0, ms) / 1000
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  const base = `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return tenths ? `${base}.${Math.floor((s * 10) % 10)}` : base
}

/** A stopwatch and a countdown. */
export function Timer() {
  const t = useTimer()
  const running = t.since > 0
  const [, tick] = useState(0)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => tick((n) => n + 1), 100)
    return () => clearInterval(id)
  }, [running])
  const elapsed = t.base + (t.since ? Date.now() - t.since : 0)
  const count = t.mode === 'countdown'
  const left = Math.max(0, t.target - elapsed)
  const done = count && elapsed >= t.target
  return (
    <div className="grid gap-3">
      <div role="group" aria-label="Mode" className="flex gap-1.5">
        {(['countdown', 'stopwatch'] as const).map((m) => (
          <button key={m} aria-pressed={t.mode === m} onClick={() => t.setMode(m)} className={cn('h-11 flex-1 text-[13px] md:h-9', t.mode === m ? 'bg-ink text-ground' : 'bg-ink/[0.07] text-ink ring-1 ring-ink/12 hover:bg-ink/12')}>{m === 'countdown' ? 'Countdown' : 'Stopwatch'}</button>
        ))}
      </div>
      <p className={cn('dot fig text-center text-[2.4rem] leading-[1.3]', done && 'text-signal')} role="timer" aria-label={count ? `${clock(left, false)} left` : `${clock(elapsed, false)} elapsed`}>{count ? clock(left, left < 10_000 && running) : clock(elapsed, true)}</p>
      {count && (
        <div className="flex items-center justify-center gap-1.5" role="group" aria-label="Length">
          <button onClick={() => t.setTarget(t.target - MIN)} disabled={running || t.target <= MIN} aria-label="One minute less" className={`${key} size-11 disabled:opacity-40`}><Minus className="size-4" /></button>
          {[5, 10, 25, 45].map((m) => <button key={m} onClick={() => t.setTarget(m * MIN)} disabled={running} aria-pressed={t.target === m * MIN} className={cn(key, 'h-11 w-11 px-0 text-[13px] disabled:opacity-40', t.target === m * MIN && 'border-signal text-signal')}>{m}</button>)}
          <button onClick={() => t.setTarget(t.target + MIN)} disabled={running || t.target >= 180 * MIN} aria-label="One minute more" className={`${key} size-11 disabled:opacity-40`}><Plus className="size-4" /></button>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={running ? t.pause : t.start} className="inline-flex h-11 flex-1 items-center justify-center gap-2 bg-signal px-4 text-sm font-semibold text-on-signal">{running ? <><Pause className="size-4" />Pause</> : <><Play className="size-4" />{elapsed > 0 && !done ? 'Resume' : done ? 'Again' : 'Start'}</>}</button>
        <button onClick={t.reset} disabled={!elapsed && !running} className="inline-flex h-11 items-center justify-center gap-2 border border-ink/30 px-4 text-sm hover:bg-ink/10 disabled:opacity-40"><RotateCcw className="size-4" />Reset</button>
      </div>
    </div>
  )
}
