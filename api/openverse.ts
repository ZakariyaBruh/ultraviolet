/**
 * A search relay for Openverse. Its API answers slowly or not at all from some networks (it hangs from Saudi Arabia, for one),
 * so the browser asks this function first, which reads it from a Vercel server, tries twice in case the first call hangs, and
 * caches good answers for an hour. It only ever asks Openverse's audio search, with the person's words, and keeps nothing.
 */
const reply = (body: string, status = 200, cache = 'no-store') => new Response(body, { status, headers: { 'content-type': 'application/json', 'cache-control': cache } })

async function ask(q: string, size: number, delay: number): Promise<string> {
  await new Promise((r) => setTimeout(r, delay))
  const r = await fetch(`https://api.openverse.org/v1/audio/?q=${encodeURIComponent(q)}&page_size=${size}`, { headers: { accept: 'application/json', 'user-agent': 'friction-music/1.0 (focus app)' }, signal: AbortSignal.timeout(12000) })
  if (!r.ok) throw new Error(String(r.status))
  const t = await r.text()
  if (!t.startsWith('{')) throw new Error('shape')
  return t
}

export default {
  async fetch(request: Request) {
    const site = request.headers.get('sec-fetch-site')
    if (site && site !== 'same-origin' && site !== 'none') return reply('{"error":"not here"}', 403)
    const q = (new URL(request.url).searchParams.get('q') ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80) || 'music'
    try {
      const body = await Promise.any([ask(q, 20, 0), ask(q, 12, 3000)])
      return reply(body, 200, 'public, s-maxage=3600, stale-while-revalidate=86400')
    } catch { return reply('{"error":"busy"}', 502) }
  },
}
