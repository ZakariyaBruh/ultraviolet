import { verdict } from './_blocklist.js'

/**
 * The Browser window's server side. Two jobs, both read-only and neither storing anything:
 *  - `?q=words&e=google|bing|duckduckgo`: a web search on the engine the person chose, turned into a short list of results. Google
 *    is read through its official Programmable Search API (env `GOOGLE_API_KEY` and `GOOGLE_CX`; its ordinary result page needs a
 *    full browser with scripts and is not served to a server). Bing and DuckDuckGo are read from their plain result pages. If the
 *    chosen engine fails, or Google is not set up, the next one answers and the reply says which did;
 *  - `?u=address`: the page at that address as cleaned HTML (no scripts, frames or forms that post), for the window to show in
 *    a sealed frame. Every address, and every redirect on the way, is checked against the blocklist (games, short-form social
 *    media) and against private networks, so the window cannot be used to reach either. A site that refuses our server (403) is
 *    reported as such rather than worked around, and a page that is only a shell for scripts is flagged `thin`.
 */
const reply = (body: string, status = 200, type = 'application/json', cache = 'no-store') => new Response(body, { status, headers: { 'content-type': type, 'cache-control': cache } })
const json = (o: unknown, status = 200, cache = 'no-store') => reply(JSON.stringify(o), status, 'application/json', cache)
const UA = 'Mozilla/5.0 (compatible; FrictionBrowser/1.0; +https://frictionx.vercel.app)'
/** the raw page we will read (most of a heavy page is scripts, which are removed), and the most we send back (a function reply holds 4.5 MB) */
const RAW = 8_000_000
const MAX = 3_300_000
/** a cleaned page with less readable text than this is a shell that needs scripts to show anything */
const THIN = 300

const hits = new Map<string, { n: number; at: number }>()
function limited(id: string, max: number, windowMs: number) {
  const now = Date.now()
  const h = hits.get(id)
  if (!h || now - h.at > windowMs) { hits.set(id, { n: 1, at: now }); if (hits.size > 8000) hits.clear(); return false }
  return ++h.n > max
}

/** private networks and the machine itself are never fetched */
function internal(host: string) {
  const h = host.toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.')) return true
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return true // an address, not a name
  if (h.includes(':') || h.startsWith('[')) return true
  return false
}

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

/** takes out everything that can run or phone home, and makes addresses absolute so images and styles still load */
export function clean(html: string, base: string): string {
  let h = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|iframe|object|embed|applet|noscript|template|portal)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|iframe|object|embed|applet|portal|link\s+[^>]*rel=["']?(?:preload|prefetch|modulepreload|dns-prefetch|preconnect)[^>]*)\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*http-equiv=["']?(?:refresh|content-security-policy)[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/\s(on[a-z]+|srcdoc|formaction|ping)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|action|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=$2#$2')
  const head = `<base href="${base.replace(/"/g, '&quot;')}">`
  h = /<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, (m) => `${m}${head}`) : `${head}${h}`
  return h.length > MAX ? h.slice(0, MAX) : h
}

/** how much a person could read on a cleaned page */
const readable = (html: string) => html.replace(/<(style|head|svg|template)\b[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[#\w]+;/g, ' ').replace(/\s+/g, ' ').trim().length

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
    const u = p.get('u') ?? ''
    if (!u) return json({ error: 'bad' }, 400)
    try {
      const got = await fetchPage(u)
      if ('error' in got) return json(got, got.error === 'blocked' ? 403 : 502)
      const html = clean(got.html, got.url)
      return json({ url: got.url, html, thin: readable(html) < THIN }, 200, 'public, s-maxage=300')
    } catch { return json({ error: 'The site did not answer' }, 502) }
  },
}
