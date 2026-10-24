import { Pause, Play, Radio, Square } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Eq, Logo, PageHeader, Panel, Strip, Transport, VideoSurface } from '@/components/app/shared'
import { Listings } from '@/components/app/Listings'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { MagneticButton } from '@/components/ui/magnetic-button'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SplitButton } from '@/components/ui/split-button'
import { TextScrambleDecoder } from '@/components/ui/text-scramble-decoder'
import { fx_say, quickPlay } from '@/lib/actions'
import { dateKey, fmtClock } from '@/lib/dates'
import { play, usePlayer } from '@/lib/player'
import { dayTotal, streak, sum } from '@/lib/stats'
import { useStore } from '@/lib/store'
import type { View } from '@/components/app/Shell'

const LENGTHS = [15, 25, 45, 60]

const PRESETS: { label: string; kind: 'radio' | 'tv'; tag: string }[] = [
  { label: 'Lo-fi', kind: 'radio', tag: 'lofi' },
  { label: 'Ambient', kind: 'radio', tag: 'ambient' },
  { label: 'Documentaries', kind: 'tv', tag: 'documentary' },
  { label: 'Science', kind: 'tv', tag: 'science' },
]

function Ring({ progress, left, running, paused, ready }: { progress: number; left: number; running: boolean; paused: boolean; ready: boolean }) {
  const lots = useStore((s) => s.settings.motion >= 2)
  const R = 46
  const secs = Math.floor(left) % 60
  const ticks = useMemo(() => Array.from({ length: 60 }, (_, i) => i), [])
  return (
    <div className="relative aspect-square h-full max-h-[380px] min-h-[150px]">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        {ticks.map((i) => (
          <motion.line
            key={i}
            x1="50" y1="2" x2="50" y2={i % 5 === 0 ? 5.6 : 4.2}
            transform={`rotate(${i * 6} 50 50)`}
            strokeWidth={i % 5 === 0 ? 0.7 : 0.4}
            initial={false}
            animate={{ stroke: ready && i / 60 <= progress ? '#1d5fbf' : '#c9cdd6' }}
            transition={{ duration: 0.3 }}
          />
        ))}
        <circle cx="50" cy="50" r={R - 6} fill="none" stroke="var(--rule)" strokeWidth="1.2" />
        <motion.circle
          cx="50" cy="50" r={R - 6} fill="none" stroke="var(--signal)" strokeWidth="1.8" strokeLinecap="round"
          strokeDasharray={2 * Math.PI * (R - 6)}
          initial={false}
          animate={{ strokeDashoffset: 2 * Math.PI * (R - 6) * (1 - Math.max(0.002, progress)) }}
          transition={{ type: 'spring', stiffness: 70, damping: 20 }}
        />
      </svg>
      {lots && (
        <motion.div className="pointer-events-none absolute inset-[16%]" animate={{ rotate: -360 }} transition={{ duration: running ? 24 : 90, repeat: Infinity, ease: 'linear' }} aria-hidden>
          <svg viewBox="0 0 100 100" className="size-full"><circle cx="50" cy="50" r="49" fill="none" stroke="var(--control)" strokeWidth="0.5" strokeDasharray="1.5 3" /><circle cx="50" cy="1" r="1.6" fill="var(--ink)" /></svg>
        </motion.div>
      )}
      {/* the sweeping end-point */}
      <motion.div className="absolute inset-0" initial={false} animate={{ rotate: progress * 360 }} transition={{ type: 'spring', stiffness: 70, damping: 20 }} aria-hidden>
        <span className="absolute left-1/2 top-[8%] size-2.5 -translate-x-1/2 rounded-full bg-signal ring-4 ring-[var(--signal-soft)]" />
      </motion.div>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="fig flex items-baseline justify-center text-[44px] leading-[48px] text-ink" aria-live="off">
            {fmtClock(left).split('').map((ch, i, arr) => {
              const last = i === arr.length - 1
              return (
                <AnimatePresence mode="popLayout" key={arr.length - i} initial={false}>
                  <motion.span
                    key={last ? `${ch}-${secs}` : ch}
                    initial={{ y: last ? 14 : 0, opacity: last ? 0 : 1 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -14, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                    className="inline-block"
                  >
                    {ch}
                  </motion.span>
                </AnimatePresence>
              )
            })}
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[13px] text-ink-2">
            {running && <span className="live-dot" />}
            {!ready ? 'Ready' : paused ? 'Paused' : 'Locked in'}
          </div>
        </div>
      </div>
    </div>
  )
}

export function FocusView({ go }: { go: (v: View) => void }) {
  const session = useStore((s) => s.session)
  const sessionMin = useStore((s) => s.settings.sessionMin)
  const setSettings = useStore((s) => s.setSettings)
  const goal = useStore((s) => s.settings.dailyGoalMin)
  const today = dateKey()
  const blocked = useStore((s) => Math.round(sum(s.urgeLog[today] ?? [])))
  const held = useStore((s) => dayTotal(s.focusLog, today))
  const days = useStore((s) => streak(s.focusLog))
  const { current, status } = usePlayer()
  const recent = useStore((s) => s.recent)
  const [busy, setBusy] = useState<string | null>(null)
  const [tune, setTune] = useState(false)

  const total = (session?.goalMin ?? sessionMin) * 60
  const left = session ? Math.max(0, total - session.elapsedSec) : total
  const progress = session ? Math.min(1, session.elapsedSec / total) : 0
  const running = !!session && !session.paused

  const start = () => {
    useStore.getState().startSession(sessionMin, current ? current.kind : 'silent', current?.name ?? 'Silent focus')
    if (current && status === 'paused') play(current)
  }

  const preset = async (p: (typeof PRESETS)[number]) => {
    setBusy(p.label)
    try {
      await quickPlay(p.kind, p.tag)
    } catch {
      fx_say({ title: 'Could not reach the directory', description: 'Check your connection and try again.', variant: 'danger' })
    } finally {
      setBusy(null)
    }
  }

  const finding = session
    ? `${Math.round(session.elapsedSec / 60)} of ${session.goalMin} min held, ${session.urges} scroll${session.urges === 1 ? '' : 's'} blocked this session.`
    : held >= goal
      ? `Daily goal of ${goal} min met. ${blocked} scrolls blocked today.`
      : held > 0
        ? `${Math.round(held)} of ${goal} min today, ${blocked} scrolls blocked.`
        : 'Nothing held yet today. Lock in to start the first block.'

  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader title="Focus" sub={finding}>
        {!session && (
          <button onClick={() => setTune(true)} className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[var(--control)] bg-surface px-3 text-sm text-ink hover:bg-raised lg:hidden">
            <Radio className="size-4" /> Tune
          </button>
        )}
        <AnimatePresence mode="wait" initial={false}>
          {!session ? (
            <motion.div key="start" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
              <SplitButton
                label={`Lock in · ${sessionMin} min`}
                onClick={start}
                variant="primary"
                size="md"
                options={LENGTHS.map((m) => ({ value: String(m), label: `${m} minutes`, onSelect: () => setSettings({ sessionMin: m }) }))}
              />
            </motion.div>
          ) : (
            <motion.div key="live" className="flex items-center gap-2" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
              <MagneticButton size="md" strength={0.2} onClick={() => useStore.getState().togglePause()} className="!bg-ink !text-white hover:!bg-[#2a2a2a]">
                {session.paused ? <Play className="mr-1.5 size-3.5 fill-current" /> : <Pause className="mr-1.5 size-3.5 fill-current" />}
                {session.paused ? 'Resume' : 'Pause'}
              </MagneticButton>
              <MagneticButton size="md" variant="outline" strength={0.2} onClick={() => useStore.getState().endSession(false)}>
                <Square className="mr-1.5 size-3 fill-current" /> End
              </MagneticButton>
            </motion.div>
          )}
        </AnimatePresence>
      </PageHeader>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* session */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }} className="min-h-0">
          <Panel className="flex h-full min-h-0 flex-col gap-3 p-4 sm:p-5">
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <Ring progress={progress} left={left} running={running} paused={!!session?.paused} ready={!!session} />
            </div>
            <div className="rule pt-3">
              <Strip
                compact
                cells={[
                  { label: 'Blocked today', value: <AnimatedNumber value={blocked} />, note: 'scroll attempts' },
                  { label: 'Held today', value: <AnimatedNumber value={Math.round(held)} />, unit: 'min', note: `of ${goal} min goal` },
                  { label: 'Streak', value: <AnimatedNumber value={days} />, unit: days === 1 ? 'day' : 'days', note: '10+ min each day' },
                ]}
              />
            </div>
          </Panel>
        </motion.div>

        {/* now playing */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.2, 0, 0, 1], delay: 0.05 }} className="hidden min-h-0 lg:block">
          <Panel className="flex h-full min-h-0 flex-col gap-3 p-3">
            <div className="relative min-h-[120px] flex-1 overflow-hidden rounded-md">
              <VideoSurface className="absolute inset-0" />
              {current?.kind === 'radio' && (
                <div className="absolute inset-0 z-[4] grid place-items-center bg-signal-soft">
                  <div className="flex flex-col items-center gap-3">
                    <Logo item={current} size={64} />
                    <Eq playing={status === 'playing'} className="!h-5 [&>i]:!w-[3px]" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">
                  {current ? <TextScrambleDecoder key={current.id} text={current.name} trigger="mount" duration={700} className="!font-sans !text-sm !tracking-normal" /> : 'Nothing playing'}
                </div>
                <div className="truncate text-[13px] text-ink-2">
                  {status === 'loading' ? 'Tuning…' : status === 'error' ? 'Stream unavailable' : current?.meta || 'Pick something below'}
                </div>
              </div>
              <Transport compact />
            </div>
            <ul className="rule" aria-label="Quick tune">
              {PRESETS.map((p, i) => (
                <motion.li key={p.label} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 + i * 0.04, duration: 0.2 }}>
                  <button
                    onClick={() => void preset(p)}
                    disabled={!!busy}
                    className="group flex h-9 w-full items-center justify-between border-b border-[var(--rule)] px-1 text-left text-sm text-ink transition-colors last:border-b-0 hover:bg-raised disabled:opacity-60"
                  >
                    <span>{busy === p.label ? 'Tuning…' : p.label}</span>
                    <span className="text-[13px] text-ink-3">{p.kind === 'radio' ? 'Radio' : 'TV'}</span>
                  </button>
                </motion.li>
              ))}
            </ul>
            {recent.length > 0 && (
              <button onClick={() => play(recent[0], recent)} className="truncate px-1 text-left text-[13px] text-ink-2 hover:text-ink">
                Resume {recent[0].name}
              </button>
            )}
            <div className="flex gap-3 px-1 text-[13px]">
              <button className="text-ink underline decoration-[var(--control)] underline-offset-4 hover:decoration-ink" onClick={() => go('radio')}>Browse radio</button>
              <button className="text-ink underline decoration-[var(--control)] underline-offset-4 hover:decoration-ink" onClick={() => go('tv')}>Browse TV</button>
            </div>
          </Panel>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.2, 0, 0, 1], delay: 0.1 }} className="hidden shrink-0 [@media(min-height:780px)]:block">
        <Panel className="px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Today</h2>
            <span className="hidden text-[13px] text-ink-2 sm:inline">Focused time by source, scrolls blocked underneath</span>
          </div>
          <Listings />
        </Panel>
      </motion.div>
      <Sheet open={tune} onOpenChange={setTune}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Tune in</SheetTitle>
            <SheetDescription>Pick something to stay with, then lock in.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <ul>
              {PRESETS.map((p) => (
                <li key={p.label}>
                  <button
                    onClick={() => { setTune(false); void preset(p) }}
                    className="flex h-12 w-full items-center justify-between border-b border-[var(--rule)] text-left text-[15px] text-ink last:border-b-0"
                  >
                    <span>{p.label}</span>
                    <span className="text-sm text-ink-2">{p.kind === 'radio' ? 'Radio' : 'TV'}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <button className="h-11 flex-1 rounded-md border border-[var(--control)] text-sm" onClick={() => { setTune(false); go('radio') }}>Browse radio</button>
              <button className="h-11 flex-1 rounded-md border border-[var(--control)] text-sm" onClick={() => { setTune(false); go('tv') }}>Browse TV</button>
            </div>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </section>
  )
}
