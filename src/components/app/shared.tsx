import { Heart, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatedTabs } from '@/components/ui/animated-tabs'
import { OrbitalLoadingRing } from '@/components/ui/orbital-loading-ring'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { cn } from '@/lib/utils'
import { play, step, toggle, usePlayer, video } from '@/lib/player'
import { useStore, type MediaItem } from '@/lib/store'

export function Eq({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn('eq text-lime-300', !playing && 'paused', className)}>
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}

/** Segmented control (EasyUI animated tabs, used without panels). */
export function Seg({
  tabs,
  value,
  onChange,
  id,
  className,
}: {
  tabs: { id: string; label: ReactNode; icon?: ReactNode; badge?: string | number }[]
  value: string
  onChange: (id: string) => void
  id: string
  className?: string
}) {
  return (
    <AnimatedTabs
      tabs={tabs.map((t) => ({ id: t.id, label: t.label as string, icon: t.icon, badge: t.badge }))}
      activeTab={value}
      onChange={onChange}
      layoutId={id}
      variant="glass"
      renderContent={false}
      className={className}
    />
  )
}

/** The one <video> element lives outside React; this just parks it in the layout. */
export function VideoSurface({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const { current, status, error } = usePlayer()
  useEffect(() => {
    const el = host.current
    if (!el) return
    el.prepend(video)
    return () => {
      if (video.parentNode === el) el.removeChild(video)
    }
  }, [])
  const isTv = current?.kind === 'tv'
  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-black/60 scanlines', className)}>
      <div ref={host} className="absolute inset-0 [&>video]:h-full [&>video]:w-full [&>video]:object-cover" />
      {(!isTv || status === 'loading') && (
        <div className="absolute inset-0 z-[3] grid place-items-center bg-black/55 backdrop-blur-sm">
          {isTv ? (
            <OrbitalLoadingRing size={84} label="Tuning" />
          ) : (
            <div className="text-center text-sm text-white/60">
              <div className="font-display text-base text-white/80">No signal</div>
              Pick a channel to put it on air
            </div>
          )}
        </div>
      )}
      {isTv && status === 'error' && (
        <div className="absolute inset-0 z-[3] grid place-items-center bg-black/70 p-4 text-center text-sm text-fuchsia-200">
          {error ?? 'Stream unavailable'} — hopping to the next channel…
        </div>
      )}
    </div>
  )
}

export function Logo({ item, size = 44 }: { item: Pick<MediaItem, 'logo' | 'name'>; size?: number }) {
  const initials = item.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <div
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-600/60 to-fuchsia-600/40 font-display text-xs font-bold text-white/90"
      style={{ width: size, height: size }}
    >
      {initials}
      {item.logo && (
        <img
          src={item.logo}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full bg-[#150d2b] object-contain p-1"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}
    </div>
  )
}

export function MediaCard({ item, queue, index = 0 }: { item: MediaItem; queue: MediaItem[]; index?: number }) {
  const current = usePlayer((s) => s.current)
  const status = usePlayer((s) => s.status)
  const fav = useStore((s) => s.favorites.some((f) => f.id === item.id))
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const isCurrent = current?.id === item.id
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.94, rotateX: -12 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, delay: index * 0.035 }}
      whileHover={{ y: -3 }}
      className="min-h-0 min-w-0"
      style={{ perspective: 800 }}
    >
      <SpotlightCard
        spotlightColor="rgba(168,85,247,0.35)"
        className={cn(
          'group relative h-full rounded-2xl !border-white/10 !bg-white/[0.04] p-0 backdrop-blur-md',
          isCurrent && 'uv-border !border-transparent',
        )}
      >
        <button
          type="button"
          onClick={() => (isCurrent ? toggle() : play(item, queue))}
          className="flex h-full w-full items-center gap-3 p-3 pr-11 text-left"
          aria-label={`Play ${item.name}`}
        >
          <Logo item={item} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-white">{item.name}</span>
              {isCurrent && <Eq playing={status === 'playing'} className="text-sm" />}
            </span>
            <span className="block truncate text-xs text-white/50">{item.meta || item.tags?.join(' · ')}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => toggleFavorite(item)}
          aria-label={fav ? 'Remove favorite' : 'Add favorite'}
          aria-pressed={fav}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-fuchsia-300"
        >
          <motion.span key={String(fav)} initial={{ scale: 0.4, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }}>
            <Heart className={cn('h-4 w-4', fav && 'fill-fuchsia-400 text-fuchsia-400')} />
          </motion.span>
        </button>
      </SpotlightCard>
    </motion.div>
  )
}

export function Transport({ compact = false }: { compact?: boolean }) {
  const { current, status } = usePlayer()
  const queueLen = usePlayer((s) => s.queue.length)
  const btn =
    'grid place-items-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/15 active:scale-90 disabled:opacity-30'
  const size = compact ? 'h-9 w-9' : 'h-11 w-11'
  return (
    <div className="flex items-center gap-2">
      <button className={cn(btn, size)} onClick={() => step(-1)} disabled={queueLen < 2} aria-label="Previous">
        <SkipBack className="h-4 w-4" />
      </button>
      <motion.button
        whileTap={{ scale: 0.88 }}
        className={cn(btn, size, 'bg-lime-300 !text-black hover:!bg-lime-200')}
        onClick={toggle}
        disabled={!current}
        aria-label={status === 'playing' ? 'Pause' : 'Play'}
      >
        {status === 'playing' ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
      </motion.button>
      <button className={cn(btn, size)} onClick={() => step(1)} disabled={queueLen < 2} aria-label="Next">
        <SkipForward className="h-4 w-4" />
      </button>
    </div>
  )
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('glass rounded-3xl', className)}>{children}</div>
}

export function ViewHeader({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-lime-300/90">{kicker}</div>
        <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">{title}</h1>
      </div>
      {children}
    </header>
  )
}
