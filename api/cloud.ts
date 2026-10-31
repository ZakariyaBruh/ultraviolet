import { createClient, type Client } from '@libsql/client'
import { json } from './_page.js'
import { verdict } from './_blocklist.js'
import { CREATE_DAY, PER_IP, POOL_ROW, SQL_ADD, SQL_BACK, poolSecs, today, who } from './_pool.js'

/**
 * The cloud browser: a real Chromium on Hyperbeam (hyperbeam.com), streamed into the Browser window. It runs the page's scripts, passes sign-in and
 * most checks as an ordinary browser would, and uses none of the device's own thread. Our part is to start it, meter it and end it.
 *
 * Two keys, tried in order (env on Vercel, never in git or the client; the page only gets one session's embed address and admin token):
 *   1. `HYPERBEAM_API_KEY`   the main account: up to `HB_MAX_ACTIVE` (10) sessions at once and about 10,000 free minutes a month. Used until its
 *                            month is spent (`FREE_MIN`, kept below by `MARGIN`), a start is refused for quota (then it is set aside until next month),
 *                            or its sessions are all busy.
 *   2. `HYPERBEAM_API_KEY_2` the spare account: no usage limit but only `HB_MAX_ACTIVE_2` (2) sessions at once.
 * When neither has a free session the answer is `busy` and the page opens the Scramjet backup instead (api/relay.ts), with a warning.
 *
 * Hyperbeam has no hard time limit to set, so time is leased here in `LIFE` chunks, charged up front: `start` takes the first, `beat` (every 15 s
 * from the page) takes the next when one is nearly spent, `end` gives back what was not used, and a cron (`?sweep=1`, every minute, `CRON_SECRET`)
 * closes any session whose lease ran out or whose page stopped answering. `offline_timeout` (90 s; the smallest allowed is 60) is the last backstop.
 * Each address may use 30 minutes a day across both keys and the backup, and everyone draws on one shared daily pool (api/_pool.ts), so time
 * someone leaves unused is there for the next person. Counted in Turso (`cloud_day`: one row for each hashed address, `POOL1` for the pool, `HBM1` for the main key's month; `cloud_sess`: one row for each open session, deleted when it closes). Same-origin only, and with no Turso
 * or key it refuses, so it is never unmetered.
 */
const LIFE = 3 * 60
const FREE_MIN = Number(process.env.HB_FREE_MIN) || 10_000
const MARGIN = 0.93
const API = 'https://engine.hyperbeam.com/v0'
const MONTH_ROW = 'HBM1'
const FLAG_ROW = 'HBX1'

type Tier = 1 | 2
const keyOf = (t: Tier) => (t === 1 ? process.env.HYPERBEAM_API_KEY : process.env.HYPERBEAM_API_KEY_2)
const maxOf = (t: Tier) => (t === 1 ? Number(process.env.HB_MAX_ACTIVE) || 10 : Number(process.env.HB_MAX_ACTIVE_2) || 2)

let db: Client | undefined
const client = () => (db ??= createClient({ url: process.env.TURSO_URL!, authToken: process.env.TURSO_TOKEN! }))
const month = () => new Date().toISOString().slice(0, 7)
const now = () => Math.floor(Date.now() / 1000)
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
const hb = (t: Tier, path: string, init?: RequestInit) => fetch(API + path, { ...init, headers: { authorization: `Bearer ${keyOf(t)}`, 'content-type': 'application/json', ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(15000) })

/** the month row is kept for the main key only; the second key has no usage limit to count against */
const addTime = (who: string, tier: Tier) => [{ sql: SQL_ADD, args: [who, today(), LIFE] }, { sql: SQL_ADD, args: [POOL_ROW, today(), LIFE] }, ...(tier === 1 ? [{ sql: SQL_ADD, args: [MONTH_ROW, month(), LIFE] }] : [])]

async function setup(c: Client) {
  await c.execute(CREATE_DAY)
  await c.execute('CREATE TABLE IF NOT EXISTS cloud_sess (sid TEXT PRIMARY KEY, who TEXT NOT NULL, ticket TEXT NOT NULL, deadline INTEGER NOT NULL, beat INTEGER NOT NULL, day TEXT NOT NULL, tier INTEGER NOT NULL DEFAULT 1)')
  await c.execute('ALTER TABLE cloud_sess ADD COLUMN tier INTEGER NOT NULL DEFAULT 1').catch(() => {})
}
async function usedBy(c: Client, id: string) {
  const r = await c.execute({ sql: 'SELECT secs FROM cloud_day WHERE id = ? AND day = ?', args: [id, today()] })
  return Number(r.rows[0]?.secs ?? 0)
}
async function poolLeft(c: Client) {
  const r = await c.execute({ sql: 'SELECT secs FROM cloud_day WHERE id = ? AND day = ?', args: [POOL_ROW, today()] })
  return Math.max(0, poolSecs() - Number(r.rows[0]?.secs ?? 0))
}
async function monthUsed(c: Client) {
  const r = await c.execute({ sql: 'SELECT id, secs FROM cloud_day WHERE day = ? AND id IN (?, ?)', args: [month(), MONTH_ROW, FLAG_ROW] })
  return { secs: Number(r.rows.find((x) => x.id === MONTH_ROW)?.secs ?? 0), refused: r.rows.some((x) => x.id === FLAG_ROW) }
}
/** closes one session at Hyperbeam and gives back the time it did not use */
async function close(c: Client, sid: string, who: string, deadline: number, day: string, tier: Tier) {
  await hb(tier, `/vm/${encodeURIComponent(sid)}`, { method: 'DELETE' }).catch(() => {})
  const back = Math.max(0, deadline - now())
  const batch: { sql: string; args: (string | number)[] }[] = [{ sql: 'DELETE FROM cloud_sess WHERE sid = ?', args: [sid] }]
  if (back > 0) {
    batch.push({ sql: SQL_BACK, args: [back, who, day] }, { sql: SQL_BACK, args: [back, POOL_ROW, day] })
    if (tier === 1) batch.push({ sql: SQL_BACK, args: [back, MONTH_ROW, month()] })
  }
  await c.batch(batch)
}
/** every session whose lease is over or whose page went quiet */
async function reap(c: Client) {
  const r = await c.execute({ sql: 'SELECT sid, who, deadline, day, tier FROM cloud_sess WHERE deadline < ? OR beat < ?', args: [now() - 5, now() - 75] })
  for (const x of r.rows) await close(c, String(x.sid), String(x.who), Number(x.deadline), String(x.day), Number(x.tier) === 2 ? 2 : 1)
  return r.rows.length
}

type Made = { session_id?: string; embed_url?: string; admin_token?: string }
/** starts a browser on one key; `quota` is true when Hyperbeam refused for want of allowance or payment, so that key is set aside for the month */
async function make(t: Tier, start: string): Promise<{ made: Made | null; quota: boolean }> {
  try {
    const r = await hb(t, '/vm', { method: 'POST', body: JSON.stringify({ start_url: start, offline_timeout: 90, ublock: true, width: 1280, height: 720 }) })
    if (r.ok) return { made: (await r.json()) as Made, quota: false }
    const text = await r.text().catch(() => '')
    return { made: null, quota: r.status === 402 || r.status === 403 || (r.status === 429 && /quota|limit|credit|billing|minutes/i.test(text)) || /quota|credit|billing|exceeded|payment/i.test(text) }
  } catch { return { made: null, quota: false } }
}

export default {
  async fetch(request: Request) {
    const url = new URL(request.url)
    if ((!keyOf(1) && !keyOf(2)) || !process.env.TURSO_URL || !process.env.TURSO_TOKEN) return json({ error: 'The cloud browser is not set up' }, 503)

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

      if (body.a === 'start') {
        const v = verdict(body.u ?? '')
        if (!v.ok) return json({ error: 'blocked', why: 'why' in v ? v.why : 'not a web page' }, 403)
        const mine = PER_IP - (await usedBy(c, id))
        if (mine < LIFE) return json({ error: 'limit' }, 429)
        if ((await poolLeft(c)) < LIFE) return json({ error: 'full' }, 429)
        const counts = await c.execute({ sql: 'SELECT tier, COUNT(*) AS n FROM cloud_sess WHERE deadline >= ? GROUP BY tier', args: [now()] })
        const active = (t: Tier) => Number(counts.rows.find((x) => Number(x.tier) === t)?.n ?? 0)
        const m = await monthUsed(c)
        const order: Tier[] = []
        if (keyOf(1) && !m.refused && m.secs + LIFE <= FREE_MIN * 60 * MARGIN && active(1) < maxOf(1)) order.push(1)
        if (keyOf(2) && active(2) < maxOf(2)) order.push(2)
        if (!order.length) return json({ error: 'busy' }, 429)
        for (const t of order) {
          // the time is taken first and given back if the browser does not start
          await c.batch(addTime(id, t))
          const { made, quota } = await make(t, v.url.toString())
          if (!made?.session_id || !made.embed_url) {
            await c.batch([{ sql: SQL_BACK, args: [LIFE, id, today()] }, { sql: SQL_BACK, args: [LIFE, POOL_ROW, today()] }, ...(t === 1 ? [{ sql: SQL_BACK, args: [LIFE, MONTH_ROW, month()] }] : [])])
            if (quota && t === 1) await c.execute({ sql: SQL_ADD, args: [FLAG_ROW, month(), 1] }).catch(() => {})
            continue
          }
          const ticket = token()
          const deadline = now() + LIFE
          await c.execute({ sql: 'INSERT INTO cloud_sess (sid, who, ticket, deadline, beat, day, tier) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [made.session_id, id, ticket, deadline, now(), today(), t] })
          return json({ sid: made.session_id, ticket, embed: made.embed_url, admin: made.admin_token, exp: deadline, left: mine - LIFE })
        }
        return json({ error: 'busy' }, 429)
      }

      // beat and end belong to the session's own page
      const row = await c.execute({ sql: 'SELECT sid, who, ticket, deadline, day, tier FROM cloud_sess WHERE sid = ?', args: [body.sid ?? ''] })
      const s = row.rows[0]
      if (!s || s.ticket !== body.ticket) return json({ error: 'gone' }, 410)
      const sid = String(s.sid)
      const deadline = Number(s.deadline)
      const tier: Tier = Number(s.tier) === 2 ? 2 : 1

      if (body.a === 'end') { await close(c, sid, String(s.who), deadline, String(s.day), tier); return json({ ok: true }) }

      if (body.a === 'beat') {
        let next = deadline
        // the next chunk is taken when this one is nearly spent, if there is any left
        if (deadline - now() <= 25 && s.day === today()) {
          const mine = PER_IP - (await usedBy(c, String(s.who)))
          const m = tier === 1 ? await monthUsed(c) : null
          if (mine >= LIFE && (await poolLeft(c)) >= LIFE && (!m || m.secs + LIFE <= FREE_MIN * 60 * MARGIN)) {
            await c.batch(addTime(String(s.who), tier))
            next = deadline + LIFE
          }
        }
        await c.execute({ sql: 'UPDATE cloud_sess SET beat = ?, deadline = ? WHERE sid = ?', args: [now(), next, sid] })
        const mine = PER_IP - (await usedBy(c, String(s.who)))
        return json({ exp: next, left: Math.max(0, mine), ending: next <= now() + 5 })
      }
      return json({ error: 'bad' }, 400)
    } catch { return json({ error: 'The cloud browser could not check its limit' }, 503) }
  },
}
