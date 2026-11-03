import { useEffect, useRef } from 'react'
import { video } from '@/lib/player'
import { cn } from '@/lib/utils'

/** The one live video element is parked here. Only one slot should be mounted at a time. */
export function VideoSlot({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    el.prepend(video)
    return () => { if (video.parentNode === el) el.removeChild(video) }
  }, [])
  return <div ref={host} className={cn('relative bg-black [&>video]:size-full [&>video]:object-contain', className)} />
}
