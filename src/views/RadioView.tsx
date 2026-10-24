import { useCallback, useMemo, useState } from 'react'
import { Browser } from '@/components/app/Browser'
import { Panel } from '@/components/app/shared'
import { CircularOrbit } from '@/components/ui/circular-orbit'
import { FOCUS_TAGS, searchStations, stationToMedia } from '@/lib/radio'
import type { MediaItem } from '@/lib/store'

/** Station logos circle the title: the directory's most-listened stations for the genre you are on. */
function Orbit({ items }: { items: MediaItem[] }) {
  const logos = useMemo(() => items.filter((i) => i.logo).slice(0, 8), [items])
  if (logos.length < 4) return null
  return (
    <Panel className="grid h-[360px] place-items-center overflow-hidden">
      <CircularOrbit title="On air" radius={120} speed={0.5} items={logos.map((l) => ({ id: l.id, src: l.logo!, alt: l.name, size: 46 }))} titleClassName="!text-3xl !font-semibold !tracking-tight !text-ink" />
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
