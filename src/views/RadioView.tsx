import { useCallback } from 'react'
import { Browser } from '@/components/app/Browser'
import { FOCUS_TAGS, searchStations, stationToMedia } from '@/lib/radio'

export function RadioView() {
  const load = useCallback(async (tag: string, q: string) => {
    const list = await searchStations(q ? { name: q } : { tag })
    return list.map(stationToMedia)
  }, [])
  return (
    <Browser
      kind="radio"
      title="Radio"
      sub="Internet stations from the Radio Browser directory, most listened first."
      chips={FOCUS_TAGS}
      initialChip="lofi"
      load={load}
      remoteSearch
      placeholder="Search stations"
    />
  )
}
