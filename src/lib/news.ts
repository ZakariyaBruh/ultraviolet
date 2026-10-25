import { cached } from './cache'
import { FEEDS, type Feed, type NewsCategory } from './feeds'
import type { Mute } from './store'

export interface Story {
  id: string
  title: string
  link: string
  date: number
  about: string
  source: string
}

const text = (el: Element | null | undefined) => (el?.textContent ?? '').trim()
const plain = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent?.replace(/\s+/g, ' ').trim() ?? ''
const first = (n: Element, ...tags: string[]) => { for (const t of tags) { const e = n.getElementsByTagName(t)[0]; if (e && text(e)) return e } return null }

/** RSS 2.0, RSS 1.0 (rdf) and Atom: every item or entry with a title and a link. */
export function parseNews(xml: string, source: string): Story[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) throw new Error('feed')
  const nodes = Array.from(doc.getElementsByTagName('item')).concat(Array.from(doc.getElementsByTagName('entry')))
  const out: Story[] = []
  for (const n of nodes) {
    const title = plain(text(first(n, 'title')))
    const l = n.getElementsByTagName('link')[0]
    const link = (l?.getAttribute('href') || text(l) || text(first(n, 'guid'))).trim()
    if (!title || !/^https?:\/\//i.test(link)) continue
    const date = Date.parse(text(first(n, 'pubDate', 'published', 'updated', 'dc:date'))) || 0
    out.push({ id: `${source}:${link}`, title, link: link.replace(/^http:\/\//i, 'https://'), date, about: plain(text(first(n, 'description', 'summary', 'content'))).slice(0, 240), source })
    if (out.length >= 25) break
  }
  if (!out.length) throw new Error('feed')
  return out
}

async function grab(url: string, ms = 8000): Promise<string> {
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

/** One feed: read it directly, or through a public CORS relay for the many publishers that do not allow browsers. */
export function loadFeed(f: Feed): Promise<Story[]> {
  return cached(`news:${f.url}`, 15 * 60 * 1000, async () => {
    const direct = grab(f.url, 6000).then((x) => parseNews(x, f.name))
    // the relay only starts if the feed itself has not answered quickly, so open feeds never touch it
    const relayed = new Promise<Story[]>((res, rej) => {
      setTimeout(() => { grab(`https://api.allorigins.win/raw?url=${encodeURIComponent(f.url)}`, 8000).then((x) => res(parseNews(x, f.name)), rej) }, 700)
    })
    try {
      return await Promise.any([direct, relayed])
    } catch {
      throw new Error('feed')
    }
  })
}

/** Loads a category's feeds a few at a time, calling back as each one lands so stories appear without waiting for the slowest. */
export async function loadCategory(cat: NewsCategory, onBatch: (stories: Story[], done: number, total: number) => void, cancelled: () => boolean) {
  const feeds = FEEDS.filter((f) => f.category === cat)
  let done = 0
  const queue = feeds.slice()
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      let got: Story[] = []
      try { got = await loadFeed(f) } catch { /* this source is down; the rest carry on */ }
      done++
      if (cancelled()) return
      onBatch(got, done, feeds.length)
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
}

export const normWord = (w: string) => w.trim().toLowerCase().replace(/\s+/g, ' ')
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A story is hidden when a live mute matches a whole word or phrase in its title or summary. */
export function matcher(mutes: Mute[], now: number) {
  const live = mutes.filter((m) => !m.until || m.until > now)
  if (!live.length) return () => null as string | null
  const rx = live.map((m) => ({ m, r: new RegExp(`(^|[^\\p{L}\\p{N}])${esc(m.word)}($|[^\\p{L}\\p{N}])`, 'iu') }))
  return (s: Story) => {
    const hay = `${s.title} ${s.about}`
    return rx.find((x) => x.r.test(hay))?.m.word ?? null
  }
}

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'will', 'have', 'after', 'about', 'what', 'when', 'says', 'into', 'over', 'more', 'than', 'been', 'their', 'could', 'would', 'how', 'why', 'who', 'are', 'was', 'not', 'but', 'new'])
/** Words from a headline worth offering as things to hide: names and nouns, longest first. */
export function topicsOf(title: string): string[] {
  const words = title.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) ?? []
  const uniq = Array.from(new Set(words.map((w) => w.replace(/['’]s$/i, ''))))
  return uniq.filter((w) => !STOP.has(w.toLowerCase())).sort((a, b) => (/^\p{Lu}/u.test(b) ? 1 : 0) - (/^\p{Lu}/u.test(a) ? 1 : 0) || b.length - a.length).slice(0, 5)
}

export const DURATIONS: { id: string; label: string; ms: number }[] = [
  { id: '1h', label: '1 hour', ms: 3600e3 },
  { id: '8h', label: '8 hours', ms: 8 * 3600e3 },
  { id: '1d', label: '1 day', ms: 24 * 3600e3 },
  { id: '7d', label: '1 week', ms: 7 * 24 * 3600e3 },
  { id: '30d', label: '30 days', ms: 30 * 24 * 3600e3 },
  { id: 'inf', label: 'Until I lift it', ms: 0 },
]

export const remaining = (m: Mute, now: number) => {
  if (!m.until) return 'until you lift it'
  const s = Math.max(0, Math.round((m.until - now) / 1000))
  if (s >= 86400) return `${Math.ceil(s / 86400)}d left`
  if (s >= 3600) return `${Math.ceil(s / 3600)}h left`
  return `${Math.max(1, Math.ceil(s / 60))}m left`
}
