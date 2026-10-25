import { cached } from './cache'
import type { MediaItem } from './store'

export interface Show {
  id: string
  name: string
  artist: string
  art: string
  feedUrl: string
  genre: string
  episodes?: number
}

export interface Episode {
  id: string
  title: string
  url: string
  date: number
  seconds: number
  about: string
  art?: string
}

export const TOPICS = ['focus', 'history', 'science', 'philosophy', 'storytelling', 'comedy', 'news', 'technology', 'calm']

const https = (u: string) => u.replace(/^http:\/\//i, 'https://')

interface ItunesRow {
  collectionId: number
  collectionName: string
  artistName: string
  artworkUrl600?: string
  artworkUrl100?: string
  feedUrl?: string
  primaryGenreName?: string
  trackCount?: number
}

/** iTunes Search: the directory behind Apple Podcasts. No key. */
export async function searchShows(term: string): Promise<Show[]> {
  const url = `https://itunes.apple.com/search?media=podcast&entity=podcast&limit=36&term=${encodeURIComponent(term)}`
  return cached(`pod:s:${term}`, 3600 * 1000, async () => {
    const res = await fetch(url)
    if (!res.ok) throw new Error('directory')
    const d = (await res.json()) as { results?: ItunesRow[] }
    return (d.results ?? [])
      .filter((r) => r.feedUrl)
      .map((r): Show => ({
        id: String(r.collectionId),
        name: r.collectionName,
        artist: r.artistName,
        art: https(r.artworkUrl600 ?? r.artworkUrl100 ?? ''),
        feedUrl: https(r.feedUrl!),
        genre: r.primaryGenreName ?? '',
        episodes: r.trackCount,
      }))
  })
}

const text = (el: Element | null | undefined) => (el?.textContent ?? '').trim()
const plain = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent?.replace(/\s+/g, ' ').trim() ?? ''

/** "1:02:03", "42:10" or "2535" to seconds. */
const clock = (v: string) => {
  if (!v) return 0
  const p = v.split(':').map(Number)
  if (p.some((n) => !Number.isFinite(n))) return 0
  return p.reduce((a, n) => a * 60 + n, 0)
}

/** A small RSS 2.0 reader: channel art, then every item that carries an audio enclosure. */
export function parseFeed(xml: string, showId: string): Episode[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) throw new Error('feed')
  const channelArt = doc.querySelector('channel > image > url')?.textContent?.trim() || doc.getElementsByTagName('itunes:image')[0]?.getAttribute('href') || ''
  const out: Episode[] = []
  for (const item of Array.from(doc.getElementsByTagName('item'))) {
    const enc = item.getElementsByTagName('enclosure')[0]
    const url = enc?.getAttribute('url')
    if (!url || (enc.getAttribute('type') && !/audio|video|octet/i.test(enc.getAttribute('type')!))) continue
    const guid = text(item.getElementsByTagName('guid')[0]) || url
    const art = item.getElementsByTagName('itunes:image')[0]?.getAttribute('href') || channelArt
    out.push({
      id: `pod:${showId}:${guid}`,
      title: plain(text(item.getElementsByTagName('title')[0])) || 'Untitled episode',
      url: https(url),
      date: Date.parse(text(item.getElementsByTagName('pubDate')[0])) || 0,
      seconds: clock(text(item.getElementsByTagName('itunes:duration')[0])),
      about: plain(text(item.getElementsByTagName('description')[0]) || text(item.getElementsByTagName('itunes:summary')[0])).slice(0, 220),
      art: art ? https(art) : undefined,
    })
    if (out.length >= 60) break
  }
  if (!out.length) throw new Error('feed')
  return out
}

async function grab(url: string, ms = 9000): Promise<string> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) throw new Error(String(res.status))
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

/** Newest first. Tries the feed itself, then a public CORS relay for feeds that block browsers, then iTunes' own episode list. */
export async function loadEpisodes(show: Show): Promise<Episode[]> {
  return cached(`pod:e:${show.id}`, 1800 * 1000, async () => {
    for (const via of [(u: string) => u, (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`]) {
      try {
        return parseFeed(await grab(via(show.feedUrl)), show.id).sort((a, b) => b.date - a.date)
      } catch {
        /* blocked or unreadable: next route */
      }
    }
    const d = JSON.parse(await grab(`https://itunes.apple.com/lookup?id=${show.id}&entity=podcastEpisode&limit=60`)) as { results?: { wrapperType: string; episodeUrl?: string; trackName?: string; releaseDate?: string; trackTimeMillis?: number; description?: string; trackId: number; artworkUrl600?: string }[] }
    const eps = (d.results ?? [])
      .filter((r) => r.wrapperType === 'podcastEpisode' && r.episodeUrl)
      .map((r): Episode => ({ id: `pod:${show.id}:${r.trackId}`, title: r.trackName ?? 'Untitled episode', url: https(r.episodeUrl!), date: Date.parse(r.releaseDate ?? '') || 0, seconds: Math.round((r.trackTimeMillis ?? 0) / 1000), about: plain(r.description ?? '').slice(0, 220), art: r.artworkUrl600 }))
    if (!eps.length) throw new Error('feed')
    return eps
  })
}

export const episodeToMedia = (e: Episode, show: Show): MediaItem => ({
  id: e.id,
  kind: 'radio',
  name: e.title,
  url: e.url,
  logo: e.art ?? show.art,
  meta: `Podcast · ${show.name}`,
})
