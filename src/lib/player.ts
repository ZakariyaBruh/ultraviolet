import Hls from 'hls.js'
import { create } from 'zustand'
import type { MediaItem } from './store'
import { useStore } from './store'
import { registerClick } from './radio'

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

if (audio) {
  audio.preload = 'none'
  audio.crossOrigin = 'anonymous'
}
if (video) {
  video.playsInline = true
  video.className = 'h-full w-full object-cover'
}

const active = () => (usePlayer.getState().current?.kind === 'tv' ? video : audio)

function teardown() {
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
}
if (audio) wire(audio)
if (video) wire(video)

export function play(item: MediaItem, queue?: MediaItem[]) {
  teardown()
  const vol = useStore.getState().settings.volume
  audio.volume = vol
  video.volume = vol
  set({ current: item, status: 'loading', error: null, queue: queue ?? usePlayer.getState().queue })
  useStore.getState().pushRecent(item)
  if (item.kind === 'radio') registerClick(item.uuid)
  const el = item.kind === 'tv' ? video : audio
  const isHls = /\.m3u8(\?|$)/i.test(item.url)
  arm()
  if (isHls && Hls.isSupported()) {
    hls = new Hls({ lowLatencyMode: true, maxBufferLength: 20 })
    hls.on(Hls.Events.ERROR, (_e, d) => d.fatal && fail('Stream unavailable'))
    hls.loadSource(item.url)
    hls.attachMedia(el)
    hls.on(Hls.Events.MANIFEST_PARSED, () => void el.play().catch(() => set({ status: 'paused' })))
  } else {
    el.src = item.url
    void el.play().catch((e: unknown) => {
      if ((e as Error)?.name === 'NotAllowedError') set({ status: 'paused' })
    })
  }
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
