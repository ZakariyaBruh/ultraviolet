import type { HeatDay } from '@/components/ui/activity-heatmap'
import { dateKey, daysAgo, parseKey } from './dates'
import type { AppState } from './store'

type HourLog = Record<string, number[]>

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
export const dayTotal = (log: HourLog, key: string) => (log[key] ? sum(log[key]) : 0)

export function calendarData(log: HourLog): HeatDay[] {
  return Object.keys(log)
    .map((k) => ({ date: k, value: Math.round(dayTotal(log, k) * 10) / 10 }))
    .filter((d) => d.value > 0)
}

/** Consecutive days (ending today, or yesterday if today is still empty) with ≥ minMin focused minutes. */
export function streak(log: HourLog, minMin = 10, today: Date = new Date()): number {
  let n = 0
  let i = dayTotal(log, dateKey(today)) >= minMin ? 0 : 1
  for (; i < 400; i++) {
    if (dayTotal(log, dateKey(daysAgo(i, today))) >= minMin) n++
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
