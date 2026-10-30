/**
 * What the two page endpoints share: the address checks, the clean-up that turns a page into something safe to show in a sealed frame,
 * and the measure of whether a page has anything to read. Files starting with an underscore are not routes.
 */
export const UA = 'Mozilla/5.0 (compatible; FrictionBrowser/1.0; +https://frictionx.vercel.app)'
/** the raw page we will read (most of a heavy page is scripts, which are removed), and the most we send back (a function reply holds 4.5 MB) */
export const RAW = 8_000_000
export const MAX = 3_300_000
/** a cleaned page with less readable text than this is a shell that needs scripts to show anything */
export const THIN = 300

/** private networks and the machine itself are never fetched */
export function internal(host: string) {
  const h = host.toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.')) return true
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return true // an address, not a name
  if (h.includes(':') || h.startsWith('[')) return true
  return false
}

/** takes out everything that can run or phone home, and makes addresses absolute so images and styles still load */
export function clean(html: string, base: string, live = false, snapshot = false): string {
  let h = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(live ? /<(iframe|object|embed|applet|template|portal)\b[\s\S]*?<\/\1\s*>/gi : /<(script|iframe|object|embed|applet|template|portal)\b[\s\S]*?<\/\1\s*>/gi, '')
    // a page's own scripts do not run here, so what it keeps for browsers without scripts is what we show: a lone image is the
    // usual lazy-loading fallback (the image is given its address below instead) and a short "enable JavaScript" notice is of no use
    .replace(/<noscript\b[^>]*>([\s\S]*?)<\/noscript\s*>/gi, (_m, inner: string) => {
      if (live || snapshot) return '' // the scripts run in the person's browser (or already ran on our server), so what a page keeps for when they cannot is not wanted
      const words = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      return /^\s*<img\b[^>]*>\s*$/i.test(inner) || (words.length < 300 && /javascript/i.test(words)) ? '' : inner
    })
    .replace(/<\/?noscript\b[^>]*>/gi, '')
    // images that wait for a script to be given their address get it now
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const m = /\sdata-(?:src|lazy-src|original)\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(tag)
      const url = m?.[1] ?? m?.[2]
      return url ? tag.replace(/\ssrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '').replace(/^<img/i, `<img src="${url.replace(/"/g, '&quot;')}"`) : tag
    })
    .replace(live ? /<(iframe|object|embed|applet|portal|link\s+[^>]*rel=["']?(?:preload|prefetch|modulepreload|dns-prefetch|preconnect)[^>]*)\b[^>]*>/gi : /<(script|iframe|object|embed|applet|portal|link\s+[^>]*rel=["']?(?:preload|prefetch|modulepreload|dns-prefetch|preconnect)[^>]*)\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*http-equiv=["']?(?:refresh|content-security-policy)[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    .replace(live ? /\s(srcdoc|formaction|ping)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi : /\s(on[a-z]+|srcdoc|formaction|ping)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|action|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=$2#$2')
  const head = `<base href="${base.replace(/"/g, '&quot;')}">`
  h = /<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, (m) => `${m}${head}`) : `${head}${h}`
  return h.length > MAX ? h.slice(0, MAX) : h
}

/** how much a person could read on a cleaned page */
export const readable = (html: string) => html.replace(/<(style|head|svg|template)\b[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[#\w]+;/g, ' ').replace(/\s+/g, ' ').trim().length

export const reply = (body: string, status = 200, type = 'application/json', cache = 'no-store') => new Response(body, { status, headers: { 'content-type': type, 'cache-control': cache } })
export const json = (o: unknown, status = 200, cache = 'no-store') => reply(JSON.stringify(o), status, 'application/json', cache)

const hits = new Map<string, { n: number; at: number }>()
export function limited(id: string, max: number, windowMs: number) {
  const now = Date.now()
  const h = hits.get(id)
  if (!h || now - h.at > windowMs) { hits.set(id, { n: 1, at: now }); if (hits.size > 8000) hits.clear(); return false }
  return ++h.n > max
}
