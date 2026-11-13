import curated from './curated-radio.json'
import type { MediaItem } from './store'

/**
 * Radio is a curated list: public-service and well-known listener-supported stations whose own servers carry the stream (BBC-style
 * broadcasters such as France Inter, Deutschlandfunk, NRK, SR, NPO, RAI and ABC, public stations such as WQXR, WNYC and WFMT, and
 * independents that publish free streams for anyone to play, such as SomaFM and Radio Paradise), found through the community directory
 * https://www.radio-browser.info and kept only where the stream checks out. Played straight from them; we never re-broadcast.
 * `scripts/curate-radio.py` rebuilds the list. The directory is still told when a station is played (`registerClick` in `radioPing.ts`).
 */
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

interface Row { uuid: string; name: string; url: string; logo: string | null; cc: string; country: string; codec: string; bitrate: number; tags: string[] }
const ROWS = curated as Row[]
const asStation = (r: Row, i: number): RadioStation => ({ stationuuid: r.uuid, name: r.name, url_resolved: r.url, favicon: r.logo ?? '', tags: r.tags.join(','), country: r.country, countrycode: r.cc, codec: r.codec, bitrate: r.bitrate, votes: 0, clickcount: ROWS.length - i, hls: 0 })

const WANT = ['lofi', 'ambient', 'classical', 'jazz', 'piano', 'chillout', 'meditation', 'nature', 'instrumental', 'soundtrack', 'deep house', 'news', 'talk'] as const
/** the chips: only the ones the list has stations for */
export const FOCUS_TAGS = WANT.filter((t) => ROWS.some((r) => r.tags.includes(t)))

export interface RadioQuery {
  tag?: string
  name?: string
}

export async function searchStations({ tag, name }: RadioQuery): Promise<RadioStation[]> {
  const t = (tag ?? '').trim().toLowerCase()
  const n = (name ?? '').trim().toLowerCase()
  const want = !t && !n ? 'ambient' : t
  return ROWS.map(asStation).filter((_, i) => {
    const r = ROWS[i]
    return (!want || r.tags.includes(want)) && (!n || r.name.toLowerCase().includes(n) || r.country.toLowerCase().includes(n))
  })
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
