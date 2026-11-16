import { dateKey, parseKey } from './dates'

type HourLog = Record<string, number[]>
const dayMin = (log: HourLog, key: string) => (log[key] ? log[key].reduce((a, b) => a + b, 0) : 0)

/** A day of the last week: held (on), covered by the weekly rest day (rest), empty (off), or today and not done yet (open). */
export type DayMark = 'on' | 'rest' | 'frozen' | 'off' | 'open'

export interface Run {
  /** days with enough focus in the current run (rest days bridge a gap but are not counted) */
  days: number
  /** the longest run, counted the same way */
  best: number
  /** the first day of the current run, or null */
  since: string | null
  doneToday: boolean
  /** the run is still alive (today may still be open) */
  alive: boolean
  /** the weekly rest day is free for the next empty day */
  restReady: boolean
  /** the latest day that ended a run of at least one day (a streak freeze could have covered it), if any */
  lost: { key: string; days: number } | null
  /** the last seven days, oldest first, ending today */
  week: { key: string; mark: DayMark }[]
}

/** Days a streak freeze was spent on, kept in the store and handed here so every number agrees. */
let frozenNow = new Set<string>()
export const setFrozen = (days: string[]) => { frozenNow = new Set(days) }

const REST_EVERY = 7
const SCAN_DAYS = 800

/**
 * Days in a row with at least `minMin` focused minutes. One empty day in any seven is forgiven (a rest day: the run carries on, the day is
 * not counted); two empty days in a row, or a second one inside seven days, end it. Worked out from the saved log alone, so it cannot be
 * made up and nothing about it is stored. Today being empty yet is not a miss.
 */
export function runOf(log: HourLog, minMin = 10, today: Date = new Date(), frozen: Set<string> = frozenNow): Run {
  const todayKey = dateKey(today)
  const doneToday = dayMin(log, todayKey) >= minMin
  const keys = Object.keys(log).filter((k) => dayMin(log, k) >= minMin).sort()
  const week: Run['week'] = []
  const restDays = new Set<string>()
  let run = 0
  let best = 0
  let since: string | null = null
  let lastRest = -Infinity
  let lost: Run['lost'] = null
  let idx = 0
  if (keys.length) {
    const end = parseKey(todayKey)
    const start = parseKey(keys[0])
    start.setTime(Math.max(+start, +end - SCAN_DAYS * 864e5)) // a stray old key cannot make this long
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1), idx++) {
      const k = dateKey(d)
      if (dayMin(log, k) >= minMin) {
        if (run === 0) since = k
        run++
        best = Math.max(best, run)
      } else if (k === todayKey) {
        // still open
      } else if (run > 0 && frozen.has(k)) {
        restDays.add(k)
      } else if (run > 0 && idx - lastRest >= REST_EVERY) {
        lastRest = idx
        restDays.add(k)
      } else {
        if (run > 0) lost = { key: k, days: run }
        run = 0
        since = null
      }
    }
  }
  const today0 = parseKey(todayKey)
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today0)
    d.setDate(d.getDate() - i)
    const k = dateKey(d)
    week.push({ key: k, mark: dayMin(log, k) >= minMin ? 'on' : k === todayKey ? 'open' : frozen.has(k) && restDays.has(k) ? 'frozen' : restDays.has(k) ? 'rest' : 'off' })
  }
  const nextMiss = doneToday ? idx : idx - 1 // index of the next day that could be left empty
  return { days: run, best, since, doneToday, alive: run > 0, restReady: run > 0 && nextMiss - lastRest >= REST_EVERY, lost, week }
}

/** Run lengths that get a card of their own. */
export const MARKS: { days: number; title: string; line: string }[] = [
  { days: 3, title: 'Three days on air', line: 'It takes three to be a pattern.' },
  { days: 7, title: 'A week on air', line: 'Seven days. The hard part was day two.' },
  { days: 14, title: 'Two weeks on air', line: 'Fourteen days. This is just what you do now.' },
  { days: 30, title: 'A month on air', line: 'Thirty days. Most people stop long before this.' },
  { days: 60, title: 'Sixty days on air', line: 'Sixty days. Nobody is making you.' },
  { days: 100, title: 'A hundred days on air', line: 'One hundred. Remember day one?' },
  { days: 200, title: 'Two hundred days on air', line: 'Two hundred. Still here.' },
  { days: 365, title: 'A year on air', line: 'A year of days. That is the whole thing.' },
]

export const markAt = (days: number) => MARKS.find((m) => m.days === days)
export const nextMark = (days: number) => MARKS.find((m) => m.days > days)

/** The streak sentence on the Focus screen. Plain, a little dry, never guilt. */
export function runLine(r: Run, heldMin: number, minMin = 10): string {
  const need = Math.max(1, Math.ceil(minMin - heldMin - 1e-9))
  if (r.doneToday) {
    const m = nextMark(r.days)
    const gap = m ? m.days - r.days : 0
    if (r.days <= 1) return 'Day 1 on air. Back tomorrow for 2.'
    return gap > 0 && gap <= 3 ? `Day ${r.days} on air. ${gap} more for ${m!.days}.` : `Day ${r.days} on air. Back tomorrow for ${r.days + 1}.`
  }
  if (r.alive) return `Day ${r.days + 1} is open. ${need} more minute${need === 1 ? '' : 's'} counts it.`
  if (r.best > 0) return 'Back after a gap. Today starts a new run.'
  return ''
}

/** Small notes the run keeps in this browser (which card was shown, which day paid), erased with everything else. */
export const memo = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* storage blocked */ } },
}
