import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useMedia } from '@/lib/hooks'
import { ActivityHeatmap } from '@/components/ui/activity-heatmap'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { BarChart } from '@/components/ui/bar-chart'
import { DonutChart } from '@/components/ui/donut-chart'
import { LiveLineChart } from '@/components/ui/live-line-chart'
import { SlidePagination } from '@/components/ui/slide-pagination'
import { StatCard } from '@/components/ui/stat-card'
import { Panel, Seg, ViewHeader } from '@/components/app/shared'
import { dateKey, fmtMinutes } from '@/lib/dates'
import { getPulse } from '@/lib/pulse'
import { useStore } from '@/lib/store'
import { attentionScore, bestStreak, calendarData, dayTotal, hoursMatrix, lastDays, streak, totals, weekdayShort } from '@/lib/stats'

const LIME = '#c8ff3d'
const VIOLET = '#a855f7'
const HOT = '#ff3df2'

function ScoreRing({ score }: { score: number }) {
  const R = 44
  const C = 2 * Math.PI * R
  const label = score >= 80 ? 'Laser' : score >= 55 ? 'Locked in' : score >= 30 ? 'Warming up' : 'Scattered'
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[220px]">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="score" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={LIME} />
            <stop offset="1" stopColor={HOT} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="7" />
        <motion.circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="url(#score)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - score / 100) }}
          transition={{ type: 'spring', stiffness: 40, damping: 16, delay: 0.2 }}
        />
        <motion.circle cx="50" cy="50" r="34" fill="none" stroke={VIOLET} strokeOpacity=".35" strokeWidth="1" strokeDasharray="2 5" animate={{ rotate: 360 }} style={{ transformOrigin: '50px 50px' }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-4xl font-black text-white">
            <AnimatedNumber value={score} />
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-lime-300">{label}</div>
        </div>
      </div>
    </div>
  )
}

export function InsightsView() {
  const s = useStore()
  const [slide, setSlide] = useState(1)
  const [heat, setHeat] = useState<'focus' | 'urges'>('focus')
  const demo = s.demo
  const wide = useMedia('(min-width: 768px)')

  const score = useMemo(() => attentionScore(s), [s.focusLog, s.urgeLog, s.settings])
  const days7 = useMemo(() => lastDays(7), [])
  const days14 = useMemo(() => lastDays(14), [])
  const focus7 = days7.map((d) => Math.round(dayTotal(s.focusLog, d)))
  const urge7 = days7.map((d) => Math.round(dayTotal(s.urgeLog, d)))
  const today = dateKey()
  const tot = totals(s)
  const completed = s.sessions.filter((x) => x.completed).length
  const matrixFocus = useMemo(() => hoursMatrix(s.focusLog), [s.focusLog])
  const matrixUrge = useMemo(() => hoursMatrix(s.urgeLog), [s.urgeLog])
  const calFocus = useMemo(() => calendarData(s.focusLog), [s.focusLog])
  const calUrge = useMemo(() => calendarData(s.urgeLog), [s.urgeLog])
  const bars = days14.map((d) => ({ label: weekdayShort(d).slice(0, 2), focus: Math.round(dayTotal(s.focusLog, d)), urges: Math.round(dayTotal(s.urgeLog, d)) }))
  const split = [
    { label: 'Radio', value: Math.round(s.sourceSecs.radio / 60), color: LIME },
    { label: 'TV', value: Math.round(s.sourceSecs.tv / 60), color: VIOLET },
    { label: 'Silent', value: Math.round(s.sourceSecs.silent / 60), color: HOT },
  ]
  const empty = tot.focus < 1

  const statGrid = (
    <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
      <StatCard label="Focus today" value={Math.round(dayTotal(s.focusLog, today))} trend={focus7} format={(n) => `${Math.round(n)}m`} color={LIME} period="vs 7 days ago" />
      <StatCard label="Scrolls resisted" value={Math.round(dayTotal(s.urgeLog, today))} trend={urge7} goodWhen="down" color={HOT} period="vs 7 days ago" format={(n) => String(Math.round(n))} />
      <StatCard label="Day streak" value={streak(s.focusLog)} trend={days7.map((_, i) => Math.min(streak(s.focusLog), i + 1))} color={VIOLET} format={(n) => `${Math.round(n)}d`} period={`best ${bestStreak(s.focusLog)}d`} />
      <StatCard label="Sessions done" value={completed} trend={[0, 1, 1, 2, 3, 3, Math.max(3, completed)].map((v) => Math.min(v, Math.max(1, completed)))} color="#38bdf8" format={(n) => String(Math.round(n))} period="all time" />
    </div>
  )
  const scorePanel = (
    <Panel className="flex min-h-0 min-w-0 flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-bold text-white">Attention score</h2>
        <span className="text-[11px] text-white/50">live pulse ↓</span>
      </div>
      <ScoreRing score={score} />
      <LiveLineChart source={(push) => { const t = setInterval(() => push(getPulse()), 1000); return () => clearInterval(t) }} initial={[getPulse()]} windowSeconds={45} height={wide ? 110 : 150} color={LIME} unit="" domain={[0, 100]} formatValue={(n) => `${Math.round(n)}`} ariaLabel="Live attention pulse" />
    </Panel>
  )

  const slides = [
    /* 1 · overview */
    ...(wide
      ? [
          <div key="s1" className="grid h-full min-h-0 content-start gap-3 md:grid-cols-[1.1fr_1fr]">
            {statGrid}
            {scorePanel}
          </div>,
        ]
      : [
          <div key="s1a" className="h-full min-h-0">{statGrid}</div>,
          <div key="s1b" className="h-full min-h-0">{scorePanel}</div>,
        ]),

    /* 2 · heatmaps */
    <div key="s2" className="flex h-full min-h-0 flex-col gap-3 [&_.glass]:min-w-0">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold text-white">{heat === 'focus' ? 'When you lock in' : 'When you reach for the scroll'}</h2>
        <Seg id="heat" value={heat} onChange={(id) => setHeat(id as typeof heat)} tabs={[{ id: 'focus', label: 'Focus' }, { id: 'urges', label: 'Scroll urges' }]} />
      </div>
      <div className="grid min-h-0 content-start gap-3 lg:grid-cols-2">
      <Panel className="p-3">
        <div className="mb-1 text-[11px] uppercase tracking-widest text-white/40">Weekday × hour · last 10 weeks</div>
        <ActivityHeatmap key={`h-${heat}`} mode="hours" matrix={heat === 'focus' ? matrixFocus : matrixUrge} color={heat === 'focus' ? LIME : HOT} unit={heat === 'focus' ? 'focused minutes' : 'scrolls resisted'} ariaLabel="Weekday by hour heatmap" />
      </Panel>
      <Panel className="p-3">
        <div className="mb-1 text-[11px] uppercase tracking-widest text-white/40">Every day · {heat === 'focus' ? 'minutes focused' : 'scrolls avoided'}</div>
        <ActivityHeatmap key={`c-${heat}`} mode="calendar" data={heat === 'focus' ? calFocus : calUrge} weeks={26} weekStart={1} color={heat === 'focus' ? LIME : HOT} unit={heat === 'focus' ? 'minutes' : 'scrolls'} ariaLabel="Daily heatmap" />
      </Panel>
      </div>
    </div>,

    /* 3 · trends */
    <div key="s3" className="grid h-full min-h-0 content-start gap-3 md:grid-cols-[1.5fr_1fr]">
      <Panel className="min-w-0 p-3">
        <h2 className="mb-1 font-display text-sm font-bold text-white">Last 14 days</h2>
        <BarChart data={bars} series={[{ key: 'focus', label: 'Focus min', color: LIME }, { key: 'urges', label: 'Scroll urges', color: HOT }]} height={230} />
      </Panel>
      <Panel className="p-3">
        <h2 className="mb-1 font-display text-sm font-bold text-white">What you focus with</h2>
        <DonutChart data={split} size={210} thickness={18} centerLabel="Focus min" showLegend />
      </Panel>
    </div>,

    /* 4 · sessions */
    <div key="s4" className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: 'Lifetime focus', v: fmtMinutes(tot.focus) },
          { l: 'Scrolls resisted', v: String(tot.urges) },
          { l: 'Wanderings', v: String(tot.lapses) },
        ].map((x) => (
          <Panel key={x.l} className="p-3 text-center">
            <div className="font-display text-xl font-extrabold text-white">{x.v}</div>
            <div className="text-[10px] uppercase tracking-wider text-white/50">{x.l}</div>
          </Panel>
        ))}
      </div>
      <Panel className="min-h-0 flex-1 overflow-hidden p-3">
        <h2 className="mb-2 font-display text-sm font-bold text-white">Recent sessions</h2>
        {s.sessions.length === 0 && <div className="py-6 text-center text-sm text-white/50">No sessions yet — lock in on the Focus tab.</div>}
        <ul className="grid gap-1.5">
          {s.sessions.slice(0, 6).map((x, i) => (
            <motion.li key={x.id} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 260, damping: 22 }} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-white">{x.title}</span>
              <span className="flex shrink-0 items-center gap-3 text-xs text-white/60">
                <span className="tnum">{fmtMinutes(x.focusSec / 60)} / {x.goalMin}m</span>
                <span className="text-fuchsia-300">{x.urges}↯</span>
                <span className={x.completed ? 'text-lime-300' : 'text-white/40'}>{x.completed ? '✓' : '·'}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      </Panel>
    </div>,
  ]

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <ViewHeader kicker="Your attention, measured" title="Insights">
        {demo && <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-semibold text-fuchsia-200">Demo history loaded</span>}
      </ViewHeader>
      {empty && slide !== 1 && (
        <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/60">
          Nothing logged yet. Do a focus session — or load demo history in Pledge — and these fill up.
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={slide}
            className="h-full"
            initial={{ opacity: 0, x: 60, filter: 'blur(8px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -60, filter: 'blur(8px)' }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          >
            {slides[slide - 1]}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="relative z-10 flex shrink-0 justify-center">
        <SlidePagination pageCount={slides.length} page={slide} onChange={setSlide} />
      </div>
    </section>
  )
}

