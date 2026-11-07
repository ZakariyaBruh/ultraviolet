import { useSyncExternalStore } from 'react'
import { notify } from './notify'
import { applyPayload, b64, buildPayload, canon, hex, pack, unb64, unpack, type Payload } from './transfer'

/**
 * Cloud backup (supporters). The whole of what this browser keeps, sealed on this device and parked on the server, so a new phone or a
 * cleared browser is a minute of work and not a loss.
 *
 * Nothing leaves in the clear. A backup key (20 letters and numbers, made here, shown to the person) is the only secret. Three things are
 * worked out from it: an id to find the row, a second value that proves you hold the key (the server keeps only its hash), and an AES-GCM key
 * (PBKDF2) that seals the data. The server stores one sealed blob for each key and cannot read it. If another device saved a newer copy
 * since this one last looked, nothing is overwritten: the person chooses to restore that copy or to replace it.
 */
const STORE = 'friction:backup'
const PENDING = 'friction:backup-del'
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O, 1/I
export const BACKUP_KEY_LENGTH = 20
export const showKey = (k: string) => k.match(/.{1,4}/g)?.join('-') ?? k

export interface BackupState {
  /** the backup key (canonical, no dashes) */
  code: string
  /** the time of the last copy on the server that this browser saved or restored */
  at: number
  /** a fingerprint of what was last saved, so an unchanged browser does not upload again */
  sig: string
  /** when this browser last checked in */
  last: number
}
export interface BackupView { state: BackupState | null; busy: boolean; error: string; conflict: boolean }

let view: BackupView = { state: read(), busy: false, error: '', conflict: false }
const listeners = new Set<() => void>()
const set = (p: Partial<BackupView>) => { view = { ...view, ...p }; listeners.forEach((f) => f()) }

function read(): BackupState | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Partial<BackupState> | null
    if (v && typeof v.code === 'string' && v.code.length === BACKUP_KEY_LENGTH && [...v.code].every((c) => ALPHABET.includes(c))) return { code: v.code, at: Number(v.at) || 0, sig: String(v.sig ?? ''), last: Number(v.last) || 0 }
  } catch { /* none */ }
  return null
}
function write(s: BackupState | null) {
  try { if (s) localStorage.setItem(STORE, JSON.stringify(s)); else localStorage.removeItem(STORE) } catch { /* storage blocked */ }
  set({ state: s })
}
export const useBackup = (): BackupView => useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => view, () => view)

/* ───────────── keys and sealing ───────────── */

export function makeKey(): string {
  const r = crypto.getRandomValues(new Uint8Array(BACKUP_KEY_LENGTH))
  return Array.from(r, (x) => ALPHABET[x % ALPHABET.length]).join('')
}
export const validKey = (typed: string) => { const c = canon(typed); return c.length === BACKUP_KEY_LENGTH && [...c].every((x) => ALPHABET.includes(x)) }

interface Keys { id: string; auth: string; key: CryptoKey }
const cache = new Map<string, Promise<Keys>>()
function derive(code: string): Promise<Keys> {
  let k = cache.get(code)
  if (!k) {
    k = (async () => {
      const enc = new TextEncoder()
      const id = hex(await crypto.subtle.digest('SHA-256', enc.encode(`friction-backup-id:${code}`))).slice(0, 32)
      const auth = hex(await crypto.subtle.digest('SHA-256', enc.encode(`friction-backup-auth:${code}`))).slice(0, 32)
      const base = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey'])
      const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('friction-backup-key'), iterations: 150_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
      return { id, auth, key }
    })()
    cache.set(code, k)
  }
  return k
}
async function seal(text: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, (await pack(text)) as unknown as ArrayBuffer))
  return b64(new Uint8Array([...iv, ...sealed]))
}
async function open(blob: string, key: CryptoKey): Promise<Payload> {
  const raw = unb64(blob)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12))
  return JSON.parse(await unpack(new Uint8Array(plain)))
}
const fingerprint = async (text: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).slice(0, 16)

const post = (body: unknown) => fetch('/api/lb', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) })
const sorry = (status: number) => (status === 429 ? 'Too many tries. Wait a little and try again.' : status === 507 ? 'The backup space is full right now. Try again later.' : status === 400 ? 'Your data is too large to back up.' : 'The server could not be reached.')

/* ───────────── saving ───────────── */

export type SaveResult = 'saved' | 'same' | 'conflict' | 'off'

/** Save a copy now. Does nothing when nothing has changed since the last save, unless `force`. A newer copy from another device is never overwritten. */
export async function backupNow(force = false): Promise<SaveResult> {
  const st = view.state
  if (!st) return 'off'
  if (view.busy) return 'same'
  set({ busy: true, error: '' })
  try {
    const text = await buildPayload()
    const sig = await fingerprint(text)
    if (!force && sig === st.sig && !view.conflict) { write({ ...st, last: Date.now() }); return 'same' }
    const { id, auth, key } = await derive(st.code)
    const r = await post({ a: 'bput', id, auth, blob: await seal(text, key), prev: st.at })
    if (r.status === 409) {
      const first = !view.conflict
      set({ conflict: true })
      if (first) notify('system', 'Cloud backup is paused: another device saved a newer copy. Open Settings, Data to choose which to keep.', 'Backup paused')
      return 'conflict'
    }
    if (r.status === 404) {
      // the copy was deleted from somewhere else (turned off or erased on another device, or not saved for over a year): do not bring it back
      write(null)
      set({ conflict: false })
      notify('system', 'Cloud backup was deleted from another device, so it is off here too. Turn it on again in Settings, Data if you want a new one.', 'Backup off')
      return 'off'
    }
    if (!r.ok) throw new Error(sorry(r.status))
    const { t } = (await r.json()) as { t: number }
    set({ conflict: false })
    write({ ...st, at: t, sig, last: Date.now() })
    return 'saved'
  } catch (e) {
    set({ error: (e as Error).name === 'TimeoutError' ? 'The server took too long.' : (e as Error).message })
    return 'same'
  } finally { set({ busy: false }) }
}

/** Turn backup on: make a key, save the first copy, remember the key on this device. Resolves to the key to write down. */
export async function enableBackup(): Promise<string> {
  const code = makeKey()
  set({ busy: true, error: '' })
  try {
    const { id, auth, key } = await derive(code)
    const text = await buildPayload()
    const r = await post({ a: 'bput', id, auth, blob: await seal(text, key), prev: 0 })
    if (!r.ok) throw new Error(sorry(r.status))
    const { t } = (await r.json()) as { t: number }
    write({ code, at: t, sig: await fingerprint(text), last: Date.now() })
    set({ conflict: false })
    return code
  } catch (e) { set({ error: (e as Error).message }); throw e } finally { set({ busy: false }) }
}

/* ───────────── restoring ───────────── */

/** Fetch a copy with its key and make it this browser's data. The page reloads when it is done. The key stays on this device so backing up carries on. */
export async function restoreBackup(typed: string): Promise<void> {
  const code = canon(typed)
  if (code.length !== BACKUP_KEY_LENGTH) throw new Error(`That key is not the right length. It is ${BACKUP_KEY_LENGTH} letters and numbers.`)
  if (!validKey(code)) throw new Error('That key has a character Friction never uses. There is no 0, O, 1 or I in a key.')
  const { id, auth, key } = await derive(code)
  const r = await post({ a: 'bget', id, auth })
  if (r.status === 404) throw new Error('No backup was found for that key. Check it for a mistyped letter.')
  if (r.status === 403) throw new Error('That key does not match the backup.')
  if (!r.ok) throw new Error(sorry(r.status))
  const { blob, t } = (await r.json()) as { blob: string; t: number }
  let payload: Payload
  try { payload = await open(blob, key) } catch { throw new Error('That key did not open the backup.') }
  // keep the key and the copy's time first, so that after the reload this browser carries on saving to the same place without a clash
  try { localStorage.setItem(STORE, JSON.stringify({ code, at: t, sig: '', last: Date.now() } satisfies BackupState)) } catch { /* storage blocked */ }
  await applyPayload(payload)
}

/** Another device saved a newer copy: take it (replacing this browser's data). */
export async function takeNewerBackup(): Promise<void> {
  if (!view.state) throw new Error('Backup is off.')
  await restoreBackup(view.state.code)
}

/** Another device saved a newer copy: keep this browser's data and replace the copy on the server. */
export async function replaceBackup(): Promise<void> {
  const st = view.state
  if (!st) return
  set({ busy: true, error: '' })
  try {
    const { id, auth } = await derive(st.code)
    const h = await post({ a: 'bget', id, auth, head: true })
    if (!h.ok) throw new Error(sorry(h.status))
    const { t } = (await h.json()) as { t: number }
    write({ ...st, at: t, sig: '' })
    set({ conflict: false, busy: false })
    await backupNow(true)
  } catch (e) { set({ error: (e as Error).message }) } finally { set({ busy: false }) }
}

/* ───────────── turning it off, and erasing ───────────── */

/**
 * Delete the copy on the server and forget the key on this device. If the server cannot be reached the request is kept as a note and
 * repeated next time, so a wipe is never half done.
 */
export async function deleteBackup(): Promise<boolean> {
  const st = view.state ?? read()
  if (!st) return true
  const { id, auth } = await derive(st.code)
  write(null)
  set({ conflict: false, error: '' })
  try { localStorage.setItem(PENDING, JSON.stringify({ id, auth })) } catch { /* storage blocked */ }
  return retryBackupDelete()
}
export async function retryBackupDelete(): Promise<boolean> {
  let p: { id?: string; auth?: string } | null = null
  try { p = JSON.parse(localStorage.getItem(PENDING) ?? 'null') } catch { /* none */ }
  if (!p?.id || !p.auth) { try { localStorage.removeItem(PENDING) } catch { /* storage blocked */ } return true }
  try {
    const r = await post({ a: 'bdel', id: p.id, auth: p.auth })
    if (!r.ok && r.status !== 403) return false
    try { localStorage.removeItem(PENDING) } catch { /* storage blocked */ }
    return true
  } catch { return false }
}

/* ───────────── keeping it up to date ───────────── */

/** Save about every five minutes while the app is open and the data has changed. Cheap when nothing changed: one fingerprint, no request. */
export function startBackupWatch(): () => void {
  const run = () => { if (view.state && !document.hidden && !view.conflict) void backupNow() }
  const leave = () => { if (document.hidden && view.state && !view.conflict) void backupNow() }
  const first = setTimeout(run, 20_000)
  const t = setInterval(run, 5 * 60_000)
  document.addEventListener('visibilitychange', leave)
  return () => { clearTimeout(first); clearInterval(t); document.removeEventListener('visibilitychange', leave) }
}
