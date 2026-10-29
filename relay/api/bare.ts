import { createBareServer } from '@tomphttp/bare-server-node'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
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
    if (!/^(https?|wss?):$/.test(url.protocol) || PRIVATE(url.hostname)) throw new RangeError('Forbidden address')
    // a WebSocket is checked as the page it belongs to
    const v = verdict(url.toString().replace(/^ws/, 'http'))
    if ('why' in v) throw new RangeError(`Blocked: ${v.why}`)
  },
})

/** the pass is the first part of the path after /bare/ (the rewrite in vercel.json hands the whole path over as ?path=); null when it is wrong */
function strip(req: IncomingMessage): boolean {
  const here = new URL(req.url ?? '/', 'http://relay')
  const path = here.searchParams.get('path') ?? ''
  const cut = path.indexOf('/')
  if (!valid(cut < 0 ? path : path.slice(0, cut))) return false
  here.searchParams.delete('path')
  req.url = `/bare/${cut < 0 ? '' : path.slice(cut + 1)}${here.search}`
  return true
}

const NO = '{"error":"This relay is only for Friction. Reload the page in Friction to get a new pass."}'

/** a server, not a plain handler, because pages open WebSockets (Discord's gateway, chat) and Vercel Functions can upgrade them */
const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (!strip(req)) {
    res.statusCode = 401
    res.setHeader('content-type', 'application/json')
    res.setHeader('cache-control', 'no-store')
    res.end(NO)
    return
  }
  if (bare.shouldRoute(req)) bare.routeRequest(req, res)
  else { res.statusCode = 404; res.end() }
})

server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
  if (!strip(req) || !bare.shouldRoute(req)) {
    socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
    return
  }
  bare.routeUpgrade(req, socket, head)
})

export default server
