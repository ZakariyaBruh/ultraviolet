import { create } from 'zustand'
import { isTrying, refuse } from './trial'
import { BREAK_MIN, CAPSULE_MAX, finishBonus, TRIPS_MAX, TRIP_MAX_MIN, LIFELINES_PER_PACK, LONG_BREAK_MIN, rateAt, SHOP, STREAK_BONUS_MAX, FREEZE_MAX, type ItemId } from './credits'
import { useFx } from './fx'
import { useUI } from './ui'
import { normalizeTheme, type ThemeId } from './themes'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { dateKey, parseKey } from './dates'
import { markAt, memo, runOf, setFrozen } from './run'
import { CAL_MAX, type CalEvent } from './ical'
import { PROJECT_MAX, tidyProject } from './projects'
import { sanitizeDecks, type Deck } from './cards'

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
  /** the page of the source this came from (songs), so a problem can be reported there */
  page?: string
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
  breaks?: number
  /** times they stepped out on purpose to work somewhere else (declared first), and how many seconds that was */
  trips?: number
  tripSec?: number
  /** a label the person gave it: where the hours went */
  project?: string
  /** seconds into the session at each drift, kept from now on so the coach can say when you tend to drift */
  lapseAt?: number[]
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
  /** seconds since the session began or the last drift: sets the credit rate */
  cleanSec?: number
  /** credits earned so far this session (fractional) */
  credit?: number
  /** a paid break is running until this time (ms) */
  breakUntil?: number
  breaks?: number
  /** a declared step-out to work elsewhere: leaving the tab before this time is not a drift */
  tripUntil?: number
  trips?: number
  tripSec?: number
  /** drifts a streak shield absorbed this session */
  shielded?: number
  project?: string
  lapseAt?: number[]
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
  /** how much the moving background may cost this device: auto (it adjusts itself, see lib/perf.ts), full (never lightened) or lite (never above light) */
  perf: 'auto' | 'full' | 'lite'
  volume: number
  /** swallow and count scroll gestures (on by default) */
  guard: boolean
  theme: ThemeId
  /** how retro the screen and type look: 0 is the past (most retro), 100 is the future. Six stops of 20. */
  era: number
  /** how much of the page is 3D solids drawn in text: 0 off, 100 a whole text world. Six stops of 20, set apart from era. */
  ascii: number
  /** custom accent and background colours (#rrggbb), '' keeps the theme's own */
  accent: string
  bg: string
  /** ask an AI to write a small interactive demo for each new lesson (only the topic title leaves the browser) */
  aiDemos: boolean
  /** the built-in music: on or off, which mood, and how loud (it also follows the main volume) */
  music: boolean
  musicMood: string
  musicLevel: number
  /** the age rating of songs to offer: 0 everyone (the default), 1 teens, 2 adults */
  songAge: number
  /** the first-run walkthrough has been shown */
  toured: boolean
  /** the Browser's own walkthrough has been shown */
  browserToured: boolean
  /** the cloud browser is switched off: nothing opens in it on its own and no time is used */
  cloudOff: boolean
  /** supporters: the project a new session is labelled with ('' for none), the names to pick from, and the weekly goal in minutes */
  project: string
  projects: string[]
  weeklyGoalMin: number
}

/** Credits are earned by real work (focused minutes, finished sessions, lessons, sharp trivia) and spent on arcade rounds. */
export interface Credits {
  bal: number
  earned: number
  spent: number
  best: Record<string, number>
  log: { t: number; n: number; why: string }[]
  /** things bought in the shop */
  items?: Items
}

/** What the shop has sold you: things to spend (counts) and things to keep (`owned`), plus the settings of the ones you can adjust. */
export interface Items {
  breaks: number
  longBreaks: number
  shields: number
  /** streak freezes in hand */
  freezes: number
  /** days a freeze was spent on */
  frozen: string[]
  lifelines: number
  owned: string[]
  clunks: number
  spins: number
  /** the solid in the timer, when the Solids pack is owned ('' is the donut) */
  dial: string
  /** sound machine levels, 0 to 1 per layer */
  mix: Record<string, number>
  /** a note waiting to open after the next finished session */
  capsule: string
}
export const noItems = (): Items => ({ breaks: 0, longBreaks: 0, shields: 0, freezes: 0, frozen: [], lifelines: 0, owned: [], clunks: 0, spins: 0, dial: '', mix: {}, capsule: '' })
export const itemsOf = (c: Credits): Items => ({ ...noItems(), ...c.items })

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
  profile: Profile | null
  events: EventRec[]
  books: BookRef[]
  /** topics hidden from the news, until a time (0 = until removed) */
  mutes: Mute[]
  /** achievement id -> when it was earned (ms): kept, so one earned stays earned when old sessions are trimmed */
  achievements: Record<string, number>
  learn: Learn
  credits: Credits
  widgets: Widgets
}

/** the study windows on the Focus screen: which are open, and what the notepad and the to-do list hold */
export interface Todo { id: string; t: string; done: boolean }
/** a shortcut the person added to the Browser's start page */
export interface SavedPage { name: string; url: string }
/** `min`: open windows tucked into the tray (kept running, just out of the way); `ghost`: windows you can click through */
/** an imported calendar: the events as read from the file (see `lib/ical.ts`), kept in this browser only */
export interface Cal { name: string; at: number; events: CalEvent[] }
export interface Widgets { open: string[]; /** the first page of the Notepad, kept for older saves */ note: string; /** every Notepad page (the first is `note`) */ notes?: string[]; todos: Todo[]; pages?: SavedPage[]; min?: string[]; ghost?: string[]; cal?: Cal; /** the Code window: text for each language, `in:<language>` its Input box, `@lang` the language last used */ code?: Record<string, string>; /** the Flashcards window's decks (lib/cards.ts) */ decks?: Deck[]; /** the Graph window: up to three formulas and the angle unit */ graph?: { f: string[]; deg?: boolean }; /** events and countdowns typed into the Calendar window, kept apart from an imported file */ own?: CalEvent[] }
export const NOTE_MAX = 20000
export const NOTES_MAX = 12
export const OWN_MAX = 100
export const TODO_MAX = 60
export const PAGES_MAX = 8

interface Actions {
  addPage: (name: string, url: string) => void
  removePage: (url: string) => void
  setWidget: (id: string, on: boolean) => void
  /** tuck a window into the tray, or bring it back */
  minWidget: (id: string, on: boolean) => void
  /** hide every open window to the tray, or bring them all back */
  minAllWidgets: (on: boolean) => void
  /** make a window click-through (and faint), or solid again */
  ghostWidget: (id: string, on: boolean) => void
  closeWidgets: () => void
  setNote: (text: string) => void
  setNotes: (pages: string[]) => void
  addTodo: (text: string) => void
  toggleTodo: (id: string) => void
  removeTodo: (id: string) => void
  clearDoneTodos: () => void
  setCalendar: (name: string, events: CalEvent[]) => void
  setCode: (lang: string, text: string) => void
  clearCalendar: () => void
  setDecks: (decks: Deck[]) => void
  setGraph: (g: { f: string[]; deg?: boolean }) => void
  addOwnEvent: (ev: CalEvent) => void
  removeOwnEvent: (id: string) => void
  earnCredits: (n: number, why: string) => void
  spendCredits: (n: number, why: string) => boolean
  buyItem: (id: Exclude<ItemId, 'capsule'>) => boolean
  /** spend streak freezes on a run that ended in the last two days; returns what was covered */
  mendRun: () => string[]
  sealCapsule: (text: string) => boolean
  useBreak: (long?: boolean) => void
  useLifeline: () => boolean
  setDial: (shape: string) => void
  setMix: (layer: string, level: number) => void
  addSpins: (n: number) => void
  endBreak: () => void
  startTrip: (min: number) => void
  cancelTrip: () => void
  endTrip: (awaySec: number) => void
  clunk: () => void
  setBest: (game: string, score: number) => void
  setSettings: (patch: Partial<Settings>) => void
  /** supporters: add a project name to pick from (and choose it), choose one ('' for none), or take one off the list (past sessions keep their label) */
  addProject: (name: string) => boolean
  setProject: (name: string) => void
  removeProject: (name: string) => void
  startSession: (goalMin: number, source: MediaKind | 'silent', title: string) => void
  setSessionSource: (source: MediaKind | 'silent', title: string) => void
  tick: (sec?: number) => void
  addLapse: () => void
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
  resetAll: () => void
  restore: (snapshot: Data) => void
}

interface Live {
  session: ActiveSession | null
}

export type AppState = Data & Actions & Live

export const DEFAULT_SETTINGS: Settings = {
  dailyGoalMin: 90,
  sessionMin: 25,
  motion: 1,
  perf: 'auto',
  volume: 0.8,
  guard: true,
  theme: 'station',
  era: 80,
  ascii: 20,
  accent: '',
  bg: '',
  aiDemos: true,
  music: false,
  musicMood: 'calm',
  musicLevel: 0.6,
  songAge: 0,
  toured: false,
  browserToured: false,
  cloudOff: false,
  project: '',
  projects: [],
  weeklyGoalMin: 300,
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
  profile: null,
  events: [],
  books: [],
  mutes: [],
  achievements: {},
  learn: { xp: 0, days: [], done: {}, deck: [] },
  credits: { bal: 0, earned: 0, spent: 0, best: {}, log: [], items: noItems() },
  widgets: { open: [], note: '', todos: [], pages: [], min: [], ghost: [] },
})

export const DATA_KEYS = Object.keys(emptyData()) as (keyof Data)[]


const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Accept only what has the right shape; anything else falls back to the default for that key. */
/* ───────── history rebuilt from real sessions (declared here, above the store: saved data is read and cleaned the moment the store is created, and an error in that step is swallowed and starts the app empty) ───────── */

/**
 * Set when saved data carried made-up history (from the old "Load demo history" button, which was removed) and it was taken out on
 * load. The app says so once (App.tsx), so nobody wonders why their numbers changed.
 */
export const demoRemoved = { pending: false }

/**
 * The hourly logs, rebuilt from finished sessions alone: each session's focus minutes are spread evenly over the hours it ran, its
 * drifts land on the day it ended. Used when made-up history is removed, so that what is left is real and the charts agree with the
 * Sessions list. Approximate to the hour, never invented: every number comes from a session this person actually ran.
 */
function historyFrom(sessions: SessionRec[]) {
  const focusLog: HourLog = {}
  const urgeLog: HourLog = {}
  const sourceLog: SourceLog = {}
  const lapseLog: Record<string, number> = {}
  const sourceSecs: Record<SourceKey, number> = { radio: 0, tv: 0, silent: 0 }
  const num = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
  for (const s of sessions) {
    if (!num(s.start) || !num(s.end) || !num(s.focusSec) || s.end <= s.start) continue
    const src: SourceKey = s.source === 'radio' || s.source === 'tv' ? s.source : 'silent'
    sourceSecs[src] += s.focusSec
    const span = (s.end - s.start) / 1000
    // hour by hour, at most four days of it
    for (let t = s.start, i = 0; t < s.end && i < 96; i++) {
      const d = new Date(t)
      const next = Math.min(s.end, new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime())
      const key = dateKey(d)
      const min = (s.focusSec / 60) * ((next - t) / 1000 / span)
      const row = (focusLog[key] ??= zeros())
      row[d.getHours()] += min
      const day = (sourceLog[key] ??= { radio: zeros(), tv: zeros(), silent: zeros() })
      day[src][d.getHours()] += min
      t = next
    }
    const end = new Date(s.end)
    const key = dateKey(end)
    if (num(s.urges) && s.urges > 0) (urgeLog[key] ??= zeros())[end.getHours()] += s.urges
    if (num(s.lapses) && s.lapses > 0) lapseLog[key] = (lapseLog[key] ?? 0) + s.lapses
  }
  return { focusLog, urgeLog, sourceLog, lapseLog, sourceSecs }
}

/** how many finished sessions are kept, the same for everyone */
const sessionCap = () => 300

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
        if (!['auto', 'full', 'lite'].includes(String(st.perf))) st.perf = DEFAULT_SETTINGS.perf
        st.theme = normalizeTheme(v.theme)
        const era = Number.isFinite(Number(st.era)) ? Number(st.era) : 80
        st.era = Math.min(100, Math.max(0, Math.round(era / 20) * 20))
        // before the two dials were split, the era stop also set how many solids there were: keep what people were seeing
        st.ascii = typeof v.ascii === 'number' && Number.isFinite(v.ascii) ? Math.min(100, Math.max(0, Math.round(v.ascii / 20) * 20)) : Math.round((100 - (st.era as number)) / 20) * 20
        // a save from before the tour existed that already has a name is someone who knows their way around: no tour pops up for them (it is still in Settings > Help)
        if (typeof v.toured !== 'boolean' && isObj(raw.profile)) st.toured = true
        st.musicLevel = Math.min(1, Math.max(0, Number(st.musicLevel) || 0))
        if (![0, 1, 2].includes(st.songAge as number)) st.songAge = 0
        if (!['calm', 'focus', 'night', 'retro'].includes(String(st.musicMood))) st.musicMood = 'calm'
        for (const ck of ['accent', 'bg'] as const) if (!/^#[0-9a-f]{6}$/i.test(String(st[ck]))) st[ck] = ''
        // project names are plain text; the chosen one must be one of the list
        const names = Array.isArray(v.projects) ? v.projects.map(tidyProject).filter(Boolean) : []
        st.projects = names.filter((n, i) => names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) === i).slice(0, PROJECT_MAX)
        st.project = (st.projects as string[]).includes(tidyProject(v.project)) ? tidyProject(v.project) : ''
        const wg = Number(st.weeklyGoalMin)
        st.weeklyGoalMin = Number.isFinite(wg) ? Math.min(4800, Math.max(0, Math.round(wg / 30) * 30)) : 300
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
    else if (k === 'credits') {
      if (isObj(v)) {
        const n = (x: unknown) => (typeof x === 'number' && isFinite(x) && x >= 0 ? Math.floor(x) : 0)
        const best: Record<string, number> = {}
        if (isObj(v.best)) for (const [g, sc] of Object.entries(v.best)) if (typeof sc === 'number' && isFinite(sc) && sc >= 0) best[g.slice(0, 20)] = Math.floor(sc)
        const log = Array.isArray(v.log) ? v.log.filter((r) => isObj(r) && typeof r.t === 'number' && typeof r.n === 'number' && typeof r.why === 'string').slice(0, 40) : []
        const it = isObj(v.items) ? v.items : {}
        const owned = Array.isArray(it.owned) ? it.owned.filter((x): x is string => typeof x === 'string' && x in SHOP).slice(0, 20) : []
        if (it.brick === true && !owned.includes('brick')) owned.push('brick') // from before there was a list
        const mix: Record<string, number> = {}
        if (isObj(it.mix)) for (const [l, lv] of Object.entries(it.mix)) if (typeof lv === 'number' && isFinite(lv)) mix[l.slice(0, 12)] = Math.min(1, Math.max(0, lv))
        ok = { bal: n(v.bal), earned: n(v.earned), spent: n(v.spent), best, log, items: { breaks: n(it.breaks), longBreaks: n(it.longBreaks), shields: n(it.shields), freezes: Math.min(FREEZE_MAX, n(it.freezes)), frozen: Array.isArray(it.frozen) ? it.frozen.filter((x): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)).slice(-60) : [], lifelines: n(it.lifelines), owned, clunks: n(it.clunks), spins: n(it.spins), dial: typeof it.dial === 'string' ? it.dial.slice(0, 12) : '', mix, capsule: typeof it.capsule === 'string' ? it.capsule.slice(0, CAPSULE_MAX) : '' } }
      }
    } else if (k === 'widgets') {
      if (isObj(v)) {
        const open = Array.isArray(v.open) ? [...new Set(v.open.filter((x): x is string => typeof x === 'string' && x.length < 20))].slice(0, 12) : []
        const todos = Array.isArray(v.todos) ? v.todos.filter((x) => isObj(x) && typeof x.id === 'string' && typeof x.t === 'string' && typeof x.done === 'boolean').slice(0, TODO_MAX).map((x) => ({ id: String(x.id).slice(0, 24), t: String(x.t).slice(0, 160), done: !!x.done })) : []
        const pages = Array.isArray(v.pages) ? v.pages.filter((x) => isObj(x) && typeof x.name === 'string' && typeof x.url === 'string' && /^https?:\/\/[^\s]{1,500}$/.test(x.url)).slice(0, PAGES_MAX).map((x) => ({ name: String(x.name).slice(0, 30), url: String(x.url) })) : []
        const ids = (a: unknown) => (Array.isArray(a) ? [...new Set(a.filter((x): x is string => typeof x === 'string' && open.includes(x)))].slice(0, 12) : [])
        const num = (x: unknown) => typeof x === 'number' && isFinite(x)
        const cal = isObj(v.cal) && Array.isArray(v.cal.events) ? { name: String(v.cal.name ?? '').slice(0, 60), at: num(v.cal.at) ? v.cal.at : 0, events: v.cal.events.filter((x) => isObj(x) && typeof x.t === 'string' && num(x.s) && num(x.e)).slice(0, CAL_MAX).map((x, i) => { const r = isObj(x.r) && ['D', 'W', 'M', 'Y'].includes(String(x.r.f)) ? { f: x.r.f, i: Math.max(1, Math.min(52, Number(x.r.i) || 1)), ...(num(x.r.n) ? { n: x.r.n } : {}), ...(num(x.r.u) ? { u: x.r.u } : {}), ...(Array.isArray(x.r.d) ? { d: (x.r.d as unknown[]).filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6).slice(0, 7) } : {}) } : undefined; return { id: String(i), t: String(x.t).slice(0, 120), s: x.s as number, e: x.e as number, ...(x.day === true ? { day: true } : {}), ...(typeof x.loc === 'string' ? { loc: x.loc.slice(0, 100) } : {}), ...(r ? { r: r as CalEvent['r'] } : {}), ...(Array.isArray(x.x) ? { x: x.x.filter(num).slice(0, 200) as number[] } : {}) } as CalEvent }) } : undefined
        const code: Record<string, string> = {}
        // the Code window: text and input for each language (the ids of LANGS in lib/codelangs.ts, kept here so the start file stays small) and the last language
        const LANG_IDS = ['python', 'javascript', 'typescript', 'html', 'sql', 'bash', 'cpp', 'ruby', 'lua', 'php']
        if (isObj(v.code)) for (const [l, t] of Object.entries(v.code)) if (typeof t === 'string' && (LANG_IDS.includes(l) || LANG_IDS.includes(l.replace(/^in:/, '')) || (l === '@lang' && LANG_IDS.includes(t)))) code[l] = t.slice(0, NOTE_MAX)
        const decks = sanitizeDecks(v.decks)
        // a date of your own is let go a month after it
        const own = Array.isArray(v.own) ? (v.own as unknown[]).filter((x): x is Record<string, unknown> => isObj(x) && typeof x.id === 'string' && typeof x.t === 'string' && num(x.s) && num(x.e)).filter((x) => (x.e as number) > Date.now() - 30 * 864e5).slice(-OWN_MAX).map((x) => ({ id: String(x.id).slice(0, 24), t: String(x.t).slice(0, 120), s: x.s as number, e: Math.max(x.s as number, x.e as number), ...(x.day === true ? { day: true } : {}) })) : undefined
        const notes = Array.isArray(v.notes) ? (v.notes as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, NOTES_MAX).map((t) => t.slice(0, NOTE_MAX)) : undefined
        const graph = isObj(v.graph) && Array.isArray(v.graph.f) ? { f: (v.graph.f as unknown[]).slice(0, 3).map((x) => (typeof x === 'string' ? x.slice(0, 200) : '')), ...(v.graph.deg === true ? { deg: true } : {}) } : undefined
        ok = { open, note: notes?.length ? notes[0] : typeof v.note === 'string' ? v.note.slice(0, NOTE_MAX) : '', ...(notes && notes.length > 1 ? { notes } : {}), todos, pages, min: ids(v.min), ghost: ids(v.ghost), ...(cal ? { cal } : {}), ...(Object.keys(code).length ? { code } : {}), ...(decks?.length ? { decks } : {}), ...(graph ? { graph } : {}), ...(own?.length ? { own } : {}) }
      }
    } else if (k === 'achievements') {
      if (isObj(v)) {
        const o: Record<string, number> = {}
        for (const [id, t] of Object.entries(v)) if (/^[a-z0-9-]{1,30}$/.test(id) && typeof t === 'number' && isFinite(t) && t > 0) o[id] = t
        ok = o
      }
    } else if (Array.isArray(b)) ok = Array.isArray(v) ? v.filter((x) => isObj(x)) : undefined
    else if (typeof b === 'boolean') ok = typeof v === 'boolean' ? v : undefined
    else if (isObj(b)) ok = isObj(v) ? v : undefined
    if (ok !== undefined) {
      out[k] = ok
      matched++
    }
  }
  // History made up by the old "Load demo history" button is taken out: its sessions go, and the logs are rebuilt from the real ones left
  if (raw.demo === true) {
    const kept = (out.sessions as SessionRec[]).filter((x) => !String(x.id).startsWith('demo-'))
    Object.assign(out, historyFrom(kept), { sessions: kept })
    demoRemoved.pending = true
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

      addProject: (name) => {
        const n = tidyProject(name)
        const list = get().settings.projects
        if (!n) return false
        const have = list.find((m) => m.toLowerCase() === n.toLowerCase())
        if (!have && list.length >= PROJECT_MAX) return false
        set((s) => ({ settings: { ...s.settings, projects: have ? s.settings.projects : [...s.settings.projects, n], project: have ?? n } }))
        return true
      },
      setProject: (name) => set((s) => ({ settings: { ...s.settings, project: s.settings.projects.includes(name) ? name : '' } })),
      removeProject: (name) => set((s) => ({ settings: { ...s.settings, projects: s.settings.projects.filter((m) => m !== name), project: s.settings.project === name ? '' : s.settings.project } })),

      startSession: (goalMin, source, title) => {
        if (isTrying()) { refuse(); return }
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
            cleanSec: 0,
            credit: 0,
            breaks: 0,
            project: get().settings.project || undefined,
          },
        })
      },

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
          session: { ...a, elapsedSec: elapsed, cleanSec: (a.cleanSec ?? 0) + sec, credit: (a.credit ?? 0) + (sec / 60) * rateAt(a.cleanSec ?? 0, a.goalMin) },
        })
        if (elapsed >= a.goalMin * 60) get().endSession(true)
      },

      addLapse: () => {
        const s = get()
        const now = new Date()
        const key = dateKey(now)
        const row = hours(s.urgeLog, key)
        row[now.getHours()] += 1
        // a streak shield keeps a long clean streak alive through one drift; the drift itself is still counted
        const have = itemsOf(s.credits)
        const shielded = !!s.session && have.shields > 0 && (s.session.cleanSec ?? 0) >= 600
        set({
          urgeLog: { ...s.urgeLog, [key]: row },
          lapseLog: { ...s.lapseLog, [key]: (s.lapseLog[key] ?? 0) + 1 },
          session: s.session ? { ...s.session, lapses: s.session.lapses + 1, urges: s.session.urges + 1, cleanSec: shielded ? s.session.cleanSec : 0, shielded: (s.session.shielded ?? 0) + (shielded ? 1 : 0), lapseAt: [...(s.session.lapseAt ?? []), Math.round(s.session.elapsedSec)].slice(-30) } : null,
          ...(shielded ? { credits: { ...s.credits, items: { ...have, shields: have.shields - 1 } } } : {}),
        })
        get().log('wander', s.session ? `You left the tab during ${s.session.title}${shielded ? '. A streak shield kept the clean streak' : ''}` : 'You left the tab mid-session')
        if (shielded) useFx.getState().say({ title: 'Shield used', description: 'Streak kept. The drift still counts.' })
      },

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
          breaks: a.breaks || undefined,
          trips: a.trips || undefined,
          tripSec: a.tripSec || undefined,
          project: a.project || undefined,
          lapseAt: a.lapseAt?.length ? a.lapseAt : undefined,
        }
        set({
          session: null,
          sessions: a.elapsedSec >= 10 ? [rec, ...s.sessions].slice(0, sessionCap()) : s.sessions,
        })
        const credit = Math.floor((a.credit ?? a.elapsedSec / 60) + 1e-6) + (completed ? finishBonus(a.lapses, a.trips ?? 0) : 0)
        if (credit > 0) get().earnCredits(credit, completed ? `Finished ${a.title}` : `Locked in on ${a.title}`)
        // a sealed time capsule opens once, after a session that was finished
        const note = completed ? itemsOf(get().credits).capsule : ''
        if (note) set((st) => ({ credits: { ...st.credits, items: { ...itemsOf(st.credits), capsule: '' } } }))
        if (completed) {
          // the day's run: a card of its own on a milestone, a line and a small bonus otherwise
          const r = runOf(get().focusLog)
          const mark = r.doneToday ? markAt(r.days) : undefined
          const markKey = mark && r.since ? `${r.since}:${mark.days}` : ''
          const newMark = !!markKey && memo.get('friction:mark') !== markKey
          if (newMark) memo.set('friction:mark', markKey)
          const dayKey = dateKey()
          const bonus = r.doneToday && r.days >= 2 && memo.get('friction:run-day') !== dayKey ? Math.min(r.days, STREAK_BONUS_MAX) : 0
          if (r.doneToday) memo.set('friction:run-day', dayKey)
          if (bonus > 0) get().earnCredits(bonus, `Day ${r.days} on air`)
          const runNote = r.doneToday ? ` Day ${r.days} on air${bonus > 0 ? `, +${bonus} credits` : ''}. Back tomorrow for ${r.days + 1}.` : ''
          const base = `${note ? `“${note}” ` : ''}${a.goalMin} minutes held, ${a.urges} drift${a.urges === 1 ? '' : 's'}.${credit > 0 ? ` +${credit} credits${a.lapses === 0 ? ', clean bonus included' : ''}.` : ''}`
          useUI.getState().set({ celebrate: newMark && mark ? { title: mark.title, detail: `${mark.line}${bonus > 0 ? ` +${bonus} credits.` : ''} ${base}` } : { title: note ? 'A note from past you' : 'Session complete', detail: `${base}${runNote}` } })
        }
        // a finished session gets the celebration card instead of a toast
        if (!completed) useFx.getState().say(a.elapsedSec >= 10 ? { title: 'Session ended', description: `${Math.round(a.elapsedSec / 60)} of ${a.goalMin} min kept.` } : { title: 'Too short to count', description: 'Sessions under 10 seconds are not saved.' })
        get().log('session', `${completed ? 'Completed' : 'Ended'} ${a.title}: ${Math.round(a.elapsedSec / 60)} of ${a.goalMin} min, ${a.urges} drift${a.urges === 1 ? '' : 's'}`)
      },

      earnCredits: (n, why) => {
        const k = Math.floor(n)
        if (k <= 0) return
        set((s) => ({ credits: { ...s.credits, bal: s.credits.bal + k, earned: s.credits.earned + k, log: [{ t: Date.now(), n: k, why }, ...s.credits.log].slice(0, 40) } }))
      },
      spendCredits: (n, why) => {
        if (get().credits.bal < n) return false
        set((s) => ({ credits: { ...s.credits, bal: s.credits.bal - n, spent: s.credits.spent + n, log: [{ t: Date.now(), n: -n, why }, ...s.credits.log].slice(0, 40) } }))
        return true
      },
      buyItem: (id) => {
        const it = SHOP[id]
        const have = itemsOf(get().credits)
        if (it.kind === 'unlock' && have.owned.includes(id)) return false
        if (id === 'freeze' && have.freezes >= FREEZE_MAX) return false
        if (!get().spendCredits(it.price, `Bought ${it.name}`)) return false
        set((s) => {
          const h = itemsOf(s.credits)
          const next: Items = { ...h }
          if (id === 'break') next.breaks += 1
          else if (id === 'longbreak') next.longBreaks += 1
          else if (id === 'shield') next.shields += 1
          else if (id === 'freeze') next.freezes += 1
          else if (id === 'lifeline') next.lifelines += LIFELINES_PER_PACK
          else if (!next.owned.includes(id)) next.owned = [...next.owned, id]
          return { credits: { ...s.credits, items: next } }
        })
        return true
      },
      mendRun: () => {
        const done: string[] = []
        for (let i = 0; i < 2; i++) {
          const s = get()
          const have = itemsOf(s.credits)
          const r = runOf(s.focusLog)
          if (have.freezes < 1 || !r.lost || r.lost.days < 3) break
          const age = Math.round((+new Date(new Date().setHours(0, 0, 0, 0)) - +parseKey(r.lost.key)) / 864e5)
          if (age > 2) break
          set({ credits: { ...s.credits, items: { ...have, freezes: have.freezes - 1, frozen: [...have.frozen, r.lost.key].slice(-60) } } })
          setFrozen(get().credits.items?.frozen ?? [])
          done.push(r.lost.key)
        }
        if (done.length) { const r = runOf(get().focusLog); useFx.getState().say({ title: 'Streak freeze used', description: `${done.length === 1 ? 'A missed day was' : `${done.length} missed days were`} covered. Day ${r.days}${r.doneToday ? '' : ' so far'} on air.` }) }
        return done
      },
      /** Seal a note to yourself. It opens, once, after your next finished session. */
      sealCapsule: (text) => {
        const note = text.replace(/\s+/g, ' ').trim().slice(0, CAPSULE_MAX)
        if (!note || itemsOf(get().credits).capsule) return false
        if (!get().spendCredits(SHOP.capsule.price, 'Bought a Time capsule')) return false
        set((s) => ({ credits: { ...s.credits, items: { ...itemsOf(s.credits), capsule: note } } }))
        return true
      },
      /** Spend a break: the session pauses, leaving the tab is not a drift, and it is recorded as a break. */
      useBreak: (long = false) => {
        const s = get()
        const a = s.session
        const have = itemsOf(s.credits)
        if (!a || a.paused || (long ? have.longBreaks : have.breaks) < 1) return
        const min = long ? LONG_BREAK_MIN : BREAK_MIN
        set({ session: { ...a, paused: true, breakUntil: Date.now() + min * 60e3, breaks: (a.breaks ?? 0) + 1 }, credits: { ...s.credits, items: { ...have, breaks: have.breaks - (long ? 0 : 1), longBreaks: have.longBreaks - (long ? 1 : 0) } } })
        get().log('session', `Took a ${min} minute break during ${a.title}`)
      },
      endBreak: () => set((s) => (s.session?.breakUntil ? { session: { ...s.session, paused: false, breakUntil: undefined } } : s)),

      /**
       * Step out to work somewhere else: declared first, a few minutes at a time, so leaving the tab for it is recorded as a step-out, not a drift.
       * It is not a pause (the timer still only runs while you are looking at it, so nothing is credited for the time away) and it costs what a
       * drift costs (the clean streak and the no-drift bonus), so it is never a way to leave for free: only a bought Break is. At most TRIPS_MAX a
       * session; staying away past the time you gave counts as a drift as well.
       */
      startTrip: (min) => {
        const a = get().session
        if (!a || a.paused || a.tripUntil || (a.trips ?? 0) >= TRIPS_MAX) return
        const m = Math.max(1, Math.min(TRIP_MAX_MIN, Math.round(min)))
        set({ session: { ...a, tripUntil: Date.now() + m * 60e3 } })
      },
      cancelTrip: () => set((s) => (s.session?.tripUntil ? { session: { ...s.session, tripUntil: undefined } } : s)),
      endTrip: (awaySec) => {
        const a = get().session
        if (!a?.tripUntil) return
        const over = Date.now() > a.tripUntil + 45e3
        // only a real trip (they did leave) is recorded; one declared and not taken is simply dropped
        if (awaySec < 6) { set({ session: { ...a, tripUntil: undefined } }); return }
        // it costs what a drift costs, so the paid Break stays the only way to leave for nothing: the clean streak starts again (a streak shield holds it, as it does for a drift)
        const have = itemsOf(get().credits)
        const shielded = have.shields > 0 && (a.cleanSec ?? 0) >= 600
        set({
          session: { ...a, tripUntil: undefined, trips: (a.trips ?? 0) + 1, tripSec: (a.tripSec ?? 0) + awaySec, cleanSec: shielded ? a.cleanSec : 0, shielded: (a.shielded ?? 0) + (shielded ? 1 : 0) },
          ...(shielded ? { credits: { ...get().credits, items: { ...have, shields: have.shields - 1 } } } : {}),
        })
        get().log('session', `Stepped out to work for ${Math.max(1, Math.round(awaySec / 60))} min during ${a.title}`)
        // past the time they gave, it was an ordinary drift after all
        if (over) get().addLapse()
      },
      useLifeline: () => {
        const have = itemsOf(get().credits)
        if (have.lifelines < 1) return false
        set((s) => ({ credits: { ...s.credits, items: { ...have, lifelines: have.lifelines - 1 } } }))
        return true
      },
      setDial: (shape) => set((s) => ({ credits: { ...s.credits, items: { ...itemsOf(s.credits), dial: shape } } })),
      setMix: (layer, level) => set((s) => { const h = itemsOf(s.credits); return { credits: { ...s.credits, items: { ...h, mix: { ...h.mix, [layer]: Math.min(1, Math.max(0, level)) } } } } }),
      addSpins: (n) => set((s) => { const h = itemsOf(s.credits); return { credits: { ...s.credits, items: { ...h, spins: h.spins + n } } } }),
      clunk: () => set((s) => { const h = itemsOf(s.credits); return { credits: { ...s.credits, items: { ...h, clunks: h.clunks + 1 } } } }),
      setBest: (game, score) => set((s) => (score > (s.credits.best[game] ?? 0) ? { credits: { ...s.credits, best: { ...s.credits.best, [game]: Math.floor(score) } } } : s)),

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

      addPage: (name, url) => {
        const n = name.trim().slice(0, 30)
        if (!n || !/^https?:\/\/[^\s]{1,500}$/.test(url)) return
        set((s) => {
          const pages = s.widgets.pages ?? []
          return pages.length >= PAGES_MAX || pages.some((p) => p.url === url) ? s : { widgets: { ...s.widgets, pages: [...pages, { name: n, url }] } }
        })
      },
      removePage: (url) => set((s) => ({ widgets: { ...s.widgets, pages: (s.widgets.pages ?? []).filter((p) => p.url !== url) } })),
      // opening a window shows it (even from the tray); closing one also forgets that it was tucked away or faint
      setWidget: (id, on) => set((s) => ({ widgets: { ...s.widgets, open: on ? (s.widgets.open.includes(id) ? s.widgets.open : [...s.widgets.open, id]) : s.widgets.open.filter((x) => x !== id), min: (s.widgets.min ?? []).filter((x) => x !== id), ghost: on ? (s.widgets.ghost ?? []) : (s.widgets.ghost ?? []).filter((x) => x !== id) } })),
      minWidget: (id, on) => set((s) => (s.widgets.open.includes(id) ? { widgets: { ...s.widgets, min: on ? [...new Set([...(s.widgets.min ?? []), id])] : (s.widgets.min ?? []).filter((x) => x !== id) } } : s)),
      minAllWidgets: (on) => set((s) => ({ widgets: { ...s.widgets, min: on ? [...s.widgets.open] : [] } })),
      ghostWidget: (id, on) => set((s) => (s.widgets.open.includes(id) ? { widgets: { ...s.widgets, ghost: on ? [...new Set([...(s.widgets.ghost ?? []), id])] : (s.widgets.ghost ?? []).filter((x) => x !== id) } } : s)),
      closeWidgets: () => set((s) => ({ widgets: { ...s.widgets, open: [], min: [], ghost: [] } })),
      setNote: (text) => set((s) => ({ widgets: { ...s.widgets, note: text.slice(0, NOTE_MAX), ...(s.widgets.notes ? { notes: [text.slice(0, NOTE_MAX), ...s.widgets.notes.slice(1)] } : {}) } })),
      setNotes: (pages) => { const notes = (pages.length ? pages : ['']).slice(0, NOTES_MAX).map((t) => t.slice(0, NOTE_MAX)); set((s) => ({ widgets: { ...s.widgets, note: notes[0], notes } })) },
      addTodo: (text) => {
        const t = text.trim().slice(0, 160)
        if (!t) return
        set((s) => (s.widgets.todos.length >= TODO_MAX ? s : { widgets: { ...s.widgets, todos: [...s.widgets.todos, { id: uid(), t, done: false }] } }))
      },
      toggleTodo: (id) => set((s) => ({ widgets: { ...s.widgets, todos: s.widgets.todos.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) } })),
      removeTodo: (id) => set((s) => ({ widgets: { ...s.widgets, todos: s.widgets.todos.filter((x) => x.id !== id) } })),
      setCode: (lang, text) => set((s) => ({ widgets: { ...s.widgets, code: { ...(s.widgets.code ?? {}), [lang]: text.slice(0, NOTE_MAX) } } })),
      setCalendar: (name, events) => set((s) => ({ widgets: { ...s.widgets, cal: { name: name.slice(0, 60), at: Date.now(), events: events.slice(0, CAL_MAX) } } })),
      clearCalendar: () => set((s) => { const { cal: _gone, ...rest } = s.widgets; return { widgets: rest } }),
      setDecks: (decks) => set((s) => ({ widgets: { ...s.widgets, decks: sanitizeDecks(decks) ?? [] } })),
      addOwnEvent: (ev) => set((s) => ({ widgets: { ...s.widgets, own: [...(s.widgets.own ?? []), { id: ev.id.slice(0, 24), t: ev.t.slice(0, 120), s: ev.s, e: Math.max(ev.s, ev.e), ...(ev.day ? { day: true } : {}) }].sort((a, b) => a.s - b.s).slice(-OWN_MAX) } })),
      removeOwnEvent: (id) => set((s) => ({ widgets: { ...s.widgets, own: (s.widgets.own ?? []).filter((e) => e.id !== id) } })),
      setGraph: (g) => set((s) => ({ widgets: { ...s.widgets, graph: { f: g.f.slice(0, 3).map((x) => String(x).slice(0, 200)), ...(g.deg ? { deg: true } : {}) } } })),
      clearDoneTodos: () => set((s) => ({ widgets: { ...s.widgets, todos: s.widgets.todos.filter((x) => !x.done) } })),

      markEventsRead: () => set((s) => ({ events: s.events.map((e) => (e.read ? e : { ...e, read: true })) })),

      markEventRead: (id) => set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, read: true } : e)) })),

      resetAll: () => set({ ...emptyData(), seenIntro: true, session: null }),

      restore: (snapshot) => set({ ...snapshot, session: null }),
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
          data.sessions = [{ id: a.id, start: a.start, end: Date.now(), goalMin: a.goalMin, focusSec: a.elapsedSec, urges: a.urges ?? 0, lapses: a.lapses ?? 0, source: a.source, title: a.title, completed: false }, ...data.sessions].slice(0, sessionCap())
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


// dev-only handle so screenshots and tests can seed data
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __store: typeof useStore }).__store = useStore

if (import.meta.env.DEV) (globalThis as { __store?: unknown }).__store = useStore

// the days a streak freeze covered are read by `runOf` everywhere, so keep them in step with the store (also after a load or a restore)
const syncFrozen = () => setFrozen(useStore.getState().credits?.items?.frozen ?? [])
syncFrozen()
useStore.subscribe(syncFrozen)
