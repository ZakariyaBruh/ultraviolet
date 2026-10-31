import { Coffee, Hourglass, Play, Radio, Volume2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Glass } from '@/components/app/glass'
import { LengthBand } from '@/components/app/LengthBand'
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
import { PRESETS } from '@/lib/commands'
import { nextTier, rateAt } from '@/lib/credits'
import { dateKey, fmtClock } from '@/lib/dates'
import { useMedia } from '@/lib/hooks'
import { play, usePlayer } from '@/lib/player'
import { dayTotal, streak, sum } from '@/lib/stats'
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
        <div className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-ice transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%` }} />
        <div className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 border border-ice bg-black" style={{ left: `${progress * 100}%` }} />
      </div>
    </Glass>
  )
}

/** On a break the dial says so, and for how long. With the Break kit it also breathes with you and offers a stretch. */
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

/** What this session is paying, live: the rate climbs while you stay clean and drops back at a drift. */
function CreditMeter() {
  const cleanSec = useStore((x) => x.session?.cleanSec ?? 0)
  const credit = useStore((x) => x.session?.credit ?? 0)
  const shields = useStore((x) => itemsOf(x.credits).shields)
  const next = nextTier(cleanSec)
  return (
    <p className="hud flex flex-col items-center text-center !text-[12px] leading-[1.5] ![text-shadow:0_0_5px_var(--ground),0_0_5px_var(--ground),0_0_2px_var(--ground)]" role="status" aria-live="off">
      <span><span className="fig text-ink">{rateAt(cleanSec)}</span> credits a min · clean <span className="fig text-ink">{fmtClock(Math.floor(cleanSec))}</span> · +<span className="fig text-ink">{Math.floor(credit)}</span></span>
      {next && <span className="text-ink-3">{next.rate} a min in <span className="fig">{fmtClock(Math.ceil(next.inSec))}</span> if you stay{shields > 0 && <> · shield <span className="fig text-signal">×{shields}</span></>}</span>}
      {!next && shields > 0 && <span className="text-ink-3">shield <span className="fig text-signal">×{shields}</span> ready</span>}
    </p>
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

export function FocusView({ go }: { go: (v: View) => void }) {
  const session = useStore((s) => s.session)
  const credits = useStore((s) => s.credits)
  const items = itemsOf(credits)
  const breaks = items.breaks
  const longBreaks = items.longBreaks
  const hasSound = items.owned.includes('sound')
  const hasKit = items.owned.includes('kit')
  const dial = (items.owned.includes('solids') && items.dial ? items.dial : 'torus') as Shape
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

  const total = (session?.goalMin ?? sessionMin) * 60
  const left = session ? Math.max(0, total - session.elapsedSec) : total
  const progress = session ? Math.min(1, session.elapsedSec / total) : 0
  const running = !!session && !session.paused

  const held = dayTotal(focusLog, today)
  const blocked = Math.round(sum(urgeLog[today] ?? []))
  const days = streak(focusLog)

  const start = () => {
    useStore.getState().startSession(sessionMin, current ? current.kind : 'silent', current?.name ?? 'Silent focus')
    if (current && status === 'paused') play(current)
  }

  const step = session ? 2 : current ? 2 : 1

  const finding = session
    ? `${Math.round(session.elapsedSec / 60)} of ${session.goalMin} min held, ${session.urges} drift${session.urges === 1 ? '' : 's'}.`
    : held >= goal
      ? `Daily goal of ${goal} min met. ${blocked} drifts today.`
      : held > 0
        ? `${Math.round(held)} of ${goal} min today, ${blocked} drifts.`
        : 'Nothing held yet today. Choose a length, tune in, lock in.'

  return (
    <section className={`relative flex h-full min-h-0 flex-col gap-3 lg:gap-4 ${wide ? '' : '[justify-content:safe_center]'}`}>
      {!wide && (
        <div>
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
              <Readout label="Streak" value={<AnimatedNumber value={days} />} unit={days === 1 ? 'day' : 'days'} note="10+ min each day" />
            </Panel>
          </motion.div>
        )}

        <div data-movable="timer" className="flex min-w-0 flex-col items-center gap-4 justify-self-center">
          <FrictionDial progress={progress} left={left} running={running} paused={!!session?.paused} live={!!session} shape={dial} note={session ? (session.breakUntil ? <BreakClock until={session.breakUntil} kit={hasKit} /> : <CreditMeter />) : undefined} />

          <AnimatePresence mode="wait" initial={false}>
            {!session ? (
              <motion.div key="idle" className="flex flex-col items-center gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}>
                <div className="flex items-center gap-2">
                  <button onClick={start} className="h-14 w-full min-w-[17rem] max-w-[420px] bg-signal px-7 font-[family-name:var(--font-cond)] text-[19px] font-bold uppercase tracking-[0.1em] text-on-signal hover:brightness-110 sm:w-[19rem]">Lock in</button>
                </div>
                <LengthBand value={sessionMin} onChange={(m) => setSettings({ sessionMin: m })} />
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
                <div className="w-full">
                  <DragToConfirm className="slide-end" label="Slide to end session" confirmedLabel="Ended" size="md" onConfirm={() => useStore.getState().endSession(false)} />
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
          {[{ l: 'Drifts', v: blocked, u: '' }, { l: 'Held', v: Math.round(held), u: 'min' }, { l: 'Streak', v: days, u: 'd' }].map((r) => (
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
