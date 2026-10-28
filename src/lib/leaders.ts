/**
 * Recommendations and the leaderboard. Your browser holds a private key; a short public code is made from it
 * and goes in your share link. When someone new arrives through that link and tunes in, the code is counted once.
 * The server (api/lb.ts) only keeps a person once they reach a few recommends.
 *
 * Who you are is the private key and nothing else. The public code is always worked out from it, never read back from storage,
 * so editing the saved identity cannot make you someone else; the key is the only thing the server trusts, and nobody else has it.
 * Together rooms use a second id made from the same key that is never shown or shared (`roomId`).
 */
const ME = 'friction:me'
const FROM = 'friction:from'
const COUNTED = 'friction:counted'
const ERASE = 'friction:erase'

export interface Me { key: string; code: string; name: string }
export interface Row { rank: number; name: string; n: number }
export interface Standing { min: number; listed: boolean; n: number; name: string; rank: number }

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* storage blocked */ } },
}

async function codeOf(key: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 10)
}

async function digest(text: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
/** The id used in Together rooms: from the secret key, 128 bits, never displayed or put in a link. */
export const roomId = async (me: Me) => (await digest(`room:${me.key}`)).slice(0, 32)

const KEYRE = /^[a-f0-9]{32}$/
const tidy = (n: unknown) => String(n ?? '').replace(/[\u0000-\u001f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20)

export async function identity(): Promise<Me> {
  try {
    const saved = JSON.parse(ls.get(ME) ?? 'null') as Partial<Me> | null
    if (saved && typeof saved.key === 'string' && KEYRE.test(saved.key)) {
      // the code is never taken from storage: it is made from the key, so a hand-edited file cannot point at someone else's
      const code = await codeOf(saved.key)
      const me = { key: saved.key, code, name: tidy(saved.name) }
      if (saved.code !== code || saved.name !== me.name) ls.set(ME, JSON.stringify(me))
      return me
    }
  } catch { /* fall through and make a new one */ }
  const key = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('')
  const me = { key, code: await codeOf(key), name: '' }
  ls.set(ME, JSON.stringify(me))
  return me
}
export const saveName = (me: Me, name: string) => ls.set(ME, JSON.stringify({ ...me, name }))
export const shareUrl = (code: string) => `${location.origin}/?ref=${code}`

/** On arrival: if the address carries someone's code, remember it and tidy the address. Nothing is sent yet. */
export function captureRef() {
  try {
    const u = new URL(location.href)
    const ref = u.searchParams.get('ref')
    if (!ref) return
    if (/^[a-f0-9]{10}$/.test(ref) && !ls.get(COUNTED) && !ls.get(FROM)) ls.set(FROM, ref)
    u.searchParams.delete('ref')
    history.replaceState(null, '', u.pathname + (u.search || '') + u.hash)
  } catch { /* an odd address: ignore it */ }
}

/** Called when a visitor actually starts using the app. Counts the person who sent them, once per browser, never yourself. */
export async function countRecommend() {
  const from = ls.get(FROM)
  if (!from || ls.get(COUNTED)) return
  ls.set(COUNTED, '1')
  try {
    if (from === (await identity()).code) return
    await fetch('/api/lb', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 'recommend', code: from }) })
  } catch { /* offline: the recommend is simply not counted */ }
}

export async function loadBoard(): Promise<{ min: number; rows: Row[] }> {
  const r = await fetch('/api/lb?a=board')
  if (!r.ok) throw new Error('board')
  return r.json()
}
export async function loadStanding(me: Me): Promise<Standing> {
  // the secret key goes in the body of a POST, never in an address that a log could keep
  const r = await fetch('/api/lb', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 'me', key: me.key }) })
  if (!r.ok) throw new Error('me')
  return r.json()
}
export type NameResult = 'ok' | 'taken' | 'reserved' | 'invalid' | 'error'
/** Asks the board to show this alias. Names are unique: "Zak", "zak" and "Z.a.k" are the same name. */
export async function sendName(me: Me, name: string): Promise<NameResult> {
  try {
    const r = await fetch('/api/lb', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 'name', key: me.key, name }) })
    if (!r.ok) return 'error'
    const j = (await r.json()) as { ok: boolean; reason?: string }
    return j.ok ? 'ok' : (j.reason as NameResult) || 'error'
  } catch { return 'error' }
}
/** Is this alias already on the board (or not allowed)? Checked before you commit to it. */
export async function checkName(name: string): Promise<'free' | 'taken' | 'reserved' | 'error'> {
  try {
    const r = await fetch(`/api/lb?a=check&name=${encodeURIComponent(name)}`)
    if (!r.ok) return 'error'
    const j = (await r.json()) as { taken: boolean; reserved: boolean }
    return j.reserved ? 'reserved' : j.taken ? 'taken' : 'free'
  } catch { return 'error' }
}
export const nameProblem = (r: NameResult | 'free'): string => (r === 'taken' ? 'That name is already on the board. Pick another.' : r === 'reserved' || r === 'invalid' ? 'That name is not allowed. Pick another.' : r === 'error' ? 'Could not check that name. Try again.' : '')

/** The public alias: what everyone sees on the board. Separate from the private name your friends know you by. */
export const hasAlias = (me: Me) => me.name.trim().length > 0
export const hasIdentity = () => !!ls.get(ME)

/**
 * Erase your place: asks the server to remove you from the board (and your alias with you) and out of every room, then forgets
 * the key here. If the server cannot be reached the key is kept in a small pending note and the request is repeated next time the
 * app opens, so a flat battery or a dropped connection never leaves you listed with no way back.
 */
export async function eraseMe(): Promise<boolean> {
  let key = ''
  try { key = (JSON.parse(ls.get(ME) ?? 'null') as { key?: string } | null)?.key ?? '' } catch { /* nothing saved */ }
  const pending = ls.get(ERASE)
  const k = KEYRE.test(key) ? key : pending && KEYRE.test(pending) ? pending : ''
  for (const x of [ME, FROM, COUNTED, 'friction:board-seen']) { try { localStorage.removeItem(x) } catch { /* storage blocked */ } }
  if (!k) return true
  ls.set(ERASE, k)
  return retryErase()
}
/** Repeats an erase that did not get through. Safe to call any time. */
export async function retryErase(): Promise<boolean> {
  const k = ls.get(ERASE)
  if (!k || !KEYRE.test(k)) { try { localStorage.removeItem(ERASE) } catch { /* storage blocked */ } return true }
  try {
    const r = await fetch('/api/lb', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 'erase', key: k }) })
    if (!r.ok) return false
    try { localStorage.removeItem(ERASE) } catch { /* storage blocked */ }
    return true
  } catch { return false }
}
