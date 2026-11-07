import { useSyncExternalStore } from 'react'
import { useUI } from './ui'

/**
 * Supporters (Whop: https://whop.com, product "Support Friction"): a small way to keep Friction free. Whop takes the payment and sends the
 * buyer to /thanks, which keeps one flag in this browser (`friction:supporter`). Nothing about the buyer reaches Friction.
 *
 * The rule: nothing that was free is ever taken away or moved behind this, and credits and the shop are never sold or handed out. A
 * supporter gets things that are only extra: more themes (`lib/themes.ts`, `premium`), an encrypted cloud backup (`lib/backup.ts`) and a star
 * by their alias on the leaderboard with a mark on their avatar. The flag is an honour-system pass: nothing it opens could hurt anyone if it
 * were forged (the backup is the one server cost, and is capped).
 */
const KEY = 'friction:supporter'
export const SUPPORT_PLAN = 'plan_iP58mTsDntqwy'
export const SUPPORT_PAGE = '/support'
/** go to another screen without leaving the app */
export const goTo = (path: string) => { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate')) }
/** open the Support screen without leaving the app */
export const openSupport = () => goTo(SUPPORT_PAGE)
/** open one of the Review tools in Insights (week, projects, coach, year, records) without leaving the app */
export const openReview = (tab: string) => { useUI.getState().set({ insightsTab: 'review', reviewTab: tab }); goTo('/insights') }

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((f) => f())
export const isSupporter = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
export const markSupporter = () => { try { localStorage.setItem(KEY, '1') } catch { /* storage blocked */ } emit() }
export const forgetSupporter = () => { try { localStorage.removeItem(KEY) } catch { /* storage blocked */ } emit() }
/** true for a supporter, and the screen updates the moment that changes */
export function useSupporter(): boolean {
  return useSyncExternalStore((cb) => { listeners.add(cb); addEventListener('storage', cb); return () => { listeners.delete(cb); removeEventListener('storage', cb) } }, isSupporter, () => false)
}
