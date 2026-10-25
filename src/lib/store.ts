import { create } from 'zustand'
import { useFx } from './fx'
import { useUI } from './ui'
import { normalizeTheme, type ThemeId } from './themes'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { dateKey } from './dates'

export interface Mute {
  id: string
  word: string
  /** epoch ms the mute ends; 0 means until you lift it */
  until: number
}

export interface Flash {
  id: string
  front: string
  back: string
  /** Leitner box 0..4 */
  box: number
  due: number
}
export interface Learn {
  xp: number
  /** days (YYYY-MM-DD) with any learning */
  days: string[]
  done: Record<string, { at: number; score: number; total: number }>
  deck: Flash[]
}

export type MediaKind = 'radio' | 'tv'

export interface MediaItem {
  id: string
  kind: MediaKind
  name: string
  url: string
  logo?: string
  meta?: string
  tags?: string[]
  uuid?: string
}

import type { BookRef } from './books'

export interface SessionRec {
  id: string
  start: number
  end: number
  goalMin: number
  focusSec: number
  urges: number
  lapses: number
  source: MediaKind | 'silent'
  title: string
  completed: boolean
}

export interface ActiveSession {
  id: string
  start: number
  goalMin: number
  elapsedSec: number
  urges: number
  lapses: number
  paused: boolean
  source: MediaKind | 'silent'
  title: string
}

export type EventKind = 'blocked' | 'wander' | 'session' | 'tune' | 'system' | 'goal' | 'learn' | 'board' | 'together'

export interface EventRec {
  id: string
  t: number
  kind: EventKind
  text: string
  read: boolean
}

export interface Profile {
  name: string
  since: number
}

export interface Settings {
  dailyGoalMin: number
  sessionMin: number
  /** 0 calm · 1 lively · 2 maximum */
  motion: 0 | 1 | 2
  volume: number
  /** swallow and count scroll gestures (on by default) */
  guard: boolean
  theme: ThemeId
  /** how far into the future the look goes: 0 is the past (most retro), 100 is the future */
  era: number
  /** custom accent and background colours (#rrggbb), '' keeps the theme's own */
  accent: string
  bg: string
}

type HourLog = Record<string, number[]>
export type SourceKey = MediaKind | 'silent'
export type SourceLog = Record<string, Record<SourceKey, number[]>>

interface Data {
  settings: Settings
  focusLog: HourLog
  /** minutes per hour, split by what was playing */
  sourceLog: SourceLog
  urgeLog: HourLog
  lapseLog: Record<string, number>
  sourceSecs: Record<MediaKind | 'silent', number>
  sessions: SessionRec[]
  favorites: MediaItem[]
  recent: MediaItem[]
  seenIntro: boolean
  demo: boolean
  profile: Profile | null
  events: EventRec[]
  books: BookRef[]
  /** topics hidden from the news, until a time (0 = until removed) */
  mutes: Mute[]
  learn: Learn
}

interface Actions {
  setSettings: (patch: Partial<Settings>) => void
  startSession: (goalMin: number, source: MediaKind | 'silent', title: string) => void
  setSessionSource: (source: MediaKind | 'silent', title: string) => void
  tick: (sec?: number) => void
  addLapse: () => void
  togglePause: () => void
  endSession: (completed: boolean) => void
  toggleFavorite: (item: MediaItem) => void
  toggleBook: (book: BookRef) => void
  setMutes: (m: Mute[]) => void
  setLearn: (l: Learn) => void
  pushRecent: (item: MediaItem) => void
  markIntroSeen: () => void
  setProfile: (p: Profile | null) => void
  log: (kind: EventKind, text: string) => void
  markEventsRead: () => void
  markEventRead: (id: string) => void
  loadDemo: () => void
  resetAll: () => void
  restore: (snapshot: Data) => void
  importData: (json: string) => boolean
}

interface Live {
  session: ActiveSession | null
}

export type AppState = Data & Actions & Live

export const DEFAULT_SETTINGS: Settings = {
  dailyGoalMin: 90,
  sessionMin: 25,
  motion: 1,
  volume: 0.8,
  guard: true,
  theme: 'station',
  era: 62,
  accent: '',
  bg: '',
}

const emptyData = (): Data => ({
  settings: { ...DEFAULT_SETTINGS },
  focusLog: {},
  sourceLog: {},
  urgeLog: {},
  lapseLog: {},
  sourceSecs: { radio: 0, tv: 0, silent: 0 },
  sessions: [],
  favorites: [],
  recent: [],
  seenIntro: false,
  demo: false,
  profile: null,
  events: [],
  books: [],
  mutes: [],
  learn: { xp: 0, days: [], done: {}, deck: [] },
})

export const DATA_KEYS = Object.keys(emptyData()) as (keyof Data)[]


const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Accept only what has the right shape; anything else falls back to the default for that key. */
export function sanitizeData(raw: unknown): { data: Data; matched: number } {
  const base = emptyData()
  const out: Record<string, unknown> = { ...base }
  let matched = 0
  if (!isObj(raw)) return { data: base, matched }
  const hourLog = (v: unknown) => {
    if (!isObj(v)) return null
    const o: Record<string, number[]> = {}
    for (const [k, row] of Object.entries(v)) if (Array.isArray(row) && row.length === 24 && row.every((n) => typeof n === 'number')) o[k] = row as number[]
    return o
  }
  for (const k of DATA_KEYS) {
    const v = raw[k]
    if (v === undefined) continue
    const b = (base as unknown as Record<string, unknown>)[k]
    let ok: unknown = undefined
    if (k === 'settings') {
      if (isObj(v)) {
        const st: Record<string, unknown> = { ...DEFAULT_SETTINGS }
        for (const [sk, dv] of Object.entries(DEFAULT_SETTINGS)) if (typeof v[sk] === typeof dv) st[sk] = v[sk]
        if (![0, 1, 2].includes(st.motion as number)) st.motion = DEFAULT_SETTINGS.motion
        st.theme = normalizeTheme(v.theme)
        st.era = Math.min(100, Math.max(0, Math.round(Number(st.era))))
        for (const ck of ['accent', 'bg'] as const) if (!/^#[0-9a-f]{6}$/i.test(String(st[ck]))) st[ck] = ''
        ok = st
      }
    } else if (k === 'focusLog' || k === 'urgeLog') ok = hourLog(v) ?? undefined
    else if (k === 'sourceLog') {
      if (isObj(v)) {
        const o: Record<string, unknown> = {}
        for (const [d, day] of Object.entries(v)) if (isObj(day) && ['radio', 'tv', 'silent'].every((x) => Array.isArray(day[x]) && (day[x] as unknown[]).length === 24)) o[d] = day
        ok = o
      }
    } else if (k === 'profile') ok = v === null || (isObj(v) && typeof v.name === 'string') ? v : undefined
    else if (Array.isArray(b)) ok = Array.isArray(v) ? v.filter((x) => isObj(x)) : undefined
    else if (typeof b === 'boolean') ok = typeof v === 'boolean' ? v : undefined
    else if (isObj(b)) ok = isObj(v) ? v : undefined
    if (ok !== undefined) {
      out[k] = ok
      matched++
    }
  }
  return { data: out as unknown as Data, matched }
}

const zeros = () => new Array<number>(24).fill(0)

const hours = (log: HourLog, key: string) => {
  const row = log[key]
  return row ? row.slice() : new Array(24).fill(0)
}

/** localStorage with debounced writes (the store ticks every second). */
let timer: ReturnType<typeof setTimeout> | undefined
let pending: [string, string] | null = null
const flush = () => {
  if (!pending) return
  try {
    localStorage.setItem(pending[0], pending[1])
  } catch {
    /* storage full or blocked: keep running in memory */
  }
  pending = null
}
const debounced: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k, v) => {
    pending = [k, v]
    clearTimeout(timer)
    timer = setTimeout(flush, 500)
  },
  removeItem: (k) => {
    pending = null
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  },
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush())
}

const uid = () => Math.random().toString(36).slice(2, 10)

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...emptyData(),
      session: null,

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      startSession: (goalMin, source, title) =>
        set({
          session: {
            id: uid(),
            start: Date.now(),
            goalMin,
            elapsedSec: 0,
            urges: 0,
            lapses: 0,
            paused: false,
            source,
            title,
          },
        }),

      setSessionSource: (source, title) =>
        set((s) => (s.session ? { session: { ...s.session, source, title } } : s)),

      tick: (sec = 1) => {
        const s = get()
        const a = s.session
        if (!a || a.paused) return
        const now = new Date()
        const key = dateKey(now)
        const row = hours(s.focusLog, key)
        row[now.getHours()] += sec / 60
        const elapsed = a.elapsedSec + sec
        const day = s.sourceLog[key] ?? { radio: zeros(), tv: zeros(), silent: zeros() }
        const srcRow = (day[a.source] ?? zeros()).slice()
        srcRow[now.getHours()] += sec / 60
        set({
          focusLog: { ...s.focusLog, [key]: row },
          sourceLog: { ...s.sourceLog, [key]: { ...day, [a.source]: srcRow } },
          sourceSecs: { ...s.sourceSecs, [a.source]: s.sourceSecs[a.source] + sec },
          session: { ...a, elapsedSec: elapsed },
        })
        if (elapsed >= a.goalMin * 60) get().endSession(true)
      },

      addLapse: () => {
        const s = get()
        const now = new Date()
        const key = dateKey(now)
        const row = hours(s.urgeLog, key)
        row[now.getHours()] += 1
        set({
          urgeLog: { ...s.urgeLog, [key]: row },
          lapseLog: { ...s.lapseLog, [key]: (s.lapseLog[key] ?? 0) + 1 },
          session: s.session ? { ...s.session, lapses: s.session.lapses + 1, urges: s.session.urges + 1 } : null,
        })
        get().log('wander', s.session ? `You left the tab during ${s.session.title}` : 'You left the tab mid-session')
      },

      togglePause: () =>
        set((s) => (s.session ? { session: { ...s.session, paused: !s.session.paused } } : s)),

      endSession: (completed) => {
        const s = get()
        const a = s.session
        if (!a) return
        const rec: SessionRec = {
          id: a.id,
          start: a.start,
          end: Date.now(),
          goalMin: a.goalMin,
          focusSec: a.elapsedSec,
          urges: a.urges,
          lapses: a.lapses,
          source: a.source,
          title: a.title,
          completed,
        }
        set({
          session: null,
          sessions: a.elapsedSec >= 10 ? [rec, ...s.sessions].slice(0, 300) : s.sessions,
        })
        if (completed) useUI.getState().set({ celebrate: { title: 'Session complete', detail: `${a.goalMin} minutes held, ${a.urges} drift${a.urges === 1 ? '' : 's'}.` } })
        // a finished session gets the celebration card instead of a toast
        if (!completed) useFx.getState().say(a.elapsedSec >= 10 ? { title: 'Session ended', description: `${Math.round(a.elapsedSec / 60)} of ${a.goalMin} min kept.` } : { title: 'Too short to count', description: 'Sessions under 10 seconds are not saved.' })
        get().log('session', `${completed ? 'Completed' : 'Ended'} ${a.title}: ${Math.round(a.elapsedSec / 60)} of ${a.goalMin} min, ${a.urges} blocked`)
      },

      setLearn: (learn) => set({ learn }),
      setMutes: (mutes) => set({ mutes: mutes.slice(0, 200) }),

      toggleBook: (book) => set((s) => ({ books: s.books.some((b) => b.id === book.id) ? s.books.filter((b) => b.id !== book.id) : [book, ...s.books].slice(0, 100) })),

      toggleFavorite: (item) =>
        set((s) => ({
          favorites: s.favorites.some((f) => f.id === item.id)
            ? s.favorites.filter((f) => f.id !== item.id)
            : [item, ...s.favorites].slice(0, 60),
        })),

      pushRecent: (item) =>
        set((s) => ({ recent: [item, ...s.recent.filter((r) => r.id !== item.id)].slice(0, 14) })),

      markIntroSeen: () => set({ seenIntro: true }),

      setProfile: (profile) => set({ profile }),

      log: (kind, text) =>
        set((s) => ({
          events: [{ id: uid(), t: Date.now(), kind, text, read: false }, ...s.events].slice(0, 200),
        })),

      markEventsRead: () => set((s) => ({ events: s.events.map((e) => (e.read ? e : { ...e, read: true })) })),

      markEventRead: (id) => set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, read: true } : e)) })),

      loadDemo: () => {
        const demo = makeDemo()
        set({ ...demo, settings: get().settings, favorites: get().favorites, recent: get().recent, profile: get().profile, events: get().events, books: get().books, mutes: get().mutes, learn: get().learn, seenIntro: true, demo: true })
      },

      resetAll: () => set({ ...emptyData(), seenIntro: true, session: null }),

      restore: (snapshot) => set({ ...snapshot, session: null }),

      importData: (json) => {
        try {
          const { data, matched } = sanitizeData(JSON.parse(json))
          if (matched === 0) return false
          set({ ...data, session: null })
          return true
        } catch {
          return false
        }
      },
    }),
    {
      name: 'anti-scroll:v1',
      version: 1,
      storage: createJSONStorage(() => debounced),
      partialize: (s) => {
        const out: Record<string, unknown> = {}
        for (const k of DATA_KEYS) out[k] = s[k]
        out.session = s.session
        return out as unknown as AppState
      },
      // never trust what is on disk: validate every key, and close a session that a reload interrupted
      merge: (persisted, current) => {
        const { data } = sanitizeData(persisted)
        const p = persisted as { session?: ActiveSession | null } | null
        const a = p && isObj(p.session) ? (p.session as ActiveSession) : null
        if (a && typeof a.elapsedSec === 'number' && a.elapsedSec >= 10 && typeof a.start === 'number') {
          data.sessions = [{ id: a.id, start: a.start, end: Date.now(), goalMin: a.goalMin, focusSec: a.elapsedSec, urges: a.urges ?? 0, lapses: a.lapses ?? 0, source: a.source, title: a.title, completed: false }, ...data.sessions].slice(0, 300)
          data.events = [{ id: uid(), t: Date.now(), kind: 'session' as const, text: `Interrupted ${a.title}: ${Math.round(a.elapsedSec / 60)} of ${a.goalMin} min kept`, read: false }, ...data.events].slice(0, 200)
        }
        return { ...current, ...data, session: null }
      },
      migrate: (state) => state as AppState,
    },
  ),
)

export function snapshotData(): Data {
  const s = useStore.getState()
  const out = {} as Record<string, unknown>
  for (const k of DATA_KEYS) out[k] = s[k]
  return JSON.parse(JSON.stringify(out)) as Data
}

/* ───────── demo history so the heatmaps have something to show ───────── */
function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function splitSources(f: number[], rand: () => number): Record<SourceKey, number[]> {
  const out: Record<SourceKey, number[]> = { radio: zeros(), tv: zeros(), silent: zeros() }
  f.forEach((m, h) => {
    if (m <= 0) return
    const r = rand()
    const k: SourceKey = r < 0.46 ? 'radio' : r < 0.77 ? 'tv' : 'silent'
    out[k][h] = m
  })
  return out
}

function makeDemo(): Data {
  const rand = rng(1337)
  const d = emptyData()
  const peaks = [9, 10, 15, 16, 21]
  const DAYS = 150
  for (let i = DAYS; i >= 0; i--) {
    const day = new Date()
    day.setDate(day.getDate() - i)
    const key = dateKey(day)
    const dow = (day.getDay() + 6) % 7
    const progress = 1 - i / DAYS // habits improve over time
    const weekend = dow >= 5
    if (rand() < (weekend ? 0.55 : 0.8) * (0.55 + progress * 0.45)) {
      const f = new Array(24).fill(0)
      const u = new Array(24).fill(0)
      for (const p of peaks) {
        if (rand() < 0.6) {
          const h = (p + (rand() < 0.3 ? 1 : 0)) % 24
          f[h] += (8 + rand() * 38) * (0.5 + progress * 0.7)
        }
      }
      for (let h = 7; h < 24; h++) {
        const base = f[h] > 0 ? 1.5 : 3.2
        u[h] = Math.round(rand() * base * (1.8 - progress) * (weekend ? 1.5 : 1))
      }
      for (let h = 0; h < 24; h++) f[h] = Math.min(60, Math.round(f[h] * 10) / 10)
      d.focusLog[key] = f
      d.sourceLog[key] = splitSources(f, rand)
      d.urgeLog[key] = u
      const lapses = Math.round(rand() * 3 * (1.3 - progress))
      if (lapses) d.lapseLog[key] = lapses
    }
  }
  const kinds: (MediaKind | 'silent')[] = ['radio', 'tv', 'radio', 'silent']
  for (let i = 0; i < 18; i++) {
    const end = Date.now() - (i + 1) * 1000 * 60 * 60 * (5 + rand() * 20)
    const goal = [15, 25, 25, 45, 60][Math.floor(rand() * 5)]
    const completed = rand() > 0.22
    const focusSec = Math.round(goal * 60 * (completed ? 1 : 0.3 + rand() * 0.5))
    const source = kinds[Math.floor(rand() * kinds.length)]
    d.sessions.push({
      id: `demo-${i}`,
      start: end - focusSec * 1000,
      end,
      goalMin: goal,
      focusSec,
      urges: Math.round(rand() * 9),
      lapses: Math.round(rand() * 2),
      source,
      title: source === 'tv' ? 'Documentary channel' : source === 'radio' ? 'Ambient radio' : 'Silent focus',
      completed,
    })
  }
  const total = Object.values(d.focusLog).reduce((a, r) => a + r.reduce((x, y) => x + y, 0), 0) * 60
  d.sourceSecs = { radio: Math.round(total * 0.46), tv: Math.round(total * 0.31), silent: Math.round(total * 0.23) }
  d.demo = true
  return d
}

// dev-only handle so screenshots and tests can seed data
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __store: typeof useStore }).__store = useStore
