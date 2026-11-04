import { createClient, type Client } from '@libsql/client/web'
import { timingSafeEqual } from 'node:crypto'
import { json } from './_page.js'

/**
 * The blog (/blogs, /blogs/<slug>, /blogs/sitemap.xml), served as plain HTML so search engines can read it. Posts are public text, kept in one Turso
 * table (`posts`, one row each) and added by a scheduled automation (a Make.com scenario that writes one with Groq each day and POSTs it here).
 *
 *   POST /api/blog   Authorization: Bearer <BLOG_SECRET>   { title, description, body }   -> { slug }
 *                    body is plain text: blank-line paragraphs, `## ` headings, `- ` list items and **bold**; everything else is escaped.
 *   GET  /api/blog?titles=1                                  -> the latest titles, so the writer can avoid repeating one
 *
 * Every page says the article was written with AI and published automatically. Env: `BLOG_SECRET`, `TURSO_URL`, `TURSO_TOKEN` (Vercel only).
 */
const SITE = 'https://frictionx.vercel.app'
const MAX_PER_DAY = 3
let db: Client | null = null
const client = () => (db ??= createClient({ url: process.env.TURSO_URL!, authToken: process.env.TURSO_TOKEN! }))
let ready = false
async function setup(c: Client) {
  if (ready) return
  await c.execute('CREATE TABLE IF NOT EXISTS posts (slug TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, body TEXT NOT NULL, day TEXT NOT NULL, created INTEGER NOT NULL)')
  ready = true
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const slugOf = (t: string) => t.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/g, '')
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }
const dayOf = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10)
const nice = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** plain text to safe HTML: everything is escaped first, then only headings, lists, paragraphs and bold are made */
function render(body: string) {
  const inline = (t: string) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const out: string[] = []
  let list: string[] = []
  const flush = () => { if (list.length) { out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join('')}</ul>`); list = [] } }
  for (const block of body.replace(/\r/g, '').split(/\n{2,}/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) continue
    for (const l of lines) {
      if (/^#{1,3}\s+/.test(l)) { flush(); out.push(`<h2>${inline(l.replace(/^#{1,3}\s+/, ''))}</h2>`) }
      else if (/^[-*]\s+/.test(l)) list.push(l.replace(/^[-*]\s+/, ''))
      else { flush(); out.push(`<p>${inline(l)}</p>`) }
    }
    flush()
  }
  return out.join('\n')
}

const STYLE = `<style>
  :root { --ground: #05070c; --ink: #e9eef7; --ink-2: #aab4c6; --ink-3: #7d889b; --signal: #ffd23f; --rule: #243044; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { min-height: 100vh; background: var(--ground); color: var(--ink); font: 18px/1.65 "Hanken Grotesk", system-ui, sans-serif; }
  header, main, footer { max-width: 46rem; margin: 0 auto; padding: 0 20px; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 24px; padding-bottom: 24px; border-bottom: 2px solid var(--rule); }
  .mark { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
  nav a { color: var(--ink-2); text-decoration: none; margin-left: 16px; font-size: 15px; }
  nav a:hover, nav a:focus-visible { color: var(--signal); }
  main { padding-top: 48px; padding-bottom: 56px; }
  .kicker { margin: 0 0 12px; color: var(--signal); font-size: 13px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
  h1 { margin: 0 0 16px; font-size: clamp(30px, 6vw, 46px); line-height: 1.1; letter-spacing: -.02em; }
  h2 { margin: 40px 0 12px; font-size: 26px; line-height: 1.2; }
  p, ul { margin: 0 0 18px; } ul { padding-left: 22px; } li { margin-bottom: 6px; }
  .lead { color: var(--ink-2); max-width: 36rem; }
  .meta { color: var(--ink-3); font-size: 14px; margin: 0 0 28px; }
  .ai { border-left: 3px solid var(--signal); padding: 8px 14px; color: var(--ink-3); font-size: 14px; margin: 32px 0 0; }
  .list { display: grid; gap: 14px; margin: 0; padding: 0; list-style: none; }
  .list li { margin: 0; } .list a { display: block; padding: 16px 18px; border: 2px solid var(--rule); color: var(--ink); text-decoration: none; }
  .list a:hover, .list a:focus-visible { border-color: var(--signal); }
  .list strong { display: block; font-size: 20px; line-height: 1.25; } .list span { display: block; color: var(--ink-2); font-size: 15px; margin-top: 4px; } .list small { color: var(--ink-3); }
  .empty { border: 2px solid var(--rule); padding: 20px; color: var(--ink-2); }
  .cta { display: inline-block; margin-top: 32px; padding: 12px 20px; background: var(--signal); color: #05070c; font-weight: 700; text-decoration: none; }
  a:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
  main a:not(.cta) { color: var(--signal); }
  footer { padding-top: 24px; padding-bottom: 40px; border-top: 2px solid var(--rule); color: var(--ink-3); font-size: 14px; } footer a { color: var(--ink-2); }
</style>`

const MARK = '<svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" stroke-width="5" transform="rotate(-100 32 32)" stroke-dasharray="1 1" pathLength="1"/><rect x="40" y="10" width="16" height="16" fill="#ffd23f"/></svg>'

function page(o: { title: string; description: string; path: string; type: 'website' | 'article'; ld: unknown; main: string; day?: string }) {
  const url = `${SITE}${o.path}`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${url}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#05070c">
<meta property="og:type" content="${o.type}">
<meta property="og:site_name" content="Friction">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(o.ld).replace(/</g, '\\u003c')}</script>
${STYLE}
</head>
<body>
<header>
  <a class="mark" href="/" aria-label="Friction home">${MARK} Friction</a>
  <nav aria-label="Main"><a href="/blogs">Blog</a><a href="/focus">Focus</a><a href="/learn">Learn</a><a href="/radio">Radio</a></nav>
</header>
<main>
${o.main}
</main>
<footer><p>Friction is a free focus timer with radio, live TV and lessons. No account, no feed. <a href="/">Back to the front page</a>.</p></footer>
</body>
</html>`
}

const html = (body: string, status = 200, cache = 'public, s-maxage=300, stale-while-revalidate=86400') =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache } })

type Row = { slug: string; title: string; description: string; body: string; day: string }

export default {
  async fetch(request: Request) {
    const url = new URL(request.url)
    if (!process.env.TURSO_URL || !process.env.TURSO_TOKEN) return json({ error: 'not configured' }, 503)
    const c = client()
    try { await setup(c) } catch { return json({ error: 'busy' }, 503) }

    // the writer posts a finished article
    if (request.method === 'POST') {
      const secret = process.env.BLOG_SECRET
      const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
      if (!secret || secret.length < 24 || !same(given, secret)) return json({ error: 'no' }, 401)
      const d = (await request.json().catch(() => null)) as { title?: unknown; description?: unknown; body?: unknown } | null
      const title = typeof d?.title === 'string' ? d.title.trim().replace(/\s+/g, ' ') : ''
      const description = typeof d?.description === 'string' ? d.description.trim().replace(/\s+/g, ' ') : ''
      const body = typeof d?.body === 'string' ? d.body.trim() : ''
      if (title.length < 12 || title.length > 110) return json({ error: 'title must be 12 to 110 characters' }, 400)
      if (description.length < 60) return json({ error: 'description must be at least 60 characters' }, 400)
      if (body.length < 2500 || body.length > 14000) return json({ error: 'body must be 2500 to 14000 characters' }, 400)
      const today = dayOf()
      const n = Number((await c.execute({ sql: 'SELECT COUNT(*) AS n FROM posts WHERE day = ?', args: [today] })).rows[0]?.n ?? 0)
      if (n >= MAX_PER_DAY) return json({ error: 'enough for today' }, 429)
      const slug = slugOf(title) || `post-${today}`
      const taken = await c.execute({ sql: 'SELECT 1 FROM posts WHERE slug = ?', args: [slug] })
      if (taken.rows.length) return json({ error: 'that title is already used' }, 409)
      try { await c.execute({ sql: 'INSERT INTO posts (slug, title, description, body, day, created) VALUES (?, ?, ?, ?, ?, ?)', args: [slug, title, description.slice(0, 200), body, today, Date.now()] }) } catch { return json({ error: 'that title is already used' }, 409) }
      return json({ slug, url: `${SITE}/blogs/${slug}` }, 201)
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'method' }, 405)

    // the latest titles (public, so the writer does not repeat itself)
    if (url.searchParams.get('titles') === '1') {
      const r = await c.execute('SELECT title FROM posts ORDER BY created DESC LIMIT 40')
      return json({ titles: r.rows.map((x) => String(x.title)) }, 200, 'public, s-maxage=60')
    }

    const all = async (limit: number) => (await c.execute({ sql: 'SELECT slug, title, description, body, day FROM posts ORDER BY created DESC LIMIT ?', args: [limit] })).rows as unknown as Row[]

    if (url.searchParams.get('sitemap') === '1') {
      const rows = await all(1000)
      const urls = [`  <url>\n    <loc>${SITE}/blogs</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.7</priority>\n  </url>`, ...rows.map((r) => `  <url>\n    <loc>${SITE}/blogs/${esc(r.slug)}</loc>\n    <lastmod>${r.day}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`)]
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, s-maxage=600' } })
    }

    const slug = (url.searchParams.get('slug') ?? '').toLowerCase()
    if (slug) {
      if (!/^[a-z0-9-]{1,90}$/.test(slug)) return html(page({ title: 'Not found | Friction Blog', description: 'That post does not exist.', path: '/blogs', type: 'website', ld: {}, main: '<h1>Not found</h1><p>That post does not exist. <a href="/blogs">See all posts</a>.</p>' }), 404, 'public, s-maxage=60')
      const r = (await c.execute({ sql: 'SELECT slug, title, description, body, day FROM posts WHERE slug = ?', args: [slug] })).rows[0] as unknown as Row | undefined
      if (!r) return html(page({ title: 'Not found | Friction Blog', description: 'That post does not exist.', path: '/blogs', type: 'website', ld: {}, main: '<h1>Not found</h1><p>That post does not exist. <a href="/blogs">See all posts</a>.</p>' }), 404, 'public, s-maxage=60')
      const path = `/blogs/${r.slug}`
      return html(page({
        title: `${r.title} | Friction Blog`.slice(0, 120), description: r.description, path, type: 'article',
        ld: { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: r.title, description: r.description, datePublished: r.day, dateModified: r.day, mainEntityOfPage: `${SITE}${path}`, author: { '@type': 'Organization', name: 'Friction' }, publisher: { '@type': 'Organization', name: 'Friction', url: `${SITE}/` } },
        main: `<p class="kicker"><a href="/blogs" style="color:inherit;text-decoration:none">Blog</a></p>\n<h1>${esc(r.title)}</h1>\n<p class="meta">${nice(r.day)}</p>\n${render(r.body)}\n<p class="ai">This article was written with AI and published automatically. It may contain mistakes, so check anything that matters.</p>\n<a class="cta" href="/focus">Try the focus timer</a>`,
      }))
    }

    const rows = await all(100)
    const list = rows.length
      ? `<ul class="list">${rows.map((r) => `<li><a href="/blogs/${esc(r.slug)}"><strong>${esc(r.title)}</strong><span>${esc(r.description)}</span><small>${nice(r.day)}</small></a></li>`).join('')}</ul>`
      : '<div class="empty"><strong>Nothing here yet.</strong> The first posts are on the way.</div>'
    return html(page({
      title: 'Friction Blog: Notes on Focus, Study and Attention', description: 'The Friction blog: notes on focus, studying, deep work and getting your attention back from the feed. A new post most days.',
      path: '/blogs', type: 'website', ld: { '@context': 'https://schema.org', '@type': 'Blog', name: 'Friction Blog', url: `${SITE}/blogs`, description: 'Notes on focus, studying, deep work and getting your attention back from the feed.', publisher: { '@type': 'Organization', name: 'Friction', url: `${SITE}/` } },
      main: `<p class="kicker">Blog</p>\n<h1>Notes on focus, study and attention</h1>\n<p class="lead">Short, plain writing on getting your attention back from the feed: how to study, how to hold a long session, and what the numbers say. Written with AI and published automatically.</p>\n${list}\n<a class="cta" href="/focus">Open the focus timer</a>`,
    }), 200, rows.length ? 'public, s-maxage=300, stale-while-revalidate=86400' : 'public, s-maxage=60')
  },
}
