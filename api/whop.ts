/**
 * Sign in with Whop, for supporters. Friction has no accounts and keeps no record of who paid, so this does one thing: it lets someone prove, on a
 * new browser or a new device, that they have an active "Support Friction" membership on Whop, and Friction then switches the supporter flag on in
 * that browser. Nothing is stored here: no Whop id, no email, no token.
 *
 * It is Whop's OAuth (OAuth 2.1 with PKCE, a public client, so there is no secret to keep): the browser sends the person to Whop, Whop sends them
 * back with a one-time `code`, and this function exchanges that code (with the browser's `code_verifier`) for a token that belongs to that person,
 * asks Whop whether they have an active membership of the product, throws the token away (and revokes it) and answers yes or no.
 *
 * Needs on Vercel: `WHOP_CLIENT_ID` (the `app_...` id of an app made in Whop's developer dashboard, with the Support page as a redirect URI).
 * Optional: `WHOP_SCOPE` (default `openid member:basic:read`), `WHOP_PRODUCT` (default the Support Friction product). Without the id the button is
 * not shown. The id is public by design; no secret and no API key is used or needed.
 */
const PRODUCT = 'prod_P4AJ4KOffbiD0'
const API = 'https://api.whop.com'
const OK_STATES = ['active', 'trialing', 'canceling', 'expiring', 'past_due']
/** where Whop may send a person back to: this site's Support screen (and the local dev server) */
const REDIRECTS = /^(https:\/\/(www\.)?frictionx\.app|http:\/\/localhost:\d{2,5})\/support$/

const json = (body: unknown, status = 200, cache = 'no-store') => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': cache } })

async function whop(path: string, init: RequestInit & { token?: string } = {}) {
  const { token, ...rest } = init
  const ctl = AbortSignal.timeout(12_000)
  return fetch(API + path, { ...rest, signal: ctl, headers: { ...(rest.headers || {}), ...(token ? { authorization: `Bearer ${token}` } : {}) } })
}

export default {
  async fetch(request: Request) {
    const site = request.headers.get('sec-fetch-site')
    if (site && site !== 'same-origin' && site !== 'none') return json({ error: 'not here' }, 403)
    const client = (process.env.WHOP_CLIENT_ID || '').trim()
    const scope = (process.env.WHOP_SCOPE || 'openid member:basic:read').trim()
    const product = (process.env.WHOP_PRODUCT || PRODUCT).trim()

    // the page asks whether sign-in is set up, and for what to send to Whop
    if (request.method === 'GET') {
      if (!/^app_[A-Za-z0-9]+$/.test(client)) return json({ on: false }, 200, 'public, s-maxage=300')
      return json({ on: true, client, scope }, 200, 'public, s-maxage=300, stale-while-revalidate=3600')
    }
    if (request.method !== 'POST') return json({ error: 'method' }, 405)
    if (!/^app_[A-Za-z0-9]+$/.test(client)) return json({ error: 'off' }, 503)

    let body: { code?: unknown; verifier?: unknown; redirect?: unknown }
    try { body = await request.json() } catch { return json({ error: 'bad' }, 400) }
    const code = typeof body.code === 'string' ? body.code : ''
    const verifier = typeof body.verifier === 'string' ? body.verifier : ''
    const redirect = typeof body.redirect === 'string' ? body.redirect : ''
    if (!code || code.length > 2000 || verifier.length < 43 || verifier.length > 128 || !REDIRECTS.test(redirect)) return json({ error: 'bad' }, 400)

    let token = ''
    try {
      const r = await whop('/oauth/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: redirect, client_id: client, code_verifier: verifier }) })
      if (!r.ok) return json({ error: 'code' }, 400)
      const t = (await r.json()) as { access_token?: string }
      token = typeof t.access_token === 'string' ? t.access_token : ''
      if (!token) return json({ error: 'code' }, 400)

      const q = new URLSearchParams({ user_id: 'me', first: '20' })
      q.append('product_ids', product)
      for (const s of OK_STATES) q.append('statuses', s)
      const m = await whop(`/api/v1/memberships?${q}`, { token })
      if (m.status === 403) return json({ error: 'scope' }, 502) // the app was not given member:basic:read
      if (!m.ok) return json({ error: 'whop' }, 502)
      const list = (await m.json()) as { data?: { product_id?: string; product?: { id?: string }; status?: string }[] }
      const supporter = (list.data || []).some((x) => (x.product_id === product || x.product?.id === product) && OK_STATES.includes(String(x.status)))
      return json({ ok: true, supporter })
    } catch {
      return json({ error: 'whop' }, 502)
    } finally {
      // nothing of theirs is kept: the token is given back as soon as it has answered
      if (token) void whop('/oauth/revoke', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, client_id: client }) }).catch(() => {})
    }
  },
}
