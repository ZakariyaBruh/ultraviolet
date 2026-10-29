import { createClient, type Client } from '@libsql/client/web'

/**
 * The recommendation leaderboard. The one place this app talks to a server, because the database key must not live in the browser.
 *
 * What is stored, and only this: `board` (a code, a public nickname, a count) and `pending` (a code and a count).
 *
 * The number of recommends needed to be on the board is dynamic:
 *  - while there is room (the database is under ~4.5 GB) it is 0: your first recommend puts you on the board;
 *  - once the database is full it is the lowest score on the board plus one. A newcomer who passes that score
 *    takes the lowest person's place, and that person is removed. The board then stays the same size.
 * While full, counts for people not yet on the board are kept in a capped, oldest-first `pending` table,
 * so storage never grows past the limit.
 */
const CAP_BYTES = Number(process.env.LB_CAP_BYTES) || 4.5e9
const BOARD_SIZE = 25
const PENDING_CAP = 5000
/** how long a hand-off waits to be picked up */
const XFER_MS = 10 * 60_000
/** a sealed hand-off is at most this many characters (about 500 KB): a person's data is compressed first and is a fraction of this */
const XFER_MAX = 700_000
let swept = 0

let db: Client | undefined
let ready: Promise<unknown> | undefined
const client = () => (db ??= createClient({ url: process.env.TURSO_URL!, authToken: process.env.TURSO_TOKEN! }))
const init = () =>
  (ready ??= (async () => {
    const c = client()
    await c.batch([
      'CREATE TABLE IF NOT EXISTS pending (code TEXT PRIMARY KEY, n INTEGER NOT NULL, t INTEGER NOT NULL)',
      'CREATE TABLE IF NOT EXISTS board (code TEXT PRIMARY KEY, name TEXT, n INTEGER NOT NULL, t INTEGER NOT NULL)',
      'CREATE INDEX IF NOT EXISTS board_n ON board (n DESC, t ASC)',
      // a hand-off of someone's own data to another browser: the page encrypts it with a code only they see, the server holds one
      // sealed row per person for ten minutes and gives it up once
      'CREATE TABLE IF NOT EXISTS xfer (owner TEXT PRIMARY KEY, id TEXT NOT NULL UNIQUE, blob TEXT NOT NULL, t INTEGER NOT NULL)',
    ])
    // names are unique: `nkey` is the name folded to lowercase letters and digits, so "Zak", "zak" and "Z.a.k" are one name
    const cols = await c.execute('PRAGMA table_info(board)')
    if (!cols.rows.some((r) => r.name === 'nkey')) {
      await c.execute('ALTER TABLE board ADD COLUMN nkey TEXT')
      await c.execute("UPDATE board SET nkey = lower(replace(replace(replace(coalesce(name, ''), ' ', ''), '.', ''), '-', '')) WHERE name IS NOT NULL")
    }
    await c.execute('CREATE UNIQUE INDEX IF NOT EXISTS board_nkey ON board (nkey) WHERE nkey IS NOT NULL')
  })())

const json = (body: unknown, status = 200, cache = 'no-store') => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': cache } })
const CODE = /^[a-f0-9]{10}$/
const KEY = /^[a-f0-9]{32}$/

async function sha(key: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 10)
}

/** The id this person has in Together rooms. Made from the same secret key, but it is a different, longer value that is never shown or shared, so the public code in a share link cannot be used to act as them. */
async function roomId(key: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`room:${key}`))
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

// a gentle limit per caller and per code, kept in this instance's memory (it resets with the instance, which is fine for a friendly board)
const hits = new Map<string, { n: number; at: number }>()
function limited(id: string, max: number) {
  const now = Date.now()
  const h = hits.get(id)
  if (!h || now - h.at > 3600e3) { hits.set(id, { n: 1, at: now }); if (hits.size > 5000) hits.clear(); return false }
  return ++h.n > max
}

let sizeAt = 0
let full = false
async function isFull() {
  if (Date.now() - sizeAt < (Number(process.env.LB_SIZE_TTL_MS) || 600e3)) return full
  const r = await client().batch(['PRAGMA page_count', 'PRAGMA page_size'])
  const pages = Number(Object.values(r[0].rows[0] ?? {})[0] ?? 0)
  const size = Number(Object.values(r[1].rows[0] ?? {})[0] ?? 4096)
  sizeAt = Date.now()
  full = pages * size >= CAP_BYTES
  return full
}

/** How many recommends it takes to be on the board right now. */
async function needed(): Promise<number> {
  if (!(await isFull())) return 0
  const r = await client().execute('SELECT MIN(n) AS lo, COUNT(*) AS k FROM board')
  return Number(r.rows[0].k) ? Number(r.rows[0].lo) + 1 : 0
}

/** The name folded for comparing: letters and digits only, lowercase, accents removed. */
const fold = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const RESERVED = new Set(['you', 'me', 'friend', 'afriend', 'afriendoffriction', 'friction', 'anonymous', 'anon', 'admin', 'moderator', 'system', 'unknown', 'guest', 'user', 'player'])
const clean = (s: unknown) => String(s ?? '').replace(/[\u0000-\u001f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20)

async function mine(code: string) {
  const c = client()
  const b = await c.execute({ sql: 'SELECT name, n FROM board WHERE code = ?', args: [code] })
  if (b.rows[0]) {
    const n = Number(b.rows[0].n)
    const r = await c.execute({ sql: 'SELECT COUNT(*) AS k FROM board WHERE n > ?', args: [n] })
    return { listed: true, n, name: (b.rows[0].name as string | null) ?? '', rank: Number(r.rows[0].k) + 1 }
  }
  const p = await c.execute({ sql: 'SELECT n FROM pending WHERE code = ?', args: [code] })
  return { listed: false, n: Number(p.rows[0]?.n ?? 0), name: '', rank: 0 }
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (!process.env.TURSO_URL || !process.env.TURSO_TOKEN) return json({ error: 'not configured' }, 503)
    const url = new URL(request.url)
    const ip = (request.headers.get('x-forwarded-for') ?? 'x').split(',')[0].trim()
    try {
      await init()
      const c = client()

      if (request.method === 'GET') {
        const a = url.searchParams.get('a')
        if (a === 'board') {
          const r = await c.execute({ sql: 'SELECT code, name, n FROM board ORDER BY n DESC, t ASC LIMIT ?', args: [BOARD_SIZE] })
          const rows = r.rows.map((x, i) => ({ rank: i + 1, name: (x.name as string | null) || `Friend ${String(x.code).slice(-4).toUpperCase()}`, n: Number(x.n) }))
          return json({ min: await needed(), rows }, 200, 'public, s-maxage=60, stale-while-revalidate=300')
        }
        if (a === 'check') {
          const k = fold(clean(url.searchParams.get('name')))
          if (!k) return json({ taken: false, ok: false })
          if (RESERVED.has(k)) return json({ taken: false, reserved: true })
          const t = await c.execute({ sql: 'SELECT 1 FROM board WHERE nkey = ?', args: [k] })
          return json({ taken: !!t.rows.length, reserved: false })
        }
        return json({ error: 'unknown' }, 404)
      }

      if (request.method === 'POST') {
        // sealed hand-offs that nobody picked up are removed here, at most once a minute for each instance, on any request, so they never sit in the database
        if (Date.now() - swept > 60_000) { swept = Date.now(); await c.execute({ sql: 'DELETE FROM xfer WHERE t < ?', args: [Date.now() - XFER_MS] }) }
        const body = (await request.json().catch(() => ({}))) as { a?: string; code?: string; key?: string; name?: string }

        // your own standing: the secret key travels in the body, never in an address that a log could keep
        if (body.a === 'me') {
          const key = String(body.key ?? '')
          if (!KEY.test(key)) return json({ error: 'bad key' }, 400)
          if (limited(`ip:${ip}`, 120)) return json({ error: 'slow down' }, 429)
          return json({ min: await needed(), ...(await mine(await sha(key))) })
        }

        // Erase: removes this person from the board (and with them the alias, so the name is free again), forgets their pending
        // count, and takes their seat out of every Together room. Only the holder of the secret key can ask.
        if (body.a === 'erase') {
          const key = String(body.key ?? '')
          if (!KEY.test(key)) return json({ error: 'bad key' }, 400)
          if (limited(`erase:${ip}`, 20)) return json({ error: 'slow down' }, 429)
          const code = await sha(key)
          await c.batch([
            { sql: 'DELETE FROM board WHERE code = ?', args: [code] },
            { sql: 'DELETE FROM pending WHERE code = ?', args: [code] },
            { sql: 'DELETE FROM xfer WHERE owner = ?', args: [await roomId(key)] },
          ])
          try {
            // the rooms tables belong to api/room.ts and may not exist yet
            await c.batch([
              { sql: 'DELETE FROM members WHERE id = ?', args: [await roomId(key)] },
              { sql: 'DELETE FROM msgs WHERE room NOT IN (SELECT DISTINCT room FROM members)' },
              { sql: 'DELETE FROM rooms WHERE code NOT IN (SELECT DISTINCT room FROM members)' },
            ])
          } catch { /* no rooms yet */ }
          return json({ ok: true })
        }

        // Hand-off, put: a sealed blob the page made (AES-GCM under a key derived from a code the server never sees), one row for each
        // person (`owner` is their private room id), kept ten minutes. Hand-off, get: whoever holds the code's id takes it once.
        if (body.a === 'xput') {
          const b = body as { id?: string; blob?: string; owner?: string }
          if (!/^[a-f0-9]{32}$/.test(String(b.id)) || !/^[a-f0-9]{32}$/.test(String(b.owner)) || typeof b.blob !== 'string' || b.blob.length < 40 || b.blob.length > XFER_MAX) return json({ error: 'bad hand-off' }, 400)
          if (limited(`xput:${ip}`, 20)) return json({ error: 'slow down' }, 429)
          await c.execute({ sql: 'DELETE FROM xfer WHERE t < ?', args: [Date.now() - XFER_MS] })
          await c.execute({ sql: 'INSERT INTO xfer (owner, id, blob, t) VALUES (?, ?, ?, ?) ON CONFLICT (owner) DO UPDATE SET id = excluded.id, blob = excluded.blob, t = excluded.t', args: [b.owner!, b.id!, b.blob, Date.now()] })
          return json({ ok: true, minutes: XFER_MS / 60000 })
        }
        if (body.a === 'xget') {
          const id = String((body as { id?: string }).id)
          if (!/^[a-f0-9]{32}$/.test(id)) return json({ error: 'bad hand-off' }, 400)
          if (limited(`xget:${ip}`, 30)) return json({ error: 'slow down' }, 429)
          const r = await c.execute({ sql: 'SELECT blob, t FROM xfer WHERE id = ?', args: [id] })
          if (!r.rows.length) return json({ error: 'none' }, 404)
          await c.execute({ sql: 'DELETE FROM xfer WHERE id = ?', args: [id] })
          if (Date.now() - Number(r.rows[0].t) > XFER_MS) return json({ error: 'none' }, 404)
          return json({ blob: String(r.rows[0].blob) })
        }

        if (body.a === 'recommend') {
          const code = String(body.code ?? '')
          if (!CODE.test(code)) return json({ error: 'bad code' }, 400)
          if (limited(`ip:${ip}`, 12) || limited(`code:${code}`, 80)) return json({ error: 'slow down' }, 429)
          const now = Date.now()
          const up = await c.execute({ sql: 'UPDATE board SET n = n + 1, t = ? WHERE code = ?', args: [now, code] })
          if (up.rowsAffected) return json({ ok: true })
          const p = await c.execute({ sql: 'SELECT n FROM pending WHERE code = ?', args: [code] })
          if (!(await isFull())) {
            // room to spare: the first recommend puts you on the board
            const n = Number(p.rows[0]?.n ?? 0) + 1
            await c.batch([
              { sql: 'INSERT INTO board (code, name, n, t) VALUES (?, NULL, ?, ?) ON CONFLICT(code) DO UPDATE SET n = excluded.n, t = excluded.t', args: [code, n, now] },
              { sql: 'DELETE FROM pending WHERE code = ?', args: [code] },
            ])
          } else {
            // full: count in a capped, oldest-first table, and take a place only by beating the lowest score
            if (!p.rows[0]) {
              const k = Number((await c.execute('SELECT COUNT(*) AS k FROM pending')).rows[0].k)
              if (k >= PENDING_CAP) await c.execute('DELETE FROM pending WHERE code IN (SELECT code FROM pending ORDER BY t ASC LIMIT 1)')
            }
            const r = await c.execute({ sql: 'INSERT INTO pending (code, n, t) VALUES (?, 1, ?) ON CONFLICT(code) DO UPDATE SET n = n + 1, t = excluded.t RETURNING n', args: [code, now] })
            const n = Number(r.rows[0].n)
            const low = (await c.execute('SELECT code, n FROM board ORDER BY n ASC, t ASC LIMIT 1')).rows[0]
            if (!low || n > Number(low.n)) {
              const stmts = [
                ...(low ? [{ sql: 'DELETE FROM board WHERE code = ?', args: [low.code as string] }] : []),
                { sql: 'INSERT INTO board (code, name, n, t) VALUES (?, NULL, ?, ?) ON CONFLICT(code) DO UPDATE SET n = excluded.n, t = excluded.t', args: [code, n, now] },
                { sql: 'DELETE FROM pending WHERE code = ?', args: [code] },
              ]
              await c.batch(stmts)
            }
          }
          if (Math.random() < 0.02) await c.execute({ sql: 'DELETE FROM pending WHERE t < ?', args: [now - 45 * 86400e3] })
          return json({ ok: true })
        }

        if (body.a === 'name') {
          const key = String(body.key ?? '')
          if (!KEY.test(key)) return json({ error: 'bad key' }, 400)
          if (limited(`ip:${ip}`, 30)) return json({ error: 'slow down' }, 429)
          const name = clean(body.name)
          const k = fold(name)
          if (name && !k) return json({ ok: false, reason: 'invalid' })
          if (RESERVED.has(k)) return json({ ok: false, reason: 'reserved' })
          const code = await sha(key)
          if (k) {
            const t = await c.execute({ sql: 'SELECT 1 FROM board WHERE nkey = ? AND code != ?', args: [k, code] })
            if (t.rows.length) return json({ ok: false, reason: 'taken' })
          }
          try {
            const r = await c.execute({ sql: 'UPDATE board SET name = ?, nkey = ? WHERE code = ?', args: [name || null, k || null, code] })
            return json({ ok: !!r.rowsAffected, name })
          } catch {
            return json({ ok: false, reason: 'taken' }) // someone took it a moment ago
          }
        }
      }
      return json({ error: 'unknown' }, 404)
    } catch {
      return json({ error: 'server' }, 500)
    }
  },
}
