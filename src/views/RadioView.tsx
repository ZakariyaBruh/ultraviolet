import { Heart, SkipBack, SkipForward } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Browser } from '@/components/app/Browser'
import { Eq, Logo, Panel } from '@/components/app/shared'
import { play, step, usePlayer } from '@/lib/player'
import { FOCUS_TAGS, searchStations, stationToMedia } from '@/lib/radio'
import { useStore, type MediaItem } from '@/lib/store'

/** What is on, who it is, and the quick moves: previous, next, keep. Plus a few more from the same list. */
function OnAir({ items }: { items: MediaItem[] }) {
  const { current, status } = usePlayer()
  const fav = useStore((s) => s.favorites)
  const toggle = useStore((s) => s.toggleFavorite)
  const radio = current?.kind === 'radio' ? current : null
  const more = items.filter((i) => i.id !== radio?.id).slice(0, 6)
  return (
    <Panel className="flex h-full min-h-0 flex-col gap-4 p-5">
      {radio ? (
        <>
          <div className="flex items-center gap-4">
            <Logo item={radio} size={72} />
            <div className="min-w-0">
              <div className="hud flex items-center gap-2">{status === 'playing' && <Eq playing />}{status === 'loading' ? 'Tuning' : status === 'error' ? 'Stream down' : 'On air'}</div>
              <h2 className="truncate text-[20px] font-semibold leading-6">{radio.name}</h2>
              <p className="truncate text-[13px] text-ink-2">{radio.meta}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => step(-1)} aria-label="Previous station" className="grid size-11 place-items-center border border-ink/30 hover:bg-ink/10"><SkipBack className="size-5" /></button>
            <button onClick={() => step(1)} aria-label="Next station" className="grid size-11 place-items-center border border-ink/30 hover:bg-ink/10"><SkipForward className="size-5" /></button>
            <button onClick={() => toggle(radio)} aria-pressed={fav.some((f) => f.id === radio.id)} className="inline-flex h-11 flex-1 items-center justify-center gap-2 border border-ink/30 text-sm hover:bg-ink/10"><Heart className={`size-4 ${fav.some((f) => f.id === radio.id) ? 'fill-signal text-signal' : ''}`} />{fav.some((f) => f.id === radio.id) ? 'Saved' : 'Save station'}</button>
          </div>
        </>
      ) : (
        <div><div className="hud">Off air</div><h2 className="text-[20px] font-semibold leading-6">Pick a station</h2><p className="text-[13px] text-ink-2">Press any listing. The player keeps going while you move around.</p></div>
      )}
      {more.length > 0 && (
        <div className="min-h-0 border-t border-ink/15 pt-3">
          <div className="hud mb-1">{radio ? 'More like this' : 'Try one'}</div>
          <ul>{more.map((m) => <li key={m.id}><button onClick={() => play(m, items)} className="flex h-11 w-full items-center gap-3 text-left text-sm hover:text-signal"><Logo item={m} size={28} /><span className="min-w-0 flex-1 truncate">{m.name}</span></button></li>)}</ul>
        </div>
      )}
    </Panel>
  )
}

export function RadioView() {
  const [items, setItems] = useState<MediaItem[]>([])
  const load = useCallback(async (tag: string, q: string) => {
    // a search looks at every station: those named like it, then those tagged with it
    const list = q ? [...(await searchStations({ name: q })), ...(await searchStations({ tag: q }).catch(() => []))] : await searchStations({ tag })
    const seen = new Set<string>()
    return list.filter((s) => !seen.has(s.stationuuid) && !!seen.add(s.stationuuid)).map(stationToMedia)
  }, [])
  return (
    <Browser
      kind="radio"
      kicker="Internet radio"
      title="Radio"
      sub="Stations from the Radio Browser directory, most listened first."
      chips={FOCUS_TAGS}
      initialChip="lofi"
      load={load}
      remoteSearch
      placeholder="Search every station"
      onItems={setItems}
      aside={<OnAir items={items} />}
    />
  )
}
