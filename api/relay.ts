import { createClient, type Client } from '@libsql/client'
import { json } from './_page.js'
import { mint } from './_relaytoken.js'

/**
 * Hands out passes for the relay (the separate friction-relay project that fetches pages for sites the Browser cannot open on its own).
 * A pass is a lease of 3 minutes, signed with RELAY_SECRET, which only this project and the relay hold, so the
 * relay will not serve anyone who did not get one here. The page asks for the next lease only while the cloud browser is on screen
 * and the tab is in front, and the relay cuts a socket a short while after its lease ends, so time is spent only while it is in use.
 * Each address may be given `PER_IP` seconds of leases a day (30 minutes), and
 * everyone together (`poolSecs`): the monthly budget (`RELAY_MONTHLY_USD`, default $20, the team's credit) less the renderer's worst day (60 minutes at about $0.15 an hour, api/render.ts), divided by the cost of an open-socket hour
 * (`RELAY_HOUR_USD`, default $0.041: $0.035 plus the overlap of old and new sockets at each renewal) and by the days in this month, so a month of full days
 * adds up to the budget. People are not counted: whoever asks first gets time, each address up to 30 minutes, until the day's pool is spent (env
 * `RELAY_DAILY_CAP_H` overrides the sum). Counted in Turso (`cloud_day`, one row for each hashed address,
 * starting over each UTC day). Only the Friction page may ask, and with no Turso it refuses, so it is never unmetered.
 */
const LIFE = 3 * 60
const PER_IP = 30 * 60
const daysThisMonth = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 0)).getUTCDate() }
/** what a minute of the server-side page renderer (api/render.ts, a headless Chromium on 2 GB) costs an hour, and its daily cap in minutes */
const RENDER_HOUR_USD = Number(process.env.RENDER_HOUR_USD) || 0.15
const RENDER_MIN = Number(process.env.RENDER_DAILY_CAP_MIN) || 60
const budgetSecs = () => {
  const days = daysThisMonth()
  // the renderer's worst day is taken off the monthly budget first, so the two together never pass it
  const left = Math.max(0, (Number(process.env.RELAY_MONTHLY_USD) || 20) - (RENDER_MIN / 60) * RENDER_HOUR_USD * days)
  return Math.floor((left / (Number(process.env.RELAY_HOUR_USD) || 0.041) / days) * 3600)
}
const poolSecs = () => (Number(process.env.RELAY_DAILY_CAP_H) ? Number(process.env.RELAY_DAILY_CAP_H) * 3600 : budgetSecs())
const ORIGIN = process.env.RELAY_ORIGIN || 'https://friction-relay.vercel.app'

let db: Client | undefined
const client = () => (db ??= createClient({ url: process.env.TURSO_URL!, authToken: process.env.TURSO_TOKEN! }))
const today = () => new Date().toISOString().slice(0, 10)
/** an IPv6 address is a whole /64 to its owner, who can change the last half at will, so the allowance goes by the first half */
const net = (ip: string) => (ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip)
async function who(ip: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`relay4:${net(ip)}`))
  return `r${Array.from(new Uint8Array(h)).slice(0, 9).map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

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
      await c.execute('CREATE TABLE IF NOT EXISTS cloud_day (id TEXT PRIMARY KEY, day TEXT NOT NULL, secs REAL NOT NULL DEFAULT 0)')
      const r = await c.execute({ sql: 'SELECT id, secs FROM cloud_day WHERE day = ? AND id IN (?, ?)', args: [today(), id, 'RELAY4'] })
      const get = (k: string) => Number(r.rows.find((x) => x.id === k)?.secs ?? 0)
      if (get(id) + LIFE > PER_IP) return json({ error: 'limit' }, 429)
      if (get('RELAY4') + LIFE > poolSecs()) return json({ error: 'full' }, 429)
      const sql = 'INSERT INTO cloud_day (id, day, secs) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET secs = CASE WHEN day = excluded.day THEN secs + excluded.secs ELSE excluded.secs END, day = excluded.day'
      await c.batch([{ sql, args: [id, today(), LIFE] }, { sql, args: ['RELAY4', today(), LIFE] }])
      const t = mint(LIFE)
      return json({ base: ORIGIN, token: t.token, exp: t.exp, left: Math.max(0, PER_IP - get(id) - LIFE) })
    } catch { return json({ error: 'The relay could not check its limit' }, 503) }
  },
}
