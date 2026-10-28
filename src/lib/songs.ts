import { cached } from './cache'
import type { MediaItem } from './store'

/**
 * Songs, from two free services that ask for no key and allow a browser to call them:
 *  - Audius: independent artists, whole tracks, streamed straight from its own servers.
 *  - Apple's iTunes Search: any song or artist, but only the 30 second preview Apple publishes for it.
 * Nothing is sent but the words you typed. A song plays in the same player as a radio station (`song:` ids), so the controls,
 * the queue and the room sharing all work, and the generated music steps aside while one plays.
 */
export type SongSource = 'audius' | 'itunes'
export interface Song {
  item: MediaItem
  source: SongSource
  seconds: number
  /** where to hear or buy the whole thing */
  link: string
}

const APP = 'friction'
const AUDIUS = 'https://api.audius.co/v1'
const HOUR = 3600e3

const https = (u: unknown): string | undefined => (typeof u === 'string' && /^https:\/\//.test(u) ? u : undefined)
const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

async function getJson(url: string, ms = 9000): Promise<unknown> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } })
    if (!r.ok) throw new Error(String(r.status))
    return await r.json()
  } finally { clearTimeout(t) }
}

interface AudiusTrack { id?: string; title?: string; duration?: number; permalink?: string; is_streamable?: boolean; access?: { stream?: boolean }; user?: { name?: string }; artwork?: Record<string, string> }

function fromAudius(t: AudiusTrack): Song | null {
  if (!t.id || !t.title || t.is_streamable === false || t.access?.stream === false) return null
  const art = https(t.artwork?.['150x150']) ?? https(t.artwork?.['480x480'])
  return {
    source: 'audius',
    seconds: Math.max(0, Math.round(Number(t.duration) || 0)),
    link: `https://audius.co${/^\/[\w\-./]+$/.test(t.permalink ?? '') ? t.permalink : ''}`,
    item: { id: `song:audius:${t.id}`, kind: 'radio', name: txt(t.title, 90), meta: txt(t.user?.name, 60) || 'Audius', url: `${AUDIUS}/tracks/${encodeURIComponent(t.id)}/stream?app_name=${APP}`, logo: art },
  }
}

interface ItunesTrack { trackId?: number; trackName?: string; artistName?: string; previewUrl?: string; artworkUrl100?: string; trackViewUrl?: string; trackTimeMillis?: number }

function fromItunes(t: ItunesTrack): Song | null {
  const url = https(t.previewUrl)
  if (!t.trackId || !t.trackName || !url) return null
  const art = https(t.artworkUrl100)?.replace('100x100bb', '200x200bb')
  return {
    source: 'itunes',
    seconds: 30, // Apple's preview, whatever the song's own length
    link: https(t.trackViewUrl) ?? 'https://music.apple.com',
    item: { id: `song:itunes:${t.trackId}`, kind: 'radio', name: txt(t.trackName, 90), meta: `${txt(t.artistName, 60)} · 30 s preview`, url, logo: art },
  }
}

/** What is being played on Audius this week, for when nothing has been typed. */
export const trending = (): Promise<Song[]> =>
  cached('songs:trend:v1', HOUR, async () => {
    const d = (await getJson(`${AUDIUS}/tracks/trending?time=week&limit=16&app_name=${APP}`)) as { data?: AudiusTrack[] }
    return (d.data ?? []).map(fromAudius).filter((s): s is Song => !!s).slice(0, 12)
  })

export const searchAudius = (q: string): Promise<Song[]> =>
  cached(`songs:audius:v1:${q.toLowerCase()}`, HOUR, async () => {
    const d = (await getJson(`${AUDIUS}/tracks/search?query=${encodeURIComponent(q)}&limit=20&app_name=${APP}`)) as { data?: AudiusTrack[] }
    return (d.data ?? []).map(fromAudius).filter((s): s is Song => !!s).slice(0, 12)
  })

export const searchItunes = (q: string): Promise<Song[]> =>
  cached(`songs:itunes:v1:${q.toLowerCase()}`, HOUR, async () => {
    const d = (await getJson(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=20`)) as { results?: ItunesTrack[] }
    return (d.results ?? []).map(fromItunes).filter((s): s is Song => !!s).slice(0, 12)
  })

/** m:ss */
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
