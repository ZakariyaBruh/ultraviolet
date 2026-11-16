import { useEffect, useRef } from 'react'
import { embedReady, usePlayer, video, ytId } from '@/lib/player'
import { cn } from '@/lib/utils'

/** The one live video element is parked here. Only one slot should be mounted at a time. A YouTube channel plays in YouTube's own embed instead. */
export function VideoSlot({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const url = usePlayer((s) => (s.current?.kind === 'tv' ? s.current.url : ''))
  const yt = ytId(url)
  useEffect(() => {
    const el = host.current
    if (!el || yt) return
    el.prepend(video)
    return () => { if (video.parentNode === el) el.removeChild(video) }
  }, [yt])
  if (yt) {
    return (
      <div className={cn('relative bg-black', className)}>
        <iframe
          key={yt}
          title="Live channel from YouTube"
          src={`https://www.youtube-nocookie.com/embed/live_stream?channel=${yt}&autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          onLoad={embedReady}
          className="absolute inset-0 size-full border-0"
        />
      </div>
    )
  }
  return <div ref={host} className={cn('relative bg-black [&>video]:size-full [&>video]:object-contain', className)} />
}
