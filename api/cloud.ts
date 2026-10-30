import { createClient, type Client } from '@libsql/client'
import { json } from './_page.js'
import { verdict } from './_blocklist.js'

/**
 * The cloud browser: a real Chromium on Hyperbeam (hyperbeam.com), streamed into the Browser window. It runs the page's scripts, passes sign-in and
 * most checks as an ordinary browser would, and uses none of the device's own thread. Our part is to start it, meter it and end it.
 *
 * The key (env `HYPERBEAM_API_KEY`, set on Vercel, never in git or the client) stays here. The page gets only the session's embed address and admin
 * token, which work for that one session. A session is paid for by the minute, and Hyperbeam has no hard time limit we can set, so time is leased
 * here in `LIFE` chunks, charged up front: `start` takes the first, `beat` (every 15 s from the page) takes the next when one is nearly spent,
 * `end` gives back what was not used, and a cron (`?sweep=1`, every minute, with `CRON_SECRET`) closes any session whose lease ran out or whose page
 * stopped answering. `offline_timeout` (90 s, the smallest allowed is 60) is the backstop if even that fails: a session with nobody watching closes by itself.
 *
 * Each address may use `PER_IP` seconds a day (30 minutes), and everyone together the day's pool (`HB_DAILY_CAP_MIN`, default 60): whoever asks first
 * gets time until it is spent, people are not counted. At most `HB_MAX_ACTIVE` sessions run at once. Counted in Turso (`cloud_day`, one row for each
 * hashed address and one for everyone, starting over each UTC day; `cloud_sess`, one row for each open session, deleted when it closes). Same-origin
 * only, and with no Turso or key it refuses, so it is never unmetered.
 */
const LIFE = 3 * 60
const PER_IP = 30 * 60
const ALL = (Number(process.env.HB_DAILY_CAP_MIN) || 60) * 60
const MAX_ACTIVE = Number(process.env.HB_MAX_ACTIVE) || 3
const API = 'https://engine.hyperbeam.com/v0'
const POOL = 'HB1'

let db: Client | undefined
const client = () => (db ??= createClient({ url: process.env.TURSO_URL!, authToken: process.env.TURSO_TOKEN! }))
const today = () => new Date().toISOString().slice(0, 10)
const now = () => Math.floor(Date.now() / 1000)
const net = (ip: string) => (ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip)
async function who(ip: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`hb1:${net(ip)}`))
  return `h${Array.from(new Uint8Array(h)).slice(0, 9).map((b) => b.toString(16).padStart(2, '0')).join('')}`
}
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
const hb = (path: string, init?: RequestInit) => fetch(API + path, { ...init, headers: { authorization: `Bearer ${process.env.HYPERBEAM_API_KEY}`, 'content-type': 'application/json', ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(15000) })

const SQL_ADD = 'INSERT INTO cloud_day (id, day, secs) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET secs = CASE WHEN day = excluded.day THEN secs + excluded.secs ELSE excluded.secs END, day = excluded.day'
const SQL_BACK = 'UPDATE cloud_day SET secs = MAX(0, secs - ?) WHERE id = ? AND day = ?'

async function setup(c: Client) {
  await c.execute('CREATE TABLE IF NOT EXISTS cloud_day (id TEXT PRIMARY KEY, day TEXT NOT NULL, secs REAL NOT NULL DEFAULT 0)')
  await c.execute('CREATE TABLE IF NOT EXISTS cloud_sess (sid TEXT PRIMARY KEY, who TEXT NOT NULL, ticket TEXT NOT NULL, deadline INTEGER NOT NULL, beat INTEGER NOT NULL, day TEXT NOT NULL)')
}
async function used(c: Client, id: string) {
  const r = await c.execute({ sql: 'SELECT id, secs FROM cloud_day WHERE day = ? AND id IN (?, ?)', args: [today(), id, POOL] })
  const get = (k: string) => Number(r.rows.find((x) => x.id === k)?.secs ?? 0)
  return { me: get(id), all: get(POOL) }
}
/** closes one session at Hyperbeam and gives back the time it did not use */
async function close(c: Client, sid: string, who: string, deadline: number, day: string) {
  await hb(`/vm/${encodeURIComponent(sid)}`, { method: 'DELETE' }).catch(() => {})
  const back = Math.max(0, deadline - now())
  const batch = [{ sql: 'DELETE FROM cloud_sess WHERE sid = ?', args: [sid] }]
  if (back > 0) batch.push({ sql: SQL_BACK, args: [back, who, day] }, { sql: SQL_BACK, args: [back, POOL, day] })
  await c.batch(batch)
}
/** every session whose lease is over or whose page went quiet */
async function reap(c: Client) {
  const r = await c.execute({ sql: 'SELECT sid, who, deadline, day FROM cloud_sess WHERE deadline < ? OR beat < ?', args: [now() - 5, now() - 75] })
  for (const x of r.rows) await close(c, String(x.sid), String(x.who), Number(x.deadline), String(x.day))
  return r.rows.length
}

export default {
  async fetch(request: Request) {
    const url = new URL(request.url)
    if (!process.env.HYPERBEAM_API_KEY || !process.env.TURSO_URL || !process.env.TURSO_TOKEN) return json({ error: 'The cloud browser is not set up' }, 503)

    // the cron: Vercel sends the secret as a bearer token
    if (url.searchParams.get('sweep') === '1') {
      if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return json({ error: 'no' }, 401)
      try { const c = client(); await setup(c); return json({ closed: await reap(c) }) } catch { return json({ error: 'sweep failed' }, 500) }
    }

    const site = request.headers.get('sec-fetch-site')
    let here = site === 'same-origin'
    if (!site) { try { here = new URL(request.headers.get('referer') ?? '').host === request.headers.get('host') } catch { here = false } }
    if (!here || request.method !== 'POST') return json({ error: 'not here' }, 403)
    const body = (await request.json().catch(() => null)) as { a?: string; u?: string; sid?: string; ticket?: string } | null
    if (!body) return json({ error: 'bad' }, 400)
    const ip = (request.headers.get('x-forwarded-for') ?? 'x').split(',')[0].trim()

    try {
      const c = client()
      await setup(c)
      const id = await who(ip)
      await reap(c).catch(() => {})
      const left = async () => { const u = await used(c, id); return { ip: Math.max(0, PER_IP - u.me), pool: Math.max(0, ALL - u.all) } }

      if (body.a === 'start') {
        const v = verdict(body.u ?? '')
        if (!v.ok) return json({ error: 'blocked', why: 'why' in v ? v.why : 'not a web page' }, 403)
        const l = await left()
        if (l.ip < LIFE) return json({ error: 'limit' }, 429)
        if (l.pool < LIFE) return json({ error: 'full' }, 429)
        const open = await c.execute({ sql: 'SELECT COUNT(*) AS n FROM cloud_sess WHERE deadline >= ?', args: [now()] })
        if (Number(open.rows[0]?.n ?? 0) >= MAX_ACTIVE) return json({ error: 'busy' }, 429)
        // the time is taken first and given back if the browser does not start
        await c.batch([{ sql: SQL_ADD, args: [id, today(), LIFE] }, { sql: SQL_ADD, args: [POOL, today(), LIFE] }])
        let made: { session_id?: string; embed_url?: string; admin_token?: string } | null = null
        try {
          const r = await hb('/vm', { method: 'POST', body: JSON.stringify({ start_url: v.url.toString(), offline_timeout: 90, ublock: true, width: 1280, height: 720 }) })
          made = r.ok ? ((await r.json()) as typeof made) : null
        } catch { made = null }
        if (!made?.session_id || !made.embed_url) {
          await c.batch([{ sql: SQL_BACK, args: [LIFE, id, today()] }, { sql: SQL_BACK, args: [LIFE, POOL, today()] }])
          return json({ error: 'down' }, 502)
        }
        const ticket = token()
        const deadline = now() + LIFE
        await c.execute({ sql: 'INSERT INTO cloud_sess (sid, who, ticket, deadline, beat, day) VALUES (?, ?, ?, ?, ?, ?)', args: [made.session_id, id, ticket, deadline, now(), today()] })
        return json({ sid: made.session_id, ticket, embed: made.embed_url, admin: made.admin_token, exp: deadline, left: l.ip - LIFE })
      }

      // beat and end belong to the session's own page
      const row = await c.execute({ sql: 'SELECT sid, who, ticket, deadline, day FROM cloud_sess WHERE sid = ?', args: [body.sid ?? ''] })
      const s = row.rows[0]
      if (!s || s.ticket !== body.ticket) return json({ error: 'gone' }, 410)
      const sid = String(s.sid)
      const deadline = Number(s.deadline)

      if (body.a === 'end') { await close(c, sid, String(s.who), deadline, String(s.day)); return json({ ok: true }) }

      if (body.a === 'beat') {
        let next = deadline
        // the next chunk is taken when this one is nearly spent, if there is any left
        if (deadline - now() <= 25) {
          const l = await left()
          if (l.ip >= LIFE && l.pool >= LIFE && s.day === today()) {
            await c.batch([{ sql: SQL_ADD, args: [String(s.who), today(), LIFE] }, { sql: SQL_ADD, args: [POOL, today(), LIFE] }])
            next = deadline + LIFE
          }
        }
        await c.execute({ sql: 'UPDATE cloud_sess SET beat = ?, deadline = ? WHERE sid = ?', args: [now(), next, sid] })
        const l = await left()
        return json({ exp: next, left: l.ip, ending: next <= now() + 5 })
      }
      return json({ error: 'bad' }, 400)
    } catch { return json({ error: 'The cloud browser could not check its limit' }, 503) }
  },
}
