import { useSyncExternalStore } from 'react'
import { sessionsCsv, sessionsIcs } from './plus'
import { useStore } from './store'
import { useUI } from './ui'

/**
 * Supporters (Whop: https://whop.com, product "Support Friction"): a small way to keep Friction free. Whop takes the payment and sends the
 * buyer to /thanks, which keeps one flag in this browser (`friction:supporter`). Nothing about the buyer reaches Friction. Credits and the
 * shop are never sold or handed out: everything you can earn stays earned. A supporter gets tools about their own work and data (Plus in
 * Insights: Week, Projects, Coach, Year, Records; project labels on the Focus screen; a longer history; CSV and calendar export; an
 * encrypted backup) and a mark by their name. The flag is an honour-system pass: nothing it opens could hurt anyone if it were forged.
 */
const KEY = 'friction:supporter'
export const SUPPORT_PLAN = 'plan_iP58mTsDntqwy'
export const SUPPORT_PAGE = '/support'
/** open the Support screen without leaving the app */
export const openSupport = () => { history.pushState(null, '', SUPPORT_PAGE); dispatchEvent(new PopStateEvent('popstate')) }
/** go to another screen without leaving the app */
export const goTo = (path: string) => { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate')) }
/** open one of the Plus tools in Insights (week, projects, coach, year, records) without leaving the app */
export const openPlus = (tab: string) => { useUI.getState().set({ insightsTab: 'plus', plusTab: tab }); history.pushState(null, '', '/insights'); dispatchEvent(new PopStateEvent('popstate')) }

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((f) => f())
export const isSupporter = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
export const markSupporter = () => { try { localStorage.setItem(KEY, '1') } catch { /* storage blocked */ } emit() }
export const forgetSupporter = () => { try { localStorage.removeItem(KEY) } catch { /* storage blocked */ } emit() }
/** true for a supporter, and the screen updates the moment that changes */
export function useSupporter(): boolean {
  return useSyncExternalStore((cb) => { listeners.add(cb); addEventListener('storage', cb); return () => { listeners.delete(cb); removeEventListener('storage', cb) } }, isSupporter, () => false)
}

/** hand a file built in the browser to the person: nothing is sent anywhere */
export function download(name: string, mime: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
export const downloadCsv = () => download('friction-sessions.csv', 'text/csv', sessionsCsv(useStore.getState().sessions))
export const downloadIcs = () => download('friction-sessions.ics', 'text/calendar', sessionsIcs(useStore.getState().sessions))
