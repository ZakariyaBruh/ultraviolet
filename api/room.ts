import { createClient, type Client } from '@libsql/client/web'

/**
 * "Lock in together": small rooms for friends. A room is a short code, up to 12 people, a chat, a shared
 * "now playing" and a shared lock-in. Browsers poll every few seconds (serverless functions cannot hold sockets).
 * Rooms vanish after a day of silence. A host may attach a Discord or Slack webhook; room events are then relayed to it.
 */
const CAP_BYTES = Number(process.env.LB_CAP_BYTES) || 4.5e9
const MAX_MEMBERS = 12
const KEEP_MSGS = 100
const ROOM_TTL = 24 * 3600e3
const AWAY_MS = 25e3

let db: Client | undefined
let ready: Promise<unknown> | undefined
const client = () => (db ??= createClient({ url: process.env.TURSO_URL!, authToken: process.env.TURSO_TOKEN! }))
const init = () =>
  (ready ??= client().batch([
    'CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, host TEXT NOT NULL, hook TEXT, media TEXT, sess TEXT, t INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS members (room TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL, left INTEGER NOT NULL DEFAULT 0, seen INTEGER NOT NULL, PRIMARY KEY (room, id))',
    'CREATE TABLE IF NOT EXISTS msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL, who TEXT NOT NULL, text TEXT NOT NULL, sys INTEGER NOT NULL DEFAULT 0, t INTEGER NOT NULL)',
    'CREATE INDEX IF NOT EXISTS msgs_room ON msgs (room, id)',
  ]))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
const ID = /^[a-f0-9]{10}$/
const CODE = /^[A-Z0-9]{6}$/
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const clean = (s: unknown, n: number) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n)

const hits = new Map<string, { n: number; at: number }>()
function limited(id: string, max: number, windowMs = 60e3) {
  const now = Date.now()
  const h = hits.get(id)
  if (!h || now - h.at > windowMs) { hits.set(id, { n: 1, at: now }); if (hits.size > 8000) hits.clear(); return false }
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

/** Only real Discord and Slack incoming-webhook addresses are accepted, so this cannot be pointed at anything else. */
function hookKind(u: string): 'discord' | 'slack' | null {
  try {
    const url = new URL(u)
    if (url.protocol !== 'https:') return null
    if (/^(discord|discordapp)\.com$|^(ptb|canary)\.discord\.com$/.test(url.hostname) && url.pathname.startsWith('/api/webhooks/')) return 'discord'
    if (url.hostname === 'hooks.slack.com' && url.pathname.startsWith('/services/')) return 'slack'
  } catch { /* not a URL */ }
  return null
}
async function relay(hook: string | null, text: string) {
  const kind = hook ? hookKind(hook) : null
  if (!hook || !kind) return
  try {
    await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(kind === 'discord' ? { content: text.slice(0, 1900), allowed_mentions: { parse: [] } } : { text: text.slice(0, 2900) }), signal: AbortSignal.timeout(2500) })
  } catch { /* the webhook is down: the room carries on */ }
}

async function say(room: string, who: string, text: string, sys = 0) {
  const c = client()
  await c.execute({ sql: 'INSERT INTO msgs (room, who, text, sys, t) VALUES (?, ?, ?, ?, ?)', args: [room, who, text, sys, Date.now()] })
  await c.execute({ sql: 'DELETE FROM msgs WHERE room = ? AND id <= (SELECT id FROM msgs WHERE room = ? ORDER BY id DESC LIMIT 1 OFFSET ?)', args: [room, room, KEEP_MSGS] })
}

type Rows = { rows: Record<string, unknown>[] }
/** Turns the three reads into what browsers get. */
function shape(code: string, id: string, room: Record<string, unknown>, mem: Rows, msgs: Rows) {
  const now = Date.now()
  return {
    code,
    host: mem.rows.find((m) => m.id === room.host)?.name ?? '',
    isHost: room.host === id,
    hasHook: !!room.hook,
    media: room.media ? JSON.parse(room.media as string) : null,
    sess: room.sess ? JSON.parse(room.sess as string) : null,
    members: mem.rows.map((m) => ({ name: m.name as string, me: m.id === id, status: m.status as string, left: Number(m.left), away: now - Number(m.seen) > AWAY_MS })),
    msgs: [...msgs.rows].reverse().map((m) => ({ id: Number(m.id), who: m.who as string, text: m.text as string, sys: !!m.sys, t: Number(m.t) })),
    now,
  }
}

async function state(code: string, id: string, since: number) {
  const c = client()
  const [room, mem, msgs] = await Promise.all([
    c.execute({ sql: 'SELECT host, hook, media, sess FROM rooms WHERE code = ?', args: [code] }),
    c.execute({ sql: 'SELECT id, name, status, left, seen FROM members WHERE room = ? ORDER BY name', args: [code] }),
    c.execute({ sql: 'SELECT id, who, text, sys, t FROM msgs WHERE room = ? AND id > ? ORDER BY id DESC LIMIT 60', args: [code, since] }),
  ])
  if (!room.rows[0]) return null
  return shape(code, id, room.rows[0] as Record<string, unknown>, mem as Rows, msgs as Rows)
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (!process.env.TURSO_URL || !process.env.TURSO_TOKEN) return json({ error: 'not configured' }, 503)
    if (request.method !== 'POST') return json({ error: 'post only' }, 405)
    const ip = (request.headers.get('x-forwarded-for') ?? 'x').split(',')[0].trim()
    if (limited(`ip:${ip}`, 300)) return json({ error: 'slow down' }, 429)
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const a = String(b.a ?? '')
    const id = String(b.id ?? '')
    const name = clean(b.name, 20)
    const code = String(b.code ?? '').toUpperCase()
    if (!ID.test(id)) return json({ error: 'bad id' }, 400)
    try {
      await init()
      const c = client()
      const now = Date.now()
      if (Math.random() < 0.03) {
        const old = await c.execute({ sql: 'SELECT code FROM rooms WHERE t < ?', args: [now - ROOM_TTL] })
        for (const r of old.rows) await c.batch([{ sql: 'DELETE FROM msgs WHERE room = ?', args: [r.code as string] }, { sql: 'DELETE FROM members WHERE room = ?', args: [r.code as string] }, { sql: 'DELETE FROM rooms WHERE code = ?', args: [r.code as string] }])
      }

      // The common case, a member who is already in the room, is one round trip to the database instead of five.
      if (a === 'sync' && CODE.test(code)) {
        const st = ['idle', 'locked', 'done'].includes(String(b.status)) ? String(b.status) : 'idle'
        const since = Math.max(0, Number(b.since) || 0)
        const r = await c.batch([
          { sql: 'UPDATE members SET status = ?, left = ?, seen = ? WHERE room = ? AND id = ?', args: [st, Math.max(0, Math.min(86400, Number(b.left) || 0)), now, code, id] },
          { sql: 'UPDATE rooms SET t = ? WHERE code = ?', args: [now, code] },
          { sql: 'SELECT host, hook, media, sess FROM rooms WHERE code = ?', args: [code] },
          { sql: 'SELECT id, name, status, left, seen FROM members WHERE room = ? ORDER BY name', args: [code] },
          { sql: 'SELECT id, who, text, sys, t FROM msgs WHERE room = ? AND id > ? ORDER BY id DESC LIMIT 60', args: [code, since] },
        ])
        const room = r[2].rows[0] as Record<string, unknown> | undefined
        if (r[0].rowsAffected > 0 && room) {
          if (b.finished === true) await relay((room.hook as string | null) ?? null, `${(r[3].rows.find((m) => m.id === id)?.name as string) ?? name} finished a lock-in.`)
          return json(shape(code, id, room, r[3] as Rows, r[4] as Rows))
        }
        // not in the room yet (joining) or no such room: the full path below says which
      }

      if (a === 'create') {
        if (!name) return json({ error: 'name needed' }, 400)
        if (limited(`create:${ip}`, 6, 3600e3)) return json({ error: 'slow down' }, 429)
        if (await isFull()) return json({ error: 'full' }, 503)
        let made = ''
        for (let i = 0; i < 6 && !made; i++) {
          const try_ = Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => ALPHA[x % ALPHA.length]).join('')
          const r = await c.execute({ sql: 'INSERT OR IGNORE INTO rooms (code, host, t) VALUES (?, ?, ?)', args: [try_, id, now] })
          if (r.rowsAffected) made = try_
        }
        if (!made) return json({ error: 'busy' }, 503)
        await c.execute({ sql: 'INSERT INTO members (room, id, name, status, left, seen) VALUES (?, ?, ?, ?, 0, ?)', args: [made, id, name, 'idle', now] })
        await say(made, name, `${name} opened the room.`, 1)
        return json(await state(made, id, 0))
      }

      if (!CODE.test(code)) return json({ error: 'bad code' }, 400)
      const room = await c.execute({ sql: 'SELECT host, hook FROM rooms WHERE code = ?', args: [code] })
      if (!room.rows[0]) return json({ error: 'no room' }, 404)
      const hook = (room.rows[0].hook as string | null) ?? null
      const me = await c.execute({ sql: 'SELECT name FROM members WHERE room = ? AND id = ?', args: [code, id] })

      if (a === 'sync') {
        if (!me.rows[0]) {
          if (!name) return json({ error: 'name needed' }, 400)
          const k = Number((await c.execute({ sql: 'SELECT COUNT(*) AS k FROM members WHERE room = ?', args: [code] })).rows[0].k)
          if (k >= MAX_MEMBERS) return json({ error: 'room full' }, 403)
          await c.execute({ sql: 'INSERT INTO members (room, id, name, status, left, seen) VALUES (?, ?, ?, ?, 0, ?)', args: [code, id, name, 'idle', now] })
          await say(code, name, `${name} joined.`, 1)
          await relay(hook, `${name} joined the room.`)
        }
        const status = ['idle', 'locked', 'done'].includes(String(b.status)) ? String(b.status) : 'idle'
        await c.batch([
          { sql: 'UPDATE members SET status = ?, left = ?, seen = ? WHERE room = ? AND id = ?', args: [status, Math.max(0, Math.min(86400, Number(b.left) || 0)), now, code, id] },
          { sql: 'UPDATE rooms SET t = ? WHERE code = ?', args: [now, code] },
        ])
        if (b.finished === true) await relay(hook, `${me.rows[0]?.name ?? name} finished a lock-in.`)
        return json(await state(code, id, Math.max(0, Number(b.since) || 0)))
      }

      if (!me.rows[0]) return json({ error: 'not in room' }, 403)
      const who = me.rows[0].name as string

      if (a === 'say') {
        if (limited(`say:${id}`, 25)) return json({ error: 'slow down' }, 429)
        const text = clean(b.text, 280)
        if (!text) return json({ ok: false })
        await say(code, who, text)
        await relay(hook, `**${who}**: ${text}`)
        return json({ ok: true })
      }
      if (a === 'media') {
        const m = b.media as { id?: string; kind?: string; name?: string; url?: string; logo?: string; meta?: string; pos?: number | null } | null
        if (!m) { await c.execute({ sql: 'UPDATE rooms SET media = NULL WHERE code = ?', args: [code] }); return json({ ok: true }) }
        const url = String(m.url ?? '')
        if (!/^https:\/\//.test(url) || url.length > 600 || !['radio', 'tv'].includes(String(m.kind))) return json({ error: 'bad media' }, 400)
        const item = { id: clean(m.id, 200), kind: m.kind, name: clean(m.name, 120), url, logo: /^https:\/\//.test(String(m.logo ?? '')) ? String(m.logo).slice(0, 600) : undefined, meta: clean(m.meta, 120), pos: Number.isFinite(Number(m.pos)) && m.pos !== undefined && m.pos !== null ? Math.max(0, Math.min(86400, Math.round(Number(m.pos)))) : undefined, by: who, at: now }
        await c.execute({ sql: 'UPDATE rooms SET media = ? WHERE code = ?', args: [JSON.stringify(item), code] })
        await say(code, who, `${who} is ${item.kind === 'tv' ? 'watching' : 'listening to'} ${item.name}.`, 1)
        await relay(hook, `${who} is ${item.kind === 'tv' ? 'watching' : 'listening to'} ${item.name}.`)
        return json({ ok: true })
      }
      if (a === 'lock') {
        const min = Math.max(1, Math.min(180, Math.round(Number(b.minutes) || 25)))
        await c.execute({ sql: 'UPDATE rooms SET sess = ?, t = ? WHERE code = ?', args: [JSON.stringify({ start: now, min, by: who }), now, code] })
        await say(code, who, `${who} started a ${min} minute lock-in. Join them.`, 1)
        await relay(hook, `${who} started a ${min} minute lock-in. Join them.`)
        return json({ ok: true })
      }
      if (a === 'hook') {
        if (room.rows[0].host !== id) return json({ error: 'host only' }, 403)
        const url = String(b.url ?? '').trim()
        if (url && !hookKind(url)) return json({ error: 'Use a Discord or Slack incoming webhook address.' }, 400)
        await c.execute({ sql: 'UPDATE rooms SET hook = ? WHERE code = ?', args: [url || null, code] })
        if (url) await relay(url, `Friction room ${code} is now connected to this channel.`)
        return json({ ok: true })
      }
      if (a === 'leave') {
        await c.execute({ sql: 'DELETE FROM members WHERE room = ? AND id = ?', args: [code, id] })
        const left = Number((await c.execute({ sql: 'SELECT COUNT(*) AS k FROM members WHERE room = ?', args: [code] })).rows[0].k)
        if (!left) await c.batch([{ sql: 'DELETE FROM msgs WHERE room = ?', args: [code] }, { sql: 'DELETE FROM rooms WHERE code = ?', args: [code] }])
        else await say(code, who, `${who} left.`, 1)
        return json({ ok: true })
      }
      return json({ error: 'unknown' }, 404)
    } catch {
      return json({ error: 'server' }, 500)
    }
  },
}
