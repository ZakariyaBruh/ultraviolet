import { cached } from './cache'
import type { MediaItem } from './store'

/** Community radio directory: https://api.radio-browser.info */
const MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://all.api.radio-browser.info',
  'https://fi1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
]

export interface RadioStation {
  stationuuid: string
  name: string
  url_resolved: string
  favicon: string
  tags: string
  country: string
  countrycode: string
  codec: string
  bitrate: number
  votes: number
  clickcount: number
  hls: number
}

let preferred = 0

async function rb<T>(path: string): Promise<T> {
  let last: unknown
  for (let i = 0; i < MIRRORS.length; i++) {
    const base = MIRRORS[(preferred + i) % MIRRORS.length]
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 7000)
    try {
      const res = await fetch(base + path, { signal: ctl.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      preferred = (preferred + i) % MIRRORS.length
      return (await res.json()) as T
    } catch (err) {
      last = err
    } finally {
      clearTimeout(t)
    }
  }
  throw last instanceof Error ? last : new Error('Radio directory unreachable')
}

export const FOCUS_TAGS = [
  'lofi',
  'ambient',
  'classical',
  'jazz',
  'piano',
  'chillout',
  'meditation',
  'nature',
  'instrumental',
  'soundtrack',
  'deep house',
  'news',
  'talk',
] as const

export interface RadioQuery {
  tag?: string
  name?: string
}

export async function searchStations({ tag, name }: RadioQuery): Promise<RadioStation[]> {
  const p = new URLSearchParams({
    order: 'clickcount',
    reverse: 'true',
    hidebroken: 'true',
    limit: '120',
    is_https: 'true',
  })
  if (tag) p.set('tag', tag)
  if (name) p.set('name', name)
  if (!tag && !name) p.set('tag', 'ambient')
  const path = `/json/stations/search?${p}`
  const list = await cached(`rb:${path}`, 6 * 3600e3, () => rb<RadioStation[]>(path))
  const seen = new Set<string>()
  return list.filter((s) => {
    const key = s.name.trim().toLowerCase()
    if (!s.url_resolved?.startsWith('https://') || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Be a good citizen: tell the directory this station was played. */
export function registerClick(uuid?: string) {
  if (!uuid) return
  void rb(`/json/url/${uuid}`).catch(() => undefined)
}

export function stationToMedia(s: RadioStation): MediaItem {
  const bits = [s.country, s.codec && `${s.codec}${s.bitrate ? ` ${s.bitrate}k` : ''}`].filter(Boolean)
  return {
    id: `radio:${s.stationuuid}`,
    kind: 'radio',
    name: s.name.trim(),
    url: s.url_resolved,
    logo: s.favicon?.startsWith('https://') ? s.favicon : undefined,
    meta: bits.join(' · '),
    tags: s.tags ? s.tags.split(',').slice(0, 3) : [],
    uuid: s.stationuuid,
  }
}
