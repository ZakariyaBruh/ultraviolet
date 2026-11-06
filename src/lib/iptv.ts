import curated from './curated-tv.json'
import type { MediaItem } from './store'

/**
 * Live TV is a curated list, not the open internet: public-service and international broadcasters whose own servers carry the stream
 * (ARD, ORF, RTVE, RAI, ERR, DR, Euronews, DW, France 24, NHK, ABC, CBC, PBS Kids, parliaments, and so on), found through the public
 * iptv-org playlists and kept only where the address is the broadcaster's own, not a re-host. Played straight from them; we never
 * copy or re-broadcast. `scripts/curate-tv.py` rebuilds the list and checks every stream is alive; run it now and then, streams move.
 * Anyone can ask for a channel to be hidden (see the Disclaimer page); what the broadcasters publish stays theirs.
 */
interface Row { id: string; name: string; url: string; logo: string | null; cc: string; cats: string[] }
const ROWS = curated as Row[]

/** the chips, each a way of grouping the list */
export const TV_CATEGORIES = ['news', 'general', 'education', 'culture', 'kids', 'parliament', 'sports', 'music'] as const
export type TvCategory = (typeof TV_CATEGORIES)[number]
const GROUP: Record<TvCategory, string[]> = {
  news: ['news'],
  general: ['general', 'public', 'entertainment', 'series', 'movies', 'lifestyle', 'undefined'],
  education: ['education', 'documentary', 'science', 'outdoor'],
  culture: ['culture'],
  kids: ['kids'],
  parliament: ['legislative'],
  sports: ['sports'],
  music: ['music'],
}

const COUNTRY = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }) } catch { return null } })()
const place = (cc: string) => { try { return COUNTRY?.of(cc === 'UK' ? 'GB' : cc) ?? cc } catch { return cc } }

const item = (r: Row): MediaItem => ({ id: `tv:${r.id}`, kind: 'tv', name: r.name, url: r.url, logo: r.logo ?? undefined, meta: place(r.cc) })
const inGroup = (r: Row, g: TvCategory) => (r.cats.length ? r.cats : ['undefined']).some((c) => GROUP[g].includes(c))

/** one chip's channels (the list lives in the app, so this is instant) */
export async function fetchCategory(cat: string): Promise<MediaItem[]> {
  const g = (TV_CATEGORIES as readonly string[]).includes(cat) ? (cat as TvCategory) : 'news'
  return ROWS.filter((r) => inGroup(r, g)).map(item)
}

/** search every channel by name or country */
export async function searchAllTv(q: string): Promise<MediaItem[]> {
  const needle = q.trim().toLowerCase()
  if (!needle) return []
  return ROWS.filter((r) => r.name.toLowerCase().includes(needle) || place(r.cc).toLowerCase().includes(needle) || r.cc.toLowerCase() === needle)
    .sort((a, b) => Number(b.name.toLowerCase().startsWith(needle)) - Number(a.name.toLowerCase().startsWith(needle)))
    .map(item)
}

export const TV_COUNT = ROWS.length
