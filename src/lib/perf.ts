import { create } from 'zustand'

/**
 * How much the moving parts of the screen are allowed to cost, so a slow phone or an old tablet stays usable.
 *
 * Three levels of detail (`tier`): 2 full (how it has always looked), 1 light (the backdrop and the turning solids are drawn half
 * as often and at a lower resolution, the warp has fewer stars) and 0 still (the backdrop is one drawn frame and nothing rushes
 * past). Buttons, panels and screen changes move the same at every level: only the things that animate all the time are held back,
 * because those are what keep a slow processor busy every second the app is open.
 *
 * The level is chosen for the device. On Auto (the default) it starts at full and `govern` below watches how long the browser really
 * takes over each frame; if the device cannot keep up for several seconds it steps down one level, says so once, and remembers for
 * two weeks. It only ever steps down by itself. Settings > Look has Auto, Full (never step down) and Lite (never above light).
 *
 * Everything that animates all the time shares one clock here (`everyFrame`) instead of each keeping its own loop: things that run
 * at the same rate are drawn in the same frame, so the browser composes the screen once for all of them and not once for each.
 */
export type Tier = 0 | 1 | 2
export type PerfMode = 'auto' | 'full' | 'lite'

const KEY = 'friction:perf'
const KEEP = 14 * 86_400_000

/** the level Auto starts from: what this device stepped down to in the last two weeks, or a guess from what the browser says about it */
function startTier(): Tier {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { t?: number; at?: number } | null
    if (saved && typeof saved.t === 'number' && typeof saved.at === 'number' && Date.now() - saved.at < KEEP) return (saved.t <= 0 ? 0 : saved.t === 1 ? 1 : 2) as Tier
  } catch { /* storage blocked: guess */ }
  if (typeof navigator === 'undefined') return 2
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory
  // two gigabytes of memory or two processor cores: start light and let the frame clock decide the rest
  if ((typeof mem === 'number' && mem <= 2) || (navigator.hardwareConcurrency || 8) <= 2) return 1
  return 2
}

const resolve = (mode: PerfMode, auto: Tier): Tier => (mode === 'full' ? 2 : mode === 'lite' ? (Math.min(1, auto) as Tier) : auto)

interface PerfState {
  mode: PerfMode
  /** what Auto has settled on for this device */
  auto: Tier
  /** the level in force: `auto`, held to what the person chose */
  tier: Tier
  setMode: (m: PerfMode) => void
}

export const usePerf = create<PerfState>((set, get) => {
  const auto = startTier()
  return {
    mode: 'auto',
    auto,
    tier: auto,
    setMode: (mode) => { if (mode !== get().mode) set({ mode, tier: resolve(mode, get().auto) }) },
  }
})

export const tierNow = () => usePerf.getState().tier
/** how sharp a full-screen canvas may be: a slow device spends most of its time pushing those pixels, not working out what to draw */
export const dprCap = (tier: Tier = tierNow()) => (tier === 2 ? 2 : tier === 1 ? 1.25 : 1.5)
/** a rate for the shared clock, in sixtieths of a second between frames: `full` at full detail, `light` at light, never at still */
export const pace = (full: number, light: number) => () => { const t = tierNow(); return t === 2 ? full : t === 1 ? light : 0 }

function stepDown() {
  const s = usePerf.getState()
  if (s.mode === 'full' || s.auto === 0) return
  const auto = (s.auto - 1) as Tier
  usePerf.setState({ auto, tier: resolve(s.mode, auto) })
  try { localStorage.setItem(KEY, JSON.stringify({ t: auto, at: Date.now() })) } catch { /* private mode */ }
  // the app says so once, in words (App.tsx listens); this file draws nothing itself
  try { dispatchEvent(new CustomEvent('friction:perf', { detail: auto })) } catch { /* no window */ }
}
/** forget what Auto learned about this device and start from full again (Settings offers this) */
export function relearn() {
  try { localStorage.removeItem(KEY) } catch { /* private mode */ }
  const s = usePerf.getState()
  usePerf.setState({ auto: 2, tier: resolve(s.mode, 2) })
  settle(6000)
}

/* ───────────── the shared clock ───────────── */

interface Sub { fn: (now: number) => void; step: () => number }
const subs = new Set<Sub>()
const TICK = 1000 / 60
let raf = 0
let prev = 0

/**
 * Call `fn` every `step()` sixtieths of a second (3 is twenty times a second, 6 is ten; 0 is not at all for now), in step with
 * everything else on the clock. The slots are fixed points in time, so two things at the same rate always share a frame and a
 * slower one uses every second or third of the same frames. Returns the way to stop.
 */
export function everyFrame(fn: (now: number) => void, step: () => number): () => void {
  const sub: Sub = { fn, step }
  subs.add(sub)
  if (!raf && typeof requestAnimationFrame === 'function') { prev = 0; raf = requestAnimationFrame(frame) }
  return () => { subs.delete(sub) }
}

function frame(now: number) {
  raf = subs.size ? requestAnimationFrame(frame) : 0
  if (!raf) { prev = 0; return }
  if (document.hidden) { prev = 0; return }
  const began = performance.now()
  const last = prev
  prev = now
  for (const s of subs) {
    const n = s.step()
    if (n <= 0) continue
    const slot = n * TICK
    if (!last || Math.floor(now / slot) !== Math.floor(last / slot)) s.fn(now)
  }
  govern(now, last ? now - last : 0, began)
}

/* ───────────── the governor ───────────── */

/**
 * What a frame costs is not only our own drawing: after the callbacks the browser works out styles, lays out, paints and hands
 * the frame to the compositor, all on the same thread, and for a full-screen canvas that is the larger part. A message posted
 * from inside the frame is delivered when the thread is free again, so the time until it arrives is the time the frame really
 * took. Added up over a few seconds that is the share of the processor the moving parts are using.
 */
const WINDOW = 2500
const chan = typeof MessageChannel === 'function' ? new MessageChannel() : null
let posted = 0
let cost = 0
let frames = 0
let late = 0
let winStart = 0
let bad = 0
let quietUntil = 0
if (chan) chan.port1.onmessage = () => { if (posted) { cost += performance.now() - posted; posted = 0 } }

/** nothing is judged for the next `ms`: a screen change, a part arriving or a resize is a burst of honest work, not a slow device */
export function settle(ms = 3000) {
  quietUntil = Math.max(quietUntil, performance.now() + ms)
  winStart = 0
  bad = 0
}
// the first seconds are the app starting, and so are the seconds after the tab comes back
settle(6000)
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => settle(3000))

function govern(now: number, dt: number, began: number) {
  const s = usePerf.getState()
  if (s.mode === 'full' || s.auto === 0 || !chan) return
  // a gap of more than a second is a tab that was put away, not a slow frame
  if (dt <= 0 || dt > 1000 || began < quietUntil) { winStart = 0; posted = 0; return }
  if (!winStart) { winStart = now; cost = 0; frames = 0; late = 0 }
  frames++
  if (dt > 250) late++
  if (!posted) { posted = began; chan.port2.postMessage(0) }
  const span = now - winStart
  if (span < WINDOW) return
  const load = cost / span
  const fps = (frames * 1000) / span
  // too slow: more than half of the processor going on frames, or fewer than twenty frames a second, or frames a quarter of a second apart
  const over = load > 0.55 || fps < 20 || late >= 3
  winStart = 0
  bad = over ? bad + 1 : 0
  // two windows in a row, so one heavy moment never changes anything
  if (bad >= 2) { bad = 0; stepDown(); settle(4000) }
}

/** for tests and for the Settings line that says what Auto is doing */
export const perfDebug = () => ({ subs: subs.size, bad, quiet: Math.max(0, quietUntil - performance.now()) })
