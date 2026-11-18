import { ChevronDown, Coffee, ExternalLink, Hourglass, Lock as LockIcon, Play, Radio, Timer as TimerIcon, Volume2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Glass } from '@/components/app/glass'
import { LengthBand } from '@/components/app/LengthBand'
import { ProjectPicker } from '@/components/app/ProjectPicker'
import { VideoSlot } from '@/components/app/VideoSlot'
import { Listings } from '@/components/app/Listings'
import { Logo, Panel, Readout } from '@/components/app/shared'
import { WidgetLayer, WidgetsButton } from '@/components/app/widgets/Layer'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { DragToConfirm } from '@/components/ui/drag-to-confirm'
import { Stepper } from '@/components/ui/stepper'
import { AsciiSolid } from '@/components/app/AsciiSolid'
import { useStretch, useBreath } from '@/components/app/BreakKit'
import type { Shape } from '@/lib/ascii3d'
import { useAmbience } from '@/lib/ambience'
import { fx_say, quickPlay } from '@/lib/actions'
import { PRESETS } from '@/lib/presets'
import { bringToFront } from '@/components/app/Arrange'
import { nextTier, rateAt, tierLabel, tiersFor, TRIPS_MAX } from '@/lib/credits'
import { dateKey, fmtClock } from '@/lib/dates'
import { useMedia } from '@/lib/hooks'
import { play, usePlayer } from '@/lib/player'
import { dayTotal, sum } from '@/lib/stats'
import { nextUp, type CalEvent } from '@/lib/ical'
import { cn } from '@/lib/utils'
import { goTo } from '@/lib/supporter'
import { LEVELS, canFull, enterLock } from '@/lib/lockdown'
import { runLine, runOf, nextMark, type DayMark } from '@/lib/run'
import { itemsOf, useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import type { View } from '@/components/app/Shell'


/** Retro ground (ASCII torus in a CRT window) under a futuristic clock: wide light numerals and a hairline progress rule. */
function FrictionDial({ progress, left, running, paused, live, note, shape }: { progress: number; left: number; running: boolean; paused: boolean; live: boolean; note?: ReactNode; shape: Shape }) {
  const level = useStore((s) => s.settings.motion)
  const phone = useMedia('(max-width: 639px)')
  return (
    <Glass className="relative flex h-[min(38dvh,340px)] min-h-[220px] w-[clamp(300px,32vw,440px)] max-w-full shrink-0 flex-col items-center justify-between overflow-hidden px-4 py-4 max-lg:h-[min(32dvh,270px)]">
      <div className="hud relative z-10 flex w-full items-center justify-between">
        <span className="flex items-center gap-2">{running && <span className="live-dot" />}{!live ? 'Ready' : paused ? 'On a break' : 'Locked in'}</span>
        <span className="text-ice">{live ? `${Math.round(progress * 100)}%` : '00%'}</span>
      </div>
      <div className="crt pointer-events-none absolute inset-3 grid place-items-center overflow-hidden text-signal opacity-60" aria-hidden>
        <AsciiSolid shape={shape} cols={phone ? 40 : 58} rows={phone ? 20 : 26} speed={running ? 2.2 : paused ? 0 : 0.7} still={level === 0} className="text-[6px] sm:text-[8px] lg:text-[10px]" />
      </div>
      <div className="dot relative z-10 text-[clamp(2.2rem,6.4vw,3.9rem)] font-light text-ink [text-shadow:0_0_12px_var(--ground),0_0_3px_var(--ground)]" role="timer" aria-label={`${fmtClock(left)} left`}>
        {fmtClock(left)}
      </div>
      {note && <div className="relative z-10 [text-shadow:0_0_8px_var(--ground),0_0_3px_var(--ground)]">{note}</div>}
      <div className="relative z-10 h-3 w-full" aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-px bg-ink/30" />
        {Array.from({ length: 21 }, (_, i) => <i key={i} className={`absolute top-1/2 w-px -translate-y-1/2 bg-ink/40 ${i % 5 === 0 ? 'h-3' : 'h-1.5'}`} style={{ left: `${i * 5}%` }} />)}
        {/* no transition on the fill: it moves a third of a pixel a second, so easing it only kept the browser laying out sixty times a second for the whole session */}
        <div className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-ice" style={{ width: `${progress * 100}%` }} />
        <div className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 border border-ice bg-black" style={{ left: `${progress * 100}%` }} />
      </div>
    </Glass>
  )
}

/** On a break the dial says so, and for how long. With the Break kit it also breathes with you and offers a stretch. */
/** while a declared step-out is on: how long is left of the time they gave */
function TripClock({ until }: { until: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t) }, [])
  const left = Math.ceil((until - now) / 1000)
  return (
    <p className="hud flex flex-col items-center text-center !text-[12px] leading-[1.5]" role="status">
      <span>Working elsewhere · <span className="fig text-ink">{left > 0 ? fmtClock(left) : '0:00'}</span> to be back</span>
      <span className="max-w-[34ch] text-ink-3 normal-case">{left > 0 ? "Away time isn't counted and it costs what a drift costs. Only a Break leaves free." : "Time's up. Staying away now counts as a drift."}</span>
    </p>
  )
}

/** Leaving to work somewhere else (a book, a document, another app): say so first and it is recorded as a step-out, not a drift. Not a pause: nothing is credited while away. */
function StepOut({ trips, until }: { trips: number; until?: number }) {
  const [pick, setPick] = useState(false)
  const store = useStore.getState
  if (until) {
    return (
      <Glass radius={999} clear as="button" onClick={() => store().cancelTrip()} className="inline-flex h-12 items-center gap-2 px-5 text-[15px] font-medium text-ink">
        <Play className="size-4 fill-current" />Stay here instead
      </Glass>
    )
  }
  if (trips >= TRIPS_MAX) return null
  if (!pick) {
    return (
      <Glass radius={999} clear as="button" onClick={() => setPick(true)} aria-expanded={false} className="inline-flex h-12 items-center gap-2 px-5 text-[15px] font-medium text-ink">
        <ExternalLink className="size-4" />Work elsewhere {TRIPS_MAX - trips < TRIPS_MAX && <span className="fig text-ink-2">{TRIPS_MAX - trips} left</span>}
      </Glass>
    )
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="How long will you be away">
      <span className="hud !text-[12px] text-ink-2">Back in</span>
      {[5, 10, 15].map((m) => (
        <Glass key={m} radius={999} clear as="button" onClick={() => { store().startTrip(m); setPick(false) }} className="inline-flex h-12 min-w-14 items-center justify-center px-4 text-[15px] font-medium text-ink"><span className="fig">{m}</span>&nbsp;min</Glass>
      ))}
      <button type="button" onClick={() => setPick(false)} className="h-12 px-3 text-sm text-ink-3 underline">Cancel</button>
    </div>
  )
}

function BreakClock({ until, kit }: { until: number; kit: boolean }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t) }, [])
  const { label, left } = useBreath()
  const { text } = useStretch()
  return (
    <p className="hud flex flex-col items-center text-center !text-[12px] leading-[1.5]" role="status">
      <span>On a break · <span className="fig text-ink">{fmtClock(Math.max(0, Math.ceil((until - now) / 1000)))}</span> left</span>
      {kit ? <><span className="text-signal">{label} <span className="fig">{left}</span></span><span className="max-w-[30ch] text-ink-2 normal-case">{text}</span></> : <span className="text-ink-3">Timer waits · tab is free</span>}
    </p>
  )
}

/**
 * The pay ladder: credits a minute by minutes held without a drift. The step you are on is lit, the ones behind you are firm and the
 * ones ahead are faint, so it reads as "the longer you stay, the more you earn". Without `cleanSec` nothing is lit (the idle dial).
 */
function Ladder({ cleanSec, goalMin }: { cleanSec?: number; goalMin: number }) {
  const TIERS = tiersFor(goalMin)
  const cur = cleanSec == null ? -1 : TIERS.reduce((at, t, i) => (cleanSec >= t.from ? i : at), 0)
  return (
    <span data-tour="ladder" className="grid w-full grid-cols-5 gap-1 bg-ground/70 px-1 pb-1 text-center" role="img" aria-label={`Credits a minute by minutes held without a drift: ${TIERS.map((t) => `${t.rate} from ${tierLabel(t.from)}`).join(', ')}`}>
      {TIERS.map((t, i) => (
        <span key={t.from} aria-hidden className={`border-t-2 pt-1 ${i === cur ? 'border-signal text-signal' : i < cur ? 'border-ink/70 text-ink-2' : 'border-ink/20 text-ink-3'}`}>
          <span className="fig block text-[14px] leading-none">{t.rate}</span>
          <span className="mt-0.5 block text-[10px] leading-none">{i === 0 ? 'start' : tierLabel(t.from)}</span>
        </span>
      ))}
    </span>
  )
}

/** What this session is paying, live: the rate climbs while you stay clean and starts again at a drift. */
function CreditMeter() {
  const cleanSec = useStore((x) => x.session?.cleanSec ?? 0)
  const goalMin = useStore((x) => x.session?.goalMin ?? 25)
  const credit = useStore((x) => x.session?.credit ?? 0)
  const shields = useStore((x) => itemsOf(x.credits).shields)
  const rate = rateAt(cleanSec, goalMin)
  const next = nextTier(cleanSec, goalMin)
  return (
    <div className="hud grid w-[min(100%,19rem)] justify-items-center gap-1 text-center !text-[12px] leading-[1.4] ![text-shadow:0_0_5px_var(--ground),0_0_5px_var(--ground),0_0_2px_var(--ground)]" role="status" aria-live="off">
      <p>Paying <span className="fig text-ink">{rate}</span> {rate === 1 ? 'credit' : 'credits'} a minute</p>
      <p className="text-ink-3"><span className="fig text-ink">{Math.floor(credit)}</span> earned so far{shields > 0 && <> · shield <span className="fig text-signal">×{shields}</span></>}</p>
      <p className="mb-0.5 text-ink-3">{next ? <>Stay clean <span className="fig text-ink">{fmtClock(Math.ceil(next.inSec))}</span> more for <span className="fig text-ink">{next.rate}</span> a minute</> : 'Top rate. A drift would start the climb over.'}</p>
      <Ladder cleanSec={cleanSec} goalMin={goalMin} />
    </div>
  )
}

/** Before a session: the same ladder, so it is known what staying is worth. */
function CreditHint() {
  // the length the next session will have: the Pomodoro's rounds of work, or the timer's length
  const goalMin = useStore((x) => (x.settings.pomo ? x.settings.pomoWork * x.settings.pomoRounds : x.settings.sessionMin))
  return (
    <div className="hud grid w-[min(100%,19rem)] justify-items-center gap-1.5 text-center !text-[12px] leading-[1.4] ![text-shadow:0_0_5px_var(--ground),0_0_5px_var(--ground),0_0_2px_var(--ground)]">
      <p className="text-ink-2">The longer you stay clean, the more you earn</p>
      <Ladder goalMin={goalMin} />
    </div>
  )
}

/** The sound machine's button, when you own it: opens the mixer and shows whether it is playing. */
function SoundsButton() {
  const on = useAmbience((s) => s.on)
  return (
    <Glass radius={999} clear as="button" onClick={() => useUI.getState().set({ soundOpen: true })} aria-label={on ? 'Sound machine, playing' : 'Sound machine'} className="inline-flex h-12 items-center gap-2 px-5 text-[15px] font-medium text-ink">
      <Volume2 className="size-4" />Sounds{on && <span className="live-dot" aria-hidden />}
    </Glass>
  )
}

/** A Pomodoro rest: away from the screen, but the tab stays (leaving it is a drift), and no credits come in. */
function RestClock({ until, round, rounds }: { until: number; round: number; rounds: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t) }, [])
  return (
    <p className="hud flex flex-col items-center text-center !text-[12px] leading-[1.5]" role="status">
      <span>Rest · <span className="fig text-ink">{fmtClock(Math.max(0, Math.ceil((until - now) / 1000)))}</span> · round {round} of {rounds} done</span>
      <span className="max-w-[30ch] text-ink-2 normal-case">Stand up, look far away, drink water. Stay on this tab.</span>
    </p>
  )
}

/** Timer or Pomodoro, and how hard the lock-in holds you. Both are chosen before a session and kept for it. */
function ModeRow() {
  const pomo = useStore((s) => s.settings.pomo)
  const level = useStore((s) => s.settings.lockLevel)
  const setSettings = useStore((s) => s.setSettings)
  // a select is as wide as its longest choice, so these are kept short: the row has to fit a phone on one line, since it shares
  // it with the project and costs the screen no height of its own
  const box = 'inline-flex h-11 shrink-0 items-center border border-ink/25 text-[13px] text-ink hover:bg-ink/10 focus-within:border-signal'
  const sel = 'h-full appearance-none bg-transparent pr-6 pl-1 !outline-none' // the box round it shows the focus: a second ring on the select doubled it
  const caret = 'pointer-events-none -ml-5 mr-1.5 size-3.5 text-ink-3'
  return (
    <div className="flex max-w-[420px] flex-wrap items-center justify-center gap-1.5">
      <label className={box} title="Timer: one stretch. Pomodoro: rounds with rests away from the screen.">
        <TimerIcon aria-hidden className="ml-2 size-3.5 shrink-0 text-ink-3" />
        <span className="sr-only">Kind of session</span>
        <select value={pomo ? 'pomo' : 'timer'} onChange={(e) => setSettings({ pomo: e.target.value === 'pomo' })} className={sel}>
          <option value="timer" className="bg-surface text-ink">Timer</option>
          <option value="pomo" className="bg-surface text-ink">Pomodoro</option>
        </select>
        <ChevronDown aria-hidden className={caret} />
      </label>
      <button type="button" onClick={() => goTo('/settings')} className={cn(box, 'gap-1.5 px-2.5')} title={`${LEVELS[level]?.line} Change it in Settings.`} aria-label={`Lock-in strength: ${LEVELS[level]?.name}. Change it in Settings`}>
        <LockIcon aria-hidden className="size-3.5 shrink-0 text-ink-3" />{LEVELS[level]?.name}
      </button>
      <ProjectPicker />
    </div>
  )
}

/** The Pomodoro plan: rounds of work with rests between, a long rest after every fourth. */
function PomoPlan() {
  const st = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const sel = 'h-11 border border-ink/25 bg-transparent px-2 text-[13px] text-ink md:h-9'
  const pick = (label: string, value: number, opts: number[], on: (n: number) => void, unit = 'min') => (
    <label className="flex items-center gap-1 text-[12px] text-ink-2">{label}
      <select value={value} onChange={(e) => on(Number(e.target.value))} className={sel}>{opts.map((o) => <option key={o} value={o} className="bg-surface text-ink">{o}{unit ? ` ${unit}` : ''}</option>)}</select>
    </label>
  )
  return (
    <div className="grid max-w-[420px] justify-items-center gap-1">
      <div className="flex flex-wrap justify-center gap-2">
        {pick('Work', st.pomoWork, [15, 20, 25, 30, 40, 45, 50, 60], (n) => setSettings({ pomoWork: n }))}
        {pick('Rest', st.pomoRest, [3, 5, 10, 15], (n) => setSettings({ pomoRest: n }))}
        {pick('Rounds', st.pomoRounds, [1, 2, 3, 4, 5, 6, 8], (n) => setSettings({ pomoRounds: n }), '')}
      </div>
      <p className="text-center text-[12px] leading-[1.4] text-ink-2">{st.pomoRounds * st.pomoWork} min of work. Rests: tab open, eyes off screens, no credits.{st.pomoRounds > 4 ? ` A ${st.pomoRest * 3} min rest after the fourth.` : ''}</p>
    </div>
  )
}

/** High lock-in: ending early is a ten-second hold, not a slide */
function HoldToEnd({ onDone }: { onDone: () => void }) {
  const [p, setP] = useState(0)
  const raf = useRef(0)
  const go = () => {
    cancelAnimationFrame(raf.current)
    const t0 = performance.now()
    const step = () => { const v = Math.min(1, (performance.now() - t0) / 10000); setP(v); if (v >= 1) { onDone(); return } raf.current = requestAnimationFrame(step) }
    raf.current = requestAnimationFrame(step)
  }
  const stop = () => { cancelAnimationFrame(raf.current); setP(0) }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  return (
    <button
      onPointerDown={go} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); go() } }} onKeyUp={stop}
      aria-label="Hold for ten seconds to end the session"
      className="relative mx-auto block h-12 w-full max-w-[19rem] overflow-hidden border border-ink/40 font-[family-name:var(--font-cond)] text-[14px] font-semibold uppercase tracking-[0.08em] text-ink select-none"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 border-r border-signal bg-signal/25" style={{ width: `${p * 100}%` }} />
      <span className="relative">{p ? `Keep holding · ${Math.ceil(10 - p * 10)} s` : 'Hold 10 s to end'}</span>
    </button>
  )
}

/**
 * One line under the length, only when it helps: just after a finished session, a rest on the Timer (it rings when the rest is over);
 * otherwise, when the next event in an imported calendar starts before the chosen length would end, the length that finishes first.
 */
function NextStep({ sessionMin, minute, events }: { sessionMin: number; minute: number; events: CalEvent[] }) {
  const last = useStore((s) => s.sessions[0])
  const setSettings = useStore((s) => s.setSettings)
  const [rested, setRested] = useState('')
  const now = minute * 6e4
  const btn = 'min-h-11 max-w-[420px] px-2 text-center text-[13px] leading-[1.35] text-signal hover:underline'
  if (last?.completed && now - last.end < 10 * 6e4 && rested !== last.id) {
    const rest = last.goalMin >= 50 ? 10 : 5
    const go = () => {
      setRested(last.id)
      void import('@/components/app/widgets/Timer').then(({ useTimer }) => {
        const t = useTimer.getState()
        t.setMode('countdown'); t.setTarget(rest * 6e4); t.start()
        useStore.getState().setWidget('timer', true)
      })
    }
    return <button onClick={go} className={btn}>Done. Rest {rest} minutes on the timer, then go again.</button>
  }
  const up = events.length ? nextUp(events, now) : null
  if (!up || up.s <= now) return null
  const until = Math.floor((up.s - now) / 6e4)
  if (until >= sessionMin + 2) return null
  const at = new Date(up.s).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const fit = Math.floor((until - 2) / 5) * 5
  if (fit < 10) return <p className="max-w-[420px] px-2 text-center text-[13px] text-ink-2">{up.t} at {at}, in {until} min.</p>
  return <button onClick={() => setSettings({ sessionMin: fit })} className={btn}>{up.t} at {at}. Make it {fit} min to finish first.</button>
}

export function FocusView({ go }: { go: (v: View) => void }) {
  const session = useStore((s) => s.session)
  const credits = useStore((s) => s.credits)
  const items = itemsOf(credits)
  const breaks = items.breaks
  const longBreaks = items.longBreaks
  const hasSound = items.owned.includes('sound')
  const hasKit = items.owned.includes('kit')
  const dial = (items.owned.includes('solids') && items.dial ? items.dial : 'torus') as Shape
  const sessionId = session?.id
  // a session that starts puts the timer in front of any study windows lying over it
  useEffect(() => { if (sessionId) bringToFront(document.querySelector<HTMLElement>('[data-movable="timer"]')) }, [sessionId])
  const sessionMin = useStore((s) => s.settings.sessionMin)
  const setSettings = useStore((s) => s.setSettings)
  const focusLog = useStore((s) => s.focusLog)
  const urgeLog = useStore((s) => s.urgeLog)
  const goal = useStore((s) => s.settings.dailyGoalMin)
  const { current, status } = usePlayer()
  const recent = useStore((s) => s.recent)
  const set = useUI((s) => s.set)
  const tvOn = current?.kind === 'tv'
  const theatre = useUI((s) => s.theatre)
  const tall = useMedia('(min-height: 800px)')
  const veryTall = useMedia('(min-height: 980px)')
  const wide = useMedia('(min-width: 1024px)')
  const today = dateKey()

  const nextMin = useStore((s) => (s.settings.pomo ? s.settings.pomoWork * s.settings.pomoRounds : s.settings.sessionMin))
  const total = (session?.goalMin ?? nextMin) * 60
  const left = session ? Math.max(0, total - session.elapsedSec) : total
  const progress = session ? Math.min(1, session.elapsedSec / total) : 0
  const running = !!session && !session.paused

  const held = dayTotal(focusLog, today)
  const blocked = Math.round(sum(urgeLog[today] ?? []))
  useEffect(() => { useStore.getState().mendRun() }, [])
  const run = runOf(focusLog)
  const days = run.days
  const streakLine = runLine(run, held)
  const cal = useStore((s) => s.widgets.cal)
  const own = useStore((s) => s.widgets.own)
  const events = useMemo(() => [...(cal?.events ?? []), ...(own ?? [])], [cal, own])
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 6e4))
  useEffect(() => { const t = setInterval(() => setMinute(Math.floor(Date.now() / 6e4)), 30000); return () => clearInterval(t) }, [])
  const up = events.length ? nextUp(events, minute * 6e4) : null
  // with nothing on in the next day, the nearest date you typed in to count down to (an exam, a deadline), up to two months off
  const count = !up ? (own ?? []).map((e) => ({ e, n: Math.round((new Date(e.s).setHours(0, 0, 0, 0) - new Date(minute * 6e4).setHours(0, 0, 0, 0)) / 864e5) })).find((x) => x.n >= 1 && x.n <= 60) : undefined
  const calLine = up ? (up.s <= minute * 6e4 ? `On now: ${up.t}.` : `Next: ${up.t} at ${new Date(up.s).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`) : count ? `${count.e.t} ${count.n === 1 ? 'is tomorrow' : `in ${count.n} days`}.` : ''

  const lockLevel = useStore((s) => s.settings.lockLevel)
  const pomoOn = useStore((s) => s.settings.pomo)
  const start = () => {
    void enterLock(lockLevel) // full screen needs this very press
    useStore.getState().startSession(sessionMin, current ? current.kind : 'silent', current?.name ?? 'Silent focus')
    if (current && status === 'paused') play(current)
  }

  const step = session ? 2 : current ? 2 : 1

  const finding = session
    ? `${session.project ? `${session.project}: ` : ''}${Math.round(session.elapsedSec / 60)} of ${session.goalMin} min held, ${session.urges} drift${session.urges === 1 ? '' : 's'}.`
    : held >= goal
      ? `Daily goal of ${goal} min met. ${blocked} drifts today. ${streakLine} ${calLine}`.trim()
      : held > 0
        ? `${Math.round(held)} of ${goal} min today, ${blocked} drifts. ${streakLine} ${calLine}`.trim()
        : `Nothing yet today. ${streakLine || 'Pick a length and lock in.'} ${calLine}`.trim()

  return (
    <section className={`relative flex h-full min-h-0 flex-col gap-3 lg:gap-4 ${wide ? '' : '[justify-content:safe_center]'}`}>
      {!wide && (
        <div data-movable="focus-head">
          <div className="hud kicker mb-1 flex items-center gap-2"><span className="inline-block h-px w-5 bg-signal/70" />{session ? 'Session live' : 'Ready'}</div>
          <div className="flex items-center justify-between gap-3"><h1 className="dot text-[1.6rem] font-bold">FOCUS</h1><WidgetsButton /></div>
          <p className="mt-0.5 text-[13px] text-ink-2">{finding}</p>
        </div>
      )}
      <div className={`grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] ${wide ? 'flex-1' : ''}`}>
        {wide && (
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }} className="min-w-0 self-center">
            <div className="hud kicker mb-1 flex items-center gap-2"><span className="inline-block h-px w-5 bg-signal/70" />{session ? 'Session live' : 'Ready'}</div>
            <div className="flex items-center justify-between gap-3"><h1 className="dot text-[clamp(1.6rem,3vw,2.2rem)] font-bold">FOCUS</h1><WidgetsButton /></div>
            <p className="mb-4 mt-1 max-w-[34ch] text-sm text-ink-2">{finding}</p>
            <Panel className="grid gap-4 p-5">
              <Readout label="Drifts today" value={<AnimatedNumber value={blocked} />} note="times you left" />
              <div className="h-px bg-ink/10" />
              <Readout label="Held today" value={<AnimatedNumber value={Math.round(held)} />} unit="min" note={`of ${goal} min goal`} />
              <div className="h-px bg-ink/10" />
              <div className="grid gap-2">
                <Readout label="Day streak" value={<AnimatedNumber value={days} />} unit={days === 1 ? 'day' : 'days'} note={run.doneToday ? (nextMark(days) ? `${nextMark(days)!.days - days} to ${nextMark(days)!.days}` : 'held today') : days > 0 ? '10 min keeps it' : '10+ min a day'} />
                <WeekStrip week={run.week} rest={run.restReady || !run.alive} />
              </div>
            </Panel>
          </motion.div>
        )}

        <div data-movable="timer" className="flex min-w-0 flex-col items-center gap-4 justify-self-center">
          <FrictionDial progress={progress} left={left} running={running} paused={!!session?.paused} live={!!session} shape={dial} note={session ? (session.restUntil && session.pomo ? <RestClock until={session.restUntil} round={session.pomo.round} rounds={session.pomo.rounds} /> : session.breakUntil ? <BreakClock until={session.breakUntil} kit={hasKit} /> : session.tripUntil ? <TripClock until={session.tripUntil} /> : <CreditMeter />) : <CreditHint />} />

          <AnimatePresence mode="wait" initial={false}>
            {!session ? (
              <motion.div key="idle" className="flex flex-col items-center gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}>
                <div className="flex items-center gap-2">
                  <button onClick={start} className="h-14 w-full min-w-[17rem] max-w-[420px] bg-signal px-7 font-[family-name:var(--font-cond)] text-[19px] font-bold uppercase tracking-[0.1em] text-on-signal hover:brightness-110 sm:w-[19rem]">Lock in</button>
                </div>
                {pomoOn ? <PomoPlan /> : <LengthBand value={sessionMin} onChange={(m) => setSettings({ sessionMin: m })} />}
                <NextStep sessionMin={pomoOn ? useStore.getState().settings.pomoWork : sessionMin} minute={minute} events={events} />
                <ModeRow />
                {lockLevel > 0 && !canFull() && <p className="max-w-[40ch] text-center text-[12px] text-ink-3">No full screen in this browser, so the lock works as Low.</p>}
                {hasSound && <SoundsButton />}
              </motion.div>
            ) : (
              <motion.div key="live" className="flex w-full max-w-[420px] flex-col items-center gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}>
                {(session.breakUntil || breaks > 0 || longBreaks > 0 || hasSound) && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {session.breakUntil ? (
                      <Glass radius={999} clear as="button" onClick={() => useStore.getState().endBreak()} className="inline-flex h-12 items-center gap-2 px-7 text-[15px] font-medium text-ink">
                        <Play className="size-4 fill-current" />Back now
                      </Glass>
                    ) : (
                      <>
                        {breaks > 0 && (
                          <Glass radius={999} clear as="button" onClick={() => useStore.getState().useBreak()} className="inline-flex h-12 items-center gap-2 px-5 text-[15px] font-medium text-ink">
                            <Coffee className="size-4" />Break <span className="fig text-ink-2">{breaks}</span>
                          </Glass>
                        )}
                        {longBreaks > 0 && (
                          <Glass radius={999} clear as="button" onClick={() => useStore.getState().useBreak(true)} className="inline-flex h-12 items-center gap-2 px-5 text-[15px] font-medium text-ink">
                            <Hourglass className="size-4" />Long <span className="fig text-ink-2">{longBreaks}</span>
                          </Glass>
                        )}
                      </>
                    )}
                    {hasSound && <SoundsButton />}
                  </div>
                )}
                {!session.breakUntil && <StepOut trips={session.trips ?? 0} until={session.tripUntil} />}
                {session.pomo && (
                  session.restUntil
                    ? <button onClick={() => useStore.getState().endRest()} className="h-11 border border-ink/30 px-4 text-[13px] text-ink hover:bg-ink/10">Back early: start round {Math.min(session.pomo.rounds, session.pomo.round + 1)}</button>
                    : <p className="hud" role="status">Round {session.pomo.round} of {session.pomo.rounds} · <span className="fig text-ink">{fmtClock(Math.max(0, session.pomo.round * session.pomo.work * 60 - session.elapsedSec))}</span> to the rest</p>
                )}
                <div className="w-full">
                  {(session.lock ?? 0) >= 2
                    ? <HoldToEnd onDone={() => useStore.getState().endSession(false)} />
                    : <DragToConfirm className="slide-end" label="Slide to end session" confirmedLabel="Ended" size="md" onConfirm={() => useStore.getState().endSession(false)} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {veryTall && !session && (
            <div className="w-full max-w-[460px]">
              <Stepper
                current={step}
                steps={[{ title: 'Length', description: `${sessionMin} min` }, { title: 'Tune', description: current ? current.name.slice(0, 14) : 'a source' }, { title: 'Lock in', description: 'and stay' }]}
                onStepChange={(i) => i === 1 && set({ tuneOpen: true })}
              />
            </div>
          )}
        </div>

        {wide && (
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.28, ease: [0.2, 0, 0, 1], delay: 0.05 }} className="min-w-0 self-center">
            <Panel className="p-4">
              {tvOn && !theatre && <VideoSlot className="mb-3 aspect-video w-full border border-ink/20" />}
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-base font-semibold">Tune in</h2>
                <button onClick={() => set({ tuneOpen: true })} className="text-[13px] text-signal hover:underline">All sources</button>
              </div>
              <ul>
                {PRESETS.slice(0, 5).map((p, i) => (
                  <motion.li key={p.label} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.04, duration: 0.2 }}>
                    <button onClick={() => void quickPlay(p.kind, p.tag).catch(() => fx_say({ title: 'Could not reach the directory', variant: 'danger' }))} className="flex h-10 w-full items-center justify-between border-b border-ink/10 text-left text-sm text-ink transition-colors last:border-b-0 hover:text-signal">
                      <span>{p.label}</span>
                      <span className="hud !tracking-[0.1em]">{p.kind === 'radio' ? 'Radio' : 'TV'}</span>
                    </button>
                  </motion.li>
                ))}
              </ul>
              {recent[0] && (
                <button onClick={() => play(recent[0], recent)} className="mt-3 flex w-full items-center gap-2 rounded-xl bg-ink/[0.05] p-2 text-left text-[13px] text-ink-2 hover:bg-ink/10">
                  <Logo item={recent[0]} size={28} />
                  <span className="min-w-0 truncate">Resume {recent[0].name}</span>
                </button>
              )}
              <div className="mt-3 flex gap-2">
                <button className="h-11 flex-1 border md:h-9 border-ink/30 text-[13px] text-ink hover:bg-ink/10" onClick={() => go('radio')}><Radio className="mr-1.5 inline size-3.5" />Browse radio</button>
                <button className="h-11 flex-1 border md:h-9 border-ink/30 text-[13px] text-ink hover:bg-ink/10" onClick={() => go('tv')}>Browse TV</button>
              </div>
            </Panel>
          </motion.div>
        )}
      </div>

      {wide && tall && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26, ease: [0.2, 0, 0, 1], delay: 0.1 }} className="shrink-0">
          <Panel className="px-5 pb-6 pt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-base font-semibold">Today</h2>
              <span className="hidden text-[13px] text-ink-2 sm:inline">Focused time by source, drifts underneath</span>
            </div>
            <Listings />
          </Panel>
        </motion.div>
      )}
      {!wide && (
        <div className="grid grid-cols-3 gap-2">
          {[{ l: 'Drifts', v: blocked, u: '' }, { l: 'Held', v: Math.round(held), u: 'min' }, { l: 'Streak', v: days, u: days === 1 ? 'day' : 'days' }].map((r) => (
            <Panel key={r.l} className="px-3 py-2.5">
              <div className="hud">{r.l}</div>
              <div className="fig mt-0.5 text-2xl text-ink"><AnimatedNumber value={r.v} />{r.u && <span className="ml-1 text-sm text-ink-2">{r.u}</span>}</div>
            </Panel>
          ))}
        </div>
      )}
      <WidgetLayer />
    </section>
  )
}

const MARK_CLASS: Record<DayMark, string> = {
  on: 'h-2 bg-signal',
  open: 'h-2 border border-dashed border-signal bg-transparent',
  rest: 'h-1 self-end bg-ice/60',
  frozen: 'h-1 self-end bg-ice',
  off: 'h-1 self-end bg-ink/20',
}
const MARK_WORD: Record<DayMark, string> = { on: 'held', open: 'open', rest: 'rest day', frozen: 'frozen', off: 'empty' }

/** The last seven days as seven bars, like the test-card strip: lit when held, a low bar for a rest day or an empty one. */
function WeekStrip({ week, rest }: { week: { key: string; mark: DayMark }[]; rest: boolean }) {
  const label = `Last seven days: ${week.map((w) => MARK_WORD[w.mark]).join(', ')}.${rest ? ' A rest day is free.' : ''}`
  return (
    <div role="img" aria-label={label} className="grid gap-1">
      <div className="grid h-2 grid-cols-7 gap-1">{week.map((w) => <span key={w.key} className={MARK_CLASS[w.mark]} />)}</div>
      <p className="hud text-[10px] text-ink-3">{rest ? 'Rest day free' : 'Rest day used'}</p>
    </div>
  )
}
