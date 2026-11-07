import { createClient, type Client } from '@libsql/client/web'
import { createHash, timingSafeEqual } from 'node:crypto'
import { json } from './_page.js'

/**
 * The contact form (/contact posts here). There is no public email address: a message is one row in Turso (`contact`), kept 180 days,
 * at most 1,000 rows, three a day for each network address (stored only as a hash). The owner reads them with
 * GET /api/contact and the same bearer secret as the blog (`BLOG_SECRET`, or `BLOGS_SECRET`); nothing is public.
 * A message can be left without a way to reply; a rights holder or anyone wanting an answer says how to reach them in it.
 */
let db: Client | null = null
const client = () => (db ??= createClient({ url: process.env.TURSO_URL!, authToken: process.env.TURSO_TOKEN! }))
let ready = false
async function setup(c: Client) {
  if (ready) return
  await c.execute('CREATE TABLE IF NOT EXISTS contact (id INTEGER PRIMARY KEY AUTOINCREMENT, created INTEGER NOT NULL, topic TEXT NOT NULL, name TEXT NOT NULL, reply TEXT NOT NULL, message TEXT NOT NULL, iph TEXT NOT NULL)')
  ready = true
}
const TOPICS = ['bug', 'site', 'privacy', 'rights', 'ads', 'other']
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : '')
const DAY = 86_400_000

export default {
  async fetch(request: Request) {
    if (!process.env.TURSO_URL || !process.env.TURSO_TOKEN) return json({ error: 'not configured' }, 503)
    const c = client()
    try { await setup(c) } catch { return json({ error: 'busy' }, 503) }

    if (request.method === 'GET') {
      const secret = process.env.BLOG_SECRET || process.env.BLOGS_SECRET
      const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
      if (!secret || secret.length < 24 || !same(given, secret)) return json({ error: 'no' }, 401)
      const r = await c.execute('SELECT id, created, topic, name, reply, message FROM contact ORDER BY created DESC LIMIT 100')
      return json({ messages: r.rows.map((x) => ({ id: Number(x.id), at: new Date(Number(x.created)).toISOString(), topic: x.topic, name: x.name, reply: x.reply, message: x.message })) })
    }
    if (request.method !== 'POST') return json({ error: 'method' }, 405)
    if ((request.headers.get('sec-fetch-site') ?? 'same-origin') === 'cross-site') return json({ error: 'no' }, 403)

    const d = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!d) return json({ error: 'bad request' }, 400)
    // the quiet traps: a field only a script fills in, and a form sent faster than a person can write
    if (clean(d.site, 50)) return json({ ok: true })
    if (Number(d.ms) < 2500) return json({ error: 'Please take a moment and try again.' }, 400)
    const topic = TOPICS.includes(String(d.topic)) ? String(d.topic) : 'other'
    const message = clean(d.message, 2000)
    const name = clean(d.name, 60)
    const reply = clean(d.reply, 120)
    if (message.length < 10) return json({ error: 'Please write a little more (at least 10 characters).' }, 400)
    if (reply && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reply) && !/^https?:\/\/\S+$/.test(reply)) return json({ error: 'The way to reach you should be an email address or a link.' }, 400)
    if (topic === 'rights' && !reply) return json({ error: 'A request from a rights holder needs an email address or link to reach you.' }, 400)

    const ip = (request.headers.get('x-forwarded-for') ?? 'x').split(',')[0].trim()
    const iph = createHash('sha256').update(`contact:${ip}`).digest('hex').slice(0, 16)
    const now = Date.now()
    await c.execute({ sql: 'DELETE FROM contact WHERE created < ?', args: [now - 180 * DAY] })
    const mine = Number((await c.execute({ sql: 'SELECT COUNT(*) AS n FROM contact WHERE iph = ? AND created > ?', args: [iph, now - DAY] })).rows[0]?.n ?? 0)
    if (mine >= 3) return json({ error: 'That is enough messages for today. Please try again tomorrow.' }, 429)
    const total = Number((await c.execute({ sql: 'SELECT COUNT(*) AS n FROM contact WHERE created > ?', args: [now - DAY] })).rows[0]?.n ?? 0)
    if (total >= 200) return json({ error: 'The inbox is full for today. Please try again tomorrow.' }, 429)
    await c.execute({ sql: 'INSERT INTO contact (created, topic, name, reply, message, iph) VALUES (?, ?, ?, ?, ?, ?)', args: [now, topic, name, reply, message, iph] })
    await c.execute('DELETE FROM contact WHERE id NOT IN (SELECT id FROM contact ORDER BY created DESC LIMIT 1000)')
    return json({ ok: true }, 201)
  },
}
