import { FEED_URLS } from './_feeds.js'

/**
 * A feed relay for the News screen. Most publishers do not let a browser read their RSS, and the free public relays answer only
 * now and then, so this reads the feed on the server and hands it back. It only fetches addresses that are in the app's own list
 * of feeds (`FEEDS`), so it cannot be used to reach anything else, and it keeps no data. Good answers are cached for 15 minutes
 * at the edge, so each feed is fetched about four times an hour however many people read it.
 */
const ALLOWED = new Set(FEED_URLS)
const MAX = 3_000_000

const reply = (body: string, status = 200, cache = 'no-store', type = 'text/plain; charset=utf-8') => new Response(body, { status, headers: { 'content-type': type, 'cache-control': cache } })

export default {
  async fetch(request: Request) {
    const site = request.headers.get('sec-fetch-site')
    if (site && site !== 'same-origin' && site !== 'none') return reply('not here', 403)
    const u = new URL(request.url).searchParams.get('u') ?? ''
    if (!ALLOWED.has(u)) return reply('unknown feed', 400)
    try {
      const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Friction feed reader)', accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' }, redirect: 'follow', signal: AbortSignal.timeout(8000) })
      if (!r.ok) return reply('feed answered ' + r.status, 502)
      const text = await r.text()
      if (text.length > MAX || !/<(rss|feed|rdf)/i.test(text.slice(0, 4000))) return reply('not a feed', 502)
      return reply(text, 200, 'public, s-maxage=900, stale-while-revalidate=3600', 'application/xml; charset=utf-8')
    } catch { return reply('feed unreachable', 502) }
  },
}
