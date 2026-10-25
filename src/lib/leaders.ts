/**
 * Recommendations and the leaderboard. Your browser holds a private key; a short public code is made from it
 * and goes in your share link. When someone new arrives through that link and tunes in, the code is counted once.
 * The server (api/lb.ts) only keeps a person once they reach a few recommends.
 */
const ME = 'friction:me'
const FROM = 'friction:from'
const COUNTED = 'friction:counted'

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

export async function identity(): Promise<Me> {
  try {
    const saved = JSON.parse(ls.get(ME) ?? 'null') as Me | null
    if (saved && /^[a-f0-9]{32}$/.test(saved.key) && /^[a-f0-9]{10}$/.test(saved.code)) return saved
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
  const r = await fetch(`/api/lb?a=me&key=${me.key}`)
  if (!r.ok) throw new Error('me')
  return r.json()
}
export async function sendName(me: Me, name: string): Promise<boolean> {
  const r = await fetch('/api/lb', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 'name', key: me.key, name }) })
  return r.ok && ((await r.json()) as { ok: boolean }).ok
}
