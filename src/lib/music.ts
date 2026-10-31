import { useEffect } from 'react'
import { create } from 'zustand'
import { usePlayer } from './player'
import { useStore } from './store'

/**
 * The music. Every note is made here, on the spot, out of oscillators and noise: nothing is downloaded, nothing is recorded,
 * and no two sessions are the same, because the tune is chosen as it goes from a few chords and a scale. Four moods:
 * Calm (warm chords and a soft bell), Focus (a quiet lo-fi pulse), Night (deep drones and far-off bells) and Retro (small
 * square-wave arpeggios). It steps aside while a radio station, a TV channel or a podcast is playing.
 */
export type MoodId = 'calm' | 'focus' | 'night' | 'retro'
export const MOODS: { id: MoodId; name: string; blurb: string }[] = [
  { id: 'calm', name: 'Calm', blurb: 'Slow, warm chords and a soft bell.' },
  { id: 'focus', name: 'Focus', blurb: 'A quiet lo-fi pulse with a low bass.' },
  { id: 'night', name: 'Night', blurb: 'Deep drones and far-off bells.' },
  { id: 'retro', name: 'Retro', blurb: 'Small square-wave arpeggios, like an old console.' },
]

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12)

/** a small seeded random, so a tune can be repeated in a test and still never repeats for a person */
export function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** The mixing desk for one mood: a dry path, a generated room (reverb) and a soft echo, all through a gentle compressor. */
export interface Bus { ctx: BaseAudioContext; out: GainNode; dry: GainNode; wet: GainNode; noise: AudioBuffer }

function impulse(ctx: BaseAudioContext, secs: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * secs)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6
  }
  return buf
}
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

export function makeBus(ctx: BaseAudioContext, dest: AudioNode): Bus {
  const out = ctx.createGain()
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -22; comp.knee.value = 24; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.3
  out.connect(dest)
  comp.connect(out)
  const dry = ctx.createGain(); dry.gain.value = 0.85; dry.connect(comp)
  const wet = ctx.createGain()
  const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, 2.6)
  const vg = ctx.createGain(); vg.gain.value = 0.55
  wet.connect(verb); verb.connect(vg); vg.connect(comp)
  const echo = ctx.createDelay(1.5); echo.delayTime.value = 0.43
  const fb = ctx.createGain(); fb.gain.value = 0.32
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200
  const eg = ctx.createGain(); eg.gain.value = 0.35
  wet.connect(echo); echo.connect(lp); lp.connect(fb); fb.connect(echo); lp.connect(eg); eg.connect(comp)
  return { ctx, out, dry, wet, noise: noiseBuffer(ctx) }
}

const send = (b: Bus, node: AudioNode, room = 0.3) => {
  node.connect(b.dry)
  if (room > 0) { const s = b.ctx.createGain(); s.gain.value = room; node.connect(s); s.connect(b.wet) }
}
const env = (g: GainNode, t: number, attack: number, peak: number, hold: number, release: number) => {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.setValueAtTime(peak, t + attack + hold)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release)
}

/** a held chord: two slightly different oscillators per note, so it breathes */
function pad(b: Bus, notes: number[], t: number, dur: number, vol: number, wave: OscillatorType, cutoff: number) {
  const c = b.ctx
  const g = c.createGain()
  const att = Math.min(1.4, dur * 0.4)
  env(g, t, att, vol, Math.max(0, dur - att), 1.6)
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.5
  f.connect(g)
  for (const m of notes) for (const d of [-6, 6]) {
    const o = c.createOscillator(); o.type = wave; o.frequency.value = hz(m); o.detune.value = d
    o.connect(f); o.start(t); o.stop(t + dur + 1.8)
  }
  send(b, g, 0.45)
}
/** a plucked or struck note */
function pluck(b: Bus, m: number, t: number, vol: number, wave: OscillatorType = 'triangle', decay = 1.3, bright = 2600) {
  const c = b.ctx
  const o = c.createOscillator(); o.type = wave; o.frequency.value = hz(m)
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(bright, t); f.frequency.exponentialRampToValueAtTime(500, t + decay)
  const g = c.createGain(); env(g, t, 0.006, vol, 0, decay)
  o.connect(f); f.connect(g); o.start(t); o.stop(t + decay + 0.1)
  send(b, g, 0.5)
}
/** a bell: two sine partials that do not line up, which is what makes a bell a bell */
function bell(b: Bus, m: number, t: number, vol: number, decay = 3.2) {
  const c = b.ctx
  for (const [mul, v] of [[1, 1], [2.76, 0.4], [5.4, 0.12]] as const) {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = hz(m) * mul
    const g = c.createGain(); env(g, t, 0.004, vol * v, 0, decay / (mul > 1 ? 1.8 : 1))
    o.connect(g); o.start(t); o.stop(t + decay + 0.1)
    send(b, g, 0.7)
  }
}
const bass = (b: Bus, m: number, t: number, dur: number, vol: number, wave: OscillatorType = 'sine') => {
  const c = b.ctx
  const o = c.createOscillator(); o.type = wave; o.frequency.value = hz(m)
  const g = c.createGain(); env(g, t, 0.02, vol, Math.max(0, dur - 0.1), 0.35)
  o.connect(g); o.start(t); o.stop(t + dur + 0.5)
  send(b, g, 0.05)
}
const kick = (b: Bus, t: number, vol: number) => {
  const c = b.ctx
  const o = c.createOscillator(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22)
  const g = c.createGain(); env(g, t, 0.004, vol, 0, 0.28)
  o.connect(g); o.start(t); o.stop(t + 0.35); send(b, g, 0)
}
const tick = (b: Bus, t: number, vol: number, hi = 7000, len = 0.05) => {
  const c = b.ctx
  const s = c.createBufferSource(); s.buffer = b.noise
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hi
  const g = c.createGain(); env(g, t, 0.002, vol, 0, len)
  s.connect(f); f.connect(g); s.start(t, Math.random() * 0.8, len + 0.05); send(b, g, 0.08)
}
const rim = (b: Bus, t: number, vol: number) => {
  const c = b.ctx
  const s = c.createBufferSource(); s.buffer = b.noise
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 1.2
  const g = c.createGain(); env(g, t, 0.002, vol, 0, 0.14)
  s.connect(f); f.connect(g); s.start(t, Math.random() * 0.8, 0.2); send(b, g, 0.25)
}
const chip = (b: Bus, m: number, t: number, vol: number, len = 0.12, wave: OscillatorType = 'square') => {
  const c = b.ctx
  const o = c.createOscillator(); o.type = wave; o.frequency.value = hz(m)
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200
  const g = c.createGain(); env(g, t, 0.003, vol, len * 0.4, len * 0.6)
  o.connect(f); f.connect(g); o.start(t); o.stop(t + len + 0.1); send(b, g, 0.12)
}

type Rand = () => number
const pick = <T,>(r: Rand, a: T[]) => a[Math.floor(r() * a.length)]

interface Def { bpm: number; bar: (b: Bus, n: number, t: number, spb: number, r: Rand) => void }

const DEFS: Record<MoodId, Def> = {
  // warm major chords, a root note underneath, a bell wandering the pentatonic now and then
  calm: {
    bpm: 62,
    bar: (b, n, t, spb, r) => {
      const root = 55
      const chords = [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 18]]
      const ch = chords[n % 4]
      pad(b, ch.map((x) => root + 12 + x), t, spb * 4, 0.05, 'triangle', 1500)
      bass(b, root + ch[0] - 12, t, spb * 3.5, 0.2)
      const pent = [0, 2, 4, 7, 9]
      let step = Math.floor(r() * 5)
      for (let i = 0; i < 8; i++) {
        if (r() < 0.42) {
          step = Math.max(0, Math.min(9, step + pick(r, [-2, -1, 1, 2])))
          const m = root + 24 + pent[step % 5] + 12 * Math.floor(step / 5)
          bell(b, m, t + i * spb * 0.5 + (r() < 0.3 ? spb * 0.25 : 0), 0.045, 3)
        }
      }
    },
  },
  // lo-fi: a kick that sways, a soft rim, quiet hats, an electric-piano line over minor sevenths
  focus: {
    bpm: 74,
    bar: (b, n, t, spb, r) => {
      const root = 57
      const chords = [[0, 3, 7, 10], [-4, 0, 3, 7], [3, 7, 10, 14], [-2, 2, 5, 9]]
      const ch = chords[n % 4]
      pad(b, ch.map((x) => root + 12 + x), t, spb * 4, 0.035, 'sawtooth', 900)
      bass(b, root + ch[0] - 12, t, spb * 1.4, 0.22, 'triangle')
      bass(b, root + ch[0] - 12, t + spb * 2.5, spb * 1.2, 0.16, 'triangle')
      const sw = spb * 0.09
      kick(b, t, 0.28); kick(b, t + spb * 2.5 + sw, 0.2)
      rim(b, t + spb, 0.05); rim(b, t + spb * 3, 0.05)
      for (let i = 0; i < 8; i++) tick(b, t + i * spb * 0.5 + (i % 2 ? sw : 0), i % 2 ? 0.014 : 0.024)
      const sc = [0, 3, 5, 7, 10]
      let step = 5 + Math.floor(r() * 3)
      for (let i = 0; i < 8; i++) {
        if (r() < 0.38) {
          step = Math.max(0, Math.min(11, step + pick(r, [-2, -1, 1, 2])))
          pluck(b, root + 12 + sc[step % 5] + 12 * Math.floor(step / 5), t + i * spb * 0.5 + (i % 2 ? sw : 0), 0.05, 'triangle', 0.9, 2100)
        }
      }
    },
  },
  // long drones that move slowly, and bells far away
  night: {
    bpm: 46,
    bar: (b, n, t, spb, r) => {
      const root = 38
      const roots = [0, 0, 7, 5]
      const d = roots[n % 4]
      pad(b, [root + d, root + d + 7, root + d + 12, root + d + 15], t, spb * 4, 0.06, 'sawtooth', 520)
      if (n % 2 === 0) bass(b, root + d - 12, t, spb * 7, 0.2)
      const high = [0, 3, 7, 10, 12, 14, 17]
      for (let i = 0; i < 4; i++) if (r() < 0.3) bell(b, root + 36 + pick(r, high), t + i * spb + r() * spb * 0.8, 0.04, 5)
    },
  },
  // a console's worth of sound: square arpeggios, a triangle bass, noise for a hat
  retro: {
    bpm: 108,
    bar: (b, n, t, spb, r) => {
      const root = 60
      const chords = [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]]
      const ch = chords[n % 4]
      const pat = n % 8 < 4 ? [0, 1, 2, 1, 0, 1, 2, 1] : [0, 2, 1, 2, 0, 2, 1, 2]
      for (let i = 0; i < 16; i++) chip(b, root + 12 + ch[pat[i % 8] % 3] + (i % 8 > 3 ? 12 : 0), t + i * spb * 0.25, 0.034, 0.1)
      bass(b, root + ch[0] - 24, t, spb * 0.9, 0.2, 'triangle'); bass(b, root + ch[0] - 24, t + spb * 2, spb * 0.9, 0.2, 'triangle')
      for (let i = 0; i < 4; i++) tick(b, t + i * spb + spb * 0.5, 0.03, 8000, 0.04)
      kick(b, t, 0.2); kick(b, t + spb * 2, 0.2)
      if (r() < 0.5) chip(b, root + 24 + pick(r, [0, 2, 4, 7, 9]), t + spb * pick(r, [1, 1.5, 3]), 0.045, 0.3, 'square')
    },
  },
}

/** Schedules one bar of a mood at time t and says how long it lasts. This is the whole tune; the player and the tests both call it. */
export function scheduleBar(b: Bus, mood: MoodId, n: number, t: number, r: Rand): number {
  const d = DEFS[mood]
  const spb = 60 / d.bpm
  d.bar(b, n, t, spb, r)
  return spb * 4
}

/* ───────── playing it ───────── */

interface MusicState { playing: boolean; ducked: boolean }
export const useMusic = create<MusicState>(() => ({ playing: false, ducked: false }))

let ctx: AudioContext | null = null
let master: GainNode | null = null
let bus: Bus | null = null
let timer = 0
let nextT = 0
let bars = 0
let rand: Rand = rng(1)
let live: MoodId | null = null

const level = () => {
  const s = useStore.getState().settings
  return Math.min(1, s.volume * s.musicLevel * 0.9)
}
const pump = () => {
  if (!ctx || !bus || !live) return
  // look four seconds ahead, so a busy page or a slow timer in a background tab never makes a gap
  while (nextT < ctx.currentTime + 4) nextT += scheduleBar(bus, live, bars++, nextT, rand)
}

function begin(mood: MoodId) {
  if (!ctx || !master) return
  const old = bus
  if (old) { old.out.gain.setTargetAtTime(0, ctx.currentTime, 0.25); setTimeout(() => { try { old.out.disconnect() } catch { /* already gone */ } }, 2500) }
  bus = makeBus(ctx, master)
  bus.out.gain.value = 0
  bus.out.gain.setTargetAtTime(1, ctx.currentTime + 0.1, 0.6)
  live = mood
  bars = 0
  rand = rng((Math.random() * 2 ** 31) | 0)
  nextT = ctx.currentTime + 0.15
  pump()
}

/** Starts the music, or moves it to another mood. Must follow a tap or a key press, as every browser insists. */
export function startMusic(mood: MoodId) {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = 0
      master.connect(ctx.destination)
    }
    void ctx.resume()
    if (live !== mood || !timer) begin(mood)
    if (!timer) timer = window.setInterval(pump, 500)
    applyLevel()
    useMusic.setState({ playing: true })
  } catch { /* no audio here: the music simply stays off */ }
}

export function stopMusic() {
  if (ctx && master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.3)
  clearInterval(timer); timer = 0
  const c = ctx
  live = null
  if (c) setTimeout(() => { if (!live && ctx === c) void c.suspend().catch(() => undefined) }, 1500)
  useMusic.setState({ playing: false })
}

function applyLevel() {
  if (!ctx || !master) return
  const quiet = useMusic.getState().ducked
  master.gain.setTargetAtTime(quiet ? 0 : level(), ctx.currentTime, 0.4)
}

/** Keeps the music in step with its settings and the player. Mount it once, high up. */
export function useMusicSync() {
  const owned = useStore((s) => !!s.credits?.items?.owned?.includes('automusic'))
  const on = useStore((s) => s.settings.music) && owned
  const mood = useStore((s) => s.settings.musicMood) as MoodId
  const lvl = useStore((s) => s.settings.musicLevel)
  const vol = useStore((s) => s.settings.volume)
  const status = usePlayer((s) => s.status)
  const talking = status === 'playing' || status === 'loading'

  useEffect(() => { useMusic.setState({ ducked: talking }); applyLevel() }, [talking])
  useEffect(() => { applyLevel() }, [lvl, vol])
  useEffect(() => {
    if (!on) { if (useMusic.getState().playing) stopMusic(); return }
    // a browser will not play sound before the person has touched the page: wait for the first touch if there has not been one
    const go = () => startMusic(MOODS.some((m) => m.id === mood) ? mood : 'calm')
    if (navigator.userActivation?.hasBeenActive !== false) { go(); return }
    const first = () => go()
    addEventListener('pointerdown', first, { once: true })
    addEventListener('keydown', first, { once: true })
    return () => { removeEventListener('pointerdown', first); removeEventListener('keydown', first) }
  }, [on, mood])
}
