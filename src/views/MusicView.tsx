import { ExternalLink, Pause, Play, Search } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { LoadingBlock } from '@/components/app/LoadingBlock'
import { PageHeader, Panel } from '@/components/app/shared'
import { Scrubber, useSwipe } from '@/components/app/Scrubber'
import { useGridFit } from '@/lib/hooks'
import { play, toggle, usePlayer } from '@/lib/player'
import { AGES, clock, findSongs, SOURCE_NAME, type Song, type SongSource } from '@/lib/songs'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/** One search across every source; it waits for a pause in typing and never lets an old answer replace a newer one. */
function useSongs(q: string, age: number) {
  const [state, setState] = useState<{ status: 'loading' | 'ready'; list: Song[]; failed: SongSource[] }>({ status: 'loading', list: [], failed: [] })
  useEffect(() => {
    setState((s) => ({ ...s, status: 'loading' }))
    let dead = false
    const t = setTimeout(() => { findSongs(q, age).then((r) => { if (!dead) setState({ status: 'ready', ...r }) }) }, q.trim() ? 380 : 0)
    return () => { dead = true; clearTimeout(t) }
  }, [q, age])
  return state
}

function Row({ song, list, i }: { song: Song; list: Song[]; i: number }) {
  const current = usePlayer((s) => s.current)
  const status = usePlayer((s) => s.status)
  const here = current?.id === song.item.id
  const live = here && (status === 'playing' || status === 'loading')
  const go = () => (here && status !== 'error' ? toggle() : play(song.item, list.map((x) => x.item)))
  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: Math.min(i, 8) * 0.02 }} className={cn('flex items-stretch border-b border-ink/10', here && 'bg-signal/10')}>
      <button onClick={go} aria-label={`${live ? 'Pause' : 'Play'} ${song.item.name} by ${song.item.meta}`} className="flex h-16 min-w-0 flex-1 items-center gap-3 px-2 text-left transition-colors hover:bg-ink/[0.06]">
        {song.item.logo ? <img src={song.item.logo} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-11 shrink-0 bg-ink/10 object-cover" /> : <span className="size-11 shrink-0 bg-ink/10" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-[1.25]">{song.item.name}</span>
          <span className="block truncate text-[13px] leading-[1.3] text-ink-2">{song.item.meta} · {clock(song.seconds)} · <span className="text-ink-3">{SOURCE_NAME[song.source]}</span></span>
        </span>
        <span className="grid size-10 shrink-0 place-items-center bg-signal text-on-signal" aria-hidden>{live ? <Pause className="size-4" /> : <Play className="size-4" />}</span>
      </button>
      <a href={song.link} target="_blank" rel="noopener noreferrer" aria-label={`Open ${song.item.name} on ${SOURCE_NAME[song.source]}`} className="grid min-h-11 w-11 shrink-0 place-items-center text-ink-3 hover:text-ink"><ExternalLink className="size-4" /></a>
    </motion.li>
  )
}

/** Choosing what to hear comes first: none of these services rates its music, so the person says how much to allow. */
function AgeGate() {
  const set = useStore((s) => s.setSettings)
  return (
    <Panel className="mx-auto grid max-w-[34rem] gap-3 self-center p-5">
      <p className="hud">Before you listen</p>
      <h2 className="dot text-xl font-bold">What are you happy to hear?</h2>
      <p className="text-[14px] leading-[1.45] text-ink-2">These songs come from open services that do not rate their music. Friction filters by the flags and words they do give, which is a guide and not a guarantee. You can change this any time.</p>
      <div className="grid gap-2" role="group" aria-label="Age rating">
        {AGES.map((a) => (
          <button key={a.id} onClick={() => set({ songAge: a.id })} className="grid min-h-14 gap-0.5 border border-ink/30 px-3 py-2 text-left hover:border-signal hover:bg-ink/[0.06]">
            <span className="text-[15px] font-semibold">{a.name}</span><span className="text-[13px] text-ink-2">{a.note}</span>
          </button>
        ))}
      </div>
    </Panel>
  )
}

export function MusicView() {
  const age = useStore((s) => s.settings.songAge)
  const set = useStore((s) => s.setSettings)
  const [q, setQ] = useState('')
  const { status, list, failed } = useSongs(q, Math.max(0, age))
  const searching = q.trim().length >= 2
  // a list that pages, as everywhere else in the app: it never scrolls, and the strip under it (or a swipe) turns the page
  const { ref, per } = useGridFit(240, 64, 0, 1)
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [q, age])
  const pages = Math.max(1, Math.ceil(list.length / per))
  const safe = Math.min(page, pages)
  const slice = list.slice((safe - 1) * per, safe * per)
  const swipe = useSwipe(() => setPage(Math.max(1, safe - 1)), () => setPage(Math.min(pages, safe + 1)))
  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader kicker="Music" title="Music" sub="Whole songs from Audius, Openverse and the Internet Archive. Free, no account, and only your search words are sent." />
      {age < 0 ? <AgeGate /> : (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <label className="relative min-w-[12rem] flex-1">
              <span className="sr-only">Search songs</span>
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} type="search" enterKeyHint="search" autoComplete="off" spellCheck={false} placeholder="A song, an artist or a mood" className="h-11 w-full border border-ink/30 bg-transparent pl-9 pr-3 text-[15px] text-ink placeholder:text-ink-3 focus:border-signal" />
            </label>
            <div role="group" aria-label="Age rating" className="flex">
              {AGES.map((a) => <button key={a.id} onClick={() => set({ songAge: a.id })} aria-pressed={age === a.id} title={a.note} className={cn('h-11 px-3 text-[13px] transition-colors', age === a.id ? 'bg-ink text-ground' : 'bg-ink/[0.07] ring-1 ring-ink/12 hover:bg-ink/12')}>{a.name}</button>)}
            </div>
          </div>
          <p className="hud shrink-0" role="status">
            {status === 'loading' ? 'Searching…' : !list.length ? (failed.length ? 'Could not reach the services' : 'Nothing found for this age setting') : searching ? `${list.length} songs` : 'Trending'}
            {status === 'ready' && failed.length > 0 && list.length > 0 && ` · ${failed.map((f) => SOURCE_NAME[f]).join(', ')} did not answer`}
          </p>
          <Panel className="flex min-h-[8rem] flex-1 flex-col p-1">
            <div ref={ref} className="min-h-[4rem] flex-1 overflow-hidden" {...swipe}>
              {status === 'loading' && !list.length ? <LoadingBlock label="Searching" size={72} /> : <ul key={`${q}-${age}-${safe}`} className="m-0 list-none p-0">{slice.map((s, i) => <Row key={s.item.id} song={s} list={list} i={i} />)}</ul>}
            </div>
          </Panel>
          <Scrubber count={list.length} per={per} page={safe} onPage={setPage} labelAt={(i) => list[i]?.item.name ?? ''} />
        </>
      )}
    </section>
  )
}
