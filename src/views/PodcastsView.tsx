import { ArrowLeft, Pause, Play, RotateCcw, RotateCw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader, Panel } from '@/components/app/shared'
import { Scrubber, useSwipe } from '@/components/app/Scrubber'
import { IOSSearchBar } from '@/components/ui/ios-search-bar'
import { MorphingBlob } from '@/components/ui/morphing-blob'
import { useGridFit } from '@/lib/hooks'
import { audioEl, play, seekBy, seekTo, toggle, usePlayer } from '@/lib/player'
import { episodeToMedia, loadEpisodes, searchShows, TOPICS, type Episode, type Show } from '@/lib/podcasts'
import { useStore } from '@/lib/store'
import { useColours } from '@/lib/useColours'
import { LoadingBlock } from '@/components/app/LoadingBlock'
import { cn } from '@/lib/utils'

const fmt = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`
}
const day = (t: number) => (t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '')

function Art({ src, name, className }: { src?: string; name: string; className?: string }) {
  const [bad, setBad] = useState(false)
  return src && !bad ? (
    <img src={src} alt="" loading="lazy" onError={() => setBad(true)} className={cn('object-cover', className)} />
  ) : (
    <span className={cn('grid place-items-center bg-raised p-1 text-center font-[family-name:var(--font-cond)] text-[11px] font-semibold uppercase leading-3 text-ink-3', className)}>{name.slice(0, 22)}</span>
  )
}

/** Where you are in the episode, with the two moves a podcast needs that radio does not: back 15 and forward 30. */
function Seek() {
  const { status } = usePlayer()
  const [t, setT] = useState({ at: 0, len: 0 })
  useEffect(() => {
    const f = () => setT({ at: audioEl.currentTime || 0, len: Number.isFinite(audioEl.duration) ? audioEl.duration : 0 })
    f()
    audioEl.addEventListener('timeupdate', f)
    audioEl.addEventListener('durationchange', f)
    return () => { audioEl.removeEventListener('timeupdate', f); audioEl.removeEventListener('durationchange', f) }
  }, [])
  const btn = 'grid size-11 place-items-center border border-ink/30 text-ink hover:bg-ink/10'
  return (
    <div className="grid gap-2">
      <input type="range" min={0} max={Math.max(1, Math.round(t.len))} step={1} value={Math.round(t.at)} onChange={(e) => seekTo(Number(e.target.value))} aria-label="Position in episode" aria-valuetext={`${fmt(t.at)} of ${fmt(t.len)}`} className="h-11 w-full accent-[var(--signal)]" />
      <div className="flex items-center justify-between gap-2">
        <span className="fig text-[13px] text-ink-2">{fmt(t.at)} / {t.len ? fmt(t.len) : '--:--'}</span>
        <div className="flex gap-2">
          <button className={btn} onClick={() => seekBy(-15)} aria-label="Back 15 seconds"><RotateCcw className="size-5" /></button>
          <button className={cn(btn, 'bg-signal text-on-signal')} onClick={toggle} aria-label={status === 'playing' ? 'Pause' : 'Play'}>{status === 'playing' ? <Pause className="size-5" /> : <Play className="size-5" />}</button>
          <button className={btn} onClick={() => seekBy(30)} aria-label="Forward 30 seconds"><RotateCw className="size-5" /></button>
        </div>
      </div>
    </div>
  )
}

function ShowPage({ show, onBack }: { show: Show; onBack: () => void }) {
  const { signal, ice } = useColours()
  const colours: [string, string] = [signal, ice]
  const { current, status } = usePlayer()
  const [eps, setEps] = useState<Episode[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [nonce, setNonce] = useState(0)
  const [page, setPage] = useState(1)
  const { ref, per } = useGridFit(260, 76, 8, 1)
  const motionLevel = useStore((s) => s.settings.motion)
  const live = current?.id.startsWith('pod:' + show.id) && status === 'playing'

  useEffect(() => {
    let dead = false
    setState('loading')
    loadEpisodes(show).then((r) => { if (!dead) { setEps(r); setState('ready') } }).catch(() => { if (!dead) setState('error') })
    return () => { dead = true }
  }, [show, nonce])

  const queue = useMemo(() => eps.map((e) => episodeToMedia(e, show)), [eps, show])
  const pages = Math.max(1, Math.ceil(eps.length / per))
  const safe = Math.min(page, pages)
  const slice = eps.slice((safe - 1) * per, safe * per)
  const swipe = useSwipe(() => setPage(Math.max(1, safe - 1)), () => setPage(Math.min(pages, safe + 1)))
  const here = current?.id.startsWith('pod:' + show.id)

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
      <Panel className="relative flex min-h-0 flex-col gap-3 overflow-hidden p-4 max-lg:grid max-lg:grid-cols-[104px_1fr] max-lg:items-center max-lg:gap-x-3 max-lg:gap-y-1 max-lg:p-3">
        <button onClick={onBack} className="inline-flex h-11 items-center gap-2 self-start pr-3 text-sm text-ink-2 hover:text-ink max-lg:col-span-2"><ArrowLeft className="size-4" /> All shows</button>
        {/* the disc is a square as wide as the room allows in both directions, so a short panel cannot squash it into an oval */}
        <div className="relative mx-auto min-h-[96px] w-full max-w-[300px] flex-1 [container-type:size] max-lg:h-[104px] max-lg:max-w-[104px] max-lg:flex-none">
          <div className="absolute left-1/2 top-1/2 grid size-[min(100cqw,100cqh)] -translate-x-1/2 -translate-y-1/2 place-items-center">
          <MorphingBlob className="absolute inset-0 size-full" width={400} height={400} baseRadius={128} variance={motionLevel === 2 ? 64 : 52} speed={live ? 2 : 1.1} stiffness={38} damping={5.5} points={10} colors={colours} cursorFollow={false} aria-hidden />
          <Art src={show.art} name={show.name} className={cn('relative size-[50%] rounded-full shadow-[0_14px_30px_-12px_rgba(0,0,0,.6)]', live && motionLevel > 0 && 'motion-safe:animate-[spin_26s_linear_infinite]')} />
          </div>
        </div>
        <div className="min-w-0">
          <h2 className="line-clamp-2 text-[18px] font-semibold leading-6">{show.name}</h2>
          <p className="truncate text-[13px] text-ink-2">{show.artist}{show.genre ? ` · ${show.genre}` : ''}</p>
        </div>
        {here && <div className="max-lg:col-span-2"><Seek /></div>}
      </Panel>

      <div className="flex min-h-0 min-w-0 flex-col gap-2">
        <div ref={ref} className="min-h-[76px] flex-1 overflow-hidden" {...swipe}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.ul key={`${safe}-${state}`} className="grid h-full content-start gap-2" style={{ gridAutoRows: '76px' }} exit={{ opacity: 0, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }}>
              {state === 'loading' && <li className="row-span-full" style={{ gridRow: 'span 4' }}><LoadingBlock label="Reading the feed" /></li>}
              {state === 'error' && (
                <li className="border border-dashed border-ink/25 p-6 text-sm text-ink-2">
                  This show’s feed would not open. Some publishers block browsers.
                  <button className="ml-3 h-11 bg-ink px-4 text-ground" onClick={() => setNonce((n) => n + 1)}>Try again</button>
                </li>
              )}
              {state === 'ready' && slice.map((e, i) => {
                const on = current?.id === e.id
                return (
                  <motion.li key={e.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: Math.min(i, 6) * 0.025 }}>
                    <button onClick={() => (on ? toggle() : play(queue[eps.indexOf(e)], queue))} aria-label={`${on && status === 'playing' ? 'Pause' : 'Play'} ${e.title}`} className={cn('flex h-[76px] w-full items-center gap-3 border p-3 text-left transition-colors', on ? 'border-signal bg-signal/10' : 'border-ink/15 bg-ink/[0.03] hover:border-signal/60')}>
                      <span className={cn('grid size-11 shrink-0 place-items-center', on ? 'bg-signal text-on-signal' : 'border border-ink/30')}>{on && status === 'playing' ? <Pause className="size-5" /> : <Play className="size-5" />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[14px] font-semibold leading-[18px]">{e.title}</span>
                        <span className="hud mt-0.5 block truncate">{day(e.date)}{e.seconds ? ` · ${fmt(e.seconds)}` : ''}</span>
                      </span>
                    </button>
                  </motion.li>
                )
              })}
            </motion.ul>
          </AnimatePresence>
        </div>
        <Scrubber count={eps.length} per={per} page={safe} onPage={setPage} labelAt={(i) => eps[i]?.title ?? ''} />
      </div>
    </div>
  )
}

export function PodcastsView() {
  const [topic, setTopic] = useState(TOPICS[0])
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [shows, setShows] = useState<Show[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [nonce, setNonce] = useState(0)
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<Show | null>(null)
  const { ref, per, cols } = useGridFit(300, 92, 8, 3)

  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 380); return () => clearTimeout(t) }, [q])
  useEffect(() => setPage(1), [topic, dq])
  useEffect(() => {
    let dead = false
    setState('loading')
    searchShows(dq || `${topic} podcast`).then((r) => { if (!dead) { setShows(r); setState('ready') } }).catch(() => { if (!dead) setState('error') })
    return () => { dead = true }
  }, [topic, dq, nonce])

  const pages = Math.max(1, Math.ceil(shows.length / per))
  const safe = Math.min(page, pages)
  const slice = shows.slice((safe - 1) * per, safe * per)
  const swipe = useSwipe(() => setPage(Math.max(1, safe - 1)), () => setPage(Math.min(pages, safe + 1)))
  const loading = state === 'loading'

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader kicker="Podcasts" title="Podcasts" sub="Any show in the Apple Podcasts directory. Episodes stream straight from the publisher." />
      {open ? (
        <div className="min-h-0 flex-1"><ShowPage show={open} onBack={() => setOpen(null)} /></div>
      ) : (
        <>
          <IOSSearchBar value={q} onChange={setQ} onClear={() => setQ('')} placeholder="Search podcasts" collapsedWidth="100%" expandedWidth="100%" className="max-w-full" />
          <div className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-1" data-allow-scroll role="group" aria-label="Topics">
            {TOPICS.map((c) => (
              <button key={c} onClick={() => { setQ(''); setTopic(c) }} aria-pressed={!dq && topic === c} className={cn('h-11 shrink-0 px-3.5 text-[13px] capitalize transition-colors md:h-9', !dq && topic === c ? 'bg-ink text-ground' : 'bg-ink/[0.07] text-ink ring-1 ring-ink/12 hover:bg-ink/12')}>{c}</button>
            ))}
          </div>
          <div ref={ref} className="min-h-[92px] flex-1 overflow-hidden" {...swipe}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={`${topic}-${dq}-${loading}-${safe}`} className="grid h-full content-start gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: '92px' }} exit={{ opacity: 0, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }}>
                {loading
                  ? <div className="col-span-full" style={{ gridRow: 'span 4' }}><LoadingBlock label="Finding shows" /></div>
                  : slice.map((s, i) => (
                      <motion.button key={s.id} onClick={() => setOpen(s)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: Math.min(i, 8) * 0.025 }} className="flex h-[92px] min-w-0 gap-3 border border-ink/15 bg-ink/[0.03] p-2 text-left transition-colors hover:border-signal/60 hover:bg-ink/[0.06]">
                        <Art src={s.art} name={s.name} className="size-[74px] shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-[14px] font-semibold leading-[18px]">{s.name}</span>
                          <span className="mt-0.5 block truncate text-[13px] text-ink-2">{s.artist}</span>
                          <span className="hud mt-0.5 block truncate">{s.genre}{s.episodes ? ` · ${s.episodes} eps` : ''}</span>
                        </span>
                      </motion.button>
                    ))}
                {state === 'error' && (
                  <div className="col-span-full border border-dashed border-ink/25 p-8 text-center text-sm text-ink-2">
                    Could not reach the podcast directory. Check your connection.
                    <button className="ml-3 h-11 bg-ink px-4 text-ground" onClick={() => setNonce((n) => n + 1)}>Try again</button>
                  </div>
                )}
                {state === 'ready' && slice.length === 0 && <div className="col-span-full border border-dashed border-ink/25 p-8 text-center text-sm text-ink-2">No shows matched that. Try another word.</div>}
              </motion.div>
            </AnimatePresence>
          </div>
          <Scrubber count={shows.length} per={per} page={safe} onPage={setPage} labelAt={(i) => shows[i]?.name ?? ''} />
        </>
      )}
    </section>
  )
}
