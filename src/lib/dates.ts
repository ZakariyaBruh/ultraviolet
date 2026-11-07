export const pad = (n: number) => String(n).padStart(2, '0')

export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function daysAgo(n: number, from: Date = new Date()): Date {
  const d = new Date(from)
  d.setDate(d.getDate() - n)
  return d
}

/** Monday = 0 … Sunday = 6 */
export function weekdayMon(d: Date): number {
  return (d.getDay() + 6) % 7
}

export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

export function fmtMinutes(min: number): string {
  if (min < 1) return `${Math.round(min * 60)}s`
  const t = Math.round(min) // round once, whole, so 239.6 minutes is 4h and never "3h 60m"
  if (t < 60) return `${t}m`
  const h = Math.floor(t / 60)
  const m = t % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
