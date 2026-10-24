import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useMedia } from '@/lib/hooks'
import { Listings } from '@/components/app/Listings'
import { PageHeader, Panel, Seg, Strip } from '@/components/app/shared'
import { ActivityHeatmap } from '@/components/ui/activity-heatmap'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Badge } from '@/components/ui/badge'
import { BarChart } from '@/components/ui/bar-chart'
import { DonutChart } from '@/components/ui/donut-chart'
import { LiveLineChart } from '@/components/ui/live-line-chart'
import { dateKey, daysAgo, fmtMinutes, parseKey } from '@/lib/dates'
import { getPulse } from '@/lib/pulse'
import { useStore } from '@/lib/store'
import { attentionScore, bestStreak, blockedPerHour, calendarData, dayTotal, hoursMatrix, lastDays, lastWeeks, scoreParts, streak, sum, totals, weekdayShort } from '@/lib/stats'
import { cn } from '@/lib/utils'

const SIGNAL = '#1d5fbf'
const INK = '#141414'
const GREY = '#9aa1ad'

function ScoreRing({ score }: { score: number }) {
  const R = 44
  const C = 2 * Math.PI * R
  return (
    <div className="relative aspect-square w-[148px] shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--rule)" strokeWidth="3.5" />
        <motion.circle
          cx="50" cy="50" r={R} fill="none" stroke={SIGNAL} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - score / 100) }}
          transition={{ type: 'spring', stiffness: 50, damping: 18, delay: 0.1 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="fig text-[34px] leading-9">
            <AnimatedNumber value={score} />
          </div>
          <div className="text-[13px] text-ink-2">of 100</div>
        </div>
      </div>
    </div>
  )
}

function Bar({ value, label, note, weight }: { value: number; label: string; note: string; weight: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="fig text-[13px] text-ink-2">{Math.round(value * weight)} of {weight} pts</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-raised">
        <motion.div className="h-full rounded-full bg-signal" initial={{ width: 0 }} animate={{ width: `${value * 100}%` }} transition={{ type: 'spring', stiffness: 90, damping: 20, delay: 0.15 }} />
      </div>
      <div className="mt-1 text-[13px] text-ink-2">{note}</div>
    </div>
  )
}

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'score', label: 'Score' },
  { id: 'patterns', label: 'Patterns' },
  { id: 'trends', label: 'Trends' },
  { id: 'sessions', label: 'Sessions' },
]

export function InsightsView() {
  const s = useStore()
  const [tab, setTab] = useState('today')
  const wide = useMedia('(min-width: 1024px)')
  const tabs = wide ? TABS.filter((t) => t.id !== 'score') : TABS
  const view = !wide || tab !== 'score' ? tab : 'score'
  const [offset, setOffset] = useState(0)
  const day = dateKey(daysAgo(offset))

  const score = useMemo(() => attentionScore(s), [s.focusLog, s.urgeLog, s.settings])
  const parts = useMemo(() => scoreParts(s), [s.focusLog, s.urgeLog, s.settings])
  const tot = totals(s)
  const held = dayTotal(s.focusLog, day)
  const blocked = Math.round(dayTotal(s.urgeLog, day))
  const perHour = blockedPerHour(held, blocked)
  const thisWeekF = lastWeeks(s.focusLog, 0, 7)
  const thisWeekU = lastWeeks(s.urgeLog, 0, 7)
  const lastWeekF = lastWeeks(s.focusLog, 7, 7)
  const lastWeekU = lastWeeks(s.urgeLog, 7, 7)
  const wkNow = blockedPerHour(thisWeekF, thisWeekU)
  const wkPrev = blockedPerHour(lastWeekF, lastWeekU)
  const days14 = useMemo(() => lastDays(14), [])
  const matrix = useMemo(() => hoursMatrix(s.focusLog), [s.focusLog])
  const cal = useMemo(() => calendarData(s.urgeLog), [s.urgeLog])
  const sessions = s.sessions
  const empty = tot.focus < 1

  const finding =
    wkNow !== null && wkPrev !== null
      ? `${wkNow} scrolls blocked per focused hour this week, against ${wkPrev} the week before.`
      : wkNow !== null
        ? `${wkNow} scrolls blocked per focused hour this week. Last week had too little focus to compare.`
        : 'Not enough focused time yet to compare weeks. Ten minutes in a day is enough to start.'

  const weekdayAvg = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({ label, avg: Math.round(sum(matrix[i]) / 10) }))
  const bars14 = days14.map((d) => ({ label: weekdayShort(d).slice(0, 2), held: Math.round(dayTotal(s.focusLog, d)) }))
  const rate14 = days14.map((d) => ({ label: weekdayShort(d).slice(0, 2), rate: blockedPerHour(dayTotal(s.focusLog, d), dayTotal(s.urgeLog, d)) ?? 0 }))
  const split = [
    { label: 'Radio', value: Math.round(s.sourceSecs.radio / 60), color: SIGNAL },
    { label: 'TV', value: Math.round(s.sourceSecs.tv / 60), color: INK },
    { label: 'Silent', value: Math.round(s.sourceSecs.silent / 60), color: GREY },
  ]

  const steadinessInner = (
    <>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span>Steadiness, last 45 s</span>
        <span className="text-[13px] text-ink-2">Falls 9 per blocked scroll</span>
      </div>
      <LiveLineChart source={(push) => { const t = setInterval(() => push(getPulse()), 1000); return () => clearInterval(t) }} initial={[getPulse()]} windowSeconds={45} height={wide ? 120 : 130} color={SIGNAL} domain={[0, 100]} formatValue={(n) => `${Math.round(n)}`} ariaLabel="Live steadiness" />
    </>
  )
  const steadiness = <Panel className="min-w-0 p-5">{steadinessInner}</Panel>

  const daySessions = sessions.filter((x) => dateKey(new Date(x.start)) === day)
  const todaySessions = (
    <Panel className="min-w-0 p-5">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Sessions</h2>
        <span className="fig text-[13px] text-ink-2">{daySessions.length}</span>
      </div>
      {daySessions.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--control)] py-4 text-center text-sm text-ink-2">No sessions this day.</div>
      ) : (
        <ul>
          {daySessions.slice(0, 3).map((x) => (
            <li key={x.id} className="flex h-11 items-center justify-between gap-3 border-b border-[var(--rule)] text-sm last:border-b-0">
              <span className="min-w-0 truncate text-ink">{x.title}</span>
              <span className="fig shrink-0 text-ink-2">{fmtMinutes(x.focusSec / 60)} · {x.urges} blocked</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )

  const scorePanel = (
    <Panel className="min-w-0 p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <ScoreRing score={score} />
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Attention score</h2>
          <p className="mt-1 text-sm text-ink-2">Out of 100, made from the three parts below.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4">
        {parts.map((p) => (
          <Bar key={p.label} {...p} />
        ))}
      </div>
    </Panel>
  )

  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader title="Insights" sub={finding}>
        {s.demo && <span className="whitespace-nowrap rounded-full bg-[#fffbeb] px-2.5 py-1 text-[13px] text-[#92400e] ring-1 ring-[#fde68a]">Demo history</span>}
        <Seg id="ins" value={view} onChange={setTab} tabs={tabs} />
      </PageHeader>

      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            className="h-full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          >
            {view === 'today' && (
              <div className="grid h-full min-h-0 content-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
                <div className="grid min-w-0 content-start gap-4">
                  <Panel className="p-4 sm:p-5">
                    <Strip
                      cells={[
                        { label: offset === 0 ? 'Held today' : 'Held', value: <AnimatedNumber value={Math.round(held)} />, unit: 'min', note: `of ${s.settings.dailyGoalMin} min goal` },
                        { label: 'Blocked', value: <AnimatedNumber value={blocked} />, note: 'scroll attempts' },
                        { label: 'Per focused hour', value: perHour === null ? '–' : <AnimatedNumber value={perHour} decimals={1} />, note: perHour === null ? 'under 10 min held' : wkPrev !== null ? `week before: ${wkPrev}` : 'lower is better' },
                        { label: 'Streak', value: <AnimatedNumber value={streak(s.focusLog)} />, unit: 'd', note: `best ${bestStreak(s.focusLog)} d` },
                      ]}
                    />
                  </Panel>
                  <Panel className="px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="text-base font-semibold">{offset === 0 ? 'Today' : parseKey(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h2>
                      <div className="flex items-center gap-1">
                        <button aria-label="Previous day" disabled={offset >= 13} onClick={() => setOffset((o) => o + 1)} className="grid size-11 place-items-center rounded-md border border-[var(--control)] text-ink hover:bg-raised disabled:opacity-40 md:size-9"><ChevronLeft className="size-4" /></button>
                        <button aria-label="Next day" disabled={offset <= 0} onClick={() => setOffset((o) => o - 1)} className="grid size-11 place-items-center rounded-md border border-[var(--control)] text-ink hover:bg-raised disabled:opacity-40 md:size-9"><ChevronRight className="size-4" /></button>
                      </div>
                    </div>
                    <Listings day={day} />
                  </Panel>
                  {wide && todaySessions}
                </div>
                {wide && <div className="grid min-w-0 content-start gap-4">{scorePanel}{steadiness}</div>}
              </div>
            )}

            {view === 'score' && <div className="grid h-full min-h-0 content-start gap-4">{scorePanel}</div>}

            {view === 'patterns' && (
              <div className="grid h-full min-h-0 content-start gap-4">
                <Panel className="min-w-0 p-5">
                  <h2 className="text-base font-semibold">When you lock in</h2>
                  <p className="mb-2 text-sm text-ink-2">Minutes focused by weekday and hour, last 10 weeks.</p>
                  <ActivityHeatmap mode="hours" matrix={matrix} color={SIGNAL} unit="focused minutes" ariaLabel="Weekday by hour, focused minutes" />
                </Panel>
                <Panel className="min-w-0 p-5">
                  <h2 className="text-base font-semibold">Scrolls blocked, by day</h2>
                  <p className="mb-2 text-sm text-ink-2">Darker is more attempts. Fewer is better.</p>
                  <ActivityHeatmap mode="calendar" data={cal} weeks={53} weekStart={1} color={INK} unit="blocked scrolls" ariaLabel="Daily blocked scrolls" />
                </Panel>
              </div>
            )}

            {view === 'trends' && (
              <div className="grid h-full min-h-0 content-start gap-4 lg:grid-cols-2">
                <Panel className="min-w-0 p-5">
                  <h2 className="text-base font-semibold">Minutes held per day</h2>
                  <p className="mb-2 text-sm text-ink-2">Last 14 days.</p>
                  <BarChart data={bars14} series={[{ key: 'held', label: 'Minutes held', color: SIGNAL }]} height={190} />
                </Panel>
                <Panel className="min-w-0 p-5">
                  <h2 className="text-base font-semibold">Blocked per focused hour</h2>
                  <p className="mb-2 text-sm text-ink-2">Last 14 days. Falling is the goal. Days under 10 minutes show no bar.</p>
                  <BarChart data={rate14} series={[{ key: 'rate', label: 'Blocked per hour', color: INK }]} height={190} />
                </Panel>
                <Panel className="min-w-0 p-5">
                  <h2 className="text-base font-semibold">What you held with</h2>
                  <p className="mb-2 text-sm text-ink-2">Minutes by source, all time.</p>
                  <DonutChart data={split} size={170} thickness={8} centerLabel="Minutes" />
                </Panel>
                <Panel className="min-w-0 p-5">
                  <h2 className="text-base font-semibold">Your strongest weekdays</h2>
                  <p className="mb-2 text-sm text-ink-2">Average minutes held, last 10 weeks.</p>
                  <BarChart data={weekdayAvg} series={[{ key: 'avg', label: 'Average minutes', color: SIGNAL }]} height={190} />
                </Panel>
              </div>
            )}

            {view === 'sessions' && (
              <Panel className="min-h-0 overflow-hidden p-0">
                <div className="flex items-baseline justify-between px-5 pb-2 pt-5">
                  <h2 className="text-base font-semibold">Sessions</h2>
                  <span className="text-[13px] text-ink-2">{sessions.length} total, latest 8 shown · {Math.round(tot.lapses)} wanderings</span>
                </div>
                {sessions.length === 0 ? (
                  <div className="mx-5 mb-5 rounded-md border border-dashed border-[var(--control)] py-8 text-center text-sm text-ink-2">
                    {empty ? 'No sessions yet. Lock in on the Focus screen and your first one lands here.' : 'No sessions yet.'}
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-[13px] text-ink-2">
                      <tr className="border-y border-[var(--border)]">
                        <th className="h-9 pl-5 text-left font-normal">Session</th>
                        <th className="hidden h-9 text-left font-normal sm:table-cell">Started</th>
                        <th className="h-9 text-right font-normal">Held / goal</th>
                        <th className="h-9 text-right font-normal">Blocked</th>
                        <th className="h-9 pr-5 text-right font-normal">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.slice(0, 8).map((x, i) => (
                        <motion.tr key={x.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03, duration: 0.2 }} className="border-b border-[var(--rule)] last:border-0">
                          <td className="h-12 max-w-[200px] truncate pl-5 text-ink">{x.title}</td>
                          <td className="fig hidden text-ink-2 sm:table-cell">{new Date(x.start).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="fig text-right text-ink">{fmtMinutes(x.focusSec / 60)} <span className="text-ink-3">/ {x.goalMin}m</span></td>
                          <td className={cn('fig text-right', x.urges === 0 ? 'text-ink-3' : 'text-ink')}>{x.urges}</td>
                          <td className="pr-5 text-right">
                            <Badge variant="soft" tone={x.completed ? 'success' : 'neutral'}>{x.completed ? 'Completed' : 'Ended early'}</Badge>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
