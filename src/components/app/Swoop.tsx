import { useEffect, useState } from 'react'
import { Shards } from '@/components/app/Shards'
import { useStore } from '@/lib/store'

/** Locking in sends the shards flying across the screen, once. */
export function Swoop() {
  const [n, setN] = useState(0)
  useEffect(() => {
    let was = !!useStore.getState().session
    return useStore.subscribe((s) => {
      const now = !!s.session
      if (!was && now && s.settings.motion > 0) setN((k) => k + 1)
      was = now
    })
  }, [])
  if (!n) return null
  return (
    <div key={n} className="pointer-events-none fixed inset-0 z-[55] overflow-hidden" aria-hidden>
      <Shards className="shard-swoop absolute bottom-0 left-0 w-[70vmax] max-w-none" />
    </div>
  )
}
