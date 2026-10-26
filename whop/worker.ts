import './shim'
import lb from '../api/lb'
import room from '../api/room'

/**
 * The same app on Whop hosting. Static files in dist/client are served by the platform; this Worker answers the API
 * (the very same two handlers that run on Vercel, against the same Turso database) and hands every other address
 * the app's index page, because routes like /learn are decided in the browser.
 */
declare const __INDEX_HTML__: string
type Env = Record<string, string | undefined>

/** Pages on these hosts may call this API, so the Vercel site can fall back to it. */
const FRIENDS = ['https://frictionx.vercel.app']

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    Object.assign((globalThis as unknown as { process: { env: Env } }).process.env, env)
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      const origin = request.headers.get('origin') ?? ''
      const cors: Record<string, string> = FRIENDS.includes(origin) ? { 'access-control-allow-origin': origin, vary: 'origin' } : {}
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } })
      const handler = url.pathname.startsWith('/api/room') ? room : url.pathname.startsWith('/api/lb') ? lb : null
      if (!handler) return new Response('not found', { status: 404 })
      // the handlers rate-limit by x-forwarded-for; on Cloudflare the visitor's address is in cf-connecting-ip
      const headers = new Headers(request.headers)
      const ip = request.headers.get('cf-connecting-ip')
      if (ip) headers.set('x-forwarded-for', ip)
      const res = await handler.fetch(new Request(request, { headers }))
      const out = new Response(res.body, res)
      for (const [k, v] of Object.entries(cors)) out.headers.set(k, v)
      return out
    }

    // a missing file under /assets must stay a 404, not turn into the app page
    if (url.pathname.startsWith('/assets/')) return new Response('not found', { status: 404 })

    if (request.method === 'GET' || request.method === 'HEAD') {
      return new Response(request.method === 'HEAD' ? null : __INDEX_HTML__, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' } })
    }
    return new Response('not found', { status: 404 })
  },
}
