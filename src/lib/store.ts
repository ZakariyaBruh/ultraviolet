import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { dateKey } from './dates'

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

export interface Settings {
  dailyGoalMin: number
  sessionMin: number
  /** 0 calm · 1 lively · 2 maximum */
  motion: 0 | 1 | 2
  volume: number
  cursor: boolean
}

type HourLog = Record<string, number[]>

interface Data {
  settings: Settings
  focusLog: HourLog
  urgeLog: HourLog
  lapseLog: Record<string, number>
  sourceSecs: Record<MediaKind | 'silent', number>
  sessions: SessionRec[]
  favorites: MediaItem[]
  recent: MediaItem[]
  seenIntro: boolean
  demo: boolean
}

interface Actions {
  setSettings: (patch: Partial<Settings>) => void
  startSession: (goalMin: number, source: MediaKind | 'silent', title: string) => void
  setSessionSource: (source: MediaKind | 'silent', title: string) => void
  tick: (sec?: number) => void
  addUrge: () => void
  addLapse: () => void
  togglePause: () => void
  endSession: (completed: boolean) => void
  toggleFavorite: (item: MediaItem) => void
  pushRecent: (item: MediaItem) => void
  markIntroSeen: () => void
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
  motion: 2,
  volume: 0.8,
  cursor: true,
}

const emptyData = (): Data => ({
  settings: { ...DEFAULT_SETTINGS },
  focusLog: {},
  urgeLog: {},
  lapseLog: {},
  sourceSecs: { radio: 0, tv: 0, silent: 0 },
  sessions: [],
  favorites: [],
  recent: [],
  seenIntro: false,
  demo: false,
})

const DATA_KEYS = Object.keys(emptyData()) as (keyof Data)[]

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
        set({
          focusLog: { ...s.focusLog, [key]: row },
          sourceSecs: { ...s.sourceSecs, [a.source]: s.sourceSecs[a.source] + sec },
          session: { ...a, elapsedSec: elapsed },
        })
        if (elapsed >= a.goalMin * 60) get().endSession(true)
      },

      addUrge: () => {
        const s = get()
        const now = new Date()
        const key = dateKey(now)
        const row = hours(s.urgeLog, key)
        row[now.getHours()] += 1
        set({
          urgeLog: { ...s.urgeLog, [key]: row },
          session: s.session ? { ...s.session, urges: s.session.urges + 1 } : null,
        })
      },

      addLapse: () => {
        const s = get()
        const key = dateKey()
        set({
          lapseLog: { ...s.lapseLog, [key]: (s.lapseLog[key] ?? 0) + 1 },
          session: s.session ? { ...s.session, lapses: s.session.lapses + 1 } : null,
        })
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
      },

      toggleFavorite: (item) =>
        set((s) => ({
          favorites: s.favorites.some((f) => f.id === item.id)
            ? s.favorites.filter((f) => f.id !== item.id)
            : [item, ...s.favorites].slice(0, 60),
        })),

      pushRecent: (item) =>
        set((s) => ({ recent: [item, ...s.recent.filter((r) => r.id !== item.id)].slice(0, 14) })),

      markIntroSeen: () => set({ seenIntro: true }),

      loadDemo: () => {
        const demo = makeDemo()
        set({ ...demo, settings: get().settings, favorites: get().favorites, recent: get().recent, seenIntro: true, demo: true })
      },

      resetAll: () => set({ ...emptyData(), seenIntro: true, session: null }),

      restore: (snapshot) => set({ ...snapshot, session: null }),

      importData: (json) => {
        try {
          const parsed = JSON.parse(json) as Partial<Data>
          const base = emptyData()
          const next: Data = { ...base }
          for (const k of DATA_KEYS) {
            if (parsed[k] !== undefined) (next as unknown as Record<string, unknown>)[k] = parsed[k]
          }
          next.settings = { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) }
          set({ ...next, session: null })
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
        return out as unknown as AppState
      },
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
      d.urgeLog[key] = u
      const lapses = Math.round(rand() * 3 * (1.3 - progress))
      if (lapses) d.lapseLog[key] = lapses
    }
  }
  const kinds: (MediaKind | 'silent')[] = ['radio', 'tv', 'radio', 'silent']
  for (let i = 0; i < 18; i++) {
    const end = Date.now() - i * 1000 * 60 * 60 * (5 + rand() * 20)
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
