/**
 * A small .ics reader for the Calendar window. It understands what people actually export from Google, Apple and Outlook calendars:
 * events with a start and an end (UTC, a named time zone, a floating time or a whole day), a length, a repeat (daily, weekly with days,
 * monthly, yearly, with an interval, a count or an end) and dates skipped. Everything is worked out in this browser; nothing is sent.
 * Not understood (and left as one plain event): repeats by the hour or minute, "third Tuesday" style rules, and Windows time-zone names,
 * which are read as the device's own time.
 */
export interface Rule { f: 'D' | 'W' | 'M' | 'Y'; i: number; n?: number; u?: number; d?: number[] }
export interface CalEvent { id: string; t: string; s: number; e: number; day?: boolean; loc?: string; r?: Rule; x?: number[] }
export interface Occ { id: string; t: string; s: number; e: number; day: boolean; loc?: string }

export const CAL_MAX = 1500
export const CAL_BYTES = 2_000_000
const DAY = 864e5

/** the wall-clock time in a zone, as milliseconds since the epoch if that wall-clock time were UTC, minus the instant: the zone's offset */
function offsetAt(ms: number, tz: string): number {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(ms))
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value)
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - Math.floor(ms / 1000) * 1000
}
export function zoned(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const guess = Date.UTC(y, mo, d, h, mi, s)
  try {
    let t = guess - offsetAt(guess, tz)
    t = guess - offsetAt(t, tz)
    return t
  } catch {
    return new Date(y, mo, d, h, mi, s).getTime() // a name this browser does not know: the device's own time
  }
}

/** lines of a file with the folded ones joined */
const unfold = (text: string) => text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n')
const unescape = (v: string) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').replace(/\s+/g, ' ').trim()

interface Prop { name: string; params: Record<string, string>; value: string }
function prop(line: string): Prop | null {
  const c = line.indexOf(':')
  if (c < 1) return null
  const head = line.slice(0, c).split(';')
  const params: Record<string, string> = {}
  for (const p of head.slice(1)) { const [k, ...v] = p.split('='); params[k.toUpperCase()] = v.join('=').replace(/^"|"$/g, '') }
  return { name: head[0].toUpperCase(), params, value: line.slice(c + 1) }
}

/** a DATE or DATE-TIME value to an instant (and whether it was a whole day) */
function when(v: string, params: Record<string, string>): { ms: number; day: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
  if (m[4] === undefined || params.VALUE === 'DATE') return { ms: new Date(y, mo, d).getTime(), day: true }
  const [h, mi, s] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)]
  if (m[7]) return { ms: Date.UTC(y, mo, d, h, mi, s), day: false }
  if (params.TZID) return { ms: zoned(y, mo, d, h, mi, s, params.TZID), day: false }
  return { ms: new Date(y, mo, d, h, mi, s).getTime(), day: false }
}

const DOW = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
function rule(v: string, params: Record<string, string>): Rule | undefined {
  const kv: Record<string, string> = {}
  for (const part of v.split(';')) { const [k, ...r] = part.split('='); kv[k.toUpperCase()] = r.join('=') }
  const f: Rule['f'] | undefined = ({ DAILY: 'D', WEEKLY: 'W', MONTHLY: 'M', YEARLY: 'Y' } as Record<string, Rule['f']>)[kv.FREQ]
  if (!f) return undefined
  const out: Rule = { f, i: Math.max(1, Math.min(52, Number(kv.INTERVAL) || 1)) }
  if (kv.COUNT) out.n = Math.max(1, Math.min(5000, Number(kv.COUNT) || 1))
  if (kv.UNTIL) { const u = when(kv.UNTIL.length === 8 ? kv.UNTIL : kv.UNTIL, params); if (u) out.u = u.day ? u.ms + DAY : u.ms }
  if (kv.BYDAY && f === 'W') {
    const d = kv.BYDAY.split(',').map((x) => DOW.indexOf(x.replace(/^[+-]?\d+/, '').toUpperCase())).filter((x) => x >= 0)
    if (d.length) out.d = [...new Set(d)].sort()
  }
  return out
}

export function parseIcs(text: string): { name: string; events: CalEvent[]; skipped: number } {
  const lines = unfold(text.slice(0, CAL_BYTES))
  let name = ''
  const events: CalEvent[] = []
  let skipped = 0
  let cur: Prop[] | null = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = []; continue }
    if (line === 'END:VEVENT') {
      if (cur) {
        const get = (n: string) => cur!.find((p) => p.name === n)
        const st = get('DTSTART')
        const s = st && when(st.value, st.params)
        if (!s || get('STATUS')?.value.toUpperCase() === 'CANCELLED') { skipped++; cur = null; continue }
        const en = get('DTEND')
        let e = en ? when(en.value, en.params)?.ms : undefined
        const dur = get('DURATION')?.value
        if (e === undefined && dur) {
          const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(dur)
          if (m) e = s.ms + ((Number(m[1] ?? 0) * 7 + Number(m[2] ?? 0)) * DAY) + (Number(m[3] ?? 0) * 3600 + Number(m[4] ?? 0) * 60 + Number(m[5] ?? 0)) * 1000
        }
        if (e === undefined || e < s.ms) e = s.day ? s.ms + DAY : s.ms
        const ev: CalEvent = { id: String(events.length), t: unescape(get('SUMMARY')?.value ?? '').slice(0, 120) || 'Busy', s: s.ms, e }
        if (s.day) ev.day = true
        const loc = unescape(get('LOCATION')?.value ?? '').slice(0, 100)
        if (loc) ev.loc = loc
        const rr = get('RRULE')
        if (rr) { const r = rule(rr.value, st.params); if (r) ev.r = r }
        const ex = cur.filter((p) => p.name === 'EXDATE').flatMap((p) => p.value.split(',').map((v) => when(v, { ...p.params, VALUE: s.day ? 'DATE' : '' })?.ms ?? NaN)).filter((n) => isFinite(n))
        if (ex.length) ev.x = ex.slice(0, 200)
        if (events.length < CAL_MAX) events.push(ev)
        else skipped++
      }
      cur = null
      continue
    }
    const p = prop(line)
    if (!p) continue
    if (cur) cur.push(p)
    else if (!name && (p.name === 'X-WR-CALNAME' || p.name === 'NAME')) name = unescape(p.value).slice(0, 60)
  }
  return { name, events, skipped }
}

/** every occurrence of every event that overlaps [from, to), earliest first */
export function between(events: CalEvent[], from: number, to: number, cap = 400): Occ[] {
  const out: Occ[] = []
  const push = (ev: CalEvent, s: number) => {
    const e = s + (ev.e - ev.s)
    if (e > from && s < to && !ev.x?.includes(s)) out.push({ id: `${ev.id}:${s}`, t: ev.t, s, e, day: !!ev.day, loc: ev.loc })
  }
  for (const ev of events) {
    if (!ev.r) { push(ev, ev.s); continue }
    const { f, i, n, u, d } = ev.r
    const start = new Date(ev.s)
    let made = 0
    for (let k = 0; k < 6000; k++) {
      const days: Date[] = []
      if (f === 'D') { const x = new Date(start); x.setDate(x.getDate() + k * i); days.push(x) }
      else if (f === 'W') {
        const wk = new Date(start); wk.setDate(wk.getDate() - wk.getDay() + k * 7 * i)
        for (const wd of d ?? [start.getDay()]) { const x = new Date(wk); x.setDate(x.getDate() + wd); if (+x >= ev.s - DAY) days.push(x) }
      } else if (f === 'M') { const x = new Date(start); x.setDate(1); x.setMonth(start.getMonth() + k * i); x.setDate(start.getDate()); if (x.getDate() === start.getDate()) days.push(x) }
      else { const x = new Date(start); x.setFullYear(start.getFullYear() + k * i); if (x.getMonth() === start.getMonth()) days.push(x) }
      let past = false
      for (const x of days.sort((a, b) => +a - +b)) {
        // the time of day is the start's, on the new date
        const s = new Date(x.getFullYear(), x.getMonth(), x.getDate(), start.getHours(), start.getMinutes(), start.getSeconds()).getTime()
        if (s < ev.s) continue
        if (u && s >= u) { past = true; break }
        made++
        if (n && made > n) { past = true; break }
        if (s >= to) { past = true; break }
        push(ev, s)
      }
      if (past) break
    }
  }
  return out.sort((a, b) => a.s - b.s || a.t.localeCompare(b.t)).slice(0, cap)
}

/** what is on now or starts next, within a day (whole-day events do not count: they are not a time to be somewhere) */
export function nextUp(events: CalEvent[], now: number): Occ | null {
  return between(events, now, now + DAY).find((o) => !o.day && o.e > now) ?? null
}
