import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Listings } from '@/components/app/Listings'
import { PageHeader, Panel, Seg } from '@/components/app/shared'
import { ActivityFeed, type ActivityEvent } from '@/components/ui/activity-feed'
import { ActivityHeatmap } from '@/components/ui/activity-heatmap'
import { AdvancedDataTable } from '@/components/ui/advanced-data-table'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { BarChart } from '@/components/ui/bar-chart'
import { DatePicker } from '@/components/ui/date-picker'
import { DonutChart } from '@/components/ui/donut-chart'
import { FunnelChart } from '@/components/ui/funnel-chart'
import { InteractiveAreaChart } from '@/components/ui/interactive-area-chart'
import { InteractiveTimeline } from '@/components/ui/interactive-timeline'
import { LiveLineChart } from '@/components/ui/live-line-chart'
import { MetricHUD } from '@/components/ui/metric-hud'
import { SlidePagination } from '@/components/ui/slide-pagination'
import { SmartComparison } from '@/components/ui/smart-comparison'
import { dateKey, daysAgo, fmtMinutes, parseKey } from '@/lib/dates'
import { useMedia } from '@/lib/hooks'
import { getPulse } from '@/lib/pulse'
import { useStore } from '@/lib/store'
import { attentionScore, blockedPerHour, calendarData, dayTotal, hoursMatrix, lastDays, lastWeeks, scoreParts, sum, totals, weekdayShort } from '@/lib/stats'

const SIGNAL = '#6ee7ff'
const VIOLET = '#a78bfa'
const PINK = '#f0abfc'

function ScoreRing({ score }: { score: number }) {
  const R = 44
  const C = 2 * Math.PI * R
  return (
    <div className="relative aspect-square w-[140px] shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        <motion.circle cx="50" cy="50" r={R} fill="none" stroke={SIGNAL} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - score / 100) }} transition={{ type: 'spring', stiffness: 50, damping: 18, delay: 0.1 }} style={{ filter: 'drop-shadow(0 0 3px rgba(110,231,255,0.8))' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="fig text-[34px] leading-9"><AnimatedNumber value={score} /></div>
          <div className="hud">of 100</div>
        </div>
      </div>
    </div>
  )
}

function Part({ value, label, note, weight }: { value: number; label: string; note: string; weight: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="fig text-[13px] text-ink-2">{Math.round(value * weight)} of {weight}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-white/10">
        <motion.div className="h-full rounded-full bg-signal shadow-[0_0_10px_rgba(110,231,255,0.6)]" initial={{ width: 0 }} animate={{ width: `${value * 100}%` }} transition={{ type: 'spring', stiffness: 90, damping: 20, delay: 0.15 }} />
      </div>
      <div className="mt-1 text-[13px] text-ink-2">{note}</div>
    </div>
  )
}

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'patterns', label: 'Patterns' },
  { id: 'trends', label: 'Trends' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'log', label: 'Log' },
]

export function InsightsView() {
  const s = useStore()
  const wide = useMedia('(min-width: 1024px)')
  const [tab, setTab] = useState('today')
  const [half, setHalf] = useState('day')
  const [offset, setOffset] = useState(0)
  const [slide, setSlide] = useState(1)
  const [sessView, setSessView] = useState('table')
  const day = dateKey(daysAgo(offset))

  const score = useMemo(() => attentionScore(s), [s.focusLog, s.urgeLog, s.settings]) // eslint-disable-line react-hooks/exhaustive-deps
  const parts = useMemo(() => scoreParts(s), [s.focusLog, s.urgeLog, s.settings]) // eslint-disable-line react-hooks/exhaustive-deps
  const tot = totals(s)
  const held = dayTotal(s.focusLog, day)
  const blocked = Math.round(dayTotal(s.urgeLog, day))
  const wkNow = blockedPerHour(lastWeeks(s.focusLog, 0, 7), lastWeeks(s.urgeLog, 0, 7))
  const wkPrev = blockedPerHour(lastWeeks(s.focusLog, 7, 7), lastWeeks(s.urgeLog, 7, 7))
  const days14 = useMemo(() => lastDays(14), [])
  const matrix = useMemo(() => hoursMatrix(s.focusLog), [s.focusLog])
  const cal = useMemo(() => calendarData(s.urgeLog), [s.urgeLog])
  const sessions = s.sessions

  const finding = wkNow !== null && wkPrev !== null ? `${wkNow} scrolls blocked per focused hour this week, against ${wkPrev} the week before.` : wkNow !== null ? `${wkNow} scrolls blocked per focused hour this week. Last week had too little focus to compare.` : 'Ten focused minutes in a day is enough to start comparing weeks.'

  const metrics = useMemo(() => {
    const d30 = lastDays(30)
    const d7 = d30.slice(-7)
    const f = (days: string[]) => days.map((d) => Math.round(dayTotal(s.focusLog, d)))
    const u = (days: string[]) => days.map((d) => Math.round(dayTotal(s.urgeLog, d)))
    const held7 = lastWeeks(s.focusLog, 0, 7)
    const held7p = lastWeeks(s.focusLog, 7, 7)
    const pct = held7p ? Math.round(((held7 - held7p) / held7p) * 100) : 0
    return [
      { id: 'held', label: 'Held', value: String(Math.round(held)), unit: 'min', delta: { value: `${pct >= 0 ? '+' : ''}${pct}% week`, trend: (pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral', isPositiveGood: true }, timeSeries: { '7d': f(d7), '30d': f(d30) } },
      { id: 'blocked', label: 'Blocked', value: String(blocked), delta: { value: wkPrev !== null && wkNow !== null ? `${wkNow}/h` : 'per hour: –', trend: 'neutral' as const }, timeSeries: { '7d': u(d7), '30d': u(d30) } },
    ]
  }, [s.focusLog, s.urgeLog, held, blocked, wkNow, wkPrev])

  const bars14 = days14.map((d) => ({ label: weekdayShort(d).slice(0, 2), held: Math.round(dayTotal(s.focusLog, d)) }))
  const rate14 = days14.map((d) => ({ label: weekdayShort(d).slice(0, 2), rate: blockedPerHour(dayTotal(s.focusLog, d), dayTotal(s.urgeLog, d)) ?? 0 }))
  const weekdayAvg = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({ label, avg: Math.round(sum(matrix[i]) / 10) }))
  const area = useMemo(() => {
    const mk = (n: number) => lastDays(n).map((d) => ({ date: parseKey(d).getTime(), value: Math.round(dayTotal(s.focusLog, d)) }))
    return { '7D': mk(7), '30D': mk(30), '90D': mk(90) }
  }, [s.focusLog])
  const split = [{ label: 'Radio', value: Math.round(s.sourceSecs.radio / 60), color: SIGNAL }, { label: 'TV', value: Math.round(s.sourceSecs.tv / 60), color: VIOLET }, { label: 'Silent', value: Math.round(s.sourceSecs.silent / 60), color: PINK }]
  const funnel = [
    { label: 'Started', value: sessions.length },
    { label: 'Held 10 min', value: sessions.filter((x) => x.focusSec >= 600).length },
    { label: 'Held 25 min', value: sessions.filter((x) => x.focusSec >= 1500).length },
    { label: 'Completed', value: sessions.filter((x) => x.completed).length },
  ]
  const tw = lastWeeks(s.focusLog, 0, 7)
  const lw = lastWeeks(s.focusLog, 7, 7)
  const twU = lastWeeks(s.urgeLog, 0, 7)
  const lwU = lastWeeks(s.urgeLog, 7, 7)
  const events: ActivityEvent[] = s.events.slice(0, 40).map((e) => ({
    id: e.id,
    type: e.kind === 'blocked' ? 'security' : e.kind === 'wander' ? 'error' : e.kind === 'session' ? 'deploy' : e.kind === 'tune' ? 'api' : 'system',
    status: e.kind === 'blocked' ? 'warning' : e.kind === 'wander' ? 'error' : e.kind === 'session' ? 'success' : 'info',
    title: e.text,
    timestamp: new Date(e.t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  }))

  const trendSlides = [
    <div key="t0" className="grid h-full min-h-0 content-start"><MetricHUD metrics={metrics} timeRanges={['7d', '30d']} defaultTimeRange="7d" /></div>,
    <div key="t1" className="grid h-full min-h-0 content-start gap-4 lg:grid-cols-2">
      <Panel className="min-w-0 p-5"><h2 className="text-base font-semibold">Minutes held per day</h2><p className="mb-2 text-[13px] text-ink-2">Last 14 days.</p><BarChart data={bars14} series={[{ key: 'held', label: 'Minutes held', color: SIGNAL }]} height={200} /></Panel>
      <Panel className="min-w-0 p-5"><h2 className="text-base font-semibold">Blocked per focused hour</h2><p className="mb-2 text-[13px] text-ink-2">Falling is the goal. Days under 10 minutes show no bar.</p><BarChart data={rate14} series={[{ key: 'rate', label: 'Blocked per hour', color: PINK }]} height={200} /></Panel>
      <Panel className="min-w-0 p-5 lg:col-span-2"><InteractiveAreaChart data={area} defaultRange="30D" title="Minutes held" height={150} /></Panel>
    </div>,
    <div key="t2" className="grid h-full min-h-0 content-start gap-4 lg:grid-cols-2">
      <Panel className="min-w-0 p-5"><h2 className="text-base font-semibold">What you held with</h2><p className="mb-2 text-[13px] text-ink-2">Minutes by source, all time.</p><DonutChart data={split} size={190} thickness={10} centerLabel="Minutes" /></Panel>
      <Panel className="min-w-0 p-5"><h2 className="text-base font-semibold">How sessions go</h2><p className="mb-2 text-[13px] text-ink-2">From starting to finishing.</p><FunnelChart stages={funnel} /></Panel>
    </div>,
    <div key="t3" className="grid h-full min-h-0 content-start gap-4 lg:grid-cols-2">
      <Panel className="min-w-0 p-5"><h2 className="text-base font-semibold">Your strongest weekdays</h2><p className="mb-2 text-[13px] text-ink-2">Average minutes held, last 10 weeks.</p><BarChart data={weekdayAvg} series={[{ key: 'avg', label: 'Average minutes', color: VIOLET }]} height={210} /></Panel>
      <Panel className="max-h-[360px] min-w-0 overflow-hidden p-3">
        <SmartComparison
          plans={[{ id: 'this', name: 'This week', tagline: 'Last 7 days', price: `${Math.round(tw)}`, billingPeriod: 'min', featured: true }, { id: 'last', name: 'Last week', tagline: 'Days 8–14', price: `${Math.round(lw)}`, billingPeriod: 'min' }]}
          categories={[{ id: 'h', title: 'Habit', features: [{ id: 'f1', name: 'Minutes held', values: { this: `${Math.round(tw)}`, last: `${Math.round(lw)}` } }, { id: 'f2', name: 'Scrolls blocked', values: { this: `${Math.round(twU)}`, last: `${Math.round(lwU)}` } }, { id: 'f3', name: 'Blocked per focused hour', values: { this: `${wkNow ?? '–'}`, last: `${wkPrev ?? '–'}` } }] }]}
        />
      </Panel>
    </div>,
  ]

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader kicker="Your attention, measured" title="Insights" sub={finding}>
        {s.demo && <span className="whitespace-nowrap rounded-full bg-amber-300/15 px-3 py-1.5 text-xs text-amber-200 ring-1 ring-amber-300/30">Demo history</span>}
        <Seg id="ins" value={tab} onChange={setTab} tabs={TABS} />
      </PageHeader>

      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} className="h-full" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}>
            {tab === 'today' && (
              <div className="grid h-full min-h-0 content-start grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                {!wide && <Seg id="half" value={half} onChange={setHalf} tabs={[{ id: 'day', label: 'The day' }, { id: 'score', label: 'Score' }]} />}
                <div className={`grid min-w-0 content-start gap-4 ${!wide && half !== 'day' ? 'hidden' : ''}`}>
                  <Panel className="min-w-0 overflow-hidden px-4 pb-3 pt-4 sm:px-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                      <h2 className="text-base font-semibold">{offset === 0 ? 'Today' : parseKey(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h2>
                      <div className="flex w-full min-w-0 items-center justify-between gap-1.5 sm:w-auto">
                        <button aria-label="Previous day" disabled={offset >= 89} onClick={() => setOffset((o) => o + 1)} className="grid size-10 place-items-center rounded-full bg-white/[0.06] text-ink ring-1 ring-white/12 hover:bg-white/12 disabled:opacity-40"><ChevronLeft className="size-4" /></button>
                        <DatePicker value={parseKey(day)} onChange={(d) => d && setOffset(Math.max(0, Math.round((+parseKey(dateKey()) - +parseKey(dateKey(d))) / 864e5)))} placeholder="Pick a day" align="end" />
                        <button aria-label="Next day" disabled={offset <= 0} onClick={() => setOffset((o) => o - 1)} className="grid size-10 place-items-center rounded-full bg-white/[0.06] text-ink ring-1 ring-white/12 hover:bg-white/12 disabled:opacity-40"><ChevronRight className="size-4" /></button>
                      </div>
                    </div>
                    <Listings day={day} />
                  </Panel>
                </div>
                <Panel className={`min-w-0 p-5 ${!wide && half !== 'score' ? 'hidden' : ''}`}>
                  <div className="flex items-center gap-4">
                    <ScoreRing score={score} />
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold">Attention score</h2>
                      <p className="mt-1 text-sm text-ink-2">Made from three parts you can see below.</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4">{parts.map((p) => <Part key={p.label} {...p} />)}</div>
                  {wide && (
                    <div className="mt-5 border-t border-white/10 pt-3">
                      <div className="mb-1 flex items-baseline justify-between text-sm"><span>Steadiness, last 45 s</span><span className="text-[13px] text-ink-2">Falls 9 per blocked scroll</span></div>
                      <LiveLineChart source={(push) => { const t = setInterval(() => push(getPulse()), 1000); return () => clearInterval(t) }} initial={[getPulse()]} windowSeconds={45} height={96} color={SIGNAL} domain={[0, 100]} formatValue={(n) => `${Math.round(n)}`} ariaLabel="Live steadiness" />
                    </div>
                  )}
                </Panel>
              </div>
            )}

            {tab === 'patterns' && (
              <div className="grid h-full min-h-0 content-start gap-4">
                <Panel className="min-w-0 p-5"><h2 className="text-base font-semibold">When you lock in</h2><p className="mb-2 text-[13px] text-ink-2">Minutes focused by weekday and hour, last 10 weeks.</p><ActivityHeatmap mode="hours" matrix={matrix} color={SIGNAL} unit="focused minutes" ariaLabel="Weekday by hour, focused minutes" /></Panel>
                <Panel className="min-w-0 p-5"><h2 className="text-base font-semibold">Scrolls blocked, by day</h2><p className="mb-2 text-[13px] text-ink-2">Brighter is more attempts. Fewer is better.</p><ActivityHeatmap mode="calendar" data={cal} weeks={53} weekStart={1} color={PINK} unit="blocked scrolls" ariaLabel="Daily blocked scrolls" /></Panel>
              </div>
            )}

            {tab === 'trends' && (
              <div className="flex h-full min-h-0 flex-col gap-3">
                <div className="min-h-0 flex-1 overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={slide} className="h-full" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}>{trendSlides[slide - 1]}</motion.div>
                  </AnimatePresence>
                </div>
                <div className="flex justify-center"><SlidePagination pageCount={trendSlides.length} page={slide} onChange={setSlide} /></div>
              </div>
            )}

            {tab === 'sessions' && (
              <div className="flex h-full min-h-0 flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-ink-2">{sessions.length} sessions · {Math.round(tot.lapses)} wanderings · {fmtMinutes(tot.focus)} held in total</span>
                  <Seg id="sv" value={sessView} onChange={setSessView} tabs={[{ id: 'table', label: 'Table' }, { id: 'timeline', label: 'Timeline' }]} />
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  {sessions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/20 py-10 text-center text-sm text-ink-2">No sessions yet. Lock in on the Focus screen and your first one lands here.</div>
                  ) : sessView === 'table' ? (
                    <Panel className="h-full overflow-hidden p-3">
                      <AdvancedDataTable
                        defaultPageSize={wide ? 6 : 4}
                        data={sessions.map((x) => ({ id: x.id, title: x.title, started: new Date(x.start).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), held: Math.round(x.focusSec / 60), goal: x.goalMin, blocked: x.urges, result: x.completed ? 'Completed' : 'Ended early' }))}
                        columns={[
                          { id: 'title', header: 'Session', accessorKey: 'title', sortable: true, priority: 'high' },
                          { id: 'started', header: 'Started', accessorKey: 'started', priority: 'low' },
                          { id: 'held', header: 'Held (min)', accessorKey: 'held', sortable: true, align: 'right', priority: 'high' },
                          { id: 'blocked', header: 'Blocked', accessorKey: 'blocked', sortable: true, align: 'right', priority: 'medium' },
                          { id: 'result', header: 'Result', accessorKey: 'result', filterable: true, filterOptions: [{ label: 'Completed', value: 'Completed' }, { label: 'Ended early', value: 'Ended early' }], priority: 'medium' },
                        ]}
                      />
                    </Panel>
                  ) : (
                    <Panel className="h-full overflow-hidden p-4">
                      <InteractiveTimeline items={sessions.slice(0, 5).map((x) => ({ id: x.id, title: x.title, timestamp: new Date(x.start).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }), status: x.completed ? 'completed' : 'failed', description: `${Math.round(x.focusSec / 60)} of ${x.goalMin} min held`, metrics: [{ label: 'Held', value: `${Math.round(x.focusSec / 60)}m` }, { label: 'Blocked', value: String(x.urges) }] }))} />
                    </Panel>
                  )}
                </div>
              </div>
            )}

            {tab === 'log' && (
              <Panel className="h-full overflow-hidden p-3">
                {events.length === 0 ? <div className="grid h-full place-items-center text-sm text-ink-2">Events appear here as you use the app.</div> : <ActivityFeed events={events} enableFilters enableSearch={false} maxEntries={wide ? 8 : 5} />}
              </Panel>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
