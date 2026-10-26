/**
 * The two API routes (leaderboard, rooms) run on Vercel and, as a spare, on Whop hosting (`/whop`), both against the same
 * Turso database. If the Vercel functions are paused or down, calls move to the spare for ten minutes, then try Vercel again.
 */
const SPARE = 'https://frictionx.whop.site'
const KEY = 'friction:api-spare-until'
const HOLD = 10 * 60e3

const read = () => { try { return Number(localStorage.getItem(KEY)) || 0 } catch { return 0 } }
const write = (t: number) => { try { localStorage.setItem(KEY, String(t)) } catch { /* storage blocked: stay on the main host */ } }

/** A failure of the host itself, as opposed to an answer from our own code (which is always JSON). */
const hostFailed = (r: Response) => r.status === 402 || (r.status >= 500 && !(r.headers.get('content-type') ?? '').includes('application/json'))

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const spare = location.hostname.endsWith('.vercel.app')
  if (!spare) return fetch(path, init)
  if (read() > Date.now()) {
    try { return await fetch(SPARE + path, init) } catch { write(0) }
  }
  try {
    const r = await fetch(path, init)
    if (!hostFailed(r)) return r
  } catch { /* the main host did not answer: try the spare */ }
  try {
    const r = await fetch(SPARE + path, init)
    write(Date.now() + HOLD)
    return r
  } catch {
    return fetch(path, init)
  }
}
