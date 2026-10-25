import { Apple, ArrowUpDown, Bird, Car, CircleDot, Coins, Crosshair, Disc, Footprints, Ghost, Hammer, Layers, LayoutGrid, Lock, Mountain, Orbit, Pause, PlaneLanding, Play as PlayIcon, Rocket, ShoppingBasket, Skull, Target, Volume2, VolumeX, Worm, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PageHeader, Panel } from '@/components/app/shared'
import { Scrubber } from '@/components/app/Scrubber'
import { COST, GAMES } from '@/games'
import { runGame, type Game, type Key } from '@/games/engine'
import { useCoarse, useGridFit, useSize } from '@/lib/hooks'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = { dodge: Rocket, catch: ShoppingBasket, pong: CircleDot, breakout: LayoutGrid, snake: Worm, flap: Bird, runner: Footprints, invaders: Skull, asteroids: Disc, whack: Hammer, aim: Target, stack: Layers, cross: Car, tunnel: Mountain, orbit: Orbit, gravity: ArrowUpDown, slash: Apple, turret: Crosshair, maze: Ghost, lander: PlaneLanding }
const MUTE = 'friction:arcade-mute'
const readMute = () => { try { return localStorage.getItem(MUTE) === '1' } catch { return false } }

const PADS: Record<Key, string> = { left: '◀', right: '▶', up: '▲', down: '▼', act: 'GO' }

function Play({ game, onExit }: { game: Game; onExit: () => void }) {
  const best = useStore((s) => s.credits.best[game.id] ?? 0)
  const bal = useStore((s) => s.credits.bal)
  const live = useStore((s) => !!s.session)
  const coarse = useCoarse()
  const cv = useRef<HTMLCanvasElement>(null)
  const [box, { w: bw, h: bh }] = useSize<HTMLDivElement>()
  const cw = Math.max(0, Math.min(bw, bh * 1.5))
  const run = useRef<ReturnType<typeof runGame> | null>(null)
  const [phase, setPhase] = useState<'ready' | 'play' | 'over'>('ready')
  const [score, setScore] = useState(0)
  const [fresh, setFresh] = useState(false)
  const [why, setWhy] = useState<'out' | 'time'>('out')
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(readMute)
  const settings = useStore((s) => s.settings)

  const start = () => {
    if (live || !useStore.getState().spendCredits(COST, `Played ${game.name}`)) return
    run.current?.stop()
    setPhase('play'); setFresh(false); setPaused(false)
    requestAnimationFrame(() => {
      if (!cv.current) return
      const calm = settings.motion === 0 || matchMedia('(prefers-reduced-motion: reduce)').matches
      run.current = runGame(cv.current, game, {
        motion: !calm, volume: settings.volume, muted, best,
        onPause: setPaused,
        onEnd: (sc, w) => {
          const prev = useStore.getState().credits.best[game.id] ?? 0
          useStore.getState().setBest(game.id, sc)
          setScore(sc); setWhy(w); setFresh(sc > prev && sc > 0); setPhase('over'); setPaused(false)
        },
      })
    })
  }
  useEffect(() => () => run.current?.stop(), [])
  // leaving the tab ends nothing; locking in mid-round stops it
  useEffect(() => { if (live && phase === 'play') { run.current?.stop(); setPhase('over') } }, [live, phase])
  const can = !live && bal >= COST

  return (
    <Panel className="flex min-h-0 flex-1 flex-col gap-2 p-3">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="dot truncate text-lg font-bold uppercase">{game.name}</h2>
          <p className="truncate text-[13px] text-ink-2">{game.how}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {phase === 'play' && <button onClick={(e) => { run.current?.pause(!paused); e.currentTarget.blur() }} aria-label={paused ? 'Resume' : 'Pause'} className="grid size-11 place-items-center border border-ink/30 hover:bg-ink/10">{paused ? <PlayIcon className="size-4" /> : <Pause className="size-4" />}</button>}
          <button onClick={(e) => { e.currentTarget.blur(); const m = !muted; setMuted(m); run.current?.mute(m); try { localStorage.setItem(MUTE, m ? '1' : '0') } catch { /* private mode */ } }} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={muted} className="grid size-11 place-items-center border border-ink/30 hover:bg-ink/10">{muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}</button>
          <button onClick={() => { run.current?.stop(); onExit() }} className="h-11 border border-ink/30 px-4 text-sm hover:bg-ink/10">All games</button>
        </div>
      </div>
      <div ref={box} className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="relative" style={{ width: cw, height: cw / 1.5 }}>
          <canvas ref={cv} role="img" aria-label={`${game.name}: ${game.how}`} className="size-full touch-none border border-rule bg-ground" />
          {phase !== 'play' && (
            <div className="absolute inset-0 grid place-content-center justify-items-center gap-2 bg-ground/60 p-4 text-center">
              {phase === 'over' && <p className="hud">{why === 'time' ? 'Time' : 'Game over'}</p>}
              {phase === 'over' && <p className="dot text-4xl font-bold" role="status">{score}</p>}
              {phase === 'over' && <p className="hud">{fresh ? 'New best' : `Best ${best}`}</p>}
              {phase === 'ready' && <p className="text-sm text-ink-2">Best {best}. A round is {COST} credits. It ends when you lose, or after 75 seconds. Press P to pause.</p>}
              <button onClick={start} disabled={!can} className="h-11 bg-signal px-6 text-sm font-semibold text-on-signal disabled:opacity-40">{phase === 'over' ? 'Play again' : 'Start'} · {COST} credits</button>
              {live ? <p className="inline-flex items-center gap-1.5 text-[13px] text-ink-2" role="status"><Lock className="size-3.5" />You are locked in. Games open when you finish.</p> : bal < COST ? <p className="text-[13px] text-ink-2" role="status">You need {COST - bal} more credit{COST - bal === 1 ? '' : 's'}. Lock in to earn them.</p> : null}
            </div>
          )}
        </div>
      </div>
      {coarse && game.pad.length > 0 && phase === 'play' && (
        <div className="flex shrink-0 items-center justify-center gap-2" aria-label="Controls">
          {game.pad.map((k) => (
            <button key={k} aria-label={k === 'act' ? 'Action' : k} onPointerDown={(e) => { e.preventDefault(); run.current?.press(k, true) }} onPointerUp={() => run.current?.press(k, false)} onPointerLeave={() => run.current?.press(k, false)} onPointerCancel={() => run.current?.press(k, false)} className={cn('h-12 min-w-14 touch-none select-none border border-ink/40 px-3 text-lg active:bg-signal active:text-on-signal', k === 'act' && 'min-w-24 font-semibold')}>{PADS[k]}</button>
          ))}
        </div>
      )}
    </Panel>
  )
}

function Ic({ id }: { id: string }) { const I = ICONS[id] ?? Rocket; return <I className="size-4 shrink-0 text-signal" aria-hidden /> }

export function ArcadeView() {
  const cr = useStore((s) => s.credits)
  const live = useStore((s) => !!s.session)
  const [game, setGame] = useState<Game | null>(null)
  const [page, setPage] = useState(1)
  const { ref, per, cols } = useGridFit(190, 84, 8, 5)
  const pages = Math.max(1, Math.ceil(GAMES.length / per))
  const safe = Math.min(page, pages)
  const slice = GAMES.slice((safe - 1) * per, safe * per)
  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader kicker="Arcade" title="Arcade" sub="Credits come from real work: 1 per focused minute, 5 for a finished session, 6 for a lesson, 4 for a sharp trivia round. Spend them here.">
        <div className="flex items-center gap-4 text-sm" aria-label="Your credits">
          <span className="inline-flex items-center gap-1.5"><Coins className="size-4 text-signal" /><span className="fig font-semibold" role="status">{cr.bal}</span> credits</span>
          <span className="text-ink-2 max-sm:hidden"><span className="fig">{cr.earned}</span> earned · <span className="fig">{cr.spent}</span> spent</span>
        </div>
      </PageHeader>
      {game ? <Play key={game.id} game={game} onExit={() => setGame(null)} /> : (
        <>
          <p className="hud shrink-0" role="status">{live ? 'Locked in: the arcade opens when you finish' : cr.bal >= COST ? `${GAMES.length} games, ${COST} credits a round` : `Not enough credits yet. A round costs ${COST}.`}</p>
          <div ref={ref} className="min-h-[84px] flex-1 overflow-hidden">
            <div className="grid h-full content-start gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: '84px' }}>
              {slice.map((g) => (
                <button key={g.id} onClick={() => setGame(g)} className="material flex h-[84px] min-w-0 flex-col justify-between p-3 text-left hover:bg-ink/5">
                  <span className="flex items-baseline justify-between gap-2"><span className="flex min-w-0 items-center gap-2"><Ic id={g.id} /><span className="truncate text-[15px] font-semibold">{g.name}</span></span><span className="fig shrink-0 text-[12px] text-signal">{cr.best[g.id] ? `Best ${cr.best[g.id]}` : ''}</span></span>
                  <span className="line-clamp-2 text-[13px] leading-[17px] text-ink-2">{g.blurb}</span>
                </button>
              ))}
            </div>
          </div>
          <Scrubber count={GAMES.length} per={per} page={safe} onPage={setPage} labelAt={(i) => GAMES[i]?.name ?? ''} />
        </>
      )}
    </section>
  )
}
