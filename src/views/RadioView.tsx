import { useCallback, useState } from 'react'
import { Browser } from '@/components/app/Browser'
import { Panel } from '@/components/app/shared'
import { AsciiSolid } from '@/components/app/AsciiSolid'
import { usePlayer } from '@/lib/player'
import { FOCUS_TAGS, searchStations, stationToMedia } from '@/lib/radio'
import type { MediaItem } from '@/lib/store'

/** A text-mode slate: the torus spins while a station is on, and says so in plain words. */
function Orbit({ items }: { items: MediaItem[] }) {
  const on = usePlayer((s) => s.current?.kind === 'radio' && s.status === 'playing')
  return (
    <Panel className="grid h-[360px] place-content-center justify-items-center gap-3 overflow-hidden">
      <AsciiSolid cols={46} rows={20} speed={on ? 2 : 0.5} className="text-[9px] text-signal" />
      <p className="dot text-2xl text-ink">{on ? 'ON AIR' : items.length ? 'STANDBY' : 'NO SIGNAL'}</p>
    </Panel>
  )
}

export function RadioView() {
  const [items, setItems] = useState<MediaItem[]>([])
  const load = useCallback(async (tag: string, q: string) => {
    const list = await searchStations(q ? { name: q } : { tag })
    return list.map(stationToMedia)
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
      placeholder="Search stations"
      onItems={setItems}
      aside={<Orbit items={items} />}
    />
  )
}
