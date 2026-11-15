import type { HeatDay } from '@/components/ui/activity-heatmap'
import { dateKey, daysAgo, parseKey } from './dates'
import { runOf } from './run'
import type { AppState } from './store'

type HourLog = Record<string, number[]>

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
export const dayTotal = (log: HourLog, key: string) => (log[key] ? sum(log[key]) : 0)

export function calendarData(log: HourLog): HeatDay[] {
  return Object.keys(log)
    .map((k) => ({ date: k, value: Math.round(dayTotal(log, k) * 10) / 10 }))
    .filter((d) => d.value > 0)
}

/** Days in a row with at least `minMin` focused minutes; one empty day in seven is forgiven (see `runOf`). */
export function streak(log: HourLog, minMin = 10, today: Date = new Date()): number {
  return runOf(log, minMin, today).days
}

export function bestStreak(log: HourLog, minMin = 10, today: Date = new Date()): number {
  return runOf(log, minMin, today).best
}

export function lastDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => dateKey(daysAgo(n - 1 - i)))
}

export function weekdayShort(key: string) {
  return parseKey(key).toLocaleDateString(undefined, { weekday: 'short' })
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
