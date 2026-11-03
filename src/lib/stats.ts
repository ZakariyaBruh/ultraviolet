import type { HeatDay } from '@/components/ui/activity-heatmap'
import { dateKey, daysAgo, parseKey, weekdayMon } from './dates'
import type { AppState } from './store'

type HourLog = Record<string, number[]>

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
export const dayTotal = (log: HourLog, key: string) => (log[key] ? sum(log[key]) : 0)

/** 7 rows (Mon…Sun) × 24 hours, summed over the last `weeks` weeks. */
export function hoursMatrix(log: HourLog, weeks = 10): number[][] {
  const m = Array.from({ length: 7 }, () => new Array(24).fill(0))
  const cutoff = daysAgo(weeks * 7)
  for (const [key, row] of Object.entries(log)) {
    const d = parseKey(key)
    if (d < cutoff) continue
    const r = weekdayMon(d)
    for (let h = 0; h < 24; h++) m[r][h] += row[h] ?? 0
  }
  return m.map((row) => row.map((v) => Math.round(v * 10) / 10))
}

export function calendarData(log: HourLog): HeatDay[] {
  return Object.keys(log)
    .map((k) => ({ date: k, value: Math.round(dayTotal(log, k) * 10) / 10 }))
    .filter((d) => d.value > 0)
}

/** Consecutive days (ending today, or yesterday if today is still empty) with ≥ minMin focused minutes. */
export function streak(log: HourLog, minMin = 10): number {
  let n = 0
  let i = dayTotal(log, dateKey()) >= minMin ? 0 : 1
  for (; i < 400; i++) {
    if (dayTotal(log, dateKey(daysAgo(i))) >= minMin) n++
    else break
  }
  return n
}

export function bestStreak(log: HourLog, minMin = 10): number {
  const keys = Object.keys(log).filter((k) => dayTotal(log, k) >= minMin).sort()
  let best = 0
  let run = 0
  let prev: Date | null = null
  for (const k of keys) {
    const d = parseKey(k)
    run = prev && Math.round((+d - +prev) / 864e5) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

export function lastDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => dateKey(daysAgo(n - 1 - i)))
}

export function weekdayShort(key: string) {
  return parseKey(key).toLocaleDateString(undefined, { weekday: 'short' })
}

/** 0–100. Focus vs goal, streak, and how often you drifted while focusing. */
export function attentionScore(s: Pick<AppState, 'focusLog' | 'urgeLog' | 'settings'>): number {
  const today = dateKey()
  const focus = dayTotal(s.focusLog, today)
  const goalProg = Math.min(1, focus / Math.max(1, s.settings.dailyGoalMin))
  const st = Math.min(7, streak(s.focusLog)) / 7
  const urges = dayTotal(s.urgeLog, today)
  const perHour = focus > 1 ? urges / (focus / 60) : null
  const calm = perHour === null ? 0.5 : 1 - Math.min(1, perHour / 30)
  return Math.round(100 * (0.55 * goalProg + 0.25 * st + 0.2 * calm))
}

export function totals(s: Pick<AppState, 'focusLog' | 'urgeLog' | 'lapseLog'>) {
  const focus = Object.values(s.focusLog).reduce((a, r) => a + sum(r), 0)
  const urges = Object.values(s.urgeLog).reduce((a, r) => a + sum(r), 0)
  const lapses = Object.values(s.lapseLog).reduce((a, b) => a + b, 0)
  return { focus, urges, lapses }
}

/** Drifts per focused hour, or null when there was too little focus to say. */
export function blockedPerHour(focusMin: number, blocked: number): number | null {
  return focusMin >= 10 ? Math.round((blocked / (focusMin / 60)) * 10) / 10 : null
}

export function lastWeeks(log: Record<string, number[]>, endOffsetDays: number, days: number): number {
  let t = 0
  for (let i = endOffsetDays; i < endOffsetDays + days; i++) t += dayTotal(log, dateKey(daysAgo(i)))
  return t
}

/** The three parts that make the attention score, each 0–1, with their weights. */
export function scoreParts(s: Pick<AppState, 'focusLog' | 'urgeLog' | 'settings'>) {
  const today = dateKey()
  const focus = dayTotal(s.focusLog, today)
  const goal = Math.min(1, focus / Math.max(1, s.settings.dailyGoalMin))
  const run = Math.min(7, streak(s.focusLog)) / 7
  const urges = dayTotal(s.urgeLog, today)
  const per = focus > 1 ? urges / (focus / 60) : null
  const calm = per === null ? 0.5 : 1 - Math.min(1, per / 30)
  return [
    { label: 'Daily goal', note: `${Math.round(focus)} of ${s.settings.dailyGoalMin} min`, weight: 55, value: goal },
    { label: 'Streak', note: `${Math.min(7, streak(s.focusLog))} of 7 days`, weight: 25, value: run },
    { label: 'Calm', note: per === null ? 'no focus yet, counts as half' : `${Math.round(per * 10) / 10} drifts per hour`, weight: 20, value: calm },
  ]
}
