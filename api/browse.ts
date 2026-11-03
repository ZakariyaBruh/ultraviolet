import { verdict } from './_blocklist.js'
import { clean, internal, json, limited, RAW, readable, THIN, UA } from './_page.js'

/**
 * The Browser window's server side. Two jobs, both read-only and neither storing anything:
 *  - `?q=words&e=google|bing|duckduckgo`: a web search on the engine the person chose, turned into a short list of results. Google
 *    is read through its official Programmable Search API (env `GOOGLE_API_KEY` and `GOOGLE_CX`; its ordinary result page needs a
 *    full browser with scripts and is not served to a server). Bing and DuckDuckGo are read from their plain result pages. If the
 *    chosen engine fails, or Google is not set up, the next one answers and the reply says which did;
 *  - `?v=words`: YouTube videos for a search (full videos only), for the window's own YouTube page, read from the data in YouTube's
 *    public results page because its site shows nothing without scripts;
 *  - `?u=address`: the page at that address as cleaned HTML (no scripts, frames or forms that post), for the window to show in
 *    a sealed frame. Every address, and every redirect on the way, is checked against the blocklist (games, short-form social
 *    media) and against private networks, so the window cannot be used to reach either. A site that refuses our server (403) is
 *    reported as such rather than worked around, and a page that is only a shell for scripts is flagged `thin`.
 */


async function fetchPage(start: string): Promise<{ url: string; html: string } | { error: string; why?: string; walled?: true }> {
  let url = start
  for (let hop = 0; hop < 5; hop++) {
    const v = verdict(url)
    if (!v.ok) return { error: 'blocked', why: v.why }
    if (internal(v.url.hostname)) return { error: 'blocked', why: 'not a web page' }
    const r = await fetch(v.url, { redirect: 'manual', headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'accept-language': 'en' }, signal: AbortSignal.timeout(12000) })
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location')!, v.url).toString(); continue }
    // a site that turns programs away is left alone: the window says so and offers the page in the person's own browser
    if (r.status === 401 || r.status === 403 || r.status === 451) return { error: `${v.url.hostname.replace(/^www\./, '')} does not let other programs read its pages`, walled: true }
    if (r.status === 429 || r.status === 503) return { error: 'The site is busy right now. Try again in a moment' }
    if (!r.ok) return { error: `The site answered ${r.status}` }
    const type = r.headers.get('content-type') ?? ''
    if (!/html|xml/i.test(type)) return { error: 'This is a file, not a page', why: 'not a web page' }
    const buf = await r.arrayBuffer()
    if (buf.byteLength > RAW) return { error: 'That page is too big' }
    const charset = /charset=([\w-]+)/i.exec(type)?.[1] ?? 'utf-8'
    let html: string
    try { html = new TextDecoder(charset).decode(buf) } catch { html = new TextDecoder('utf-8').decode(buf) }
    return { url, html }
  }
  return { error: 'Too many redirects' }
}

const NAMED: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', middot: '·', bull: '•' }
/** plain text from a bit of markup: tags removed, character references (named and numeric) turned into the characters */
const decode = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&(?:#(\d{1,6})|#x([0-9a-f]{1,6})|([a-z]{2,8}));/gi, (m, d, x, n) => {
  if (n) return NAMED[n.toLowerCase()] ?? m
  const c = d ? Number(d) : parseInt(x, 16)
  return c > 0 && c < 0x110000 && !(c >= 0xd800 && c < 0xe000) ? String.fromCodePoint(c) : ''
}).replace(/\s+/g, ' ').trim()
interface Hit { title: string; url: string; about: string }

async function ddg(q: string): Promise<Hit[]> {
  const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, { headers: { 'user-agent': UA, 'accept-language': 'en' }, signal: AbortSignal.timeout(9000) })
  const t = await r.text()
  const out: Hit[] = []
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="result__snippet"[^>]*>([\s\S]*?)<\/a>)?/g
  for (let m = re.exec(t); m && out.length < 12; m = re.exec(t)) {
    let url = m[1].replace(/&amp;/g, '&')
    const u = /[?&]uddg=([^&]+)/.exec(url)
    if (u) url = decodeURIComponent(u[1])
    if (/^https?:\/\//.test(url)) out.push({ title: decode(m[2]), url, about: decode(m[3] ?? '') })
  }
  if (!out.length) throw new Error('none')
  return out
}

async function bing(q: string): Promise<Hit[]> {
  const r = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=en`, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'accept-language': 'en' }, signal: AbortSignal.timeout(9000) })
  const t = await r.text()
  const out: Hit[] = []
  // a result can hold a list of its own sub-links, so its text runs to the next result rather than the first </li>
  const re = /<li class="b_algo"[\s\S]*?<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>([\s\S]*?)(?=<li class="b_algo"|<\/ol>|$)/g
  for (let m = re.exec(t); m && out.length < 12; m = re.exec(t)) {
    let url = m[1].replace(/&amp;/g, '&')
    const b = /[?&]u=a1([^&]+)/.exec(url) // Bing wraps links; the target is base64 after "a1"
    if (b) { try { url = atob(decodeURIComponent(b[1]).replace(/-/g, '+').replace(/_/g, '/')) } catch { /* keep */ } }
    const about = /<p[^>]*>([\s\S]*?)<\/p>/.exec(m[3])?.[1] ?? ''
    if (/^https?:\/\//.test(url)) out.push({ title: decode(m[2]), url, about: decode(about) })
  }
  if (!out.length) throw new Error('none')
  return out
}

/** sites seen to turn programs away (403), so their results go below the ones that will open; a hint only, they still appear */
const WALLED = /(^|\.)(britannica|reddit|quizlet|sciencedirect|medium|merriam-webster|smithsonianmag|stackoverflow)\.com$/i
const hostOf = (u: string) => { try { return new URL(u).hostname } catch { return '' } }
const openable = (hits: Hit[]) => [...hits.filter((x) => !WALLED.test(hostOf(x.url))), ...hits.filter((x) => WALLED.test(hostOf(x.url)))]

/** Google through its official search API: the key and the search engine id stay on the server, 100 free searches a day */
const googleOn = () => !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CX)
async function google(q: string): Promise<Hit[]> {
  const u = new URL('https://www.googleapis.com/customsearch/v1')
  u.search = new URLSearchParams({ key: process.env.GOOGLE_API_KEY ?? '', cx: process.env.GOOGLE_CX ?? '', q, num: '10', hl: 'en' }).toString()
  const r = await fetch(u, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
  if (!r.ok) throw new Error(String(r.status))
  const d = (await r.json()) as { items?: { title?: string; link?: string; snippet?: string }[] }
  const out: Hit[] = []
  for (const x of d.items ?? []) if (typeof x.link === 'string' && /^https?:\/\//.test(x.link)) out.push({ title: decode(x.title ?? x.link), url: x.link, about: decode(x.snippet ?? '') })
  if (!out.length) throw new Error('none')
  return out
}

/**
 * YouTube videos for a search, for the window's own YouTube page (YouTube's site is a script app and shows nothing without scripts).
 * The public results page carries its first results as data inside the page, so no script has to run to read them. Only full videos
 * are kept (Shorts and live streams are left out); a video plays in YouTube's own embedded player.
 */
interface Video { id: string; title: string; channel: string; length: string; views: string; when: string }

/** with a key (YOUTUBE_API_KEY, or the same GOOGLE_API_KEY if the YouTube Data API is switched on for it) the official API answers; 100 free searches a day */
const ytKey = () => process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY
const short = (n: number) => (n >= 1e9 ? `${+(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n))
const ago = (iso: string) => {
  const d = (Date.now() - Date.parse(iso)) / 864e5
  if (!(d >= 0)) return ''
  const [n, u] = d >= 365 ? [Math.floor(d / 365), 'y'] : d >= 30 ? [Math.floor(d / 30), 'mo'] : d >= 1 ? [Math.floor(d), 'd'] : [Math.max(1, Math.floor(d * 24)), 'h']
  return `${n}${u} ago`
}
interface YtItem { id?: string | { videoId?: string }; snippet?: { title?: string; channelTitle?: string; publishedAt?: string }; contentDetails?: { duration?: string }; statistics?: { viewCount?: string } }
async function youtubeApi(q: string, key: string): Promise<Video[]> {
  const ask = async (path: string, args: Record<string, string>) => {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...args, key })}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
    if (!r.ok) throw new Error(String(r.status))
    return ((await r.json()) as { items?: YtItem[] }).items ?? []
  }
  const found = await ask('search', { part: 'snippet', type: 'video', maxResults: '15', q, safeSearch: 'moderate' })
  const idOf = (x: YtItem) => (typeof x.id === 'object' ? x.id.videoId : x.id)
  const ids = found.map(idOf).filter((x): x is string => typeof x === 'string' && /^[\w-]{11}$/.test(x))
  if (!ids.length) throw new Error('none')
  const out: Video[] = []
  for (const v of await ask('videos', { part: 'contentDetails,statistics', id: ids.join(',') })) {
    const id = idOf(v)
    const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(v.contentDetails?.duration ?? '')
    const secs = m ? (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0) : 0
    if (!id || secs <= 60) continue // a live stream, or short enough to be a Short
    const sn = found.find((x) => idOf(x) === id)?.snippet ?? {}
    const h = Math.floor(secs / 3600), mm = Math.floor((secs % 3600) / 60), ss = String(secs % 60).padStart(2, '0')
    out.push({ id, title: decode(sn.title ?? '').slice(0, 140), channel: decode(sn.channelTitle ?? '').slice(0, 60), length: h ? `${h}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`, views: v.statistics?.viewCount ? short(Number(v.statistics.viewCount)) : '', when: sn.publishedAt ? ago(sn.publishedAt) : '' })
  }
  if (!out.length) throw new Error('none')
  return out
}

async function youtube(q: string): Promise<Video[]> {
  const key = ytKey()
  if (key) { try { return await youtubeApi(q, key) } catch { /* over its daily share, or not switched on: read the public page instead */ } }
  const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=en`, { headers: { 'user-agent': UA, 'accept-language': 'en' }, signal: AbortSignal.timeout(9000) })
  if (!r.ok) throw new Error(String(r.status))
  const m = /ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/.exec(await r.text())
  if (!m) throw new Error('shape')
  const out: Video[] = []
  const text = (o: unknown): string => {
    const t = o as { simpleText?: string; runs?: { text?: string }[] } | undefined
    return (t?.simpleText ?? t?.runs?.map((x) => x.text ?? '').join('') ?? '').replace(/\s+/g, ' ').trim()
  }
  const stack: unknown[] = [JSON.parse(m[1])]
  while (stack.length && out.length < 14) {
    const n = stack.pop()
    if (!n || typeof n !== 'object') continue
    if (Array.isArray(n)) { for (let i = n.length - 1; i >= 0; i--) stack.push(n[i]); continue }
    const o = n as Record<string, unknown>
    const v = o.videoRenderer as Record<string, unknown> | undefined
    if (v) {
      const url = ((v.navigationEndpoint as { commandMetadata?: { webCommandMetadata?: { url?: string } } } | undefined)?.commandMetadata?.webCommandMetadata?.url) ?? ''
      const id = typeof v.videoId === 'string' && /^[\w-]{11}$/.test(v.videoId) ? v.videoId : ''
      const length = text(v.lengthText)
      if (id && length && !url.startsWith('/shorts')) out.push({ id, title: text(v.title).slice(0, 140), channel: text(v.ownerText ?? v.longBylineText).slice(0, 60), length, views: text(v.shortViewCountText ?? v.viewCountText).slice(0, 30), when: text(v.publishedTimeText).slice(0, 30) })
      continue
    }
    for (const k of Object.keys(o).reverse()) stack.push(o[k])
  }
  if (!out.length) throw new Error('none')
  return out
}

type Engine = 'google' | 'bing' | 'duckduckgo'
const ENGINES: Record<Engine, (q: string) => Promise<Hit[]>> = { google, bing, duckduckgo: ddg }
const ORDER: Record<Engine, Engine[]> = { google: ['google', 'bing', 'duckduckgo'], bing: ['bing', 'duckduckgo'], duckduckgo: ['duckduckgo', 'bing'] }

/** the chosen engine first; the next is started if it fails, or if it has not answered in 2.5 s, and the first good answer wins */
function search(q: string, want: Engine): Promise<{ engine: Engine; results: Hit[] }> {
  const order = ORDER[want].filter((e) => e !== 'google' || googleOn())
  return new Promise((resolve, reject) => {
    const started = new Set<number>()
    const timers: ReturnType<typeof setTimeout>[] = []
    let failed = 0, done = false
    const start = (i: number) => {
      if (done || i >= order.length || started.has(i)) return
      started.add(i)
      ENGINES[order[i]](q).then(
        (results) => { if (!done) { done = true; timers.forEach(clearTimeout); resolve({ engine: order[i], results }) } },
        () => { start(i + 1); if (++failed === order.length && !done) reject(new Error('none')) },
      )
      if (i + 1 < order.length) timers.push(setTimeout(() => start(i + 1), 2500))
    }
    start(0)
  })
}

export default {
  async fetch(request: Request) {
    const site = request.headers.get('sec-fetch-site')
    if (site && site !== 'same-origin' && site !== 'none') return json({ error: 'not here' }, 403)
    const ip = (request.headers.get('x-forwarded-for') ?? 'x').split(',')[0].trim()
    if (limited(`ip:${ip}`, 240, 3600e3)) return json({ error: 'slow down' }, 429)
    const p = new URL(request.url).searchParams
    const q = (p.get('q') ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120)
    if (q) {
      const want: Engine = p.get('e') === 'bing' ? 'bing' : p.get('e') === 'duckduckgo' ? 'duckduckgo' : 'google'
      try {
        const { engine, results } = await search(q, want)
        // a result that points at a blocked site is dropped, so the list never offers one
        return json({ results: openable(results.filter((x) => verdict(x.url).ok)), engine, asked: want, googleOff: want === 'google' && !googleOn() }, 200, 'public, s-maxage=600')
      } catch { return json({ error: 'search busy' }, 502) }
    }
    const yt = (p.get('v') ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120)
    if (yt) {
      try { return json({ videos: await youtube(yt) }, 200, 'public, s-maxage=3600, stale-while-revalidate=86400') } catch { return json({ error: 'video search busy' }, 502) }
    }
    const u = p.get('u') ?? ''
    if (!u) return json({ error: 'bad' }, 400)
    try {
      const got = await fetchPage(u)
      if ('error' in got) return json(got, got.error === 'blocked' ? 403 : 502)
      // s=1: the page keeps its scripts, to run in the person's own browser (never here); the window has already checked the address
      const html = clean(got.html, got.url, p.get('s') === '1')
      return json({ url: got.url, html, thin: readable(html) < THIN }, 200, 'public, s-maxage=300')
    } catch { return json({ error: 'The site did not answer' }, 502) }
  },
}
