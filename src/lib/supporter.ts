import { useStore } from './store'

/**
 * Supporters (Whop: https://whop.com, product "Support Friction"): a small way to keep Friction free. Whop takes the payment and sends the
 * buyer to /thanks, which keeps one flag in this browser (`friction:supporter`). Nothing about the buyer reaches Friction. Credits and the
 * shop are never sold or handed out: everything you can earn stays earned. A supporter gets tools about their own data: a Year view in
 * Insights (every day of the last 52 weeks), a CSV export of their sessions, and a mark by their name. The flag is an honour-system pass.
 */
const KEY = 'friction:supporter'
export const SUPPORT_PLAN = 'plan_iP58mTsDntqwy'
export const SUPPORT_PAGE = '/support'
/** open the Support screen without leaving the app */
export const openSupport = () => { history.pushState(null, '', SUPPORT_PAGE); dispatchEvent(new PopStateEvent('popstate')) }

export const isSupporter = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
export const markSupporter = () => { try { localStorage.setItem(KEY, '1') } catch { /* storage blocked */ } }
export const forgetSupporter = () => { try { localStorage.removeItem(KEY) } catch { /* storage blocked */ } }

const q = (v: string | number | boolean) => { const t = String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t }
/** the person's own sessions as CSV text (supporters only; built in the browser, nothing is sent) */
export function sessionsCsv(): string {
  const rows = useStore.getState().sessions
  const head = 'start,end,goal_min,focus_sec,drifts,source,title,completed,breaks'
  const body = rows.map((r) => [new Date(r.start).toISOString(), new Date(r.end).toISOString(), r.goalMin, r.focusSec, r.lapses, r.source, r.title, r.completed, r.breaks ?? 0].map(q).join(','))
  return [head, ...body].join('\n')
}
