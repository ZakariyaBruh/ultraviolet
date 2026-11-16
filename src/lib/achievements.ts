import { dayTotal, streak, sum } from './stats'
import { runOf } from './run'
import { useFx } from './fx'
import { isSupporter } from './supporter'
import { useStore, type AppState } from './store'

/**
 * Achievements: recognition for what the numbers already show, nothing more. Each one is worked out from saved data (finished sessions,
 * the hourly log, credits, lessons) by a pure function, never estimated, and no credits are paid for them: credits are earned only by
 * real work, and a badge that paid would be something to grind. Once earned it stays earned (`store.achievements`, id -> when), so
 * trimming old sessions never takes one away. Nothing here leaves the browser.
 */
export type AchGroup = 'Focus' | 'Habit' | 'Learn' | 'Credits' | 'Board'
export type Src = Pick<AppState, 'sessions' | 'focusLog' | 'credits' | 'learn' | 'settings'>

export interface Facts {
  finished: number
  clean: number
  longest: number
  minutes: number
  streak: number
  bestRun: number
  frozen: number
  goalDays: number
  early: number
  late: number
  lessons: number
  perfect: number
  earned: number
  spent: number
  games: number
  /** a day of focus after eight or more days with none */
  comeback: number
  brick: number
  breaks: number
  trips: number
}

/** 1 if there was ever a day of focus after a gap of eight or more days with none */
function comeback(log: Src['focusLog']): number {
  const days = Object.keys(log).filter((k) => dayTotal(log, k) > 0).sort()
  for (let i = 1; i < days.length; i++) if ((Date.parse(days[i]) - Date.parse(days[i - 1])) / 864e5 >= 9) return 1
  return 0
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
    bestRun: runOf(s.focusLog, 10, today).best,
    frozen: (s.credits.items?.frozen ?? []).length,
    goalDays: goal > 0 ? Object.keys(s.focusLog).filter((k) => dayTotal(s.focusLog, k) >= goal).length : 0,
    early: done.filter((x) => hour(x.start) >= 4 && hour(x.start) < 7).length,
    late: done.filter((x) => hour(x.start) >= 22).length,
    lessons: lessons.length,
    perfect: lessons.filter((l) => l.total > 0 && l.score === l.total).length,
    earned: s.credits.earned,
    spent: s.credits.spent,
    games: Object.values(s.credits.best).filter((n) => n > 0).length,
    comeback: comeback(s.focusLog),
    brick: s.credits.items?.owned?.includes('brick') ? 1 : 0,
    breaks: s.sessions.filter((x) => (x.breaks ?? 0) > 0).length,
    trips: s.sessions.filter((x) => (x.trips ?? 0) > 0).length,
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
  /** earned by something that happens (a fast lesson, a rank) rather than counted from saved numbers: no progress bar */
  event?: boolean
  value: (f: Facts) => number
}

const A = (id: string, group: AchGroup, name: string, how: string, goal: number, unit: string, value: (f: Facts) => number): Achievement => ({ id, group, name, how, goal, unit, value })
/** earned when something happens, by `award(id)` from the place it happens */
const E = (id: string, group: AchGroup, name: string, how: string): Achievement => ({ id, group, name, how, goal: 1, unit: '', event: true, value: () => 0 })

export const ACHIEVEMENTS: Achievement[] = [
  A('first-lock', 'Focus', "Fine, I'll try it", 'Finish a session.', 1, 'session', (f) => f.finished),
  A('ten-sessions', 'Focus', 'Repeat offender', 'Finish ten sessions.', 10, 'sessions', (f) => f.finished),
  A('fifty-sessions', 'Focus', 'Fifty? Really?', 'Finish fifty sessions.', 50, 'sessions', (f) => f.finished),
  A('hundred-sessions', 'Focus', 'Touch grass', 'Finish a hundred sessions.', 100, 'sessions', (f) => f.finished),
  A('clean-sheet', 'Focus', 'Not one peek', 'Finish a session without leaving once.', 1, 'clean session', (f) => f.clean),
  A('ten-clean', 'Focus', 'Monk mode', 'Finish ten sessions without leaving.', 10, 'clean sessions', (f) => f.clean),
  A('an-hour', 'Focus', 'Say whaaa?', 'Finish a session set for an hour.', 60, 'minutes', (f) => f.longest),
  A('ninety', 'Focus', 'Different breed', 'Finish a session set for ninety minutes.', 90, 'minutes', (f) => f.longest),
  A('ten-hours', 'Focus', 'Ten hours deep', 'Hold ten hours of focus, all told.', 600, 'minutes', (f) => f.minutes),
  A('fifty-hours', 'Focus', 'Basically a job', 'Hold fifty hours of focus.', 3000, 'minutes', (f) => f.minutes),
  A('hundred-hours', 'Focus', 'This is your personality now', 'Hold a hundred hours of focus.', 6000, 'minutes', (f) => f.minutes),
  A('took-break', 'Focus', 'Five-minute hero', 'Take a Break in the middle of a session.', 1, 'session', (f) => f.breaks),
  A('stepped-out', 'Focus', 'Off to do real work', 'Step out to work elsewhere, and say so first.', 1, 'session', (f) => f.trips),
  A('brick', 'Focus', 'Why, though?', 'Buy the Golden Brick. It does nothing.', 1, 'brick', (f) => f.brick),
  A('streak-3', 'Habit', 'Okay, a pattern', 'Ten minutes or more on three days in a row.', 3, 'days', (f) => f.bestRun),
  A('streak-7', 'Habit', 'A week, no excuses', 'Ten minutes or more on seven days in a row.', 7, 'days', (f) => f.bestRun),
  A('streak-30', 'Habit', 'Thirty days. Who are you?', 'Ten minutes or more on thirty days in a row.', 30, 'days', (f) => f.bestRun),
  A('streak-14', 'Habit', 'Two weeks. Suspicious.', 'Ten minutes or more, fourteen days running.', 14, 'days', (f) => f.bestRun),
  A('streak-60', 'Habit', 'Sixty days, no one asked', 'Sixty days running. One rest day a week is allowed.', 60, 'days', (f) => f.bestRun),
  A('streak-100', 'Habit', 'Triple digits', 'A hundred days running.', 100, 'days', (f) => f.bestRun),
  A('streak-365', 'Habit', 'A whole orbit', 'A year of days. Yes, really.', 365, 'days', (f) => f.bestRun),
  A('froze', 'Habit', 'Saved by the freeze', 'Let a Streak freeze cover a missed day.', 1, 'freeze', (f) => f.frozen),
  A('goal-day', 'Habit', 'Overachiever, once', 'Hit your daily goal.', 1, 'day', (f) => f.goalDays),
  A('goal-week', 'Habit', 'Overachiever, seven times', 'Hit your daily goal on seven days.', 7, 'days', (f) => f.goalDays),
  A('early-bird', 'Habit', 'Up before the pigeons', 'Finish a session that began before 7 am.', 1, 'session', (f) => f.early),
  A('night-owl', 'Habit', 'Sleep is for later', 'Finish a session that began after 10 pm.', 1, 'session', (f) => f.late),
  A('comeback', 'Habit', "Look who's back", 'Focus again after eight or more days away.', 1, 'comeback', (f) => f.comeback),
  A('first-lesson', 'Learn', "Teacher's pet", 'Finish a lesson.', 1, 'lesson', (f) => f.lessons),
  A('ten-lessons', 'Learn', 'Citation needed', 'Finish ten different lessons.', 10, 'lessons', (f) => f.lessons),
  A('perfect-lesson', 'Learn', '100%, obviously', 'Get every question in a lesson right.', 1, 'lesson', (f) => f.perfect),
  E('iq', 'Learn', 'An IQ too high?', 'Finish a lesson in under a minute with every answer right.'),
  E('trivia-perfect', 'Learn', 'Pub quiz menace', 'Get every question right in a trivia round.'),
  A('hundred-credits', 'Credits', 'Pocket change', 'Earn a hundred credits.', 100, 'credits', (f) => f.earned),
  A('thousand-credits', 'Credits', 'Rich-ish', 'Earn a thousand credits.', 1000, 'credits', (f) => f.earned),
  A('first-spend', 'Credits', 'Retail therapy', 'Spend credits, in the shop or on a round.', 1, 'credit spent', (f) => f.spent),
  A('five-games', 'Credits', "Can't pick a favourite", 'Score in five different arcade games.', 5, 'games', (f) => f.games),
  E('onboard', 'Board', 'On the board', 'Get a name on the leaderboard.'),
  E('top-10', 'Board', 'Top ten, somehow', 'Reach the top ten.'),
  E('top-3', 'Board', 'On the podium', 'Reach the top three.'),
  E('first', 'Board', 'Number one. Insufferable.', 'Reach number one.'),
  E('climber', 'Board', 'Elbows out', 'Climb three places or more between visits to the board.'),
  E('room', 'Board', 'Study group', 'Start or join a Together room.'),
  E('supporter', 'Board', 'Keeping the lights on', 'Support Friction. A badge and nothing else: it unlocks no feature.'),
]

export const progressOf = (a: Achievement, f: Facts) => Math.min(1, Math.max(0, a.value(f) / a.goal))
export const metBy = (a: Achievement, f: Facts) => a.value(f) >= a.goal

/** record one that is earned by something happening (a fast lesson, a rank, a room) and say so; does nothing if it is already earned */
export function award(id: string) {
  const s = useStore.getState()
  const a = ACHIEVEMENTS.find((x) => x.id === id)
  if (!a || s.achievements[id]) return
  useStore.setState({ achievements: { ...s.achievements, [id]: Date.now() } })
  useFx.getState().say({ title: `Unlocked: ${a.name}`, description: a.how })
}

/** where you stand on the board: the ranks, and a climb of three places or more since the last visit */
export function noteRank(rank: number) {
  if (!(rank >= 1)) return
  award('onboard')
  if (rank <= 10) award('top-10')
  if (rank <= 3) award('top-3')
  if (rank === 1) award('first')
  try {
    const prev = Number(localStorage.getItem('friction:rank'))
    if (prev >= 1 && prev - rank >= 3) award('climber')
    localStorage.setItem('friction:rank', String(rank))
  } catch { /* storage blocked */ }
}

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
    // someone who already supports gets it the first time this runs, and a new supporter gets it when they join
    if (isSupporter()) award('supporter')
    const s = useStore.getState()
    const got = newlyMet(s.achievements, s)
    if (!got.length) return
    const t = Date.now()
    useStore.setState({ achievements: { ...s.achievements, ...Object.fromEntries(got.map((a) => [a.id, t])) } })
    const say = useFx.getState().say
    if (got.length > 2) say({ title: `${got.length} achievements unlocked`, description: 'Earned from your history. They are in Insights.' })
    else for (const a of got) say({ title: `Unlocked: ${a.name}`, description: a.how })
  }
  const off = useStore.subscribe((s, p) => {
    if (s.sessions === p.sessions && s.focusLog === p.focusLog && s.credits === p.credits && s.learn === p.learn) return
    clearTimeout(timer)
    timer = window.setTimeout(check, 600)
  })
  timer = window.setTimeout(check, 2500)
  return () => { off(); clearTimeout(timer) }
}
