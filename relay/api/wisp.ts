import { server as wisp, logging } from '@mercuryworkshop/wisp-js/server'
import { createServer, type IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { verdict } from './_blocklist.js'
import { expiry, valid } from './_relaytoken.js'

/**
 * The relay's only door: a Wisp server (a WebSocket that carries raw TCP streams, which the page's own TLS runs over, so this server
 * sees which host and port a stream goes to and nothing of what is inside it). Four guards stand in front of it.
 * One: the socket must be opened with a pass minted by Friction (path /wisp/<pass>/), so nobody else can use this.
 * Two: only ports 80 and 443, no UDP, no raw IP addresses (so the name checks cannot be skipped), and private and loopback addresses
 * are refused by Wisp itself. Three: every host name is checked against Friction's blocklist (games, short-form social media). The
 * blocklist works on names here, not paths, because the path is inside the encrypted stream. Wisp's own stream limits are left off: in this version they crash the server.
 */
logging.set_level(logging.WARN)
/** how long a socket may outlive its pass: the page swaps to a new pass when one runs out, and what was in flight gets this long to finish */
const GRACE_MS = 30_000
Object.assign(wisp.options, {
  allow_udp_streams: false,
  allow_direct_ip: false,
  allow_private_ips: false,
  allow_loopback_ips: false,
  port_whitelist: [80, 443],
  // the blacklist is a list of things with a test(name) method; ours asks the blocklist
  hostname_blacklist: [{ test: (host: string) => !verdict(`https://${host}/`).ok }],
})

const server = createServer((_req, res) => {
  res.statusCode = 426
  res.setHeader('content-type', 'application/json')
  res.end('{"error":"This is a Wisp socket and only Friction may open it."}')
})

server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
  const here = new URL(req.url ?? '/', 'http://relay')
  const path = here.searchParams.get('path') ?? ''
  if (!valid(path.split('/')[0])) {
    socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
    return
  }
  // the lease is the meter: when it has run out (and the page did not renew it) the socket is closed
  const stop = setTimeout(() => socket.destroy(), Math.max(0, expiry(path.split('/')[0]) * 1000 + GRACE_MS - Date.now()))
  socket.once('close', () => clearTimeout(stop))
  req.url = '/wisp/'
  wisp.routeRequest(req, socket, head)
})

export default server
