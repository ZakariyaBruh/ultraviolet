/**
 * The Planner window: an exam date and its topics turned into a spaced daily plan by fixed rules. Each topic is learnt once, spread over
 * the first part of the time left, then revisited a day, three days and a week later (only where that is before the exam), and the last
 * two days before the exam are a mixed review of everything. Days are counted on the calendar (UTC day numbers), so a clock change
 * cannot move a day. No AI: the same input gives the same plan.
 */
export interface Exam { id: string; subject: string; date: string; topics: string[]; mins: number }
export type Kind = 'learn' | 'review' | 'final'
export interface Item { topic: string; kind: Kind }
export interface Day { date: string; items: Item[] }
export const EXAMS_MAX = 12
export const TOPICS_MAX = 40
const DAY = 864e5
const num = (key: string) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY) }
const key = (n: number) => new Date(n * DAY).toISOString().slice(0, 10)
export const validKey = (k: unknown): k is string => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && key(num(k)) === k
export const REVIEW_GAPS = [1, 3, 7]

/** days left before the exam day, counting today (0 when the exam is today or past) */
export const daysLeft = (e: Exam, today: string) => Math.max(0, num(e.date) - num(today))

export function planOf(e: Exam, today: string): Day[] {
  if (!validKey(e.date) || !validKey(today)) return []
  const t0 = num(today), last = num(e.date) - 1
  if (last < t0) return []
  const span = last - t0 + 1
  const topics = e.topics.map((t) => t.trim()).filter(Boolean).slice(0, TOPICS_MAX)
  const days: Day[] = Array.from({ length: span }, (_, i) => ({ date: key(t0 + i), items: [] }))
  if (!topics.length) { for (const d of days) d.items.push({ topic: e.subject || 'Revision', kind: d === days[days.length - 1] ? 'final' : 'review' }); return days }
  // the last two days (or the last day, when only a few are left) are the final review of everything
  const finals = span >= 5 ? 2 : span >= 2 ? 1 : 0
  const learnDays = span - finals
  topics.forEach((t, i) => {
    const day = Math.min(learnDays - 1, Math.floor((i * learnDays) / topics.length))
    if (learnDays > 0) days[day].items.push({ topic: t, kind: 'learn' })
    else days[0].items.push({ topic: t, kind: 'final' })
    for (const g of REVIEW_GAPS) { const r = day + g; if (learnDays > 0 && r < learnDays) days[r].items.push({ topic: t, kind: 'review' }) }
  })
  for (let i = learnDays; i < span; i++) for (const t of topics) days[i].items.push({ topic: t, kind: 'final' })
  return days
}

/** what to do today across every exam, soonest exam first */
export function todayOf(exams: Exam[], today: string): { exam: Exam; items: Item[]; left: number }[] {
  return exams
    .map((exam) => ({ exam, items: planOf(exam, today)[0]?.items ?? [], left: daysLeft(exam, today) }))
    .filter((x) => x.left > 0)
    .sort((a, b) => a.left - b.left)
}

/** minutes a topic gets today: the day's time shared out, never under 5 */
export const minutesEach = (e: Exam, n: number) => (n ? Math.max(5, Math.round(e.mins / n / 5) * 5) : 0)

export function sanitizeExams(v: unknown): Exam[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: Exam[] = []
  for (const x of v.slice(0, EXAMS_MAX)) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    if (!validKey(o.date) || typeof o.subject !== 'string') continue
    const topics = (Array.isArray(o.topics) ? o.topics : []).filter((t): t is string => typeof t === 'string').map((t) => t.trim().slice(0, 80)).filter(Boolean).slice(0, TOPICS_MAX)
    const mins = typeof o.mins === 'number' && Number.isFinite(o.mins) ? Math.min(240, Math.max(10, Math.round(o.mins))) : 45
    out.push({ id: String(o.id ?? out.length).slice(0, 24), subject: o.subject.trim().slice(0, 60) || 'Exam', date: o.date, topics, mins })
  }
  return out
}
