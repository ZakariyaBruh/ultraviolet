import { createBareServer } from '@tomphttp/bare-server-node'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { verdict } from './_blocklist.js'
import { valid } from './_relaytoken.js'

/**
 * The relay's only door: a Bare server (the part of Ultraviolet that fetches pages for the browser). Three guards stand in front of it.
 * One: a request must carry a token minted by Friction (path /bare/<token>/...), so nobody else can use
 * this. Two: every address passes Friction's blocklist (games, short-form social media) and private networks are refused, however the
 * page got there. Three: the Bare server itself refuses names that resolve to private addresses. It sends no cookies or anything else
 * of its own, keeps nothing, and fetches with the headers the person's browser gave it.
 */
const PRIVATE = (host: string) => {
  const h = host.toLowerCase()
  return h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':') || h.startsWith('[')
}
const bare = createBareServer('/bare/', {
  logErrors: true,
  filterRemote(url: URL) {
    if (!/^https?:$/.test(url.protocol) || PRIVATE(url.hostname)) throw new RangeError('Forbidden address')
    const v = verdict(url.toString())
    if ('why' in v) throw new RangeError(`Blocked: ${v.why}`)
  },
})

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const here = new URL(req.url ?? '/', 'http://relay')
  const path = here.searchParams.get('path') ?? ''
  const cut = path.indexOf('/')
  const token = cut < 0 ? path : path.slice(0, cut)
  if (!valid(token)) {
    res.statusCode = 401
    res.setHeader('content-type', 'application/json')
    res.setHeader('cache-control', 'no-store')
    res.end('{"error":"This relay is only for Friction. Reload the page in Friction to get a new pass."}')
    return
  }
  here.searchParams.delete('path')
  req.url = `/bare/${cut < 0 ? '' : path.slice(cut + 1)}${here.search}`
  if (bare.shouldRoute(req)) bare.routeRequest(req, res)
  else { res.statusCode = 404; res.end() }
}
