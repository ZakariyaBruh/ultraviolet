import { useMemo } from 'react'
import { SpotlightSearch } from '@/components/ui/spotlight-search'
import { buildSearchItems } from '@/lib/commands'
import type { View } from '@/lib/route'
import { useUI } from '@/lib/ui'

/** Search (⌘K): the palette and everything it can reach. It is its own part, fetched the first time search is opened or while the app is idle. */
export function SearchLayer({ go }: { go: (v: View) => void }) {
  const open = useUI((s) => s.searchOpen)
  const set = useUI((s) => s.set)
  // the list is built when the palette opens, so it has the favourites and windows of that moment
  const items = useMemo(() => (open ? buildSearchItems(go) : []), [open]) // eslint-disable-line react-hooks/exhaustive-deps
  return <SpotlightSearch open={open} onOpenChange={(o) => set({ searchOpen: o })} onClose={() => set({ searchOpen: false })} items={items} placeholder="Search screens, stations, actions, components" />
}
