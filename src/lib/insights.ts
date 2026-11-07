/**
 * What the Insights screen shows, worked out from what is saved in this browser and nothing else. Each function says what it counts,
 * so a number on screen can be traced to a rule. Pure functions: the tests in the sweep call them with a clock and known data.
 *
 * A "day" is a calendar day in the person's own time zone. A drift is one time they left the tab during a session. Held time is
 * focused minutes (the clock runs only while a session is running and the tab is in front).
 */
import { dateKey, daysAgo, parseKey, weekdayMon } from './dates'
import { blockedPerHour, dayTotal, streak, sum } from './stats'
import type { SessionRec } from './store'

type HourLog = Record<string, number[]>
export interface InsightData { focusLog: HourLog; urgeLog: HourLog; sessions: SessionRec[]; sourceSecs?: Record<string, number> }

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => { const x = midnight(d); x.setDate(x.getDate() + n); return x }
/** whole days from a to b, both taken at local midnight (23 or 25 hour days at a clock change still count as one) */
const daysBetween = (a: Date, b: Date) => Math.round((midnight(b).getTime() - midnight(a).getTime()) / 864e5)

/** the first day on which anything was held, or null when nothing has been */
export function firstDay(log: HourLog): Date | null {
  let first: string | null = null
  for (const [k, row] of Object.entries(log)) if (sum(row) > 0 && (first === null || k < first)) first = k
  return first ? parseKey(first) : null
}

/* ───────────── weekdays ───────────── */

export interface WeekdayAvg {
  /** average minutes held on each weekday, Monday first; 0 for a weekday that has not come round yet */
  avg: number[]
  /** how many of each weekday the average is over */
  days: number[]
  /** the first day counted, or null when there is no finished day with focus to count yet */
  since: Date | null
  /** weeks the average spans, for the caption */
  weeks: number
}

/**
 * Average minutes held on each weekday, over the complete days from the first day anything was held (at most `maxWeeks` weeks back) to yesterday.
 * Today is left out because it is not finished. Days before the person started are not counted, so a new person's average is not
 * thinned out by weeks that never happened, and days with no focus inside the span count as zero.
 */
export function weekdayAverages(log: HourLog, today: Date = new Date(), maxWeeks = 10): WeekdayAvg {
  const first = firstDay(log)
  const end = addDays(today, -1) // yesterday
  const windowStart = addDays(today, -maxWeeks * 7)
  const start = first && first > windowStart ? first : windowStart
  const tot = new Array<number>(7).fill(0)
  const cnt = new Array<number>(7).fill(0)
  if (!first || start > end) return { avg: tot, days: cnt, since: null, weeks: 0 }
  const n = daysBetween(start, end) + 1
  for (let i = 0; i < n; i++) {
    const d = addDays(start, i)
    const r = weekdayMon(d)
    tot[r] += dayTotal(log, dateKey(d))
    cnt[r]++
  }
  return { avg: tot.map((t, r) => (cnt[r] ? t / cnt[r] : 0)), days: cnt, since: start, weeks: Math.max(1, Math.ceil(n / 7)) }
}

/* ───────────── hours of the week ───────────── */

export interface HoursGrid {
  /** 7 rows (Monday first) by 24 hours: minutes held, added up over the days counted */
  matrix: number[][]
  /** all minutes in the grid */
  total: number
  /** days the grid covers: from the first day anything was held (at most `maxWeeks` weeks back) up to and including today */
  days: number
  /** minutes a week on average over those days */
  perWeek: number
}

export function hoursGrid(log: HourLog, today: Date = new Date(), maxWeeks = 10): HoursGrid {
  const first = firstDay(log)
  const windowStart = addDays(today, -(maxWeeks * 7 - 1)) // today and the 69 days before it
  const start = first && first > windowStart ? first : windowStart
  const matrix = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
  const n = daysBetween(start, today) + 1
  let total = 0
  for (let i = 0; i < n; i++) {
    const d = addDays(start, i)
    const row = log[dateKey(d)]
    if (!row) continue
    const r = weekdayMon(d)
    for (let h = 0; h < 24; h++) { const v = row[h] ?? 0; matrix[r][h] += v; total += v }
  }
  const days = first ? n : 0
  return { matrix: matrix.map((r) => r.map((v) => Math.round(v * 10) / 10)), total, days, perWeek: days ? total / (days / 7) : 0 }
}

/* ───────────── this week against last ───────────── */

export interface Span { minutes: number; drifts: number; perHour: number | null; sessions: number; finished: number }
/** `days` whole days that end `endOffset` days before today (0 means the span ends with today), added up */
export function spanOf(d: InsightData, endOffset: number, days: number, today: Date = new Date()): Span {
  let minutes = 0
  let drifts = 0
  for (let i = endOffset; i < endOffset + days; i++) { const k = dateKey(daysAgo(i, today)); minutes += dayTotal(d.focusLog, k); drifts += dayTotal(d.urgeLog, k) }
  const from = addDays(today, -(endOffset + days - 1)).getTime()
  const to = addDays(today, -endOffset + 1).getTime()
  const inSpan = d.sessions.filter((x) => x.start >= from && x.start < to)
  return { minutes, drifts, perHour: blockedPerHour(minutes, drifts), sessions: inSpan.length, finished: inSpan.filter((x) => x.completed).length }
}

/* ───────────── parts of the day ───────────── */

export const PARTS_OF_DAY: [string, number, number][] = [['Night', 0, 6], ['Morning', 6, 12], ['Afternoon', 12, 18], ['Evening', 18, 24]]
/** a log's minutes (or drifts) added up by part of the day, over every day saved */
export const partsOfDay = (log: HourLog) => PARTS_OF_DAY.map(([label, a, b]) => ({ label, value: Object.values(log).reduce((acc, row) => acc + sum(row.slice(a, b)), 0) }))
/** a log added up by hour of the day (24 values) over every day saved */
export const byHour = (log: HourLog) => Array.from({ length: 24 }, (_, h) => Object.values(log).reduce((a, r) => a + (r[h] ?? 0), 0))

/* ───────────── the attention score ───────────── */

export interface ScorePart { id: 'goal' | 'streak' | 'calm'; label: string; /** what was measured, in the units it is measured in */ measure: string; /** how the part is worked out, in one line */ rule: string; /** points available */ max: number; /** 0 to 1 */ value: number }
export interface ScoreView { score: number; parts: ScorePart[] }

/**
 * 0 to 100 from three parts: today's minutes against the daily goal (55 points), the run of days with at least ten minutes, counted up to
 * seven (25 points), and how seldom you drifted today (20 points; no drifts is full marks, thirty or more an hour is none, and a day with no
 * focus yet counts as half).
 */
export function scoreView(d: InsightData, dailyGoalMin: number, today: Date = new Date()): ScoreView {
  const key = dateKey(today)
  const focus = dayTotal(d.focusLog, key)
  const goal = Math.min(1, focus / Math.max(1, dailyGoalMin))
  const run = streak(d.focusLog, 10, today)
  const urges = dayTotal(d.urgeLog, key)
  const per = focus > 1 ? urges / (focus / 60) : null
  const calm = per === null ? 0.5 : 1 - Math.min(1, per / 30)
  const parts: ScorePart[] = [
    { id: 'goal', label: 'Daily goal', measure: `${Math.round(focus)} of ${dailyGoalMin} min held today`, rule: 'Minutes held today against your goal.', max: 55, value: goal },
    { id: 'streak', label: 'Streak', measure: `${run} day${run === 1 ? '' : 's'} in a row`, rule: 'Days in a row with at least 10 minutes. Seven or more is full marks.', max: 25, value: Math.min(7, run) / 7 },
    { id: 'calm', label: 'Calm', measure: per === null ? 'No focus yet today' : `${Math.round(per * 10) / 10} drift${Math.round(per * 10) / 10 === 1 ? '' : 's'} per focused hour today`, rule: 'No drifts is full marks, 30 or more an hour is none. A day with no focus counts as half.', max: 20, value: calm },
  ]
  return { score: Math.round(sum(parts.map((p) => p.value * p.max))), parts }
}

/* ───────────── sessions ───────────── */

export interface SessionTotals { count: number; finished: number; endedEarly: number; minutes: number; drifts: number }
export const sessionTotals = (sessions: SessionRec[]): SessionTotals => ({
  count: sessions.length,
  finished: sessions.filter((x) => x.completed).length,
  endedEarly: sessions.filter((x) => !x.completed).length,
  minutes: sum(sessions.map((x) => x.focusSec / 60)),
  drifts: sum(sessions.map((x) => x.lapses)),
})

/** the funnel from starting to finishing, over the sessions that are kept */
export const funnelOf = (sessions: SessionRec[]) => [
  { label: 'Started', value: sessions.length },
  { label: 'Held 10 min', value: sessions.filter((x) => x.focusSec >= 600).length },
  { label: 'Held 25 min', value: sessions.filter((x) => x.focusSec >= 1500).length },
  { label: 'Finished', value: sessions.filter((x) => x.completed).length },
]

/** an old log line said "N blocked"; the word for it now is drifts */
export const driftWords = (text: string) => text.replace(/(\d+) blocked\b/, (_, n: string) => `${n} drift${n === '1' ? '' : 's'}`)
