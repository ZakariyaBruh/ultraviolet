/**
 * The Ask AI window's relay. It asks free, keyless chat services, never from the browser, so the person's network and any one
 * service's bad day matter less. Order: Pollinations (tested at 25 of 25 answers) first; if it has not answered within
 * 3.5 seconds, or fails, LLM7 is started too and the first good answer wins; Pollinations is also asked a second time late, in case
 * the first call hung. Nothing is stored and no account is involved. Only the last few messages of the chat are sent.
 */
const SYSTEM = 'You are a calm study helper inside a focus app. Answer clearly and briefly, in plain language, in a few short paragraphs at most. If you are not sure, say so rather than guessing. Help with studying, explaining, summarising and checking understanding. Decline anything harmful, and do not pretend to be a person.'
const MAX_MESSAGES = 12
const MAX_CHARS = 2000

type Msg = { role: 'user' | 'assistant'; content: string }
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

const hits = new Map<string, { n: number; at: number }>()
function limited(id: string, max: number, windowMs: number) {
  const now = Date.now()
  const h = hits.get(id)
  if (!h || now - h.at > windowMs) { hits.set(id, { n: 1, at: now }); if (hits.size > 8000) hits.clear(); return false }
  return ++h.n > max
}

interface Provider { name: string; url: string; model: string; delay: number }
const PROVIDERS: Provider[] = [
  { name: 'pollinations', url: 'https://text.pollinations.ai/openai', model: 'openai', delay: 0 },
  { name: 'llm7', url: 'https://api.llm7.io/v1/chat/completions', model: 'default', delay: 3500 },
  { name: 'pollinations', url: 'https://text.pollinations.ai/openai', model: 'openai', delay: 8000 },
]

const SCREEN = 'You screen web pages for a study app that blocks games and short-form content. Reply with exactly one word: BLOCK if the page is mainly a game or a place to play games (browser games, game portals, game stores or streaming, gaming news), or is mainly short-form content (feeds of short videos or clips, endless social feeds like TikTok, Reels or Shorts); otherwise ALLOW. When unsure, ALLOW.'

async function ask(p: Provider, messages: Msg[], signal: AbortSignal, screen = false): Promise<{ text: string; via: string }> {
  await new Promise<void>((res, rej) => { const t = setTimeout(res, p.delay); signal.addEventListener('abort', () => { clearTimeout(t); rej(new Error('stopped')) }, { once: true }) })
  const r = await fetch(p.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer unused' },
    body: JSON.stringify({ model: p.model, messages: [{ role: 'system', content: screen ? SCREEN : SYSTEM }, ...messages], temperature: screen ? 0 : 0.5, max_tokens: screen ? 6 : 700 }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]),
  })
  if (!r.ok) throw new Error(`${p.name} ${r.status}`)
  const d = (await r.json()) as { choices?: { message?: { content?: string } }[] }
  const text = (d.choices?.[0]?.message?.content ?? '').trim()
  if (text.length < 2) throw new Error(`${p.name} empty`)
  return { text: text.slice(0, 6000), via: p.name }
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') return reply({ error: 'post' }, 405)
    const site = request.headers.get('sec-fetch-site')
    if (site && site !== 'same-origin' && site !== 'none') return reply({ error: 'not here' }, 403)
    const ip = (request.headers.get('x-forwarded-for') ?? 'x').split(',')[0].trim()
    if (limited(`ip:${ip}`, 40, 3600e3)) return reply({ error: 'slow down' }, 429)
    let body: { messages?: unknown; mode?: unknown }
    try { body = (await request.json()) as { messages?: unknown; mode?: unknown } } catch { return reply({ error: 'bad' }, 400) }
    const raw = Array.isArray(body.messages) ? body.messages : []
    const messages: Msg[] = raw
      .filter((m): m is Msg => !!m && typeof m === 'object' && ((m as Msg).role === 'user' || (m as Msg).role === 'assistant') && typeof (m as Msg).content === 'string')
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
      .slice(-MAX_MESSAGES)
    if (!messages.length || messages[messages.length - 1].role !== 'user') return reply({ error: 'bad' }, 400)
    const stop = new AbortController()
    try {
      const won = await Promise.any(PROVIDERS.map((p) => ask(p, messages, stop.signal, body.mode === 'screen')))
      stop.abort()
      return reply(won)
    } catch { stop.abort(); return reply({ error: 'busy' }, 502) }
  },
}
