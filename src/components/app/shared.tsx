import { Heart, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatedTabs } from '@/components/ui/animated-tabs'
import { OrbitalLoadingRing } from '@/components/ui/orbital-loading-ring'
import { play, step, toggle, usePlayer, video } from '@/lib/player'
import { useStore, type MediaItem } from '@/lib/store'
import { cn } from '@/lib/utils'

export function Eq({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn('eq', !playing && 'paused', className)}>
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}

/** Segmented control: EasyUI animated tabs used without panels. */
export function Seg({
  tabs,
  value,
  onChange,
  id,
  className,
}: {
  tabs: { id: string; label: string; badge?: string | number }[]
  value: string
  onChange: (id: string) => void
  id: string
  className?: string
}) {
  return (
    <AnimatedTabs
      tabs={tabs}
      activeTab={value}
      onChange={onChange}
      layoutId={id}
      variant="default"
      renderContent={false}
      className={className}
    />
  )
}

export function Panel({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('panel', className)} {...rest}>
      {children}
    </div>
  )
}

export function PageHeader({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold leading-8 tracking-[-0.01em] text-ink">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-ink-2">{sub}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  )
}

/** Greyscale test bars: the "no signal" screen. */
export function TestBars({ className }: { className?: string }) {
  const tones = ['#e9ebef', '#d9dce2', '#c6cad2', '#b1b6c0', '#9aa0ac', '#848b98', '#6d7482']
  return (
    <div aria-hidden className={cn('flex h-full w-full', className)}>
      {tones.map((t, i) => (
        <motion.div
          key={t}
          className="h-full flex-1 origin-bottom"
          style={{ background: t }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: i * 0.04, duration: 0.35, ease: [0.2, 0, 0, 1] }}
        />
      ))}
    </div>
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
    <div className={cn('relative overflow-hidden rounded-md bg-[#e9ebef]', className)}>
      <div ref={host} className="absolute inset-0 [&>video]:h-full [&>video]:w-full [&>video]:object-cover" />
      {!isTv && (
        <div className="absolute inset-0 z-[3]">
          <TestBars />
          <div className="absolute inset-x-0 bottom-0 bg-surface/90 px-3 py-2 text-[13px] text-ink">No signal. Choose a channel on TV.</div>
        </div>
      )}
      {isTv && status === 'loading' && (
        <div className="absolute inset-0 z-[3] grid place-items-center bg-surface/80">
          <OrbitalLoadingRing size={72} label="Tuning" />
        </div>
      )}
      {isTv && status === 'error' && (
        <div className="absolute inset-0 z-[3] grid place-items-center bg-surface/90 p-4 text-center text-sm text-ink">
          {error ?? 'Stream unavailable'}. Trying the next channel.
        </div>
      )}
    </div>
  )
}

export function Logo({ item, size = 40 }: { item: Pick<MediaItem, 'logo' | 'name'>; size?: number }) {
  const initials = item.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <div
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-[4px] bg-raised text-[11px] font-medium text-ink-2"
      style={{ width: size, height: size }}
    >
      {initials}
      {item.logo && (
        <img
          src={item.logo}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full bg-white object-contain p-1"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}
    </div>
  )
}

/** One listing: logo, name, meta, favourite. Reads like a row in a programme guide. */
export function MediaRow({ item, queue, index = 0 }: { item: MediaItem; queue: MediaItem[]; index?: number }) {
  const current = usePlayer((s) => s.current)
  const status = usePlayer((s) => s.status)
  const fav = useStore((s) => s.favorites.some((f) => f.id === item.id))
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const isCurrent = current?.id === item.id
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.22, ease: [0.2, 0, 0, 1], delay: Math.min(index, 11) * 0.025 }}
      className={cn(
        'group relative flex h-14 min-w-0 items-center gap-3 rounded-md border border-transparent bg-surface px-3 transition-colors hover:border-[var(--control)]',
        isCurrent && 'border-signal/60 bg-signal-soft/50',
      )}
    >
      <button
        type="button"
        onClick={() => (isCurrent ? toggle() : play(item, queue))}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        aria-current={isCurrent ? 'true' : undefined}
      >
        <span className="sr-only">{isCurrent && status === 'playing' ? 'Pause ' : 'Play '}</span>
        <Logo item={item} size={36} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">{item.name}</span>
            {isCurrent && <Eq playing={status === 'playing'} />}
          </span>
          <span className="block truncate text-[13px] text-ink-2">{item.meta || item.tags?.join(', ')}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => toggleFavorite(item)}
        aria-label={fav ? `Remove ${item.name} from saved` : `Save ${item.name}`}
        aria-pressed={fav}
        className="grid size-11 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:text-ink md:size-9"
      >
        <motion.span key={String(fav)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 28 }}>
          <Heart className={cn('size-4', fav && 'fill-ink text-ink')} />
        </motion.span>
      </button>
    </motion.div>
  )
}

export function Transport({ compact = false }: { compact?: boolean }) {
  const { current, status } = usePlayer()
  const queueLen = usePlayer((s) => s.queue.length)
  const base = 'grid place-items-center rounded-full border border-[var(--control)] bg-surface text-ink transition-colors hover:bg-raised disabled:opacity-40 disabled:hover:bg-surface'
  const size = compact ? 'size-9' : 'size-11'
  return (
    <div className="flex items-center gap-1.5">
      <motion.button whileTap={{ scale: 0.95 }} className={cn(base, size, compact && 'max-[359px]:hidden')} onClick={() => step(-1)} disabled={queueLen < 2} aria-label="Previous">
        <SkipBack className="size-4" />
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.95 }}
        className={cn(base, size, '!border-ink !bg-ink !text-white hover:!bg-[#2a2a2a]')}
        onClick={toggle}
        disabled={!current}
        aria-label={status === 'playing' ? 'Pause' : 'Play'}
      >
        {status === 'playing' ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
      </motion.button>
      <motion.button whileTap={{ scale: 0.95 }} className={cn(base, size, compact && 'max-[359px]:hidden')} onClick={() => step(1)} disabled={queueLen < 2} aria-label="Next">
        <SkipForward className="size-4" />
      </motion.button>
    </div>
  )
}

/** Divided KPI strip: label over figure, no tiles, no icons. */
export function Strip({ cells, compact = false }: { cells: { label: string; value: ReactNode; unit?: string; note?: ReactNode }[]; compact?: boolean }) {
  return (
    <dl className={cn('grid gap-y-4 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none sm:divide-x sm:divide-[var(--rule)]', compact ? 'auto-cols-fr grid-flow-col divide-x divide-[var(--rule)]' : 'grid-cols-2')}>
      {cells.map((c) => (
        <div key={c.label} className={cn('min-w-0 sm:px-4 sm:first:pl-0 sm:last:pr-0', compact && 'px-3 first:pl-0 last:pr-0')}>
          <dt className="truncate text-[13px] text-ink-2">{c.label}</dt>
          <dd className={cn('mt-1 flex items-baseline gap-1 font-normal text-ink', compact ? 'text-[22px] leading-7 sm:text-[26px] sm:leading-8' : 'text-[26px] leading-8')}>
            <span className="fig">{c.value}</span>
            {c.unit && <span className="text-sm text-ink-2">{c.unit}</span>}
          </dd>
          {c.note && <dd className={cn('mt-0.5 truncate text-[13px] text-ink-2', compact && 'hidden sm:block')}>{c.note}</dd>}
        </div>
      ))}
    </dl>
  )
}
