import { verdict } from './_blocklist.js'

/**
 * The Browser window's server side. Two jobs, both read-only and neither storing anything:
 *  - `?q=words`: a web search (DuckDuckGo's plain page, Bing's as a backup) turned into a short list of results;
 *  - `?u=address`: the page at that address as cleaned HTML (no scripts, frames or forms that post), for the window to show in
 *    a sealed frame. Every address, and every redirect on the way, is checked against the blocklist (games, short-form social
 *    media) and against private networks, so the window cannot be used to reach either.
 */
const reply = (body: string, status = 200, type = 'application/json', cache = 'no-store') => new Response(body, { status, headers: { 'content-type': type, 'cache-control': cache } })
const json = (o: unknown, status = 200, cache = 'no-store') => reply(JSON.stringify(o), status, 'application/json', cache)
const UA = 'Mozilla/5.0 (compatible; FrictionBrowser/1.0; +https://frictionx.vercel.app)'
const MAX = 2_500_000

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

async function fetchPage(start: string): Promise<{ url: string; html: string } | { error: string; why?: string }> {
  let url = start
  for (let hop = 0; hop < 5; hop++) {
    const v = verdict(url)
    if (!v.ok) return { error: 'blocked', why: v.why }
    if (internal(v.url.hostname)) return { error: 'blocked', why: 'not a web page' }
    const r = await fetch(v.url, { redirect: 'manual', headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'accept-language': 'en' }, signal: AbortSignal.timeout(12000) })
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location')!, v.url).toString(); continue }
    if (!r.ok) return { error: `The site answered ${r.status}` }
    const type = r.headers.get('content-type') ?? ''
    if (!/html|xml/i.test(type)) return { error: 'This is a file, not a page', why: 'not a web page' }
    const buf = await r.arrayBuffer()
    if (buf.byteLength > MAX) return { error: 'That page is too big' }
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

const decode = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
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
  const re = /<li class="b_algo"[\s\S]*?<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>([\s\S]*?)<\/li>/g
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

export default {
  async fetch(request: Request) {
    const site = request.headers.get('sec-fetch-site')
    if (site && site !== 'same-origin' && site !== 'none') return json({ error: 'not here' }, 403)
    const ip = (request.headers.get('x-forwarded-for') ?? 'x').split(',')[0].trim()
    if (limited(`ip:${ip}`, 240, 3600e3)) return json({ error: 'slow down' }, 429)
    const p = new URL(request.url).searchParams
    const q = (p.get('q') ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120)
    if (q) {
      try {
        const results = await Promise.any([ddg(q), new Promise<Hit[]>((res, rej) => setTimeout(() => bing(q).then(res, rej), 2500))])
        // a result that points at a blocked site is dropped, so the list never offers one
        return json({ results: results.filter((x) => verdict(x.url).ok) }, 200, 'public, s-maxage=600')
      } catch { return json({ error: 'search busy' }, 502) }
    }
    const u = p.get('u') ?? ''
    if (!u) return json({ error: 'bad' }, 400)
    try {
      const got = await fetchPage(u)
      if ('error' in got) return json(got, got.error === 'blocked' ? 403 : 502)
      return json({ url: got.url, html: clean(got.html, got.url) }, 200, 'public, s-maxage=300')
    } catch { return json({ error: 'The site did not answer' }, 502) }
  },
}
