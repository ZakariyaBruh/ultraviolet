import { Heart, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Glass } from '@/components/app/glass'
import { AnimatedTabs } from '@/components/ui/animated-tabs'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { play, step, toggle, usePlayer } from '@/lib/player'
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

/** Segmented control: EasyUI animated tabs in their glass variant, used without panels. */
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
  return <AnimatedTabs tabs={tabs} activeTab={value} onChange={onChange} layoutId={id} variant="glass" renderContent={false} className={className} tabsContainerClassName="max-w-full [&_button]:px-3 sm:[&_button]:px-4" />
}

/** Content-layer surface (thicker material, no refraction). */
export function Panel({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('material', className)} {...rest}>
      {children}
    </div>
  )
}

export function PageHeader({ title, sub, kicker, children }: { title: string; sub?: ReactNode; kicker?: string; children?: ReactNode }) {
  return (
    <header className="flex shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {kicker && <div className="hud mb-1 flex items-center gap-2"><span className="inline-block h-px w-5 bg-signal/70" />{kicker}</div>}
        <h1 className="dot text-[clamp(1.6rem,3.4vw,2.4rem)] font-bold uppercase text-ink">{title}</h1>
        {sub && <p className="mt-0.5 max-w-[60ch] text-sm text-ink-2">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
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
    <div className="relative grid shrink-0 place-items-center overflow-hidden rounded-[10px] bg-ink/10 text-xs font-medium text-ink-2 ring-1 ring-ink/10" style={{ width: size, height: size }}>
      {initials}
      {item.logo && (
        <img src={item.logo} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 size-full bg-ink/90 object-contain p-1" onError={(e) => (e.currentTarget.style.display = 'none')} />
      )}
    </div>
  )
}

/** One listing: logo, name, meta, save. Content layer, so a material row, not glass. */
export function MediaRow({ item, queue, index = 0 }: { item: MediaItem; queue: MediaItem[]; index?: number }) {
  const current = usePlayer((s) => s.current)
  const status = usePlayer((s) => s.status)
  const fav = useStore((s) => s.favorites.some((f) => f.id === item.id))
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const isCurrent = current?.id === item.id
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.24, ease: [0.2, 0, 0, 1], delay: Math.min(index, 11) * 0.01 }}
      className="min-h-0 min-w-0"
    >
      <SpotlightCard
        spotlightColor="rgba(255,90,31,0.18)"
        className={cn('group relative !rounded-2xl !border-ink/10 !bg-ink/[0.04] !p-0', isCurrent && '!border-signal/50 !bg-signal/10')}
      >
        <div className="flex h-14 items-center gap-3 px-3">
        <button type="button" onClick={() => (isCurrent ? toggle() : play(item, queue))} aria-current={isCurrent ? 'true' : undefined} className="flex min-w-0 flex-1 items-center gap-3 text-left">
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
          className="grid size-11 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:text-ink md:size-9"
        >
          <motion.span key={String(fav)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 28 }}>
            <Heart className={cn('size-4', fav && 'fill-signal text-signal')} />
          </motion.span>
        </button>
        </div>
      </SpotlightCard>
    </motion.div>
  )
}

export function Transport({ compact = false }: { compact?: boolean }) {
  const { current, status } = usePlayer()
  const queueLen = usePlayer((s) => s.queue.length)
  const size = compact ? 'size-11 md:size-9' : 'size-11'
  const base = 'grid place-items-center rounded-full text-ink transition-colors hover:bg-ink/10 disabled:opacity-35'
  return (
    <div className="flex items-center gap-1.5">
      <motion.button whileTap={{ scale: 0.95 }} className={cn(base, size)} onClick={() => step(-1)} disabled={queueLen < 2} aria-label="Previous">
        <SkipBack className="size-4" />
      </motion.button>
      <motion.button whileTap={{ scale: 0.95 }} className={cn(base, size, '!bg-ink !text-ground hover:!bg-white')} onClick={toggle} disabled={!current} aria-label={status === 'playing' ? 'Pause' : 'Play'}>
        {status === 'playing' ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
      </motion.button>
      <motion.button whileTap={{ scale: 0.95 }} className={cn(base, size)} onClick={() => step(1)} disabled={queueLen < 2} aria-label="Next">
        <SkipForward className="size-4" />
      </motion.button>
    </div>
  )
}

/** HUD readout: a mono caption over a large figure. */
export function Readout({ label, value, unit, note, className }: { label: string; value: ReactNode; unit?: string; note?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="hud truncate">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5 text-ink">
        <span className="fig text-[30px] leading-9">{value}</span>
        {unit && <span className="text-sm text-ink-2">{unit}</span>}
      </div>
      {note && <div className="mt-0.5 truncate text-[13px] text-ink-2">{note}</div>}
    </div>
  )
}

export function GlassIconButton({ label, onClick, children, className }: { label: string; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <Glass as="button" clear radius={999} onClick={onClick} aria-label={label} className={cn('grid size-11 place-items-center text-ink md:size-10', className)}>
      {children}
    </Glass>
  )
}
