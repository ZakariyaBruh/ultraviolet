/**
 * The Review tab in Insights (free for everyone): everything here is plain arithmetic on what is already saved in this browser, so nothing
 * is estimated or invented. A finding says how much data it rests on, and says what is missing when there is not enough yet.
 */
import { dateKey, daysAgo, fmtMinutes, weekdayMon } from './dates'
import { dayTotal, sum } from './stats'
import type { SessionRec } from './store'

type HourLog = Record<string, number[]>
export interface ReviewData { focusLog: HourLog; urgeLog: HourLog; sessions: SessionRec[] }

/* ───────────── projects ───────────── */

export const PROJECT_MAX = 12
/** a project name as it is kept: no control characters or markup, single spaces, at most 24 characters */
export const tidyProject = (s: unknown): string => String(s ?? '').replace(/[\u0000-\u001f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24)
export const projectOf = (x: Pick<SessionRec, 'project'>): string => tidyProject(x.project)
export const NO_PROJECT = 'No project'

export interface ProjectRow { name: string; min: number; n: number }
/** minutes held per project, most first. Sessions with no project are grouped as "No project" and come last. */
export function projectTotals(sessions: SessionRec[], sinceMs = 0): ProjectRow[] {
  const m = new Map<string, ProjectRow>()
  for (const x of sessions) {
    if (x.start < sinceMs) continue
    const name = projectOf(x) || NO_PROJECT
    const r = m.get(name) ?? { name, min: 0, n: 0 }
    r.min += x.focusSec / 60
    r.n += 1
    m.set(name, r)
  }
  return [...m.values()].sort((a, b) => (a.name === NO_PROJECT ? 1 : b.name === NO_PROJECT ? -1 : b.min - a.min))
}

/* ───────────── weeks (Monday first) ───────────── */

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (d: Date, n: number): Date => { const x = midnight(d); x.setDate(x.getDate() + n); return x }
/** the Monday of the week that holds `d`, at local midnight */
export const weekStart = (d: Date = new Date()): Date => addDays(d, -weekdayMon(midnight(d)))

export interface WeekDay { key: string; date: Date; min: number; drifts: number; future: boolean }
export interface Week {
  start: Date
  days: WeekDay[]
  held: number
  drifts: number
  sessions: number
  finished: number
  /** finished with no drift */
  clean: number
  /** minutes in the longest session */
  longest: number
  activeDays: number
  best: WeekDay | null
  top: { name: string; min: number } | null
}

export function weekOf(d: ReviewData, start: Date, today: Date = new Date()): Week {
  const end = addDays(start, 7).getTime()
  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i)
    const key = dateKey(date)
    return { key, date, min: dayTotal(d.focusLog, key), drifts: dayTotal(d.urgeLog, key), future: date.getTime() > today.getTime() }
  })
  const inWeek = d.sessions.filter((x) => x.start >= start.getTime() && x.start < end)
  const rows = projectTotals(inWeek).filter((r) => r.name !== NO_PROJECT)
  const best = days.filter((x) => x.min > 0).sort((a, b) => b.min - a.min)[0] ?? null
  return {
    start,
    days,
    held: sum(days.map((x) => x.min)),
    drifts: sum(days.map((x) => x.drifts)),
    sessions: inWeek.length,
    finished: inWeek.filter((x) => x.completed).length,
    clean: inWeek.filter((x) => x.completed && x.lapses === 0).length,
    longest: inWeek.reduce((m, x) => Math.max(m, x.focusSec), 0) / 60,
    activeDays: days.filter((x) => x.min >= 1).length,
    best,
    top: rows[0] ? { name: rows[0].name, min: rows[0].min } : null,
  }
}

/** how many days of the week have started (1 on Monday … 7), so this week can be compared with the same days of last week */
export const daysSoFar = (start: Date, today: Date = new Date()): number =>
  Math.min(7, Math.max(0, Math.round((midnight(today).getTime() - start.getTime()) / 864e5) + 1))
export const heldFirst = (w: Week, n: number): number => sum(w.days.slice(0, n).map((x) => x.min))

/** weeks in a row (counting this one once it is reached) with at least `goalMin` minutes held */
export function weeksHit(d: Pick<ReviewData, 'focusLog'>, goalMin: number, today: Date = new Date()): number {
  if (goalMin <= 0) return 0
  const cur = weekStart(today)
  const total = (s: Date) => sum(Array.from({ length: 7 }, (_, i) => dayTotal(d.focusLog, dateKey(addDays(s, i)))))
  let run = total(cur) >= goalMin ? 1 : 0
  for (let i = 1; i <= 104; i++) { if (total(addDays(cur, -7 * i)) >= goalMin) run++; else break }
  return run
}

/** minutes held in each of the last `n` weeks, oldest first; the last one is this week so far */
export function weekTotals(d: Pick<ReviewData, 'focusLog'>, n: number, today: Date = new Date()): number[] {
  const cur = weekStart(today)
  return Array.from({ length: n }, (_, k) => {
    const s = addDays(cur, -7 * (n - 1 - k))
    return sum(Array.from({ length: 7 }, (_, i) => dayTotal(d.focusLog, dateKey(addDays(s, i)))))
  })
}

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
export const fmtRange = (start: Date): string => {
  const end = addDays(start, 6)
  const m = (x: Date) => x.toLocaleDateString(undefined, { month: 'short' })
  return start.getMonth() === end.getMonth() ? `${start.getDate()} to ${end.getDate()} ${m(end)}` : `${start.getDate()} ${m(start)} to ${end.getDate()} ${m(end)}`
}
const pct = (x: number) => `${Math.round(x * 100)}%`

/** "up 22% on last week" or null when there is nothing to compare with */
export function change(now: number, before: number): { pct: number; text: string } | null {
  if (before < 10) return null
  const p = Math.round(((now - before) / before) * 100)
  return { pct: p, text: p === 0 ? 'level with' : `${p > 0 ? 'up' : 'down'} ${Math.abs(p)}% on` }
}

/** one plain paragraph about a week, for copying */
export function weekSummary(w: Week, goalMin: number): string {
  const parts = [`Friction, week of ${fmtRange(w.start)}: ${fmtMinutes(w.held)} held over ${w.activeDays} day${w.activeDays === 1 ? '' : 's'}`]
  parts.push(`${w.finished} session${w.finished === 1 ? '' : 's'} finished, ${w.drifts} drift${w.drifts === 1 ? '' : 's'}`)
  if (w.best) parts.push(`best day ${DAY_NAMES[weekdayMon(w.best.date)]} (${fmtMinutes(w.best.min)})`)
  if (w.top) parts.push(`most time on ${w.top.name} (${fmtMinutes(w.top.min)})`)
  if (goalMin > 0) parts.push(`goal ${fmtMinutes(goalMin)}: ${Math.min(999, Math.round((w.held / goalMin) * 100))}%`)
  return `${parts.map((x) => x[0].toUpperCase() + x.slice(1)).join('. ')}.`
}

/* ───────────── the coach ───────────── */

export interface Finding {
  id: string
  title: string
  body: string
  /** how much data it rests on, or what is missing */
  evidence: string
  ready: boolean
  action?: { label: string; minutes: number }
  /** weekly totals for a small bar chart */
  spark?: number[]
}

const BUCKETS = [
  { to: 15, label: '10 to 15 minutes' },
  { to: 30, label: '20 to 30 minutes' },
  { to: 45, label: '35 to 45 minutes' },
  { to: 60, label: '50 to 60 minutes' },
  { to: 999, label: 'over an hour' },
]
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`
const per = (x: number) => (Math.round(x * 10) / 10).toString()

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0 }
const snap = (m: number) => Math.min(90, Math.max(10, Math.round(m / 5) * 5))

export function coach(d: ReviewData, today: Date = new Date()): Finding[] {
  const out: Finding[] = []
  const s = d.sessions

  /* 1. the length you finish most */
  {
    const rows = BUCKETS.map((b, i) => {
      const lo = i === 0 ? 0 : BUCKETS[i - 1].to
      const xs = s.filter((x) => x.goalMin > lo && x.goalMin <= b.to)
      const fin = xs.filter((x) => x.completed).length
      return { ...b, n: xs.length, fin, rate: xs.length ? fin / xs.length : 0, goals: xs.map((x) => x.goalMin) }
    }).filter((r) => r.n >= 4)
    if (rows.length < 2) {
      out.push({ id: 'length', title: 'Your best length', body: 'It needs at least four sessions at two different lengths to tell which you finish more often.', evidence: `${s.length} session${s.length === 1 ? '' : 's'} so far`, ready: false })
    } else {
      const best = [...rows].sort((a, b) => b.rate - a.rate || b.to - a.to)[0]
      const worst = [...rows].sort((a, b) => a.rate - b.rate || b.to - a.to)[0]
      const longest = rows[rows.length - 1]
      const total = rows.reduce((a, r) => a + r.n, 0)
      if (best.rate - worst.rate < 0.1) {
        out.push({ id: 'length', title: 'Length barely changes whether you finish', body: `You finish ${pct(best.rate)} at ${best.label} and ${pct(worst.rate)} at ${worst.label}. If it costs you nothing, the longer ones give you more focus in one go.`, evidence: `${total} sessions compared`, ready: true, action: { label: `Use ${snap(median(longest.goals))} min`, minutes: snap(median(longest.goals)) } })
      } else {
        out.push({ id: 'length', title: `You finish most at ${best.label}`, body: `You finished ${best.fin} of ${best.n} sessions that long (${pct(best.rate)}), against ${worst.fin} of ${worst.n} at ${worst.label} (${pct(worst.rate)}).`, evidence: `${total} sessions compared`, ready: true, action: { label: `Use ${snap(median(best.goals))} min`, minutes: snap(median(best.goals)) } })
      }
    }
  }

  /* 2. the hours you drift least */
  {
    const f = new Array<number>(24).fill(0)
    const u = new Array<number>(24).fill(0)
    for (let i = 0; i < 90; i++) {
      const k = dateKey(daysAgo(i, today))
      for (let h = 0; h < 24; h++) { f[h] += d.focusLog[k]?.[h] ?? 0; u[h] += d.urgeLog[k]?.[h] ?? 0 }
    }
    const wins = Array.from({ length: 23 }, (_, h) => ({ h, min: f[h] + f[h + 1], dr: u[h] + u[h + 1] })).filter((w) => w.min >= 60).map((w) => ({ ...w, rate: w.dr / (w.min / 60) }))
    const calm = [...wins].sort((a, b) => a.rate - b.rate || b.min - a.min)[0]
    const busy = calm ? [...wins].filter((w) => Math.abs(w.h - calm.h) >= 2).sort((a, b) => b.rate - a.rate)[0] : undefined
    const hours = Math.round(sum(f) / 60)
    if (!calm || !busy) {
      out.push({ id: 'hours', title: 'Your calmest hours', body: 'It needs an hour of focus in at least two different parts of the day, over the last 90 days.', evidence: `${hours} focused hour${hours === 1 ? '' : 's'} so far`, ready: false })
    } else if (busy.rate - calm.rate < 0.5) {
      out.push({ id: 'hours', title: 'You drift at a steady rate all day', body: `About ${per(calm.rate)} to ${per(busy.rate)} drifts an hour, whatever the time. The hour is not what pulls you away.`, evidence: `${hours} focused hours, last 90 days`, ready: true })
    } else {
      out.push({ id: 'hours', title: `You are calmest from ${hh(calm.h)} to ${hh(calm.h + 2)}`, body: `There you drift ${per(calm.rate)} times an hour. From ${hh(busy.h)} to ${hh(busy.h + 2)} it is ${per(busy.rate)}. Put the work that needs you in the first slot.`, evidence: `${hours} focused hours, last 90 days`, ready: true })
    }
  }

  /* 3. the weekday you hold most */
  {
    const tot = new Array<number>(7).fill(0)
    const cnt = new Array<number>(7).fill(0)
    let active = 0
    for (let i = 0; i < 84; i++) {
      const date = daysAgo(i, today)
      const r = weekdayMon(date)
      const m = dayTotal(d.focusLog, dateKey(date))
      tot[r] += m; cnt[r]++; if (m >= 10) active++
    }
    const avg = tot.map((t, r) => (cnt[r] ? t / cnt[r] : 0))
    const hi = avg.indexOf(Math.max(...avg))
    const lo = avg.indexOf(Math.min(...avg))
    if (active < 10 || avg[hi] < 5) {
      out.push({ id: 'weekday', title: 'Your strongest day', body: 'It needs about ten days with at least ten minutes of focus, spread over a few weeks.', evidence: `${active} such day${active === 1 ? '' : 's'} in the last 12 weeks`, ready: false })
    } else if (avg[hi] < avg[lo] * 1.3 + 1) {
      out.push({ id: 'weekday', title: 'Every day of the week looks alike', body: `You hold ${fmtMinutes(avg[lo])} to ${fmtMinutes(avg[hi])} on an average day, whichever day it is.`, evidence: `${active} days with focus, last 12 weeks`, ready: true })
    } else {
      out.push({ id: 'weekday', title: `${DAY_NAMES[hi]}s are your strongest day`, body: `You average ${fmtMinutes(avg[hi])} on ${DAY_NAMES[hi]}s over the last 12 weeks, against ${fmtMinutes(avg[lo])} on ${DAY_NAMES[lo]}s. Plan the hard thing for ${DAY_NAMES[hi]}.`, evidence: `${active} days with focus, last 12 weeks`, ready: true })
    }
  }

  /* 4. what is on while you drift least */
  {
    const NAME: Record<string, string> = { radio: 'radio', tv: 'TV', silent: 'silence' }
    const g = new Map<string, { sec: number; lapses: number }>()
    for (const x of s) { const r = g.get(x.source) ?? { sec: 0, lapses: 0 }; r.sec += x.focusSec; r.lapses += x.lapses; g.set(x.source, r) }
    const rows = [...g].filter(([, r]) => r.sec >= 3600).map(([k, r]) => ({ k, rate: r.lapses / (r.sec / 3600), h: r.sec / 3600 })).sort((a, b) => a.rate - b.rate)
    if (rows.length < 2) {
      out.push({ id: 'source', title: 'What helps you stay', body: 'It needs an hour of focus with each of at least two things on: radio, TV or silence.', evidence: rows.length ? `only ${NAME[rows[0].k] ?? rows[0].k} has an hour so far` : 'no source has an hour yet', ready: false })
    } else {
      const a = rows[0]
      const b = rows[rows.length - 1]
      out.push({ id: 'source', title: per(a.rate) === per(b.rate) ? 'Nothing you play changes how you drift' : `You drift least with ${NAME[a.k] ?? a.k}`, body: `${per(a.rate)} drifts an hour with ${NAME[a.k] ?? a.k}, ${per(b.rate)} with ${NAME[b.k] ?? b.k}. This is what the numbers show so far, not proof that it is the cause.`, evidence: rows.map((r) => `${per(r.h)} h of ${NAME[r.k] ?? r.k}`).join(', '), ready: true })
    }
  }

  /* 5. when in a session you drift (noted from now on) */
  {
    const timed = s.filter((x) => x.lapseAt && x.lapseAt.length)
    const times = timed.flatMap((x) => x.lapseAt ?? [])
    if (times.length < 10 || timed.length < 4) {
      out.push({ id: 'timing', title: 'When in a session you drift', body: 'Friction now notes how far into a session each drift happens. This fills in after about ten drifts across a few sessions.', evidence: `${times.length} drift${times.length === 1 ? '' : 's'} timed so far`, ready: false })
    } else {
      const early = times.filter((t) => t < 600).length / times.length
      const late = times.filter((t) => t >= 1200).length / times.length
      const med = Math.round(median(times) / 60)
      const title = early >= 0.5 ? 'Most of your drifts come early' : late >= 0.4 ? 'Your drifts creep in late' : 'Your drifts are spread through a session'
      const body = early >= 0.5
        ? `${pct(early)} of your drifts happen in the first 10 minutes. Settle in first: put the phone out of reach before you lock in.`
        : late >= 0.4
          ? `${pct(late)} of your drifts come after minute 20. Shorter sessions with a break between them may suit you better.`
          : `Half of them have happened by minute ${med}. No single stretch is the problem.`
      out.push({ id: 'timing', title, body, evidence: `${times.length} drifts in ${timed.length} sessions`, ready: true })
    }
  }

  /* 6. the last four full weeks against the four before */
  {
    const w = weekTotals(d, 9, today) // 8 full weeks then this one
    const recent = w.slice(4, 8)
    const before = w.slice(0, 4)
    const a = sum(recent) / 4
    const b = sum(before) / 4
    const spark = w.slice(0, 8)
    const weeks = spark.filter((x) => x >= 10).length
    if (weeks < 4 || a < 10 || b < 10) {
      out.push({ id: 'momentum', title: 'Where you are heading', body: 'It needs focus in at least four of the last eight full weeks, with some in each half.', evidence: `${weeks} of 8 weeks with focus`, ready: false, spark })
    } else {
      const c = change(a, b)
      out.push({ id: 'momentum', title: c && Math.abs(c.pct) >= 5 ? `You are ${c.text} the four weeks before` : 'Steady, week on week', body: `Your last four full weeks averaged ${fmtMinutes(a)} a week; the four before averaged ${fmtMinutes(b)}.`, evidence: 'eight full weeks of focus time', ready: true, spark })
    }
  }

  /* 7. how often you show up */
  {
    let n = 0
    let t = 0
    for (let i = 0; i < 28; i++) { const m = dayTotal(d.focusLog, dateKey(daysAgo(i, today))); if (m >= 10) { n++; t += m } }
    if (n === 0) out.push({ id: 'days', title: 'How often you show up', body: 'It needs at least one day with ten minutes of focus in the last four weeks.', evidence: 'no focused days in the last 28', ready: false })
    else out.push({ id: 'days', title: `You focused on ${n} of the last 28 days`, body: n >= 20 ? `That is steady. On those days you averaged ${fmtMinutes(t / n)}.` : `On the days you did show up you averaged ${fmtMinutes(t / n)}. A short session on the quiet days keeps the habit alive.`, evidence: 'days with at least 10 minutes', ready: true })
  }
  return out
}

/* ───────────── exports ───────────── */

const csvq = (v: string | number | boolean) => { const t = String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
/** the person's own sessions as CSV text (built in the browser, sent nowhere) */
export function sessionsCsv(sessions: SessionRec[]): string {
  const head = 'start,end,goal_min,focus_sec,drifts,source,title,project,completed,breaks'
  const body = sessions.map((r) => [new Date(r.start).toISOString(), new Date(r.end).toISOString(), r.goalMin, r.focusSec, r.lapses, r.source, r.title, projectOf(r), r.completed, r.breaks ?? 0].map(csvq).join(','))
  return [head, ...body].join('\n')
}

const icsText = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const icsTime = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
/** content lines longer than 75 octets are folded onto continuation lines that start with a space (RFC 5545) */
function fold(line: string): string[] {
  const enc = new TextEncoder()
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const b = enc.encode(ch).length
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0 }
    cur += ch; bytes += b
  }
  out.push(cur)
  return out.map((l, i) => (i ? ` ${l}` : l))
}
/** the sessions as a calendar file that Google Calendar, Apple Calendar and Outlook can import */
export function sessionsIcs(sessions: SessionRec[], now: number = Date.now()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Friction//Focus sessions//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Friction focus sessions']
  for (const r of sessions) {
    const p = projectOf(r)
    const end = Math.max(r.end, r.start + Math.max(60, r.focusSec) * 1000)
    const desc = `${Math.round(r.focusSec / 60)} of ${r.goalMin} min held, ${r.lapses} drift${r.lapses === 1 ? '' : 's'}, ${r.completed ? 'finished' : 'ended early'}. ${r.source === 'silent' ? 'Silence' : r.source === 'tv' ? 'TV' : 'Radio'}: ${r.title}.`
    lines.push('BEGIN:VEVENT', `UID:${String(r.id).replace(/[^\w-]/g, '')}@frictionx.app`, `DTSTAMP:${icsTime(now)}`, `DTSTART:${icsTime(r.start)}`, `DTEND:${icsTime(end)}`, `SUMMARY:${icsText(`Focus: ${p || r.title}`)}`, `DESCRIPTION:${icsText(desc)}`)
    if (p) lines.push(`CATEGORIES:${icsText(p)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.flatMap(fold).join('\r\n') + '\r\n'
}

