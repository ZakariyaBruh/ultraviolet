import { Pause, Play, Radio } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'
import { Glass } from '@/components/app/glass'
import { Listings } from '@/components/app/Listings'
import { Logo, Panel, Readout } from '@/components/app/shared'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { DragToConfirm } from '@/components/ui/drag-to-confirm'
import { NeonEdgeButton } from '@/components/ui/neon-edge-button'
import { Stepper } from '@/components/ui/stepper'
import { ThinkingOrb } from '@/components/ui/thinking-orb'
import { fx_say, quickPlay } from '@/lib/actions'
import { PRESETS } from '@/lib/commands'
import { dateKey, fmtClock } from '@/lib/dates'
import { useMedia } from '@/lib/hooks'
import { play, usePlayer } from '@/lib/player'
import { dayTotal, streak, sum } from '@/lib/stats'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import type { View } from '@/components/app/Shell'

const LENGTHS = [15, 25, 45, 60]

/** The timer is a lens of glass: the ring is the only bright thing, and the picture behind bends through the rest. */
function LensTimer({ progress, left, running, paused, live }: { progress: number; left: number; running: boolean; paused: boolean; live: boolean }) {
  const lots = useStore((s) => s.settings.motion >= 2)
  const { status } = usePlayer()
  const R = 44
  const secs = Math.floor(left) % 60
  const ticks = useMemo(() => Array.from({ length: 60 }, (_, i) => i), [])
  const orb = !live ? 'breathing' : paused ? 'searching' : status === 'playing' ? 'listening' : 'working'
  return (
    <Glass lens radius={9999} className="relative aspect-square h-[min(36dvh,360px)] min-h-[200px] max-lg:h-[min(30dvh,250px)] shrink-0">
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        {ticks.map((i) => (
          <line key={i} x1="50" y1="3.5" x2="50" y2={i % 5 === 0 ? 7 : 5.4} transform={`rotate(${i * 6} 50 50)`} strokeWidth={i % 5 === 0 ? 0.55 : 0.3} stroke={live && i / 60 <= progress ? '#6ee7ff' : 'rgba(255,255,255,0.28)'} />
        ))}
        <circle cx="50" cy="50" r={R - 4} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <motion.circle
          cx="50" cy="50" r={R - 4} fill="none" stroke="var(--signal)" strokeWidth="1.6" strokeLinecap="round"
          strokeDasharray={2 * Math.PI * (R - 4)}
          initial={false}
          animate={{ strokeDashoffset: 2 * Math.PI * (R - 4) * (1 - Math.max(0.003, progress)) }}
          transition={{ type: 'spring', stiffness: 70, damping: 20 }}
          style={{ filter: 'drop-shadow(0 0 2.5px rgba(110,231,255,0.9))' }}
        />
      </svg>
      <motion.div className="pointer-events-none absolute inset-0" initial={false} animate={{ rotate: progress * 360 }} transition={{ type: 'spring', stiffness: 70, damping: 20 }} aria-hidden>
        <span className="absolute left-1/2 top-[11%] size-2.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_14px_3px_rgba(110,231,255,0.9)]" />
      </motion.div>
      {lots && (
        <motion.div className="pointer-events-none absolute inset-[15%]" animate={{ rotate: -360 }} transition={{ duration: running ? 24 : 90, repeat: Infinity, ease: 'linear' }} aria-hidden>
          <svg viewBox="0 0 100 100" className="size-full"><circle cx="50" cy="50" r="49" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" strokeDasharray="1.5 3" /><circle cx="50" cy="1" r="1.5" fill="#fff" /></svg>
        </motion.div>
      )}
      <div className="absolute inset-0 grid place-items-center">
        <div className="absolute opacity-60 mix-blend-screen" aria-hidden><ThinkingOrb state={orb} size={150} speed={running ? 1.5 : 0.8} dark /></div>
        <div className="relative text-center">
          <div className="fig flex items-baseline justify-center text-[clamp(2.4rem,7.5vw,4.1rem)] font-light leading-none text-ink [text-shadow:0_0_24px_rgba(110,231,255,0.35)]">
            {fmtClock(left).split('').map((ch, i, arr) => {
              const last = i === arr.length - 1
              return (
                <AnimatePresence mode="popLayout" key={arr.length - i} initial={false}>
                  <motion.span key={last ? `${ch}-${secs}` : ch} initial={{ y: last ? 14 : 0, opacity: last ? 0 : 1 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 34 }} className="inline-block">
                    {ch}
                  </motion.span>
                </AnimatePresence>
              )
            })}
          </div>
          <div className="hud mt-2 flex items-center justify-center gap-2">
            {running && <span className="live-dot" />}
            {!live ? 'Ready' : paused ? 'Paused' : 'Locked in'}
          </div>
        </div>
      </div>
    </Glass>
  )
}

export function FocusView({ go }: { go: (v: View) => void }) {
  const session = useStore((s) => s.session)
  const sessionMin = useStore((s) => s.settings.sessionMin)
  const setSettings = useStore((s) => s.setSettings)
  const focusLog = useStore((s) => s.focusLog)
  const urgeLog = useStore((s) => s.urgeLog)
  const goal = useStore((s) => s.settings.dailyGoalMin)
  const { current, status } = usePlayer()
  const recent = useStore((s) => s.recent)
  const set = useUI((s) => s.set)
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
    ? `${Math.round(session.elapsedSec / 60)} of ${session.goalMin} min held, ${session.urges} scroll${session.urges === 1 ? '' : 's'} blocked.`
    : held >= goal
      ? `Daily goal of ${goal} min met. ${blocked} scrolls blocked today.`
      : held > 0
        ? `${Math.round(held)} of ${goal} min today, ${blocked} scrolls blocked.`
        : 'Nothing held yet today. Choose a length, tune in, lock in.'

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 lg:gap-4">
      {!wide && (
        <div>
          <div className="hud mb-1 flex items-center gap-2"><span className="inline-block h-px w-5 bg-signal/70" />{session ? 'Session live' : 'Ready'}</div>
          <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.02em]">Focus</h1>
          <p className="mt-0.5 text-[13px] text-ink-2">{finding}</p>
        </div>
      )}
      <div className="grid min-h-0 flex-1 items-center gap-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {wide && (
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }} className="min-w-0 self-center">
            <div className="hud mb-2 flex items-center gap-2"><span className="inline-block h-px w-5 bg-signal/70" />{session ? 'Session live' : 'Ready'}</div>
            <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.02em]">Focus</h1>
            <p className="mb-4 mt-1 max-w-[34ch] text-sm text-ink-2">{finding}</p>
            <Panel className="grid gap-4 p-5">
              <Readout label="Blocked today" value={<AnimatedNumber value={blocked} />} note="scroll attempts" />
              <div className="h-px bg-white/10" />
              <Readout label="Held today" value={<AnimatedNumber value={Math.round(held)} />} unit="min" note={`of ${goal} min goal`} />
              <div className="h-px bg-white/10" />
              <Readout label="Streak" value={<AnimatedNumber value={days} />} unit={days === 1 ? 'day' : 'days'} note="10+ min each day" />
            </Panel>
          </motion.div>
        )}

        <div className="flex min-w-0 flex-col items-center gap-4 justify-self-center">
          <LensTimer progress={progress} left={left} running={running} paused={!!session?.paused} live={!!session} />

          <AnimatePresence mode="wait" initial={false}>
            {!session ? (
              <motion.div key="idle" className="flex flex-col items-center gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}>
                <div className="flex items-center gap-2">
                  <NeonEdgeButton onClick={start} className="!h-12 !px-7 !text-[15px]">
                    <span className="whitespace-nowrap">Lock in · {sessionMin} min</span>
                  </NeonEdgeButton>
                </div>
                <div className="flex items-center gap-1.5" role="group" aria-label="Session length">
                  {LENGTHS.map((m) => (
                    <button key={m} onClick={() => setSettings({ sessionMin: m })} aria-pressed={sessionMin === m} className={`fig h-9 rounded-full px-3.5 text-[13px] transition-colors ${sessionMin === m ? 'bg-white/15 text-ink ring-1 ring-white/25' : 'text-ink-2 hover:bg-white/10'}`}>
                      {m}m
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div key="live" className="flex w-full max-w-[420px] flex-col items-center gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}>
                <Glass radius={999} clear as="button" onClick={() => useStore.getState().togglePause()} className="inline-flex h-12 items-center gap-2 px-7 text-[15px] font-medium text-ink">
                  {session.paused ? <Play className="size-4 fill-current" /> : <Pause className="size-4 fill-current" />}
                  {session.paused ? 'Resume' : 'Pause'}
                </Glass>
                <div className="w-full">
                  <DragToConfirm label="Slide to end session" confirmedLabel="Ended" actionType="delete" size="md" onConfirm={() => useStore.getState().endSession(false)} />
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
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-base font-semibold">Tune in</h2>
                <button onClick={() => set({ tuneOpen: true })} className="text-[13px] text-signal hover:underline">All sources</button>
              </div>
              <ul>
                {PRESETS.slice(0, 5).map((p, i) => (
                  <motion.li key={p.label} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.04, duration: 0.2 }}>
                    <button onClick={() => void quickPlay(p.kind, p.tag).catch(() => fx_say({ title: 'Could not reach the directory', variant: 'danger' }))} className="flex h-10 w-full items-center justify-between border-b border-white/10 text-left text-sm text-ink transition-colors last:border-b-0 hover:text-signal">
                      <span>{p.label}</span>
                      <span className="hud !tracking-[0.1em]">{p.kind === 'radio' ? 'Radio' : 'TV'}</span>
                    </button>
                  </motion.li>
                ))}
              </ul>
              {recent[0] && (
                <button onClick={() => play(recent[0], recent)} className="mt-3 flex w-full items-center gap-2 rounded-xl bg-white/[0.05] p-2 text-left text-[13px] text-ink-2 hover:bg-white/10">
                  <Logo item={recent[0]} size={28} />
                  <span className="min-w-0 truncate">Resume {recent[0].name}</span>
                </button>
              )}
              <div className="mt-3 flex gap-2">
                <button className="h-9 flex-1 rounded-full border border-white/15 text-[13px] text-ink hover:bg-white/10" onClick={() => go('radio')}><Radio className="mr-1.5 inline size-3.5" />Browse radio</button>
                <button className="h-9 flex-1 rounded-full border border-white/15 text-[13px] text-ink hover:bg-white/10" onClick={() => go('tv')}>Browse TV</button>
              </div>
            </Panel>
          </motion.div>
        )}
      </div>

      {wide && tall && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26, ease: [0.2, 0, 0, 1], delay: 0.1 }} className="shrink-0">
          <Panel className="px-5 pb-3 pt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-base font-semibold">Today</h2>
              <span className="hidden text-[13px] text-ink-2 sm:inline">Focused time by source, blocked scrolls underneath</span>
            </div>
            <Listings />
          </Panel>
        </motion.div>
      )}
      {!wide && (
        <div className="grid grid-cols-3 gap-2">
          {[{ l: 'Blocked', v: blocked, u: '' }, { l: 'Held', v: Math.round(held), u: 'min' }, { l: 'Streak', v: days, u: 'd' }].map((r) => (
            <Panel key={r.l} className="px-3 py-2.5">
              <div className="hud">{r.l}</div>
              <div className="fig mt-0.5 text-2xl text-ink"><AnimatedNumber value={r.v} />{r.u && <span className="ml-1 text-sm text-ink-2">{r.u}</span>}</div>
            </Panel>
          ))}
        </div>
      )}
    </section>
  )
}
