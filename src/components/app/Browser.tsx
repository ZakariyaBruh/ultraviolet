import { Search } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SlidePagination } from '@/components/ui/slide-pagination'
import { MediaCard, Seg, ViewHeader } from '@/components/app/shared'
import { useGridFit } from '@/lib/hooks'
import { useStore, type MediaItem, type MediaKind } from '@/lib/store'
import { cn } from '@/lib/utils'

/** One row of chips you drag sideways (nothing here scrolls vertically). */
function ChipRow({ children, label }: { children: ReactNode; label: string }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [limit, setLimit] = useState(0)
  useLayoutEffect(() => {
    const m = () => setLimit(Math.max(0, (inner.current?.scrollWidth ?? 0) - (outer.current?.clientWidth ?? 0)))
    m()
    const ro = new ResizeObserver(m)
    if (outer.current) ro.observe(outer.current)
    if (inner.current) ro.observe(inner.current)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={outer} data-allow-scroll role="group" aria-label={label} className="relative shrink-0 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-24px),transparent)]">
      <motion.div ref={inner} drag={limit > 0 ? 'x' : false} dragConstraints={{ left: -limit, right: 0 }} dragElastic={0.18} className="flex w-max cursor-grab gap-1.5 px-3 py-0.5 active:cursor-grabbing">
        {children}
      </motion.div>
    </div>
  )
}

interface Props {
  kind: MediaKind
  kicker: string
  title: string
  chips: readonly string[]
  initialChip: string
  load: (chip: string, query: string) => Promise<MediaItem[]>
  /** true: refetch when typing (radio directory). false: filter loaded list locally. */
  remoteSearch: boolean
  placeholder: string
  side?: ReactNode
}

export function Browser({ kind, kicker, title, chips, initialChip, load, remoteSearch, placeholder, side }: Props) {
  const favorites = useStore((s) => s.favorites).filter((f) => f.kind === kind)
  const recent = useStore((s) => s.recent).filter((f) => f.kind === kind)
  const [tab, setTab] = useState<'discover' | 'favorites' | 'recent'>('discover')
  const [chip, setChip] = useState(initialChip)
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [items, setItems] = useState<MediaItem[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [page, setPage] = useState(1)
  const [nonce, setNonce] = useState(0)
  const { ref, per, cols } = useGridFit(230, 74, 10, 4)

  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 380)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (tab !== 'discover') return
    let dead = false
    setState('loading')
    load(chip, remoteSearch ? dq : '')
      .then((list) => !dead && (setItems(list), setState('ready')))
      .catch(() => !dead && (setItems([]), setState('error')))
    return () => {
      dead = true
    }
  }, [chip, dq, tab, remoteSearch, load, nonce])

  useEffect(() => setPage(1), [chip, dq, tab, q])

  const source = tab === 'favorites' ? favorites : tab === 'recent' ? recent : items
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle || (remoteSearch && tab === 'discover')) return source
    return source.filter((i) => i.name.toLowerCase().includes(needle))
  }, [source, q, remoteSearch, tab])

  const perPage = Math.max(1, per)
  const pages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, pages)
  const slice = filtered.slice((safePage - 1) * perPage, safePage * perPage)

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 lg:flex-row lg:gap-6">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <ViewHeader kicker={kicker} title={title}>
          <Seg
            id={`tabs-${kind}`}
            value={tab}
            onChange={(id) => setTab(id as typeof tab)}
            tabs={[
              { id: 'discover', label: 'Discover' },
              { id: 'favorites', label: 'Saved', badge: favorites.length || undefined },
              { id: 'recent', label: 'Recent' },
            ]}
          />
        </ViewHeader>

        <label className="glass flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 focus-within:ring-2 focus-within:ring-violet-400/70">
          <Search className="h-4 w-4 text-white/50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
          />
        </label>

        {tab === 'discover' && (
          <ChipRow label="Categories">
            {chips.map((c, i) => (
              <motion.button
                key={c}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.025 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setChip(c)}
                aria-pressed={chip === c}
                className={cn(
                  'relative shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors',
                  chip === c ? 'text-black' : 'border border-white/10 bg-white/5 text-white/70 hover:text-white',
                )}
              >
                {chip === c && (
                  <motion.span layoutId={`chip-${kind}`} className="absolute inset-0 rounded-full bg-lime-300" transition={{ type: 'spring', stiffness: 420, damping: 30 }} />
                )}
                <span className="relative">{c}</span>
              </motion.button>
            ))}
          </ChipRow>
        )}

        <div ref={ref} className="min-h-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${tab}-${chip}-${dq}-${safePage}-${state}`}
              className="grid h-full content-start gap-2.5"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: '74px' }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.18 }}
            >
              {state === 'loading' && tab === 'discover'
                ? Array.from({ length: Math.min(perPage, 12) }, (_, i) => (
                    <div key={i} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ animation: `shimmer-x 1.4s ${i * 0.08}s infinite` }} />
                    </div>
                  ))
                : slice.map((it, i) => <MediaCard key={it.id} item={it} queue={filtered} index={i} />)}
              {state === 'error' && tab === 'discover' && (
                <div className="col-span-full grid place-items-center gap-2 py-10 text-center text-sm text-white/60">
                  Couldn’t reach the directory.
                  <button className="rounded-full bg-lime-300 px-4 py-1.5 text-xs font-bold text-black" onClick={() => setNonce((n) => n + 1)}>
                    Try again
                  </button>
                </div>
              )}
              {state === 'ready' && slice.length === 0 && (
                <div className="col-span-full py-10 text-center text-sm text-white/50">
                  {tab === 'favorites' ? 'Tap the heart on anything you want to keep.' : tab === 'recent' ? 'Nothing played yet.' : 'No matches. Try another word.'}
                </div>
              )}
              {tab !== 'discover' && slice.length === 0 && (
                <div className="col-span-full py-10 text-center text-sm text-white/50">
                  {tab === 'favorites' ? 'Tap the heart on anything you want to keep.' : 'Nothing played yet.'}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex shrink-0 justify-center">
          <SlidePagination pageCount={pages} page={safePage} onChange={setPage} siblingCount={1} />
        </div>
      </div>
      {side && <aside className="shrink-0 lg:w-[380px]">{side}</aside>}
    </section>
  )
}
