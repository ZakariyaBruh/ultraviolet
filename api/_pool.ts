/**
 * The cloud browser's time, shared by both kinds (api/cloud.ts, Hyperbeam, and api/relay.ts, the Scramjet backup). Two limits, both in seconds a day
 * (UTC), kept in Turso's `cloud_day` table:
 *   - each address has `PER_IP` (30 minutes) across both kinds, so using the backup does not give anyone more time;
 *   - everyone together draw on ONE pool (`POOL_ROW`): whatever someone does not use is left for the next person, nobody is promised a share.
 * The pool is sized so that even if all of it were spent on the backup, which is the only part paid for out of Vercel's credit, a month of full days
 * stays inside the budget: `CLOUD_MONTHLY_USD` ($20) less 10% for the rest of the site, divided by what an open-socket hour costs (`CLOUD_HOUR_USD`,
 * $0.041: the estimated $0.035 plus the overlap of old and new sockets at each renewal) and by the days in the month. `CLOUD_DAILY_POOL_H` sets it
 * outright. Hyperbeam's own minutes are not paid out of that credit, but they are counted here too, so one number covers everything.
 */
export const PER_IP = 30 * 60
export const POOL_ROW = 'POOL1'

const daysThisMonth = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 0)).getUTCDate() }
export const poolSecs = () => {
  const h = Number(process.env.CLOUD_DAILY_POOL_H)
  if (h > 0) return Math.floor(h * 3600)
  const usd = (Number(process.env.CLOUD_MONTHLY_USD) || 20) * 0.9
  return Math.floor((usd / (Number(process.env.CLOUD_HOUR_USD) || 0.041) / daysThisMonth()) * 3600)
}

export const today = () => new Date().toISOString().slice(0, 10)
/** an IPv6 address is a whole /64 to its owner, who can change the last half at will, so the allowance goes by the first half */
const net = (ip: string) => (ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip)
export async function who(ip: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`hb1:${net(ip)}`))
  return `h${Array.from(new Uint8Array(h)).slice(0, 9).map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

export const SQL_ADD = 'INSERT INTO cloud_day (id, day, secs) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET secs = CASE WHEN day = excluded.day THEN secs + excluded.secs ELSE excluded.secs END, day = excluded.day'
export const SQL_BACK = 'UPDATE cloud_day SET secs = MAX(0, secs - ?) WHERE id = ? AND day = ?'
export const CREATE_DAY = 'CREATE TABLE IF NOT EXISTS cloud_day (id TEXT PRIMARY KEY, day TEXT NOT NULL, secs REAL NOT NULL DEFAULT 0)'
