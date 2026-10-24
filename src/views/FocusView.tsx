import { Flame, Pause, Play, Square, Zap } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { GlitchText } from '@/components/ui/glitch-text'
import { MagneticButton } from '@/components/ui/magnetic-button'
import { MorphingBlob } from '@/components/ui/morphing-blob'
import { TextScrambleDecoder } from '@/components/ui/text-scramble-decoder'
import { ThinkingOrb } from '@/components/ui/thinking-orb'
import { TorqueDial } from '@/components/ui/torque-dial'
import { Eq, Logo, Panel, Seg, Transport, VideoSurface } from '@/components/app/shared'
import { dateKey, fmtClock } from '@/lib/dates'
import { fx_say, quickPlay } from '@/lib/actions'
import { useSize } from '@/lib/hooks'
import { play, stop, usePlayer } from '@/lib/player'
import { useStore } from '@/lib/store'
import { dayTotal, streak, sum } from '@/lib/stats'
import type { View } from '@/components/app/Nav'

const LINES = [
  'The feed can wait.',
  'One thing. Right now.',
  'Boredom is a feature.',
  'Eyes up. Ears on.',
  'Your thumb can rest.',
  'Depth beats distance.',
]

const PRESETS: { label: string; kind: 'radio' | 'tv'; tag: string }[] = [
  { label: 'Lo-fi', kind: 'radio', tag: 'lofi' },
  { label: 'Ambient', kind: 'radio', tag: 'ambient' },
  { label: 'Classical', kind: 'radio', tag: 'classical' },
  { label: 'Documentaries', kind: 'tv', tag: 'documentary' },
  { label: 'Relax TV', kind: 'tv', tag: 'relax' },
  { label: 'Science TV', kind: 'tv', tag: 'science' },
]

export function FocusView({ go }: { go: (v: View) => void }) {
  const session = useStore((s) => s.session)
  const sessionMin = useStore((s) => s.settings.sessionMin)
  const setSettings = useStore((s) => s.setSettings)
  const urgesToday = useStore((s) => sum(s.urgeLog[dateKey()] ?? []))
  const focusToday = useStore((s) => dayTotal(s.focusLog, dateKey()))
  const days = useStore((s) => streak(s.focusLog))
  const goal = useStore((s) => s.settings.dailyGoalMin)
  const recent = useStore((s) => s.recent)
  const { current, status } = usePlayer()
  const [line, setLine] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [ringRef, ring] = useSize<HTMLDivElement>()

  useEffect(() => {
    const t = setInterval(() => setLine((l) => (l + 1) % LINES.length), 7000)
    return () => clearInterval(t)
  }, [])

  const total = (session?.goalMin ?? sessionMin) * 60
  const left = session ? Math.max(0, total - session.elapsedSec) : total
  const progress = session ? Math.min(1, session.elapsedSec / total) : 0
  const sec = Math.floor(left) % 60
  const running = !!session && !session.paused

  const orbState = !session ? 'breathing' : session.paused ? 'searching' : status === 'playing' ? 'listening' : 'working'
  const ticks = useMemo(() => Array.from({ length: 60 }, (_, i) => i), [])

  const start = () => {
    const src = current ? current.kind : 'silent'
    useStore.getState().startSession(sessionMin, src, current?.name ?? 'Silent focus')
    if (current && status === 'paused') play(current)
    fx_say({ title: 'Locked in', description: `${sessionMin} minutes. Scrolling is disabled on this site.`, variant: 'success' })
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

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 lg:flex-row lg:gap-6">
      {/* ───── Timer ───── */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-between gap-2">
        <div className="text-center">
          <GlitchText
            as="h1"
            text="ANTI-SCROLL"
            variant="rgb-split"
            intensity="medium"
            color1="#c8ff3d"
            color2="#ff3df2"
            repeatDelay={3.2}
            className="font-display text-[clamp(1.5rem,5.5vw,3rem)] font-black leading-none text-white"
          />
          <div className="mt-1 h-5 text-xs font-medium uppercase tracking-[0.3em] text-violet-200/70">
            <TextScrambleDecoder key={line} text={LINES[line]} trigger="mount" duration={900} />
          </div>
        </div>

        <div ref={ringRef} className="relative my-auto aspect-square h-[min(44dvh,80vw)] max-h-full min-h-[190px]">
          <motion.div
            className="absolute inset-0"
            animate={running ? { scale: [1, 1.012, 1] } : { scale: 1 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <defs>
                <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#c8ff3d" />
                  <stop offset="0.55" stopColor="#a855f7" />
                  <stop offset="1" stopColor="#ff3df2" />
                </linearGradient>
                <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="1.6" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="2.2" />
              {ticks.map((i) => (
                <line
                  key={i}
                  x1="50"
                  y1="2.5"
                  x2="50"
                  y2={i % 5 === 0 ? 6.2 : 4.6}
                  stroke={i / 60 <= progress && session ? '#c8ff3d' : 'rgba(255,255,255,.22)'}
                  strokeWidth={i % 5 === 0 ? 0.8 : 0.4}
                  transform={`rotate(${i * 6} 50 50)`}
                />
              ))}
              <motion.circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="url(#ring)"
                strokeWidth="3.2"
                strokeLinecap="round"
                filter="url(#glow)"
                initial={false}
                animate={{ pathLength: Math.max(0.004, progress) }}
                transition={{ type: 'spring', stiffness: 60, damping: 18 }}
              />
            </svg>
          </motion.div>

          {/* two counter-rotating orbit rings */}
          <motion.div className="absolute inset-[7%] rounded-full border border-dashed border-violet-300/20" animate={{ rotate: 360 }} transition={{ duration: running ? 40 : 160, repeat: Infinity, ease: 'linear' }}>
            <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-lime-300 shadow-[0_0_14px_#c8ff3d]" />
          </motion.div>
          <motion.div className="absolute inset-[15%] rounded-full border border-fuchsia-400/20" animate={{ rotate: -360 }} transition={{ duration: running ? 26 : 110, repeat: Infinity, ease: 'linear' }}>
            <span className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-fuchsia-400 shadow-[0_0_12px_#ff3df2]" />
          </motion.div>

          <div className="absolute inset-0 grid place-items-center">
            <div className="absolute opacity-80 [&>div]:mix-blend-screen">
              <ThinkingOrb state={orbState} size={Math.max(120, ring.w * 0.6)} dark speed={running ? 1.4 : 0.8} />
            </div>
            <div className="relative text-center">
              <div className="tnum font-display text-[clamp(2.2rem,9vw,4.6rem)] font-black leading-none text-white drop-shadow-[0_0_24px_rgba(168,85,247,.8)]">
                {fmtClock(left).split('').map((ch, i, arr) => (
                  <AnimatePresence mode="popLayout" key={arr.length - i}>
                    <motion.span
                      key={ch + (i === arr.length - 1 ? sec : '')}
                      initial={{ y: i === arr.length - 1 ? 16 : 0, opacity: i === arr.length - 1 ? 0 : 1 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -16, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                      className="inline-block"
                    >
                      {ch}
                    </motion.span>
                  </AnimatePresence>
                ))}
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-lime-300/90">
                {!session ? 'ready' : session.paused ? 'paused' : 'locked in'}
              </div>
            </div>
          </div>
        </div>

        {/* stats */}
        <div className="grid w-full max-w-md grid-cols-3 gap-2">
          {[
            { label: 'Resisted', node: <AnimatedNumber value={urgesToday} className="text-fuchsia-300" />, icon: <Zap className="h-3.5 w-3.5 text-fuchsia-300" /> },
            { label: 'Day streak', node: <AnimatedNumber value={days} className="text-lime-300" />, icon: <Flame className="h-3.5 w-3.5 text-lime-300" /> },
            { label: `Of ${goal}m goal`, node: <AnimatedNumber value={Math.round(focusToday)} suffix="m" className="text-violet-200" />, icon: null },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.08, type: 'spring', stiffness: 220, damping: 20 }}
              className="glass rounded-2xl px-3 py-2 text-center"
            >
              <div className="font-display text-xl font-extrabold leading-none">{s.node}</div>
              <div className="mt-1 flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-white/50">
                {s.icon}
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* controls */}
        <div className="flex w-full max-w-md items-center justify-center gap-4 pb-1">
          <AnimatePresence mode="wait" initial={false}>
            {!session ? (
              <motion.div key="idle" className="flex items-center gap-5" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}>
                <TorqueDial value={sessionMin} min={5} max={120} step={5} unit="m" size={84} label="Session length" onChange={(v) => setSettings({ sessionMin: v })} />
                <MagneticButton size="lg" glow onClick={start} strength={0.35} className="!bg-lime-300 !text-black hover:!bg-lime-200">
                  <Play className="mr-2 h-4 w-4 fill-current" /> Lock in
                </MagneticButton>
              </motion.div>
            ) : (
              <motion.div key="live" className="flex items-center gap-3" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}>
                <MagneticButton size="lg" glow onClick={() => useStore.getState().togglePause()} className="!bg-lime-300 !text-black hover:!bg-lime-200">
                  {session.paused ? <Play className="mr-2 h-4 w-4 fill-current" /> : <Pause className="mr-2 h-4 w-4 fill-current" />}
                  {session.paused ? 'Resume' : 'Pause'}
                </MagneticButton>
                <MagneticButton size="lg" variant="outline" onClick={() => useStore.getState().endSession(false)}>
                  <Square className="mr-2 h-3.5 w-3.5 fill-current" /> End
                </MagneticButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ───── Now playing ───── */}
      <aside className="flex min-h-0 shrink-0 flex-col gap-3 lg:w-[360px]">
        <Panel className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
          <div className="relative min-h-[110px] flex-1 overflow-hidden rounded-2xl">
            <div className={current?.kind === 'tv' ? 'absolute inset-0' : 'invisible absolute inset-0'}>
              <VideoSurface className="h-full w-full" />
            </div>
            {current?.kind !== 'tv' && (
              <div className="absolute inset-0 grid place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-950/60 to-fuchsia-950/40">
                <MorphingBlob width={260} height={260} baseRadius={78} variance={22} speed={running ? 1.4 : 0.7} colors={['#a855f7', '#c8ff3d']} className="absolute inset-0 m-auto opacity-70" />
                <div className="relative flex flex-col items-center gap-2">
                  {current ? <Logo item={current} size={64} /> : <div className="font-display text-sm text-white/60">Silence is allowed too</div>}
                  {current && <Eq playing={status === 'playing'} className="text-2xl" />}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{current?.name ?? 'Nothing playing'}</div>
              <div className="truncate text-xs text-white/50">
                {status === 'loading' ? 'Connecting…' : status === 'error' ? 'Stream unavailable' : current?.meta || 'Pick a station or channel'}
              </div>
            </div>
            <Transport compact />
          </div>

          {session && (
            <Seg
              id="src"
              value={current?.kind ?? 'silent'}
              onChange={(id) => id === 'radio' ? go('radio') : id === 'tv' ? go('tv') : stop()}
              tabs={[{ id: 'radio', label: 'Radio' }, { id: 'tv', label: 'TV' }, { id: 'silent', label: 'Silent' }]}
            />
          )}

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p, i) => (
              <motion.button
                key={p.label}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.05, type: 'spring', stiffness: 300, damping: 18 }}
                whileHover={{ scale: 1.07, y: -2 }}
                whileTap={{ scale: 0.92 }}
                disabled={!!busy}
                onClick={() => preset(p)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-lime-300/60 hover:text-lime-200 disabled:opacity-50"
              >
                {busy === p.label ? 'Tuning…' : p.label}
              </motion.button>
            ))}
          </div>

          {recent.length > 0 && !session && (
            <div className="hidden min-h-0 gap-1.5 overflow-hidden sm:flex sm:flex-wrap">
              {recent.slice(0, 3).map((r) => (
                <button key={r.id} onClick={() => play(r, recent)} className="flex max-w-full items-center gap-2 rounded-xl bg-white/5 px-2 py-1 text-left text-xs text-white/70 hover:bg-white/10">
                  <Logo item={r} size={22} />
                  <span className="truncate">{r.name}</span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </aside>
    </section>
  )
}

