import { Apple, ArrowUpDown, Car, CircleDot, Coins, Crosshair, Disc, Ghost, Layers, LayoutGrid, Lock, Mountain, Orbit, Pause, PlaneLanding, Play as PlayIcon, Rocket, Skull, Swords, Volume2, VolumeX, Worm, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AsciiSolid } from '@/components/app/AsciiSolid'
import { Panel, Seg } from '@/components/app/shared'
import { Shop } from '@/components/app/Shop'
import { Scrubber } from '@/components/app/Scrubber'
import { COST, GAMES } from '@/games'
import { runGame, type Game, type Key } from '@/games/engine'
import { useCoarse, useGridFit, useSize } from '@/lib/hooks'
import { CONTINUE_COST } from '@/lib/credits'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = { dodge: Rocket, pong: CircleDot, breakout: LayoutGrid, snake: Worm, invaders: Skull, asteroids: Disc, stack: Layers, cross: Car, tunnel: Mountain, orbit: Orbit, gravity: ArrowUpDown, slash: Apple, turret: Crosshair, maze: Ghost, lander: PlaneLanding, rogue: Swords }
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
  const [canContinue, setCanContinue] = useState(false)
  const price = game.cost ?? COST
  const [muted, setMuted] = useState(readMute)
  const settings = useStore((s) => s.settings)

  const start = () => {
    if (live || !useStore.getState().spendCredits(price, `Played ${game.name}`)) return
    run.current?.stop()
    setPhase('play'); setFresh(false); setPaused(false); setCanContinue(false)
    requestAnimationFrame(() => {
      if (!cv.current) return
      const calm = settings.motion === 0 || matchMedia('(prefers-reduced-motion: reduce)').matches
      run.current = runGame(cv.current, game, {
        motion: !calm, volume: settings.volume, muted, best,
        onPause: setPaused,
        onEnd: (sc, w, cc) => {
          const prev = useStore.getState().credits.best[game.id] ?? 0
          useStore.getState().setBest(game.id, sc)
          setScore(sc); setWhy(w); setFresh(sc > prev && sc > 0); setPhase('over'); setPaused(false); setCanContinue(cc)
        },
      })
    })
  }
  useEffect(() => () => run.current?.stop(), [])
  // leaving the tab ends nothing; locking in mid-round stops it
  useEffect(() => { if (live && phase === 'play') { run.current?.stop(); setPhase('over') } }, [live, phase])
  const can = !live && bal >= price
  const again = () => {
    if (live || !useStore.getState().spendCredits(CONTINUE_COST, `Continued ${game.name}`)) return
    setCanContinue(false); setPhase('play'); setPaused(false)
    run.current?.revive()
  }

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
              {phase === 'ready' && <p className="text-sm text-ink-2">Best {best}. A round is {price} credits. It ends when you lose, or after {game.round ?? 75} seconds. Lose with time left and you can carry on once for {CONTINUE_COST} credits. Press P to pause.</p>}
              {phase === 'over' && canContinue && (
                <button onClick={again} disabled={live || bal < CONTINUE_COST} className="h-11 border border-signal px-6 text-sm font-semibold text-signal hover:bg-signal/10 disabled:opacity-40">Continue · {CONTINUE_COST} credits</button>
              )}
              <button onClick={start} disabled={!can} className={cn('h-11 px-6 text-sm font-semibold disabled:opacity-40', phase === 'over' && canContinue ? 'border border-ink/30 text-ink hover:bg-ink/10' : 'bg-signal text-on-signal')}>{phase === 'over' ? 'Play again' : 'Start'} · {price} credits</button>
              {live ? <p className="inline-flex items-center gap-1.5 text-[13px] text-ink-2" role="status"><Lock className="size-3.5" />You are locked in. Games open when you finish.</p> : bal < price ? <p className="text-[13px] text-ink-2" role="status">You need {price - bal} more credit{price - bal === 1 ? '' : 's'}. Lock in to earn them.</p> : null}
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

/** the roguelite is the deepest game here, so it gets a banner of its own above the grid instead of one tile among sixteen */
function Featured({ game, onPick, best, locked }: { game: Game; onPick: () => void; best?: number; locked: boolean }) {
  const calm = useStore((s) => s.settings.motion === 0)
  return (
    <button onClick={onPick} className="material relative flex min-h-[88px] shrink-0 items-center gap-4 overflow-hidden border-signal p-3 text-left hover:bg-ink/5 sm:min-h-[104px] sm:p-4" style={{ borderColor: 'var(--signal)' }}>
      <span className="grid size-14 shrink-0 place-items-center bg-signal text-on-signal sm:size-16"><Swords className="size-8 sm:size-9" aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="hud block text-signal">Featured · roguelite · {best ? `best ${best}` : 'new'}</span>
        <span className="dot block truncate text-[clamp(1.4rem,3.6vw,2.2rem)] font-bold uppercase leading-[1.25]">{game.name}</span>
        <span className="line-clamp-2 block text-[13px] leading-[17px] text-ink-2 sm:text-[14px] sm:leading-[19px]">Clear rooms, pick one of three upgrades after each, and take on a boss every third room. Every run plays differently.</span>
      </span>
      <span aria-hidden className="pointer-events-none hidden shrink-0 text-signal opacity-70 md:block"><AsciiSolid shape="pyramid" cols={22} rows={9} still={calm} speed={0.8} className="text-[8px]" /></span>
      <span className="inline-flex h-12 shrink-0 items-center bg-signal px-4 text-sm font-bold text-on-signal sm:px-6">{locked ? 'Locked in' : <>Play<span className="ml-2 font-semibold opacity-80 max-sm:hidden">· {game.cost ?? COST} credits</span></>}</span>
    </button>
  )
}

function Ic({ id }: { id: string }) { const I = ICONS[id] ?? Rocket; return <I className="size-4 shrink-0 text-signal" aria-hidden /> }

export function ArcadeView() {
  const cr = useStore((s) => s.credits)
  const live = useStore((s) => !!s.session)
  const [game, setGame] = useState<Game | null>(null)
  const [tab, setTab] = useState<'games' | 'shop'>('games')
  const [page, setPage] = useState(1)
  const { ref, per, cols } = useGridFit(190, 84, 8, 5)
  const star = GAMES.find((g) => g.id === 'rogue')
  const rest = GAMES.filter((g) => g !== star)
  const pages = Math.max(1, Math.ceil(rest.length / per))
  const safe = Math.min(page, pages)
  const slice = rest.slice((safe - 1) * per, safe * per)
  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="dot text-[clamp(1.3rem,2.6vw,1.8rem)] font-bold uppercase leading-[1.4] text-ink">Arcade</h1>
        {!game && <Seg id="tabs-arcade" value={tab} onChange={(id) => setTab(id as typeof tab)} tabs={[{ id: 'games', label: 'Games' }, { id: 'shop', label: 'Shop' }]} />}
        <div className="ml-auto flex items-center gap-4 text-sm" aria-label="Your credits">
          <span className="inline-flex items-center gap-1.5"><Coins className="size-4 text-signal" /><span className="fig font-semibold" role="status">{cr.bal}</span> credits</span>
          <span className="text-ink-2 max-sm:hidden"><span className="fig">{cr.earned}</span> earned · <span className="fig">{cr.spent}</span> spent</span>
        </div>
      </header>
      {game ? <Play key={game.id} game={game} onExit={() => setGame(null)} /> : tab === 'shop' ? <Shop /> : (
        <>
          <p className="hud shrink-0" role="status">{live ? 'Locked in: the arcade opens when you finish' : cr.bal >= COST ? `${GAMES.length} games, ${COST} credits a round. Credits come from focus, lessons and trivia.` : `Not enough credits yet. A round costs ${COST}. Lock in to earn some.`}</p>
          {star && <Featured game={star} onPick={() => setGame(star)} best={cr.best[star.id]} locked={live} />}
          <div ref={ref} className="min-h-[84px] flex-1 overflow-hidden">
            <div className="grid h-full content-start gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: '84px' }}>
              {slice.map((g) => (
                <button key={g.id} onClick={() => setGame(g)} className="material flex h-[84px] min-w-0 flex-col justify-between p-3 text-left hover:bg-ink/5">
                  <span className="flex items-baseline justify-between gap-2"><span className="flex min-w-0 items-center gap-2"><Ic id={g.id} /><span className="truncate text-[15px] font-semibold">{g.name}</span></span><span className="fig shrink-0 text-[12px] text-signal">{[cr.best[g.id] ? `Best ${cr.best[g.id]}` : '', (g.cost ?? COST) > COST ? `${g.cost} credits` : ''].filter(Boolean).join(' · ')}</span></span>
                  <span className="line-clamp-2 text-[13px] leading-[17px] text-ink-2">{g.blurb}</span>
                </button>
              ))}
            </div>
          </div>
          <Scrubber count={rest.length} per={per} page={safe} onPage={setPage} labelAt={(i) => rest[i]?.name ?? ''} />
        </>
      )}
    </section>
  )
}
