import { itemsOf, useStore } from './store'

/**
 * Supporters (Whop: https://whop.com, product "Support Friction"): a small way to keep Friction free. Whop takes the payment and sends the
 * buyer to /thanks?k=<code> (scripts/legal.mjs), which keeps one flag in this browser (`friction:supporter`). Nothing about the buyer
 * reaches Friction. A supporter gets, free, every unlock in the credit shop and a mark by their name; credits are never sold, and nothing
 * is needed to use the app. Each week a supporter also gets one free Break and one free Streak shield (kept to three of each), and can export their own sessions as CSV. The flag is an honour-system pass: it unlocks only cosmetic and convenience items, so it is not worth defending harder.
 */
const KEY = 'friction:supporter'
const WEEK = 'friction:supporter-week'
export const SUPPORT_PAGE = '/support'
/** the shop's unlocks (not the Golden Brick, which is a joke that should be earned) */
export const SUPPORTER_UNLOCKS = ['sound', 'automusic', 'kit', 'solids', 'spinner', 'confetti']

export const isSupporter = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
export const forgetSupporter = () => { try { localStorage.removeItem(KEY) } catch { /* storage blocked */ } }

/** ISO year-week such as 2026-W45 */
function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y = t.getUTCFullYear()
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7)
  return `${y}-W${String(w).padStart(2, '0')}`
}

/** gives a supporter every unlock they do not already have, and once a week a free Break and Streak shield (up to 3 of each); safe to run on every start */
export function applySupporter() {
  if (!isSupporter()) return
  const have = itemsOf(useStore.getState().credits)
  const owned = Array.from(new Set([...have.owned, ...SUPPORTER_UNLOCKS]))
  let week = ''
  try { week = localStorage.getItem(WEEK) ?? '' } catch { /* storage blocked */ }
  const now = isoWeek()
  const weekly = week !== now
  const breaks = weekly ? Math.max(have.breaks, Math.min(3, have.breaks + 1)) : have.breaks
  const shields = weekly ? Math.max(have.shields, Math.min(3, have.shields + 1)) : have.shields
  if (owned.length === have.owned.length && !weekly) return
  if (weekly) { try { localStorage.setItem(WEEK, now) } catch { /* storage blocked */ } }
  useStore.setState((s) => ({ credits: { ...s.credits, items: { ...itemsOf(s.credits), owned, breaks, shields } } }))
}

const q = (v: string | number | boolean) => { const t = String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t }
/** the person's own sessions as CSV text (supporters only; built in the browser, nothing is sent) */
export function sessionsCsv(): string {
  const rows = useStore.getState().sessions
  const head = 'start,end,goal_min,focus_sec,drifts,source,title,completed,breaks'
  const body = rows.map((r) => [new Date(r.start).toISOString(), new Date(r.end).toISOString(), r.goalMin, r.focusSec, r.lapses, r.source, r.title, r.completed, r.breaks ?? 0].map(q).join(','))
  return [head, ...body].join('\n')
}
