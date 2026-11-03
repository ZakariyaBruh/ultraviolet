import { useEffect } from 'react'
import { create } from 'zustand'
import { fx_say } from './actions'
import { identity, roomId } from './leaders'
import { notify } from './notify'
import { audioEl, play, usePlayer } from './player'
import { useStore, type MediaItem } from './store'

export interface Member { name: string; me: boolean; status: 'idle' | 'locked' | 'done'; left: number; away: boolean }
export interface Msg { id: number; who: string; text: string; sys: boolean; t: number }
export interface Shared { id: string; kind: 'radio' | 'tv'; name: string; url: string; logo?: string; meta?: string; by: string; at: number; /** where a podcast episode was, in seconds, when it was shared */ pos?: number }
export interface RoomState {
  code: string; host: string; isHost: boolean; hasHook: boolean
  media: Shared | null
  sess: { start: number; min: number; by: string } | null
  members: Member[]; msgs: Msg[]; now: number
}

const KEY = 'friction:room'
const INVITE = 'friction:room-invite'
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* storage blocked */ } },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* storage blocked */ } },
}

interface Room {
  code: string | null
  room: RoomState | null
  msgs: Msg[]
  err: string
  busy: boolean
  follow: boolean
  unread: number
  seenSess: number
  seenMedia: number
}
export const useRoom = create<Room>(() => ({ code: ls.get(KEY), room: null, msgs: [], err: '', busy: false, follow: true, unread: 0, seenSess: 0, seenMedia: 0 }))
const set = useRoom.setState

async function call<T = RoomState>(body: Record<string, unknown>): Promise<T> {
  const me = await identity()
  const r = await fetch('/api/room', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: await roomId(me), ...body }) })
  const j = (await r.json().catch(() => ({}))) as { error?: string }
  if (!r.ok) throw new Error(j.error || 'The room did not answer.')
  return j as T
}

/** The private name your friends know you by (not the leaderboard alias). */
export const friendName = () => useStore.getState().profile?.name?.trim() ?? ''

export function inviteFromAddress() {
  try {
    const u = new URL(location.href)
    const room = u.searchParams.get('room')
    if (!room) return
    if (/^[A-Za-z0-9]{6}$/.test(room)) ls.set(INVITE, room.toUpperCase())
    u.searchParams.delete('room')
    history.replaceState(null, '', u.pathname + (u.search || '') + u.hash)
  } catch { /* an odd address: ignore it */ }
}
export const pendingInvite = () => ls.get(INVITE)
export const clearInvite = () => ls.del(INVITE)
export const inviteLink = (code: string) => `${location.origin}/?room=${code}`

let timer: ReturnType<typeof setTimeout> | undefined
let doneUntil = 0
let finishedFlag = false

function status(): { status: 'idle' | 'locked' | 'done'; left: number } {
  const s = useStore.getState().session
  if (s) return { status: 'locked', left: Math.max(0, Math.round(s.goalMin * 60 - s.elapsedSec)) }
  return { status: Date.now() < doneUntil ? 'done' : 'idle', left: 0 }
}

function absorb(r: RoomState, first: boolean) {
  const prev = useRoom.getState()
  const inView = location.pathname === '/together' && !document.hidden
  const next = r.msgs.length + '|' + r.sess?.start + '|' + r.media?.at + '|' + r.members.map((m) => m.name + m.status + m.away).join(',')
  if (next !== sig) { sig = next; lastChange = Date.now() }
  let msgs = prev.msgs
  const known = new Set(msgs.map((m) => m.id))
  const fresh = r.msgs.filter((m) => !known.has(m.id))
  if (fresh.length) msgs = [...msgs, ...fresh].slice(-120)
  let unread = prev.unread
  if (!first) {
    for (const m of fresh) {
      if (m.sys) { if (/joined\.$/.test(m.text) || /left\.$/.test(m.text)) notify('together', m.text, 'Together'); continue }
      if (m.who !== useStore.getState().profile?.name) { if (!inView) { unread++; notify('together', `${m.who}: ${m.text}`, `Together · ${r.code}`) } }
    }
    if (r.sess && r.sess.start > prev.seenSess && r.sess.by !== friendName()) {
      notify('together', `${r.sess.by} started a ${r.sess.min} minute lock-in. Join them.`, 'Lock in together')
      fx_say({ title: `${r.sess.by} locked in`, description: `${r.sess.min} minutes. Join them from the Together screen.` })
    }
    if (r.media && r.media.at > prev.seenMedia && r.media.by !== friendName()) {
      const m = r.media
      notify('together', `${m.by} is ${m.kind === 'tv' ? 'watching' : 'listening to'} ${m.name}.`, 'Together')
      if (prev.follow) tuneTo(m)
      // a browser may refuse to start sound it was not asked for, so offer a button that counts as asking
      setTimeout(() => {
        const st = usePlayer.getState()
        const playing = st.current?.id === m.id && (st.status === 'playing' || st.status === 'loading')
        if (!playing) fx_say({ title: `${m.by} is ${m.kind === 'tv' ? 'watching' : 'listening to'} ${m.name}`, description: 'Tune in to join them.', undo: () => tuneTo(m), label: 'Tune in' })
      }, 900)
    }
  }
  set({ room: r, msgs, unread: inView ? 0 : unread, err: '', seenSess: Math.max(prev.seenSess, r.sess?.start ?? 0), seenMedia: Math.max(prev.seenMedia, r.media?.at ?? 0) })
}

export function tuneTo(m: Shared) {
  const item: MediaItem = { id: m.id, kind: m.kind, name: m.name, url: m.url, logo: m.logo, meta: m.meta ? `${m.meta} · with ${m.by}` : `With ${m.by}` }
  play(item, [item])
  // an episode carries on from where the sharer was, plus the time since they shared it
  if (m.pos !== undefined) {
    const to = m.pos + Math.max(0, (Date.now() - m.at) / 1000)
    const seek = () => { if (Number.isFinite(audioEl.duration)) audioEl.currentTime = Math.min(to, Math.max(0, audioEl.duration - 2)) }
    audioEl.addEventListener('loadedmetadata', seek, { once: true })
  }
}

/** One round trip to the room. */
async function poll(first = false) {
  const { code } = useRoom.getState()
  if (!code) return
  try {
    const st = status()
    const last = useRoom.getState().msgs.at(-1)?.id ?? 0
    const r = await call({ a: 'sync', code, name: friendName(), status: st.status, left: st.left, since: last, finished: finishedFlag })
    finishedFlag = false
    absorb(r, first)
  } catch (e) {
    const m = (e as Error).message
    if (/no room|not in room/i.test(m)) { leaveLocal(); set({ err: 'That room has closed.' }); return }
    set({ err: m })
  }
}

/**
 * The one polling loop. Every poll is a serverless call, and the free plan allows a million a month, so it runs
 * fast only while it matters: on the Together screen with something changing. Elsewhere it ticks slowly, which is
 * still well inside the 25 seconds before a member shows as away.
 */
let gen = 0
let lastChange = Date.now()
let sig = ''
const delay = () => (document.hidden ? 12000 : location.pathname !== '/together' ? 8000 : Date.now() - lastChange < 60000 ? 3000 : 6000)
async function loop(first = false) {
  clearTimeout(timer)
  const g = ++gen
  await poll(first)
  if (g === gen && useRoom.getState().code) timer = setTimeout(() => void loop(), delay())
}
const tick = () => { lastChange = Date.now(); return poll() }
/** Called when the Together screen opens or the tab comes back: look now, and keep looking quickly for a minute. */
export function nudge() { lastChange = Date.now(); if (useRoom.getState().code) void loop() }
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!document.hidden) nudge() })

function begin() { void loop(true) }
function leaveLocal() { clearTimeout(timer); gen++; ls.del(KEY); set({ code: null, room: null, msgs: [], unread: 0, seenSess: 0, seenMedia: 0 }) }

export async function createRoom() {
  set({ busy: true, err: '' })
  try {
    const r = await call({ a: 'create', name: friendName() })
    ls.set(KEY, r.code)
    set({ code: r.code, room: r, msgs: r.msgs, seenSess: r.sess?.start ?? 0, seenMedia: r.media?.at ?? 0 })
    begin()
  } catch (e) { set({ err: (e as Error).message }) } finally { set({ busy: false }) }
}
export async function joinRoom(raw: string) {
  const code = raw.trim().toUpperCase()
  if (!/^[A-Z0-9]{6}$/.test(code)) { set({ err: 'A room code is six letters or numbers.' }); return }
  set({ busy: true, err: '' })
  try {
    const r = await call({ a: 'sync', code, name: friendName(), status: 'idle', since: 0 })
    ls.set(KEY, code)
    clearInvite()
    set({ code, room: r, msgs: r.msgs, seenSess: r.sess?.start ?? 0, seenMedia: r.media?.at ?? 0 })
    begin()
  } catch (e) { set({ err: /no room/i.test((e as Error).message) ? 'No room with that code.' : (e as Error).message }) } finally { set({ busy: false }) }
}
export async function leaveRoom() {
  const { code } = useRoom.getState()
  leaveLocal()
  if (code) await call({ a: 'leave', code }).catch(() => undefined)
}
export const sendChat = (text: string) => call({ a: 'say', code: useRoom.getState().code, text }).then(() => tick())
export const lockTogether = async (minutes: number) => {
  const code = useRoom.getState().code
  await call({ a: 'lock', code, minutes })
  const s = useStore.getState()
  if (!s.session) s.startSession(minutes, usePlayer.getState().current?.kind ?? 'silent', `Together · ${code}`)
  void tick()
}
/** Join a lock-in someone else started: your timer ends when theirs does. */
export function joinLock() {
  const { room, code } = useRoom.getState()
  if (!room?.sess) return
  const mins = Math.ceil((room.sess.start + room.sess.min * 60e3 - Date.now()) / 60e3)
  if (mins < 1) { fx_say({ title: 'That lock-in has ended' }); return }
  const s = useStore.getState()
  if (s.session) { fx_say({ title: 'You are already locked in' }); return }
  s.startSession(mins, usePlayer.getState().current?.kind ?? 'silent', `Together · ${code}`)
  void tick()
}
export const shareNow = async () => {
  const cur = usePlayer.getState().current
  if (!cur || (cur.kind !== 'radio' && cur.kind !== 'tv')) { fx_say({ title: 'Play something first', description: 'Start a station, channel or podcast, then share it with the room.' }); return }
  const ep = cur.id.startsWith('pod:') || cur.id.startsWith('song:')
  const pos = ep && Number.isFinite(audioEl.currentTime) ? Math.round(audioEl.currentTime) : undefined
  await call({ a: 'media', code: useRoom.getState().code, media: { id: cur.id, kind: cur.kind, name: cur.name, url: cur.url, logo: cur.logo, meta: cur.meta, pos } })
  fx_say({ title: cur.id.startsWith('song:') ? 'Song shared' : ep ? 'Episode shared' : cur.kind === 'tv' ? 'Channel shared' : 'Station shared', description: `${cur.name.slice(0, 40)} is in the room now.`, variant: 'success' })
  void tick()
}
export const stopSharing = () => call({ a: 'media', code: useRoom.getState().code, media: null }).then(() => tick())
export const setHook = (url: string) => call({ a: 'hook', code: useRoom.getState().code, url }).then(() => tick())
export const setFollow = (follow: boolean) => set({ follow })
export const clearUnread = () => set({ unread: 0 })

/** Keeps a joined room alive across reloads, and tells the room when you finish a session. */
export function useTogether() {
  useEffect(() => {
    inviteFromAddress()
    if (useRoom.getState().code && friendName()) begin()
    let was = !!useStore.getState().session
    const off = useStore.subscribe((s) => {
      const now = !!s.session
      if (was && !now && s.sessions[0]?.completed && Date.now() - s.sessions[0].end < 5000) { doneUntil = Date.now() + 90e3; finishedFlag = true; if (useRoom.getState().code) void tick() }
      was = now
    })
    return () => { off(); clearTimeout(timer) }
  }, [])
}
