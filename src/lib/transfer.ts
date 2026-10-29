import { identity, roomId } from './leaders'
import { sanitizeData, snapshotData, useStore } from './store'

/**
 * Moving your data to another browser, for example from Safari to the Home Screen app (iOS keeps the two apart; Android and desktop do not).
 *
 * Nothing leaves in the clear. This page makes a short code that only the person sees, encrypts the data with a key worked out from it
 * (PBKDF2, then AES-GCM), and stores the sealed blob on the server for ten minutes under an id worked out from the same code. The other
 * browser asks for that id with the code typed in, takes the blob once (the server deletes it), decrypts it and checks every key
 * through `sanitizeData` before it is used. The server never sees the code, the key or the data, and a blob nobody picks up is gone in ten minutes.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O, 1/I
const LENGTH = 8
export const HANDOFF_MIN = 10

const bytes = (b: ArrayBuffer | Uint8Array) => (b instanceof Uint8Array ? b : new Uint8Array(b))
const b64 = (b: ArrayBuffer | Uint8Array) => { let s = ''; for (const x of bytes(b)) s += String.fromCharCode(x); return btoa(s) }
const unb64 = (t: string) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0))
/** gzip before sealing, so a long history is a few kilobytes on the server (the first byte says whether it was packed) */
async function pack(text: string): Promise<Uint8Array> {
  const raw = new TextEncoder().encode(text)
  if (typeof CompressionStream === 'undefined') return new Uint8Array([0, ...raw])
  const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer())
  const out = new Uint8Array(z.length + 1); out[0] = 1; out.set(z, 1)
  return out
}
async function unpack(b: Uint8Array): Promise<string> {
  if (b[0] === 0) return new TextDecoder().decode(b.slice(1))
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed data.')
  return new TextDecoder().decode(await new Response(new Blob([b.slice(1)]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())
}
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('')

/** what a person types: spaces, dashes and case do not matter */
export const canon = (t: string) => t.toUpperCase().replace(/[^A-Z0-9]/g, '')

export function makeCode(): string {
  const r = crypto.getRandomValues(new Uint8Array(LENGTH))
  return Array.from(r, (x) => ALPHABET[x % ALPHABET.length]).join('')
}
export const showCode = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`

async function ids(code: string) {
  const enc = new TextEncoder()
  const id = hex(await crypto.subtle.digest('SHA-256', enc.encode(`friction-xfer-id:${code}`))).slice(0, 32)
  const base = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('friction-xfer-key'), iterations: 150_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  return { id, key }
}

const post = (body: unknown) => fetch('/api/lb', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) })

/** has this browser anything worth moving? */
export const hasData = () => { const s = useStore.getState(); return !!s.profile || s.sessions.length > 0 || s.settings.toured }

/** Seal this browser's data and park it for ten minutes. Resolves to the code to type in the other browser. */
export async function sendData(): Promise<string> {
  const code = makeCode()
  const { id, key } = await ids(canon(code))
  const me = await identity()
  let layout: unknown = null
  try { layout = JSON.parse(localStorage.getItem('friction:layout') ?? 'null') } catch { /* none */ }
  const plain = await pack(JSON.stringify({ v: 1, data: snapshotData(), me: { key: me.key, name: me.name }, layout }))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain as unknown as ArrayBuffer))
  const blob = b64(new Uint8Array([...iv, ...sealed]))
  const r = await post({ a: 'xput', id, blob, owner: await roomId(me) })
  if (!r.ok) throw new Error(r.status === 429 ? 'Too many tries. Wait a little and try again.' : r.status === 400 ? 'Your data is too large to move this way.' : 'The server could not be reached.')
  return code
}

/** Take a hand-off with its code, check it, and make it this browser's data. The page reloads when it is done. */
export async function receiveData(typed: string): Promise<void> {
  const code = canon(typed)
  if (code.length !== LENGTH || [...code].some((c) => !ALPHABET.includes(c))) throw new Error('That code is not the right length. It is eight letters and numbers.')
  const { id, key } = await ids(code)
  const r = await post({ a: 'xget', id })
  if (r.status === 404) throw new Error('No data is waiting for that code. It lasts ten minutes and works once. Make a new one and try again.')
  if (r.status === 429) throw new Error('Too many tries. Wait a little and try again.')
  if (!r.ok) throw new Error('The server could not be reached.')
  const { blob } = (await r.json()) as { blob: string }
  let payload: { v?: number; data?: unknown; me?: { key?: string; name?: string }; layout?: unknown }
  try {
    const raw = unb64(blob)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12))
    payload = JSON.parse(await unpack(new Uint8Array(plain)))
  } catch { throw new Error('That code did not open the data.') }
  if (payload.v !== 1) throw new Error('That data comes from a different version of Friction.')
  const { data, matched } = sanitizeData(payload.data)
  if (!matched) throw new Error('There was nothing readable in that data.')
  // the same private key means the same place on the board and in rooms; only a well-formed key is taken
  if (typeof payload.me?.key === 'string' && /^[a-f0-9]{32}$/.test(payload.me.key)) {
    const name = String(payload.me.name ?? '').replace(/[\u0000-\u001f<>&"'`\\]/g, '').slice(0, 20)
    try { localStorage.setItem('friction:me', JSON.stringify({ key: payload.me.key, code: '', name })) } catch { /* storage blocked */ }
  }
  if (payload.layout && typeof payload.layout === 'object') { try { localStorage.setItem('friction:layout', JSON.stringify(payload.layout)) } catch { /* storage blocked */ } }
  useStore.getState().restore(data)
  useStore.setState({ seenIntro: true })
  // the store writes a moment after a change, and the page is read again from storage when it reloads
  await new Promise((done) => setTimeout(done, 900))
  location.reload()
}
