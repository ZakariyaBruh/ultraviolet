import { verdict } from './blocklist'

/**
 * The PC's network (Code window, MS-DOS and FreeDOS): every HTTP request a DOS program makes becomes one call here, from v86's
 * fetch adapter. It is refused when the network is switched off, when Friction's blocklist refuses the address, or when it names a
 * private network or a bare IP; otherwise it goes out through KillCORS, with no cookies, and gives up after 30 seconds.
 *
 * One repair on the way back: a browser's fetch quietly unpacks a body sent with `Content-Encoding: gzip` (ibiblio sends FreeDOS's
 * `index.gz` that way), and v86 then hands DOS plain text under a `.gz` name, which made FDNPKG fail and crash. So a `.gz` address
 * whose body does not start with the gzip bytes is packed again before DOS sees it.
 */
export const KILLCORS = 'https://proxy.killcors.com?url='
export const isPrivate = (h: string) => !h.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(h) || /^\[/.test(h) || /\.(local|internal|lan|home|corp)$/.test(h) || h === 'localhost'
const text = (status: number, why: string) => new Response(why + '\n', { status, statusText: why, headers: { 'content-type': 'text/plain' } })
const GZ = /\.(gz|tgz|gzip)$/i

async function regzip(r: Response, path: string): Promise<Response> {
  if (!GZ.test(path) || !r.ok || typeof CompressionStream === 'undefined') return r
  const body = new Uint8Array(await r.arrayBuffer())
  const headers = new Headers(r.headers)
  headers.delete('content-encoding'); headers.delete('content-length')
  if (body.length >= 2 && body[0] === 0x1f && body[1] === 0x8b) return new Response(body, { status: r.status, statusText: r.statusText, headers })
  const packed = await new Response(new Blob([body]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()
  headers.set('content-type', 'application/gzip')
  return new Response(packed, { status: r.status, statusText: r.statusText, headers })
}

export function guardedFetch(opts: { on: () => boolean; send?: (url: string, init: RequestInit) => Promise<Response> }) {
  const send = opts.send ?? ((url: string, init: RequestInit) => fetch(KILLCORS + encodeURIComponent(url), init))
  return async (url: string, init: RequestInit = {}): Promise<Response> => {
    if (!opts.on()) return text(503, 'The network is off in this window')
    const v = verdict(url)
    if (!v.ok) return text(403, `Friction blocks this kind of site (${v.why})`)
    if (isPrivate(v.url.hostname)) return text(403, 'Private networks are not reachable from here')
    const method = (init.method ?? 'GET').toUpperCase()
    try {
      const r = await send(v.url.toString(), { method, headers: init.headers, body: /^(GET|HEAD)$/.test(method) ? undefined : init.body, credentials: 'omit', redirect: 'follow', signal: AbortSignal.timeout(30000) })
      return await regzip(r, v.url.pathname)
    } catch (e) {
      return text(502, (e as Error)?.name === 'TimeoutError' ? 'The site took longer than 30 seconds' : 'Could not reach the site')
    }
  }
}
