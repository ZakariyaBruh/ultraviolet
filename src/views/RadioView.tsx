import { Radar } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Browser } from '@/components/app/Browser'
import { RadarScan } from '@/components/app/RadarScan'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useMedia } from '@/lib/hooks'
import { FOCUS_TAGS, searchStations, stationToMedia } from '@/lib/radio'
import type { MediaItem } from '@/lib/store'

export function RadioView() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [open, setOpen] = useState(false)
  const wide = useMedia('(min-width: 1024px)')
  const load = useCallback(async (tag: string, q: string) => {
    const list = await searchStations(q ? { name: q } : { tag })
    return list.map(stationToMedia)
  }, [])
  return (
    <>
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
        aside={<RadarScan items={items} />}
      />
      {!wide && (
        <>
          <button onClick={() => setOpen(true)} className="fixed right-4 top-[72px] z-30 inline-flex h-11 items-center gap-2 bg-signal px-4 text-sm font-semibold text-on-signal"><Radar className="size-4" />Scan</button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent side="bottom">
              <SheetHeader><SheetTitle>Scan the band</SheetTitle><SheetDescription>Turn the dial. The station under the beam plays when you let go.</SheetDescription></SheetHeader>
              <SheetBody><RadarScan items={items} /></SheetBody>
            </SheetContent>
          </Sheet>
        </>
      )}
    </>
  )
}
