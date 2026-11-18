/**
 * Code share links: the language and the program, compressed (deflate, the browser's own CompressionStream) and written after
 * `#code=` in the address. A fragment is never sent to any server, so the program goes from one browser to the other inside
 * the link and is stored nowhere. Reading one is capped, so a link cannot unpack into something huge.
 */
const MAX_OUT = 120_000

const b64url = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const unb64url = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
  const out = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i)
  return out
}
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, cap = Infinity): Promise<Uint8Array | null> {
  const w = stream.writable.getWriter()
  void w.write(bytes as BufferSource).then(() => w.close()).catch(() => undefined)
  const r = stream.readable.getReader()
  const parts: Uint8Array[] = []
  let n = 0
  for (;;) {
    const { value, done } = await r.read()
    if (done) break
    n += value.length
    if (n > cap) { void r.cancel(); return null }
    parts.push(value)
  }
  const out = new Uint8Array(n)
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}
const zipOk = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'

/** `z` + deflated, or `p` + plain where the browser cannot compress */
export async function encodeShare(lang: string, text: string): Promise<string> {
  const raw = new TextEncoder().encode(`${lang}\n${text}`)
  if (zipOk()) { const z = await pipe(raw, new CompressionStream('deflate-raw')); if (z) return `z${b64url(z)}` }
  return `p${b64url(raw)}`
}

export async function decodeShare(s: string): Promise<{ lang: string; text: string } | null> {
  try {
    const kind = s[0], body = unb64url(s.slice(1))
    const raw = kind === 'z' ? (zipOk() ? await pipe(body, new DecompressionStream('deflate-raw'), MAX_OUT) : null) : kind === 'p' && body.length <= MAX_OUT ? body : null
    if (!raw) return null
    const all = new TextDecoder().decode(raw)
    const nl = all.indexOf('\n')
    if (nl < 1 || nl > 20) return null
    return { lang: all.slice(0, nl), text: all.slice(nl + 1) }
  } catch { return null }
}

export const shareUrl = (code: string) => `${location.origin}/focus#code=${code}`

/** what else can travel in a link besides a program: a flashcard deck, a notepad page, a reference list */
export const ITEM_KINDS = ['deck', 'note', 'refs']
/** a link for one of them; the longer it is, the more likely an app is to cut it */
export async function itemLink(kind: 'deck' | 'note' | 'refs', text: string): Promise<{ url: string; long: boolean }> {
  const url = shareUrl(await encodeShare(kind, text))
  return { url, long: url.length > 8000 }
}
