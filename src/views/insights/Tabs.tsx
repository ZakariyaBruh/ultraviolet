import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Listings } from '@/components/app/Listings'
import { Panel } from '@/components/app/shared'
import { ActivityHeatmap } from '@/components/ui/activity-heatmap'
import { BarChart } from '@/components/ui/bar-chart'
import { DatePicker } from '@/components/ui/date-picker'
import { DonutChart } from '@/components/ui/donut-chart'
import { FunnelChart } from '@/components/ui/funnel-chart'
import { dateKey, daysAgo, fmtClock, fmtMinutes, pad, parseKey } from '@/lib/dates'
import { byHour, funnelOf, hoursGrid, partsOfDay, scoreView, spanOf, weekdayAverages } from '@/lib/insights'
import { blockedPerHour, calendarData, dayTotal, lastDays, sum, weekdayShort } from '@/lib/stats'
import { useStore } from '@/lib/store'
import { useColours } from '@/lib/useColours'
import { MinutesArea, WeekCompare } from './charts'

const h2 = 'text-base font-semibold'
const note = 'mb-2 text-[13px] text-ink-2'

/* ───────────── Today ───────────── */

function ScoreRing({ score }: { score: number }) {
  return (
    <div className="w-[132px] shrink-0" role="img" aria-label={`Attention score ${score} out of 100`}>
      <div className="dot text-[44px] font-light leading-none text-ink">{score}<span className="ml-1 text-base text-ink-3">/100</span></div>
      <div className="relative mt-3 h-3" aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-px bg-ink/30" />
        {Array.from({ length: 11 }, (_, i) => <i key={i} className="absolute top-1/2 h-1.5 w-px -translate-y-1/2 bg-ink/40" style={{ left: `${i * 10}%` }} />)}
        <div className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-ice" style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

/** what is happening in the running session, from the session itself: nothing is estimated */
function RightNow() {
  const session = useStore((s) => s.session)
  return (
    <Panel className="min-w-0 p-5">
      <h2 className={h2}>Right now</h2>
      {!session ? (
        <p className="mt-2 text-[14px] text-ink-2">No session is running. Lock in on the Focus screen and this follows it.</p>
      ) : (
        <>
          <p className="mb-3 mt-1 text-[13px] text-ink-2">{session.title}{session.paused ? ' (on a break)' : ''}</p>
          <dl className="grid grid-cols-3 gap-3">
            {[
              ['Held', `${fmtClock(session.elapsedSec)} of ${session.goalMin}:00`],
              ['Clean for', fmtClock(session.cleanSec ?? 0)],
              ['Drifts', String(session.lapses)],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0 border border-[var(--rule)] p-3"><dt className="hud">{k}</dt><dd className="fig mt-1 truncate text-lg font-semibold text-ink">{v}</dd></div>
            ))}
          </dl>
          <p className="mt-2 text-[13px] text-ink-3">Clean for is the time since your last drift, or since you started.</p>
        </>
      )}
    </Panel>
  )
}

export function TodayTab() {
  const focusLog = useStore((s) => s.focusLog)
  const urgeLog = useStore((s) => s.urgeLog)
  const sessions = useStore((s) => s.sessions)
  const goal = useStore((s) => s.settings.dailyGoalMin)
  const [offset, setOffset] = useState(0)
  const day = dateKey(daysAgo(offset))
  const sv = useMemo(() => scoreView({ focusLog, urgeLog, sessions }, goal), [focusLog, urgeLog, sessions, goal])
  const hourBars = useMemo(() => byHour(urgeLog).map((v, h) => ({ label: pad(h), drifts: Math.round(v) })), [urgeLog])
  const col = useColours()
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="grid min-w-0 content-start gap-4">
        <Panel className="min-w-0 px-4 pb-3 pt-4 sm:px-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h2 className={h2}>{offset === 0 ? 'Today' : parseKey(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h2>
            <div className="flex w-full min-w-0 items-center justify-between gap-1.5 sm:w-auto" data-no-drag>
              <button aria-label="Previous day" disabled={offset >= 89} onClick={() => setOffset((o) => o + 1)} className="grid size-11 place-items-center bg-ink/[0.06] text-ink ring-1 ring-ink/12 hover:bg-ink/12 disabled:opacity-40 md:size-10"><ChevronLeft className="size-4" /></button>
              <DatePicker value={parseKey(day)} onChange={(d) => d && setOffset(Math.max(0, Math.round((+parseKey(dateKey()) - +parseKey(dateKey(d))) / 864e5)))} placeholder="Pick a day" align="end" />
              <button aria-label="Next day" disabled={offset <= 0} onClick={() => setOffset((o) => o - 1)} className="grid size-11 place-items-center bg-ink/[0.06] text-ink ring-1 ring-ink/12 hover:bg-ink/12 disabled:opacity-40 md:size-10"><ChevronRight className="size-4" /></button>
            </div>
          </div>
          <div className="overflow-x-auto pb-5" data-no-drag tabIndex={0} role="region" aria-label="The day by hour"><div className="min-w-[19rem]"><Listings day={day} /></div></div>
        </Panel>
        <Panel className="min-w-0 p-5">
          <h2 className={h2}>When you drift</h2>
          <p className={note}>Times you left the tab during a session, by hour of the day, over every day saved.</p>
          <BarChart data={hourBars} series={[{ key: 'drifts', label: 'Drifts', color: col.ice }]} height={150} />
        </Panel>
      </div>
      <div className="grid min-w-0 content-start gap-4">
        <Panel className="min-w-0 p-5">
          <div className="flex items-center gap-4">
            <ScoreRing score={sv.score} />
            <div className="min-w-0">
              <h2 className={h2}>Attention score</h2>
              <p className="mt-1 text-sm text-ink-2">Worked out from today, in three parts.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4">
            {sv.parts.map((p) => (
              <div key={p.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink">{p.label}</span>
                  <span className="fig text-[13px] text-ink-2">{Math.round(p.value * p.max)} of {p.max} points</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-ink/10"><motion.div className="h-full bg-ice" initial={{ width: 0 }} animate={{ width: `${p.value * 100}%` }} transition={{ type: 'spring', stiffness: 90, damping: 20, delay: 0.1 }} /></div>
                <div className="mt-1 text-[14px] text-ink">{p.measure}</div>
                <div className="text-[13px] text-ink-3">{p.rule}</div>
              </div>
            ))}
          </div>
        </Panel>
        <RightNow />
      </div>
    </div>
  )
}

/* ───────────── Patterns ───────────── */

export function PatternsTab() {
  const focusLog = useStore((s) => s.focusLog)
  const urgeLog = useStore((s) => s.urgeLog)
  const col = useColours()
  const g = useMemo(() => hoursGrid(focusLog), [focusLog])
  const cal = useMemo(() => calendarData(urgeLog), [urgeLog])
  const lastYear = useMemo(() => sum(lastDays(365).map((d) => dayTotal(urgeLog, d))), [urgeLog])
  return (
    <div className="grid gap-4">
      <Panel className="min-w-0 p-5">
        <h2 className={h2}>When you lock in</h2>
        <p className={note}>Minutes held by weekday and hour of the day, added up over the days you have used Friction (up to 10 weeks).</p>
        <div className="overflow-x-auto" data-no-drag tabIndex={0} role="region" aria-label="Weekday by hour of the day"><div className="min-w-[36rem]">
          <ActivityHeatmap mode="hours" matrix={g.matrix} color={col.ice} unit="minutes held" summaryText={g.days ? `${fmtMinutes(g.total)} held over the last ${g.days} day${g.days === 1 ? '' : 's'}, about ${fmtMinutes(g.perWeek)} a week` : 'Nothing held yet'} ariaLabel="Minutes held by weekday and hour of the day" />
        </div></div>
      </Panel>
      <Panel className="min-w-0 p-5">
        <h2 className={h2}>Drifts, by day</h2>
        <p className={note}>One square for each day. Brighter is more drifts, and fewer is better.</p>
        <div className="overflow-x-auto" data-no-drag tabIndex={0} role="region" aria-label="Drifts on each day"><div className="min-w-[36rem]">
          <ActivityHeatmap mode="calendar" data={cal} weeks={53} weekStart={1} color={col.hot} unit="drifts" summaryText={`${Math.round(lastYear)} drift${Math.round(lastYear) === 1 ? '' : 's'} in the last year`} ariaLabel="Drifts on each day of the last year" />
        </div></div>
      </Panel>
    </div>
  )
}

/* ───────────── Trends ───────────── */

export function TrendsTab() {
  const focusLog = useStore((s) => s.focusLog)
  const urgeLog = useStore((s) => s.urgeLog)
  const sessions = useStore((s) => s.sessions)
  const sourceSecs = useStore((s) => s.sourceSecs)
  const col = useColours()
  const days14 = useMemo(() => lastDays(14), [])
  const bars14 = days14.map((d) => ({ label: weekdayShort(d).slice(0, 2), held: Math.round(dayTotal(focusLog, d)) }))
  const rate14 = days14.map((d) => ({ label: weekdayShort(d).slice(0, 2), rate: blockedPerHour(dayTotal(focusLog, d), dayTotal(urgeLog, d)) ?? 0 }))
  const days90 = useMemo(() => lastDays(90).map((d) => ({ date: parseKey(d), value: Math.round(dayTotal(focusLog, d)) })), [focusLog])
  const wd = useMemo(() => weekdayAverages(focusLog), [focusLog])
  const weekdayBars = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({ label, avg: Math.round(wd.avg[i]) }))
  const split = [{ label: 'Radio', value: Math.round(sourceSecs.radio / 60), color: col.ice }, { label: 'TV', value: Math.round(sourceSecs.tv / 60), color: col.signal }, { label: 'Silent', value: Math.round(sourceSecs.silent / 60), color: col.ink3 }]
  const funnel = funnelOf(sessions)
  const now = spanOf({ focusLog, urgeLog, sessions }, 0, 7)
  const before = spanOf({ focusLog, urgeLog, sessions }, 7, 7)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel className="min-w-0 p-5"><h2 className={h2}>Minutes held per day</h2><p className={note}>The last 14 days.</p><BarChart data={bars14} series={[{ key: 'held', label: 'Minutes held', color: col.ice }]} height={200} /></Panel>
      <Panel className="min-w-0 p-5"><h2 className={h2}>Drifts per focused hour</h2><p className={note}>The last 14 days. Falling is the goal. A day with under 10 minutes held shows no bar.</p><BarChart data={rate14} series={[{ key: 'rate', label: 'Drifts per hour', color: col.hot }]} height={200} /></Panel>
      <Panel className="min-w-0 p-5 lg:col-span-2"><MinutesArea days={days90} /></Panel>
      <Panel className="min-w-0 p-5"><h2 className={h2}>What you held with</h2><p className={note}>Minutes by source, over every day saved.</p><DonutChart data={split} size={190} thickness={10} centerLabel="Minutes" /></Panel>
      <Panel className="min-w-0 p-5"><h2 className={h2}>How sessions go</h2><p className={note}>From starting to finishing, over your last {sessions.length} session{sessions.length === 1 ? '' : 's'}.</p><FunnelChart stages={funnel} /></Panel>
      <Panel className="min-w-0 p-5">
        <h2 className={h2}>Your strongest weekdays</h2>
        <p className={note}>{wd.since ? `Average minutes held on each weekday, over the ${wd.weeks} week${wd.weeks === 1 ? '' : 's'} since ${wd.since.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}. Today is left out until it is over.` : 'This needs one finished day with focus in it. Come back tomorrow.'}</p>
        <BarChart data={weekdayBars} series={[{ key: 'avg', label: 'Average minutes', color: col.signal }]} height={210} />
      </Panel>
      <Panel className="min-w-0 p-5"><h2 className={h2}>This week against last</h2><p className={note}>The last 7 days against the 7 days before them.</p><WeekCompare now={now} before={before} /></Panel>
    </div>
  )
}

/* ───────────── Rings ───────────── */

function Ring({ title, sub, data, label, value, empty }: { title: string; sub: string; data: { label: string; value: number; color: string }[]; label: string; value?: string; empty: string }) {
  return (
    <Panel className="min-w-0 p-5">
      <h2 className={h2}>{title}</h2>
      <p className={note}>{sub}</p>
      {data.every((d) => d.value === 0) ? <p className="grid min-h-[150px] place-items-center text-sm text-ink-2">{empty}</p> : <DonutChart data={data} size={170} thickness={11} centerLabel={label} centerValue={value} />}
    </Panel>
  )
}

export function RingsTab() {
  const focusLog = useStore((s) => s.focusLog)
  const urgeLog = useStore((s) => s.urgeLog)
  const sessions = useStore((s) => s.sessions)
  const sourceSecs = useStore((s) => s.sourceSecs)
  const goal = useStore((s) => s.settings.dailyGoalMin)
  const col = useColours()
  const held = Math.round(dayTotal(focusLog, dateKey()))
  const tint = [col.ice, col.signal, col.hot, col.ink3]
  const parts = (log: Record<string, number[]>) => partsOfDay(log).map((p, i) => ({ label: p.label, value: Math.round(p.value), color: tint[i] }))
  const g = useMemo(() => hoursGrid(focusLog), [focusLog])
  const wkday = Math.round(sum(g.matrix.slice(0, 5).map((r) => sum(r))))
  const wkend = Math.round(sum(g.matrix.slice(5).map((r) => sum(r))))
  const fin = sessions.filter((x) => x.completed).length
  return (
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      <Ring title="Today against your goal" sub={`${held} of ${goal} minutes.`} data={[{ label: 'Held', value: held, color: col.signal }, { label: 'Still to go', value: Math.max(0, goal - held), color: col.ink3 }]} label="Held today" value={`${held} of ${goal}`} empty="Nothing held yet today." />
      <Ring title="When you hold" sub="Minutes held, by part of the day, over every day saved." data={parts(focusLog)} label="Minutes" empty="Hold a session and this fills in." />
      <Ring title="When you drift" sub="Times you left, by part of the day, over every day saved." data={parts(urgeLog)} label="Drifts" empty="No drifts yet. That is the goal." />
      <Ring title="How sessions end" sub={`Finished against stopped early, over your last ${sessions.length} session${sessions.length === 1 ? '' : 's'}.`} data={[{ label: 'Finished', value: fin, color: col.signal }, { label: 'Ended early', value: sessions.length - fin, color: col.hot }]} label="Sessions" empty="No sessions yet." />
      <Ring title="What you held with" sub="Minutes by source, over every day saved." data={[{ label: 'Radio', value: Math.round(sourceSecs.radio / 60), color: col.ice }, { label: 'TV', value: Math.round(sourceSecs.tv / 60), color: col.signal }, { label: 'Silent', value: Math.round(sourceSecs.silent / 60), color: col.ink3 }]} label="Minutes" empty="Nothing held yet." />
      <Ring title="Weekdays and weekends" sub={g.days ? `Minutes held over the last ${g.days} day${g.days === 1 ? '' : 's'}: five weekdays against two weekend days.` : 'Minutes held on weekdays against weekends.'} data={[{ label: 'Weekdays', value: wkday, color: col.signal }, { label: 'Weekends', value: wkend, color: col.ice }]} label="Minutes" empty="Hold a few sessions to compare." />
    </div>
  )
}
