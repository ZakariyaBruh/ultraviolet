import { useEffect } from 'react'
import { dayTotal, streak } from './stats'
import { useStore, type EventKind } from './store'
import { dateKey } from './dates'

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* storage blocked */ } },
}

/** A system notification, only when this tab is in the background and you have allowed them in Settings. */
export function osNotify(title: string, body: string) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) new Notification(title, { body, icon: '/favicon.svg', tag: 'friction' })
  } catch { /* some browsers only allow these from a service worker */ }
}
export const osState = (): 'unsupported' | NotificationPermission => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
export const askOs = async () => (typeof Notification === 'undefined' ? 'denied' : Notification.requestPermission())

/** One place for "something happened": it lands in the bell, and in the system tray when the tab is hidden. */
export function notify(kind: EventKind, text: string, title = 'Friction') {
  useStore.getState().log(kind, text)
  osNotify(title, text)
}

const STREAKS = [3, 7, 14, 30, 60, 100]

/** Watches finished sessions for the goal and streak moments. */
export function useMilestones() {
  useEffect(() => {
    let seen = useStore.getState().sessions.length
    return useStore.subscribe((s) => {
      if (s.sessions.length <= seen) { seen = s.sessions.length; return }
      seen = s.sessions.length
      const last = s.sessions[0]
      if (!last?.completed) return
      const today = dateKey()
      const held = dayTotal(s.focusLog, today)
      if (held >= s.settings.dailyGoalMin && ls.get('friction:goal-day') !== today) {
        ls.set('friction:goal-day', today)
        notify('goal', `Daily goal reached: ${Math.round(held)} of ${s.settings.dailyGoalMin} minutes held.`, 'Goal reached')
      }
      const n = streak(s.focusLog)
      const prev = Number(ls.get('friction:streak-note') ?? 0)
      if (STREAKS.includes(n) && n !== prev) {
        ls.set('friction:streak-note', String(n))
        notify('goal', `${n} days in a row of ten focused minutes or more.`, 'A streak')
      }
    })
  }, [])
}
