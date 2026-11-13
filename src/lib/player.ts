import type Hls from 'hls.js'
import { create } from 'zustand'
import type { MediaItem } from './store'
import { useStore } from './store'
import { registerClick } from './radioPing'
import { isTrying, refuse } from './trial'

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

interface PlayerState {
  current: MediaItem | null
  status: PlayerStatus
  error: string | null
  queue: MediaItem[]
  /** Extra stations tried automatically after an error. */
  hops: number
}

export const usePlayer = create<PlayerState>(() => ({
  current: null,
  status: 'idle',
  error: null,
  queue: [],
  hops: 0,
}))

const set = usePlayer.setState

const audio = typeof Audio !== 'undefined' ? new Audio() : (null as unknown as HTMLAudioElement)
export const video = typeof document !== 'undefined' ? document.createElement('video') : (null as unknown as HTMLVideoElement)
let hls: Hls | null = null
let watchdog: ReturnType<typeof setTimeout> | undefined
/** each play and each stop starts a new turn, so a library that arrives late can never start a stream that is no longer wanted */
let turn = 0

type HlsCtor = typeof import('hls.js').default
let hlsLib: Promise<HlsCtor | null> | null = null
/**
 * hls.js is the biggest single thing in the app (about a megabyte of source) and only streams in the .m3u8 format need it, which is
 * most TV channels and almost no radio. So it is fetched the first time one is played, or when the TV screen opens, and not at start.
 */
const loadHls = () => (hlsLib ??= import('hls.js').then((m) => m.default, () => { hlsLib = null; return null }))
/** hls.js needs Media Source. A browser without it (an iPhone) plays .m3u8 by itself, so the library is never fetched there. */
const canMse = () => typeof window !== 'undefined' && ('MediaSource' in window || 'ManagedMediaSource' in window || 'WebKitMediaSource' in window)
/** fetch the stream library ahead of the first channel (the TV screen calls this when it opens) */
export const warmStreams = () => { if (canMse()) void loadHls() }

if (audio) {
  audio.preload = 'none'
  audio.crossOrigin = 'anonymous'
}
if (video) {
  video.playsInline = true
  video.className = 'h-full w-full object-cover'
  video.poster = barsPoster()
}

/** Greyscale test bars as a tiny data-URI poster, shown before any channel plays. */
function barsPoster(): string {
  const tones = ['#e9ebef', '#d9dce2', '#c6cad2', '#b1b6c0', '#9aa0ac', '#848b98', '#6d7482']
  const c = document.createElement('canvas')
  c.width = 112
  c.height = 63
  const g = c.getContext('2d')
  if (!g) return ''
  tones.forEach((t, i) => {
    g.fillStyle = t
    g.fillRect(i * 16, 0, 16, 63)
  })
  return c.toDataURL('image/png')
}

const active = () => (usePlayer.getState().current?.kind === 'tv' ? video : audio)

function teardown() {
  turn++
  clearTimeout(watchdog)
  hls?.destroy()
  hls = null
  for (const el of [audio, video]) {
    el.pause()
    el.removeAttribute('src')
    el.load()
  }
}

function fail(msg: string) {
  clearTimeout(watchdog)
  set({ status: 'error', error: msg })
  const { queue, current, hops } = usePlayer.getState()
  if (current && queue.length > 1 && hops < 4) {
    set({ hops: hops + 1 })
    setTimeout(() => step(1, true), 900)
  }
}

function arm() {
  clearTimeout(watchdog)
  watchdog = setTimeout(() => {
    if (usePlayer.getState().status === 'loading') fail('This stream took too long to start')
  }, 14000)
}

function wire(el: HTMLMediaElement) {
  el.addEventListener('playing', () => {
    clearTimeout(watchdog)
    set({ status: 'playing', error: null, hops: 0 })
  })
  el.addEventListener('waiting', () => el === active() && set({ status: 'loading' }))
  el.addEventListener('pause', () => {
    if (el === active() && usePlayer.getState().status === 'playing') set({ status: 'paused' })
  })
  el.addEventListener('error', () => el === active() && el.getAttribute('src') && fail('Stream unavailable'))
  // a song that finishes hands over to the next one in its list
  el.addEventListener('ended', () => {
    const { current, queue } = usePlayer.getState()
    if (el === active() && current?.id.startsWith('song:') && queue.length > 1) step(1, true)
  })
}
if (audio) wire(audio)
if (video) wire(video)

export function play(item: MediaItem, queue?: MediaItem[]) {
  if (isTrying()) { refuse(); return }
  teardown()
  const vol = useStore.getState().settings.volume
  audio.volume = vol
  video.volume = vol
  set({ current: item, status: 'loading', error: null, queue: queue ?? usePlayer.getState().queue })
  useStore.getState().pushRecent(item)
  if (item.kind === 'radio') registerClick(item.uuid)
  const el = item.kind === 'tv' ? video : audio
  // podcast hosts rarely send CORS headers, and a plain element needs none to play
  if (item.id.startsWith('pod:') || item.id.startsWith('song:')) audio.removeAttribute('crossorigin')
  else audio.crossOrigin = 'anonymous'
  const isHls = /\.m3u8(\?|$)/i.test(item.url)
  arm()
  const plain = () => {
    el.src = item.url
    void el.play().catch((e: unknown) => {
      if ((e as Error)?.name === 'NotAllowedError') set({ status: 'paused' })
    })
  }
  if (isHls && canMse()) {
    const mine = turn
    void loadHls().then((H) => {
      if (mine !== turn) return // something else was played, or this was stopped, while the library was on its way
      if (!H || !H.isSupported()) { plain(); return }
      hls = new H({ lowLatencyMode: true, maxBufferLength: 20 })
      hls.on(H.Events.ERROR, (_e, d) => d.fatal && fail('Stream unavailable'))
      hls.loadSource(item.url)
      hls.attachMedia(el)
      hls.on(H.Events.MANIFEST_PARSED, () => void el.play().catch(() => set({ status: 'paused' })))
    })
  } else plain()
}

export function toggle() {
  const { status, current } = usePlayer.getState()
  if (!current) return
  const el = active()
  if (status === 'playing' || status === 'loading') {
    el.pause()
    set({ status: 'paused' })
  } else if (status === 'error') play(current)
  else void el.play().catch(() => undefined)
}

export function stop() {
  teardown()
  set({ current: null, status: 'idle', error: null, hops: 0 })
}

export function step(dir: 1 | -1, auto = false) {
  const { queue, current } = usePlayer.getState()
  if (!queue.length) return
  const i = Math.max(0, queue.findIndex((q) => q.id === current?.id))
  const next = queue[(i + dir + queue.length) % queue.length]
  const hops = auto ? usePlayer.getState().hops : 0
  play(next)
  set({ hops })
}

export function setVolume(v: number) {
  audio.volume = v
  video.volume = v
  useStore.getState().setSettings({ volume: v })
}

/** Podcast episodes can be sought; live streams cannot. */
export function seekBy(sec: number) {
  if (!Number.isFinite(audio.duration)) return
  audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + sec))
}
export function seekTo(sec: number) {
  if (Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(audio.duration, sec))
}
export const audioEl = audio
