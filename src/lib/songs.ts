import { cached } from './cache'
import type { MediaItem } from './store'

/**
 * Songs, from services that ask for no key and let a browser call them:
 *  - Audius: independent artists, whole tracks.
 *  - Openverse: openly licensed music from Jamendo and others, whole tracks.
 *  - Internet Archive: public domain and openly licensed recordings, whole tracks. Three of its collections are their own lanes, so
 *    they can be named: Musopen (public domain classical), the Free Music Archive (a mirror of its Creative Commons tracks) and the Live
 *    Music Archive (concert recordings that the bands allow to be shared).
 *  - Wikimedia Commons: freely licensed and public domain recordings (a lot of classical), whole tracks.
 *  - Library of Congress (National Jukebox): early records, 1900 to 1925, whole tracks.
 * Only the words you type are sent. A song plays in the same player as a radio station (`song:` ids), so the controls, the queue
 * and room sharing all work, and the music made in the browser steps aside while one plays. None of these sources rates its
 * music, so the age setting works from the flags they do give (explicit, mature) and a short list of words.
 */
export type SongSource = 'audius' | 'openverse' | 'archive' | 'musopen' | 'fma' | 'live' | 'commons' | 'loc'
export const SOURCE_NAME: Record<SongSource, string> = { audius: 'Audius', openverse: 'Openverse', archive: 'Internet Archive', musopen: 'Musopen', fma: 'Free Music Archive', live: 'Live Music Archive', commons: 'Wikimedia Commons', loc: 'Library of Congress' }
export interface Song { item: MediaItem; source: SongSource; seconds: number; link: string; rating: 0 | 1 | 2 }

/** artists the owner wants offered to adults only, whatever their genre says */
const ADULT_ONLY = /la goony|miss bashful|mrs\.? bashful/i

/** what the person asked to hear: 0 everyone, 1 teens, 2 adults */
export const AGES = [
  { id: 0, name: 'Everyone', note: 'Only songs with no explicit flag and no strong or mild bad words in the title or tags.' },
  { id: 1, name: 'Teens, 13+', note: 'No explicit flag and no strong words. Mild words are allowed.' },
  { id: 2, name: 'Adults, 18+', note: 'Everything, including songs marked explicit.' },
] as const

const APP = 'friction'
const AUDIUS = 'https://api.audius.co/v1'
const HOUR = 3600e3
const STRONG = /\b(goon\w*|xxx+|hoes?|thot|molly|percs?|xanax|fuck\w*|shit\w*|bitch\w*|cunt|nigg\w*|whore|slut|porn\w*|sex\w*|rape|nsfw|explicit|dick|pussy|cock|motherf\w*)\b/i
/** genres whose songs so often carry strong language that only the adult setting offers them */
const ADULT_GENRE = /hip.?hop|rap|trap|drill|dancehall|punk|metal|hardcore|comedy|spoken|podcast|audiobook|hyperpop|reggaeton|grime|crunk/i
/** genres made of voices, where the words are not known: fine for teens, not for the youngest */
const VOCAL_GENRE = /pop|rock|alternative|r&b|soul|latin|reggae|country|indie|blues|world|devotional|singer|emo|hyper/i
/** instrumental or near it: what the Everyone setting is built from */
const CALM_GENRE = /ambient|lo.?fi|classical|jazz|acoustic|soundtrack|score|piano|folk|kids|children|downtempo|chill|electronic|house|techno|trance|disco|funk|vaporwave|instrumental|orchestral|cinematic|new age|meditation|nature|sleep|study/i
const MILD = /\b(kill\w*|murder\w*|blunt|weed|slapper\w*|damn|hell|ass|bastard|crap|piss)\b/i

/** 2 for anything flagged or with strong words, 1 for mild words, 0 for the rest */
const rate = (flag: boolean, hay: string, genre = ''): 0 | 1 | 2 => {
  if (flag || STRONG.test(hay) || /xxx/i.test(hay) || ADULT_GENRE.test(genre)) return 2
  if (MILD.test(hay) || VOCAL_GENRE.test(genre)) return 1
  // an unknown genre is not trusted for the youngest setting; the open archives (no genre at all) are old recordings and kept
  return genre && !CALM_GENRE.test(genre) ? 1 : 0
}
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

interface AudiusTrack { id?: string; title?: string; duration?: number; permalink?: string; is_streamable?: boolean; access?: { stream?: boolean }; user?: { name?: string }; artwork?: Record<string, string>; parental_warning_type?: string | null; tags?: string | null; genre?: string | null; mood?: string | null }
function fromAudius(t: AudiusTrack): Song | null {
  if (!t.id || !t.title || t.is_streamable === false || t.access?.stream === false) return null
  const art = https(t.artwork?.['150x150']) ?? https(t.artwork?.['480x480'])
  return {
    source: 'audius', rating: rate(!!t.parental_warning_type, `${t.title} ${t.tags ?? ''}`, txt(t.genre, 40) || 'unknown'),
    seconds: Math.max(0, Math.round(Number(t.duration) || 0)),
    link: `https://audius.co${/^\/[\w\-./]+$/.test(t.permalink ?? '') ? t.permalink : ''}`,
    item: { id: `song:audius:${t.id}`, kind: 'radio', name: txt(t.title, 90), meta: txt(t.user?.name, 60) || 'Audius', url: `${AUDIUS}/tracks/${encodeURIComponent(t.id)}/stream?app_name=${APP}`, logo: art },
  }
}

interface OvTrack { category?: string | null; genres?: string[]; id?: string; title?: string; creator?: string; duration?: number; thumbnail?: string; url?: string; foreign_landing_url?: string; mature?: boolean; tags?: { name?: string }[] }
function fromOpenverse(t: OvTrack): Song | null {
  const url = https(t.url)
  if (!t.id || !t.title || !url || t.category === 'sound_effect' || /^(sound_effect|pronunciation)$/.test(t.category ?? '')) return null
  const hay = `${t.title} ${(t.tags ?? []).map((x) => x.name).join(' ')}`
  return {
    source: 'openverse', rating: rate(!!t.mature, hay, (t.genres ?? []).join(' ')),
    seconds: Math.round((Number(t.duration) || 0) / 1000),
    link: https(t.foreign_landing_url) ?? 'https://openverse.org',
    item: { id: `song:openverse:${t.id}`, kind: 'radio', name: txt(t.title, 90), meta: txt(t.creator, 60) || 'Openverse', url, logo: https(t.thumbnail) },
  }
}

const trendingAudius = () => cached('songs:trend:audius:v2', HOUR, async () => {
  const d = (await getJson(`${AUDIUS}/tracks/trending?time=week&limit=24&app_name=${APP}`)) as { data?: AudiusTrack[] }
  return (d.data ?? []).map(fromAudius).filter((s): s is Song => !!s)
})
const searchAudius = (q: string) => cached(`songs:audius:v4:${q.toLowerCase()}`, HOUR, async () => {
  const d = (await getJson(`${AUDIUS}/tracks/search?query=${encodeURIComponent(q)}&limit=24&app_name=${APP}`)) as { data?: AudiusTrack[] }
  return (d.data ?? []).map(fromAudius).filter((s): s is Song => !!s)
})
/**
 * Openverse is slow or unreachable from some countries, so our own relay (`api/openverse.ts`, which reads it from a server and
 * caches it) is asked first, and Openverse itself directly in case the relay is down. The first answer wins.
 */
const searchOpenverse = (q: string) => cached(`songs:ov:v5:${q.toLowerCase()}`, HOUR, async () => {
  const term = encodeURIComponent(q || 'music')
  const parse = (d: unknown) => ((d as { results?: OvTrack[] }).results ?? []).map(fromOpenverse).filter((s): s is Song => !!s)
  const relay = async () => { const l = parse(await getJson(`/api/openverse?q=${term}`, 20000)); if (!l.length) throw new Error('empty'); return l }
  const direct = async (delay: number, size: number) => { await new Promise((r) => setTimeout(r, delay)); return parse(await getJson(`https://api.openverse.org/v1/audio/?q=${term}&page_size=${size}`, 14000)) }
  return Promise.any([relay(), direct(2000, 12), direct(6000, 8)])
})

interface ArchiveDoc { identifier?: string; title?: string; creator?: string | string[] }
interface ArchiveMeta { d1?: string; dir?: string; files?: { name?: string; length?: string; format?: string }[] }
/**
 * The Archive lists recordings and their files separately, so each hit is looked up for its first MP3. One search serves four lanes
 * (the general one and three named collections); with no words typed a lane lists its most downloaded recordings.
 */
const archiveLane = (source: SongSource, q: string, where: string, plain = false) => cached(`songs:ia:${source}:v5:${q.toLowerCase()}`, HOUR, async () => {
  const term = q.replace(/["\\:()[\]{}]/g, ' ').trim()
  const words = term ? `(title:(${term}) OR creator:(${term})) AND ` : ''
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(`${words}${where}`)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&sort%5B%5D=downloads+desc&rows=${plain ? 8 : 10}&output=json`
  const d = (await getJson(url)) as { response?: { docs?: ArchiveDoc[] } }
  const docs = (d.response?.docs ?? []).filter((x) => x.identifier && /^[\w.\-]+$/.test(x.identifier))
  const got = await Promise.allSettled(docs.map(async (x): Promise<Song | null> => {
    const m = (await getJson(`https://archive.org/metadata/${x.identifier}`, 7000)) as ArchiveMeta
    const f = (m.files ?? []).find((y) => /\.mp3$/i.test(y.name ?? ''))
    if (!f?.name) return null
    const by = Array.isArray(x.creator) ? x.creator[0] : x.creator
    const hay = `${x.title ?? ''}`
    return {
      source, rating: rate(false, hay), seconds: Math.round(Number(f.length) || 0),
      link: `https://archive.org/details/${x.identifier}`,
      item: { id: `song:${source}:${x.identifier}`, kind: 'radio', name: txt(x.title, 90) || f.name, meta: txt(by, 60) || SOURCE_NAME[source], url: `https://archive.org/download/${x.identifier}/${encodeURIComponent(f.name).replace(/%2F/g, '/')}`, logo: `https://archive.org/services/img/${x.identifier}` },
    }
  }))
  return got.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []))
})
const searchArchive = (q: string) => archiveLane('archive', q || 'music', 'mediatype:audio AND collection:(opensource_audio OR netlabels OR 78rpm)')
const searchMusopen = (q: string) => archiveLane('musopen', q, 'mediatype:audio AND collection:musopen', true)
const searchFma = (q: string) => archiveLane('fma', q, 'mediatype:audio AND collection:freemusicarchive', true)
const searchLive = (q: string) => archiveLane('live', q, 'mediatype:etree AND collection:etree', true)

/* ---------------------------------------------------------------------------------------------- Wikimedia Commons */
interface CommonsInfo { url?: string; descriptionurl?: string; mime?: string; mediatype?: string; duration?: number; extmetadata?: Record<string, { value?: string } | undefined> }
interface CommonsPage { title?: string; index?: number; imageinfo?: CommonsInfo[] }
/** speech, effects and nature recordings are not songs */
const NOT_MUSIC = /pronunciation|sound effect|speech|spoken|recitation|ringtone|bird ?song|animal sound|ambient noise|voice|lecture|interview|audiobook|podcast|sermon/i
/** Not every browser plays every format (Safari has no Ogg), so only what this one can play is offered. */
const canPlay = (mime: string) => { try { return !!new Audio().canPlayType(mime === 'application/ogg' ? 'audio/ogg' : mime) } catch { return false } }
const plain = (html: unknown, max: number) => {
  const raw = typeof html === 'string' ? html : ''
  try { return txt(new DOMParser().parseFromString(raw, 'text/html').body.textContent, max) } catch { return txt(raw.replace(/<[^>]*>/g, ' '), max) }
}
function fromCommons(p: CommonsPage): Song | null {
  const i = p.imageinfo?.[0]
  const raw = https(i?.url)
  if (!p.title || !i || !raw || i.mediatype !== 'AUDIO' || !canPlay(String(i.mime))) return null
  const seconds = Math.round(Number(i.duration) || 0)
  if (seconds < 45 || seconds > 1800) return null
  const m = i.extmetadata ?? {}
  const name = txt(p.title.replace(/^File:/, '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_/g, ' '), 90)
  const hay = `${name} ${plain(m.Categories?.value?.replace(/\|/g, ' '), 200)} ${plain(m.ImageDescription?.value, 200)}`
  if (!name || NOT_MUSIC.test(hay)) return null
  return {
    source: 'commons', rating: rate(false, hay), seconds,
    link: https(i.descriptionurl) ?? 'https://commons.wikimedia.org',
    item: { id: `song:commons:${encodeURIComponent(name).slice(0, 80)}`, kind: 'radio', name, meta: plain(m.Artist?.value, 120).split(';')[0].replace(/\s*\([^)]*\)/g, '').trim().slice(0, 60) || 'Wikimedia Commons', url: raw.split('?')[0] },
  }
}
/** a different starting point each day, so the trending list is not the same every visit (and still cacheable) */
const ofTheDay = (list: string[]) => list[Math.floor(Date.now() / 864e5) % list.length]
const searchCommons = (q: string) => cached(`songs:wm:v1:${q.toLowerCase()}`, HOUR, async () => {
  const term = q.replace(/[^\p{L}\p{N} '’-]/gu, ' ').replace(/\s+/g, ' ').trim() || ofTheDay(['classical music', 'piano', 'orchestra', 'folk music', 'jazz', 'choir'])
  const qs = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: `filetype:audio ${term}`, gsrnamespace: '6', gsrlimit: '30', prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata|mediatype', format: 'json', formatversion: '2', origin: '*' })
  const d = (await getJson(`https://commons.wikimedia.org/w/api.php?${qs}`)) as { query?: { pages?: CommonsPage[] } }
  return (d.query?.pages ?? []).slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map(fromCommons).filter((s): s is Song => !!s)
})

/* ---------------------------------------------------------------------------------------------- Library of Congress */
interface LocItem { url?: string; title?: string; date?: string; image_url?: string[]; contributor_musical_group?: string[]; contributor_primary?: string[]; contributor?: string[]; subject_genre?: string[]; resources?: { media?: string }[] }
/** the early records carry words from their day that nobody should be served as a song title */
const OLD_WORDS = /\b(coon\w*|darkey|darkie|darky|nigg\w*|negro\w*|mammy|pickaninn\w*|sambo|chink\w*|japs?|gyp|injun|squaw|redskin\w*|savage\w*|hottentot|cannibal\w*)\b/i
const upFirst = (v: string) => v.charAt(0).toUpperCase() + v.slice(1)
const titleCase = (v: string) => v.replace(/\b([a-z])([a-z']*)/g, (_m, a: string, b: string) => a.toUpperCase() + b)
function fromLoc(t: LocItem): Song | null {
  const media = (t.resources ?? []).map((r) => https(r.media)).find((u) => !!u && /\.mp3(\?|$)/i.test(u))
  const id = /jukebox-\d+/.exec(t.url ?? '')?.[0]
  if (!media || !id || !t.title) return null
  const by = ((t.contributor_musical_group ?? t.contributor_primary ?? t.contributor ?? [])[0] ?? '').replace(/\s*\[.*?\]/g, '')
  const hay = `${t.title} ${by} ${(t.subject_genre ?? []).join(' ')}`
  if (OLD_WORDS.test(hay)) return null
  const year = /^\d{4}/.exec(t.date ?? '')?.[0]
  const art = https((t.image_url ?? [])[0])
  return {
    source: 'loc', rating: rate(false, hay), seconds: 0,
    link: https(t.url) ?? 'https://www.loc.gov/collections/national-jukebox/',
    item: { id: `song:loc:${id}`, kind: 'radio', name: upFirst(txt(t.title, 90)), meta: [titleCase(txt(by, 50)), year].filter(Boolean).join(', ') || 'National Jukebox', url: media, logo: art },
  }
}
const searchLoc = (q: string) => cached(`songs:loc:v1:${q.toLowerCase()}`, HOUR, async () => {
  const term = q.replace(/[^\p{L}\p{N} '’-]/gu, ' ').replace(/\s+/g, ' ').trim() || ofTheDay(['orchestra', 'jazz', 'waltz', 'march', 'piano', 'band', 'ragtime'])
  const qs = new URLSearchParams({ q: term, fo: 'json', c: '24', fa: 'original-format:sound recording' })
  const d = (await getJson(`https://www.loc.gov/collections/national-jukebox/?${qs}`, 12000)) as { results?: LocItem[] }
  return (d.results ?? []).map(fromLoc).filter((s): s is Song => !!s)
})

/** whether a song may be offered to someone who chose this age */
export const allowed = (s: Song, age: number) => s.rating <= age && (age >= 2 || !ADULT_ONLY.test(`${s.item.name} ${s.item.meta}`))

/**
 * Songs for a search (or what is trending when nothing is typed), from every source at once, mixed so no one source fills the list.
 * `onPartial` is called each time another source answers, so a slow one never holds the rest back.
 */
export async function findSongs(q: string, age: number, onPartial?: (r: { list: Song[]; failed: SongSource[] }) => void): Promise<{ list: Song[]; failed: SongSource[] }> {
  const term = q.trim()
  const jobs: [SongSource, Promise<Song[]>][] = term.length < 2
    ? [['audius', trendingAudius()], ['openverse', searchOpenverse('')], ['musopen', searchMusopen('')], ['fma', searchFma('')], ['commons', searchCommons('')], ['loc', searchLoc('')]]
    : [['audius', searchAudius(term)], ['openverse', searchOpenverse(term)], ['archive', searchArchive(term)], ['musopen', searchMusopen(term)], ['fma', searchFma(term)], ['live', searchLive(term)], ['commons', searchCommons(term)], ['loc', searchLoc(term)]]
  const lanes = new Map<SongSource, Song[]>()
  const failed: SongSource[] = []
  const mix = () => {
    const ls = jobs.map(([n]) => lanes.get(n) ?? [])
    const list: Song[] = []
    const seen = new Set<string>()
    for (let i = 0; list.length < 40 && ls.some((l) => i < l.length); i++) for (const l of ls) if (i < l.length && !seen.has(l[i].item.id)) { seen.add(l[i].item.id); list.push(l[i]) }
    return { list, failed: [...failed] }
  }
  await Promise.all(jobs.map(([n, p]) => p.then((r) => lanes.set(n, r.filter((s) => allowed(s, age))), () => { failed.push(n) }).then(() => onPartial?.(mix()))))
  return mix()
}

/** m:ss */
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
