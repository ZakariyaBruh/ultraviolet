import { dayTotal, streak, sum } from './stats'
import { useFx } from './fx'
import { useStore, type AppState } from './store'

/**
 * Achievements: recognition for what the numbers already show, nothing more. Each one is worked out from saved data (finished sessions,
 * the hourly log, credits, lessons) by a pure function, never estimated, and no credits are paid for them: credits are earned only by
 * real work, and a badge that paid would be something to grind. Once earned it stays earned (`store.achievements`, id -> when), so
 * trimming old sessions never takes one away. Nothing here leaves the browser.
 */
export type AchGroup = 'Focus' | 'Habit' | 'Learn' | 'Credits'
export type Src = Pick<AppState, 'sessions' | 'focusLog' | 'credits' | 'learn' | 'settings'>

export interface Facts {
  finished: number
  clean: number
  longest: number
  minutes: number
  streak: number
  goalDays: number
  early: number
  late: number
  lessons: number
  perfect: number
  earned: number
  spent: number
  games: number
}

export function factsOf(s: Src, today: Date = new Date()): Facts {
  const done = s.sessions.filter((x) => x.completed)
  const goal = s.settings.dailyGoalMin
  const hour = (t: number) => new Date(t).getHours()
  const lessons = Object.values(s.learn.done)
  return {
    finished: done.length,
    clean: done.filter((x) => x.lapses === 0).length,
    longest: done.reduce((m, x) => Math.max(m, x.goalMin), 0),
    minutes: Object.values(s.focusLog).reduce((a, row) => a + sum(row), 0),
    streak: streak(s.focusLog, 10, today),
    goalDays: goal > 0 ? Object.keys(s.focusLog).filter((k) => dayTotal(s.focusLog, k) >= goal).length : 0,
    early: done.filter((x) => hour(x.start) >= 4 && hour(x.start) < 7).length,
    late: done.filter((x) => hour(x.start) >= 22).length,
    lessons: lessons.length,
    perfect: lessons.filter((l) => l.total > 0 && l.score === l.total).length,
    earned: s.credits.earned,
    spent: s.credits.spent,
    games: Object.values(s.credits.best).filter((n) => n > 0).length,
  }
}

export interface Achievement {
  id: string
  group: AchGroup
  name: string
  /** what earns it, in plain words */
  how: string
  goal: number
  /** how the progress is counted, for "12 of 50 sessions" */
  unit: string
  value: (f: Facts) => number
}

const A = (id: string, group: AchGroup, name: string, how: string, goal: number, unit: string, value: (f: Facts) => number): Achievement => ({ id, group, name, how, goal, unit, value })

export const ACHIEVEMENTS: Achievement[] = [
  A('first-lock', 'Focus', 'First lock-in', 'Finish a session.', 1, 'session', (f) => f.finished),
  A('ten-sessions', 'Focus', 'Ten sessions', 'Finish ten sessions.', 10, 'sessions', (f) => f.finished),
  A('fifty-sessions', 'Focus', 'Fifty sessions', 'Finish fifty sessions.', 50, 'sessions', (f) => f.finished),
  A('hundred-sessions', 'Focus', 'A hundred sessions', 'Finish a hundred sessions.', 100, 'sessions', (f) => f.finished),
  A('clean-sheet', 'Focus', 'Clean sheet', 'Finish a session without leaving once.', 1, 'clean session', (f) => f.clean),
  A('ten-clean', 'Focus', 'Ten clean sheets', 'Finish ten sessions without leaving.', 10, 'clean sessions', (f) => f.clean),
  A('an-hour', 'Focus', 'An hour in one go', 'Finish a session set for an hour.', 60, 'minutes', (f) => f.longest),
  A('ninety', 'Focus', 'Ninety minutes', 'Finish a session set for ninety minutes.', 90, 'minutes', (f) => f.longest),
  A('ten-hours', 'Focus', 'Ten hours held', 'Hold ten hours of focus in all.', 600, 'minutes', (f) => f.minutes),
  A('fifty-hours', 'Focus', 'Fifty hours held', 'Hold fifty hours of focus in all.', 3000, 'minutes', (f) => f.minutes),
  A('hundred-hours', 'Focus', 'A hundred hours held', 'Hold a hundred hours of focus in all.', 6000, 'minutes', (f) => f.minutes),
  A('streak-3', 'Habit', 'Three days running', 'Focus ten minutes or more on three days in a row.', 3, 'days', (f) => f.streak),
  A('streak-7', 'Habit', 'A week running', 'Ten minutes or more on seven days in a row.', 7, 'days', (f) => f.streak),
  A('streak-30', 'Habit', 'A month running', 'Ten minutes or more on thirty days in a row.', 30, 'days', (f) => f.streak),
  A('goal-day', 'Habit', 'Goal reached', 'Reach your daily goal.', 1, 'day', (f) => f.goalDays),
  A('goal-week', 'Habit', 'Seven goal days', 'Reach your daily goal on seven days.', 7, 'days', (f) => f.goalDays),
  A('early-bird', 'Habit', 'Early bird', 'Finish a session that began before seven in the morning.', 1, 'session', (f) => f.early),
  A('night-owl', 'Habit', 'Night owl', 'Finish a session that began after ten at night.', 1, 'session', (f) => f.late),
  A('first-lesson', 'Learn', 'First lesson', 'Finish a lesson.', 1, 'lesson', (f) => f.lessons),
  A('ten-lessons', 'Learn', 'Ten lessons', 'Finish ten different lessons.', 10, 'lessons', (f) => f.lessons),
  A('perfect-lesson', 'Learn', 'Full marks', 'Answer every question in a lesson right.', 1, 'lesson', (f) => f.perfect),
  A('hundred-credits', 'Credits', 'A hundred credits', 'Earn a hundred credits.', 100, 'credits', (f) => f.earned),
  A('thousand-credits', 'Credits', 'A thousand credits', 'Earn a thousand credits.', 1000, 'credits', (f) => f.earned),
  A('first-spend', 'Credits', 'First purchase', 'Spend credits, in the shop or on a round.', 1, 'credit spent', (f) => f.spent),
  A('five-games', 'Credits', 'Five games', 'Score in five different arcade games.', 5, 'games', (f) => f.games),
]

export const progressOf = (a: Achievement, f: Facts) => Math.min(1, Math.max(0, a.value(f) / a.goal))
export const metBy = (a: Achievement, f: Facts) => a.value(f) >= a.goal

/** the ids that are met now and were not recorded before */
export function newlyMet(have: Record<string, number>, s: Src, today: Date = new Date()): Achievement[] {
  const f = factsOf(s, today)
  return ACHIEVEMENTS.filter((a) => !have[a.id] && metBy(a, f))
}

/**
 * Watches the saved numbers and records an achievement the moment it is met, with a plain notice. A first look at a long history can meet many at
 * once: that is one notice, not a flood.
 */
export function startAchievementWatch(): () => void {
  let timer = 0
  const check = () => {
    const s = useStore.getState()
    const got = newlyMet(s.achievements, s)
    if (!got.length) return
    const t = Date.now()
    useStore.setState({ achievements: { ...s.achievements, ...Object.fromEntries(got.map((a) => [a.id, t])) } })
    const say = useFx.getState().say
    if (got.length > 2) say({ title: `${got.length} achievements earned`, description: 'From what you have already done. They are in Insights, under Achievements.' })
    else for (const a of got) say({ title: `Achievement: ${a.name}`, description: a.how })
  }
  const off = useStore.subscribe((s, p) => {
    if (s.sessions === p.sessions && s.focusLog === p.focusLog && s.credits === p.credits && s.learn === p.learn) return
    clearTimeout(timer)
    timer = window.setTimeout(check, 600)
  })
  timer = window.setTimeout(check, 2500)
  return () => { off(); clearTimeout(timer) }
}
