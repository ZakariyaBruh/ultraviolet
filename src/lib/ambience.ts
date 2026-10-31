import { create } from 'zustand'
import { itemsOf, useStore } from './store'

/**
 * The sound machine. Every sound is made here, on the spot, out of filtered noise: nothing is downloaded and nothing is recorded.
 * Layers run only while their level is above zero, so a quiet mix costs almost nothing.
 */
export const LAYERS = [
  { id: 'rain', name: 'Rain' },
  { id: 'wind', name: 'Wind' },
  { id: 'fire', name: 'Fire' },
  { id: 'waves', name: 'Waves' },
  { id: 'hum', name: 'Deep hum' },
] as const
export type LayerId = (typeof LAYERS)[number]['id']

export const PRESETS: { name: string; mix: Record<LayerId, number> }[] = [
  { name: 'Rainy day', mix: { rain: 0.7, wind: 0.15, fire: 0, waves: 0, hum: 0.3 } },
  { name: 'Fireside', mix: { rain: 0, wind: 0.2, fire: 0.75, waves: 0, hum: 0.25 } },
  { name: 'Seaside', mix: { rain: 0, wind: 0.3, fire: 0, waves: 0.8, hum: 0 } },
  { name: 'Deep focus', mix: { rain: 0.2, wind: 0, fire: 0, waves: 0, hum: 0.7 } },
]

interface Running { gain: GainNode; stop: () => void }

let ctx: AudioContext | null = null
let master: GainNode | null = null
const running = new Map<LayerId, Running>()
const buffers = new Map<string, AudioBuffer>()

const noise = (kind: 'white' | 'brown' | 'pink'): AudioBuffer => {
  const hit = buffers.get(kind)
  if (hit) return hit
  const c = ctx!
  const len = c.sampleRate * 4
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  let b0 = 0, b1 = 0, b2 = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (kind === 'white') d[i] = w
    else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 }
    else { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2 }
  }
  // fade the ends together so the loop has no click
  const f = Math.floor(c.sampleRate * 0.05)
  for (let i = 0; i < f; i++) { const t = i / f; d[i] *= t; d[len - 1 - i] *= t }
  buffers.set(kind, buf)
  return buf
}

const loop = (kind: 'white' | 'brown' | 'pink') => {
  const s = ctx!.createBufferSource()
  s.buffer = noise(kind)
  s.loop = true
  s.start(0, Math.random() * 3)
  return s
}

/** a slow wobble on a parameter, so nothing sounds like a loop */
const wobble = (param: AudioParam, rate: number, depth: number) => {
  const o = ctx!.createOscillator()
  const g = ctx!.createGain()
  o.frequency.value = rate
  g.gain.value = depth
  o.connect(g).connect(param)
  o.start()
  return o
}

const BUILD: Record<LayerId, () => Running> = {
  rain: () => {
    const out = ctx!.createGain()
    const src = loop('white')
    const hp = ctx!.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400
    const lp = ctx!.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 8000
    const body = ctx!.createGain(); body.gain.value = 0.55
    src.connect(hp).connect(lp).connect(body).connect(out)
    const o = wobble(body.gain, 0.17, 0.12)
    const rumble = loop('brown'); const rl = ctx!.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 220
    const rg = ctx!.createGain(); rg.gain.value = 0.25
    rumble.connect(rl).connect(rg).connect(out)
    return { gain: out, stop: () => { src.stop(); rumble.stop(); o.stop() } }
  },
  wind: () => {
    const out = ctx!.createGain()
    const src = loop('pink')
    const bp = ctx!.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9; bp.frequency.value = 420
    const body = ctx!.createGain(); body.gain.value = 0.9
    src.connect(bp).connect(body).connect(out)
    const o1 = wobble(bp.frequency, 0.07, 260)
    const o2 = wobble(body.gain, 0.045, 0.45)
    return { gain: out, stop: () => { src.stop(); o1.stop(); o2.stop() } }
  },
  fire: () => {
    const out = ctx!.createGain()
    const src = loop('brown')
    const lp = ctx!.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520
    const body = ctx!.createGain(); body.gain.value = 0.7
    src.connect(lp).connect(body).connect(out)
    // crackles: tiny bursts of noise at random moments
    const snap = setInterval(() => {
      if (!ctx || Math.random() > 0.35) return
      const s = ctx.createBufferSource(); s.buffer = noise('white')
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500 + Math.random() * 3000
      const g = ctx.createGain(); const t = ctx.currentTime
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25 + Math.random() * 0.4, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02 + Math.random() * 0.05)
      s.connect(hp).connect(g).connect(out)
      s.start(t, Math.random() * 3, 0.1)
    }, 70)
    return { gain: out, stop: () => { src.stop(); clearInterval(snap) } }
  },
  waves: () => {
    const out = ctx!.createGain()
    const src = loop('brown')
    const lp = ctx!.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1000
    const swell = ctx!.createGain(); swell.gain.value = 0.55
    src.connect(lp).connect(swell).connect(out)
    const o1 = wobble(swell.gain, 0.1, 0.5)
    const o2 = wobble(lp.frequency, 0.1, 500)
    return { gain: out, stop: () => { src.stop(); o1.stop(); o2.stop() } }
  },
  hum: () => {
    const out = ctx!.createGain()
    const src = loop('brown')
    const lp = ctx!.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260
    const body = ctx!.createGain(); body.gain.value = 1.1
    src.connect(lp).connect(body).connect(out)
    const tone = ctx!.createOscillator(); tone.frequency.value = 55
    const tg = ctx!.createGain(); tg.gain.value = 0.06
    tone.connect(tg).connect(out); tone.start()
    return { gain: out, stop: () => { src.stop(); tone.stop() } }
  },
}

const volume = () => useStore.getState().settings.volume

interface Ambience { on: boolean; start: () => void; stop: () => void; level: (id: LayerId, v: number) => void; preset: (mix: Record<LayerId, number>) => void }

/** apply one layer's level: start it if it is wanted, stop it if it is silent */
function apply(id: LayerId, v: number) {
  if (!ctx || !master) return
  const now = ctx.currentTime
  const have = running.get(id)
  if (v <= 0.001) {
    if (have) { have.gain.gain.setTargetAtTime(0, now, 0.12); const stop = have.stop; running.delete(id); setTimeout(stop, 600) }
    return
  }
  let r = have
  if (!r) { r = BUILD[id](); r.gain.gain.value = 0; r.gain.connect(master); running.set(id, r) }
  r.gain.gain.setTargetAtTime(v * 0.9, now, 0.2)
}

export const useAmbience = create<Ambience>((set, get) => ({
  on: false,
  start: () => {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      ctx ??= new AC()
      void ctx.resume()
      if (!master) { master = ctx.createGain(); master.connect(ctx.destination) }
      master.gain.setTargetAtTime(Math.min(1, volume() * 0.7), ctx.currentTime, 0.1)
      let mix = itemsOf(useStore.getState().credits).mix
      if (!LAYERS.some((l) => (mix[l.id] ?? 0) > 0)) { mix = PRESETS[0].mix; for (const l of LAYERS) useStore.getState().setMix(l.id, mix[l.id] ?? 0) }
      for (const l of LAYERS) apply(l.id, mix[l.id] ?? 0)
      set({ on: true })
    } catch { /* no audio here: the machine just stays off */ }
  },
  stop: () => {
    if (!ctx || !master) { set({ on: false }); return }
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.15)
    for (const [id, r] of [...running]) { running.delete(id); setTimeout(r.stop, 700) }
    set({ on: false })
  },
  level: (id, v) => {
    useStore.getState().setMix(id, v)
    if (get().on) apply(id, v)
  },
  preset: (mix) => {
    for (const l of LAYERS) { useStore.getState().setMix(l.id, mix[l.id] ?? 0); if (get().on) apply(l.id, mix[l.id] ?? 0) }
  },
}))

// the Volume setting is the master level
useStore.subscribe((s, p) => { if (s.settings.volume !== p.settings.volume && ctx && master) master.gain.setTargetAtTime(Math.min(1, s.settings.volume * 0.7), ctx.currentTime, 0.1) })
