/**
 * The check for a page that is not on the blocklist: the block list is the only thing that blocks by itself, so a page it does not know is
 * read by a free chat model (through our `api/chat.ts`, mode `screen`) that is asked one question, whether it is mainly a game or
 * short-form content. Only the address, title, description and the first few hundred characters of text are sent. A site that is
 * not on the list and that the model does not clearly call a game is NOT blocked: if the model is slow, down or unsure the page opens.
 * The answer is remembered for the visit, so a site is asked about once.
 */
const KEY = 'friction:screen:'
const seen = new Map<string, boolean>()

export async function screenPage(url: URL, html: string): Promise<{ block: boolean; checked: boolean }> {
  const host = url.hostname.replace(/^www\./, '')
  if (seen.has(host)) return { block: seen.get(host)!, checked: false }
  try { const v = sessionStorage.getItem(KEY + host); if (v) { seen.set(host, v === '1'); return { block: v === '1', checked: false } } } catch { /* private mode */ }
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html') // parsing runs nothing
    const text = (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 700)
    const desc = doc.querySelector('meta[name="description"],meta[property="og:description"]')?.getAttribute('content') ?? ''
    const content = `Address: ${url.origin}${url.pathname.slice(0, 80)}\nTitle: ${doc.title.slice(0, 120)}\nDescription: ${desc.slice(0, 250)}\nText: ${text}`
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'screen', messages: [{ role: 'user', content }] }), signal: AbortSignal.timeout(9000) })
    if (!r.ok) return { block: false, checked: false }
    const said = ((await r.json()) as { text?: string }).text ?? ''
    const block = /^\W*BLOCK\b/i.test(said)
    seen.set(host, block)
    try { sessionStorage.setItem(KEY + host, block ? '1' : '0') } catch { /* private mode */ }
    return { block, checked: true }
  } catch { return { block: false, checked: false } }
}
