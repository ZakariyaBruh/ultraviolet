import { createClient, type Client } from '@libsql/client'
import { json } from './_page.js'
import { mint } from './_relaytoken.js'
import { CREATE_DAY, PER_IP, POOL_ROW, SQL_ADD, poolSecs, today, who } from './_pool.js'

/**
 * Hands out passes for the BACKUP cloud browser (Scramjet, alpha, in the separate friction-relay project), used only when both Hyperbeam keys have no
 * free session or do not answer. A pass is a short lease, signed with RELAY_SECRET, which only this project and the relay hold, so the relay serves
 * nobody who did not get one here. The page asks for the next lease only while the cloud browser is on screen and the tab is in front, and the relay
 * cuts a socket a short while after its lease ends, so time is spent only while it is in use. The lease is short (90 s) because it cannot be given back:
 * a refund would let a script keep a pass it had been refunded for. The time is the same time as the main cloud browser's (api/_pool.ts): each address
 * has 30 minutes a day across both and everyone draws on the one shared pool.
 */
const LIFE = 90
const ORIGIN = process.env.RELAY_ORIGIN || 'https://friction-relay.vercel.app'

let db: Client | undefined
const client = () => (db ??= createClient({ url: process.env.TURSO_URL!, authToken: process.env.TURSO_TOKEN! }))

export default {
  async fetch(request: Request) {
    const site = request.headers.get('sec-fetch-site')
    let here = site === 'same-origin'
    if (!site) { try { here = new URL(request.headers.get('referer') ?? '').host === request.headers.get('host') } catch { here = false } }
    if (!here) return json({ error: 'not here' }, 403)
    if (!process.env.RELAY_SECRET || !process.env.TURSO_URL || !process.env.TURSO_TOKEN) return json({ error: 'The relay is not set up' }, 503)
    const ip = (request.headers.get('x-forwarded-for') ?? 'x').split(',')[0].trim()
    try {
      const id = await who(ip)
      const c = client()
      await c.execute(CREATE_DAY)
      const r = await c.execute({ sql: 'SELECT id, secs FROM cloud_day WHERE day = ? AND id IN (?, ?)', args: [today(), id, POOL_ROW] })
      const get = (k: string) => Number(r.rows.find((x) => x.id === k)?.secs ?? 0)
      if (get(id) + LIFE > PER_IP) return json({ error: 'limit' }, 429)
      if (get(POOL_ROW) + LIFE > poolSecs()) return json({ error: 'full' }, 429)
      await c.batch([{ sql: SQL_ADD, args: [id, today(), LIFE] }, { sql: SQL_ADD, args: [POOL_ROW, today(), LIFE] }])
      const t = mint(LIFE)
      return json({ base: ORIGIN, token: t.token, exp: t.exp, left: Math.max(0, PER_IP - get(id) - LIFE) })
    } catch { return json({ error: 'The relay could not check its limit' }, 503) }
  },
}
