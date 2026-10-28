import { ExternalLink, Pause, Play, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MusicControls } from '@/components/app/MusicControls'
import { LoadingBlock } from '@/components/app/LoadingBlock'
import { clock, searchAudius, searchItunes, trending, type Song } from '@/lib/songs'
import { play, toggle, usePlayer } from '@/lib/player'
import { SPOTIFY_LINK, useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

type Tab = 'made' | 'songs' | 'previews' | 'spotify'
const TABS: { id: Tab; label: string }[] = [
  { id: 'made', label: 'Made here' },
  { id: 'songs', label: 'Songs' },
  { id: 'previews', label: 'Previews' },
  { id: 'spotify', label: 'Spotify' },
]

const field = 'h-11 min-w-0 flex-1 border border-ink/30 bg-transparent px-3 text-[15px] text-ink placeholder:text-ink-3 focus:border-signal'

/** One search: waits for a pause in typing, and never lets a slow answer to an old search replace a newer one. */
function useSongs(tab: 'songs' | 'previews', q: string) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; list: Song[] }>({ status: 'loading', list: [] })
  useEffect(() => {
    const term = q.trim()
    if (tab === 'previews' && term.length < 2) { setState({ status: 'ready', list: [] }); return }
    setState((s) => ({ status: 'loading', list: s.list }))
    let dead = false
    const t = setTimeout(() => {
      const ask = tab === 'songs' ? (term.length < 2 ? trending() : searchAudius(term)) : searchItunes(term)
      ask.then((list) => { if (!dead) setState({ status: 'ready', list }) }).catch(() => { if (!dead) setState({ status: 'error', list: [] }) })
    }, term ? 350 : 0)
    return () => { dead = true; clearTimeout(t) }
  }, [tab, q])
  return state
}

function Row({ song, list }: { song: Song; list: Song[] }) {
  const current = usePlayer((s) => s.current)
  const status = usePlayer((s) => s.status)
  const here = current?.id === song.item.id
  const live = here && (status === 'playing' || status === 'loading')
  const go = () => (here && status !== 'error' ? toggle() : play(song.item, list.map((x) => x.item)))
  return (
    <li className={cn('flex items-stretch border-b border-ink/10 last:border-b-0', here && 'bg-signal/10')}>
      <button onClick={go} aria-label={`${live ? 'Pause' : 'Play'} ${song.item.name} by ${song.item.meta?.replace(' · 30 s preview', '')}`} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 px-1.5 py-1.5 text-left hover:bg-ink/[0.06]">
        {song.item.logo ? <img src={song.item.logo} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-10 shrink-0 bg-ink/10 object-cover" /> : <span className="size-10 shrink-0 bg-ink/10" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold leading-[1.25]">{song.item.name}</span>
          <span className="block truncate text-[12px] leading-[1.25] text-ink-2">{song.item.meta} · {clock(song.seconds)}</span>
        </span>
        <span className="grid size-9 shrink-0 place-items-center bg-signal text-on-signal" aria-hidden>{live ? <Pause className="size-4" /> : <Play className="size-4" />}</span>
      </button>
      <a href={song.link} target="_blank" rel="noopener noreferrer" aria-label={`Open ${song.item.name} on ${song.source === 'audius' ? 'Audius' : 'Apple Music'}`} className="grid min-h-11 w-9 shrink-0 place-items-center text-ink-3 hover:text-ink"><ExternalLink className="size-3.5" /></a>
    </li>
  )
}

function Results({ tab }: { tab: 'songs' | 'previews' }) {
  const [q, setQ] = useState('')
  const { status, list } = useSongs(tab, q)
  return (
    <div className="grid gap-2">
      <label className="flex gap-2">
        <span className="sr-only">Search {tab === 'songs' ? 'Audius' : 'Apple Music previews'}</span>
        <span className="relative flex min-w-0 flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" enterKeyHint="search" autoComplete="off" spellCheck={false} placeholder={tab === 'songs' ? 'Search songs, or see what is trending' : 'A song or an artist'} className={cn(field, 'w-full pl-9')} data-no-drag />
        </span>
      </label>
      <p className="hud" role="status">
        {status === 'loading' ? 'Searching…' : status === 'error' ? 'Could not reach the service' : tab === 'previews' && q.trim().length < 2 ? 'Search for a song to hear 30 seconds of it' : list.length ? (tab === 'songs' && q.trim().length < 2 ? 'Trending this week on Audius' : `${list.length} found`) : 'Nothing found'}
      </p>
      <div className="scroll-y max-h-[15.5rem] min-h-[3rem]" data-no-drag>
        {status === 'loading' && !list.length ? <div className="h-24"><LoadingBlock label="Searching" size={48} /></div> : (
          <ul className="m-0 list-none p-0">{list.map((s) => <Row key={s.item.id} song={s} list={list} />)}</ul>
        )}
      </div>
      <p className="text-[12px] leading-[1.35] text-ink-3">
        {tab === 'songs' ? 'Whole tracks from independent artists on Audius. Free, no account, nothing sent but your search.' : 'Apple publishes a 30 second preview of each song. The arrow opens the whole song in Apple Music.'}
      </p>
    </div>
  )
}

/** Spotify gives anyone an embedded player for a link, with no key: it plays in Spotify's own frame under your own Spotify login. */
function Spotify() {
  const link = useStore((s) => s.widgets.spotify)
  const set = useStore((s) => s.setSpotify)
  const [text, setText] = useState('')
  const [bad, setBad] = useState(false)
  const m = link.match(SPOTIFY_LINK)
  const load = () => {
    const v = text.trim()
    if (!SPOTIFY_LINK.test(v)) { setBad(true); return }
    setBad(false); set(v); setText('')
    // two things at once would be noise: the generated music and any station go quiet while Spotify plays
    useStore.getState().setSettings({ music: false })
    if (usePlayer.getState().status === 'playing') toggle()
  }
  return (
    <div className="grid gap-2">
      <form onSubmit={(e) => { e.preventDefault(); load() }} className="flex gap-2">
        <label className="min-w-0 flex-1"><span className="sr-only">A Spotify link</span><input value={text} onChange={(e) => { setText(e.target.value); setBad(false) }} placeholder="Paste a Spotify link" inputMode="url" autoComplete="off" spellCheck={false} aria-invalid={bad} className={cn(field, 'w-full', bad && '!border-bad')} data-no-drag /></label>
        <button type="submit" className="h-11 shrink-0 bg-signal px-4 text-sm font-semibold text-on-signal">Load</button>
      </form>
      <p className={cn('text-[12px] leading-[1.35]', bad ? 'text-bad' : 'text-ink-3')} role="status">{bad ? 'That is not a Spotify link to a song, album, playlist, show or artist. Copy one from Spotify with Share, then Copy link.' : 'In Spotify choose Share, then Copy link, and paste it here. Spotify plays it in its own frame, so what you hear depends on your Spotify account. Nothing is sent to Spotify until you load a link.'}</p>
      {m && (
        <>
          <iframe title={`Spotify player: ${m[1]}`} src={`https://open.spotify.com/embed/${m[1]}/${m[2]}`} width="100%" height={m[1] === 'track' || m[1] === 'episode' ? 152 : 232} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" data-no-drag className="block border-0" />
          <button onClick={() => set('')} className="h-11 justify-self-start border border-ink/30 px-4 text-sm hover:bg-ink/10">Remove it</button>
        </>
      )}
    </div>
  )
}

/** The Music window: the music made here, songs from Audius and Apple previews, and a Spotify link. */
export function MusicWindow() {
  const [tab, setTab] = useState<Tab>('made')
  return (
    <div className="grid gap-3">
      <div role="group" aria-label="Where the music comes from" className="grid grid-cols-4 gap-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} aria-pressed={tab === t.id} className={cn('h-11 px-1 text-[13px]', tab === t.id ? 'bg-ink text-ground' : 'bg-ink/[0.07] ring-1 ring-ink/12 hover:bg-ink/12')}>{t.label}</button>
        ))}
      </div>
      {tab === 'made' && <MusicControls compact />}
      {(tab === 'songs' || tab === 'previews') && <Results tab={tab} />}
      {tab === 'spotify' && <Spotify />}
    </div>
  )
}
