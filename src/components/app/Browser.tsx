import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MediaRow, PageHeader, Seg } from '@/components/app/shared'
import { IOSSearchBar } from '@/components/ui/ios-search-bar'
import { Skeleton } from '@/components/ui/skeleton'
import { Scrubber, useSwipe } from '@/components/app/Scrubber'
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
    <div ref={outer} data-allow-scroll role="group" aria-label={label} className="fade-end shrink-0 overflow-hidden" data-fit={limit === 0}>
      <motion.div ref={inner} drag={limit > 0 ? 'x' : false} dragConstraints={{ left: -limit, right: 0 }} dragElastic={0.12} className="flex w-max gap-1.5 py-0.5 active:cursor-grabbing">
        {children}
      </motion.div>
    </div>
  )
}

interface Props {
  kind: MediaKind
  kicker: string
  title: string
  sub: ReactNode
  chips: readonly string[]
  initialChip: string
  load: (chip: string, query: string) => Promise<MediaItem[]>
  /** true: refetch when typing (radio directory). false: filter loaded list locally. */
  remoteSearch: boolean
  placeholder: string
  /** rail: one narrow column so the picture behind stays visible */
  layout?: 'wide' | 'rail'
  aside?: ReactNode
  onItems?: (items: MediaItem[]) => void
}

export function Browser({ kind, kicker, title, sub, chips, initialChip, load, remoteSearch, placeholder, layout = 'wide', aside, onItems }: Props) {
  const favorites = useStore((s) => s.favorites).filter((f) => f.kind === kind)
  const recent = useStore((s) => s.recent).filter((f) => f.kind === kind)
  const [tab, setTab] = useState<'discover' | 'saved' | 'recent'>('discover')
  const [chip, setChip] = useState(initialChip)
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [items, setItems] = useState<MediaItem[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [page, setPage] = useState(1)
  const [nonce, setNonce] = useState(0)
  const { ref, per, cols } = useGridFit(layout === 'rail' ? 9999 : 300, 56, 8, layout === 'rail' ? 1 : 3)

  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 380)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (tab !== 'discover') return
    let dead = false
    setState('loading')
    load(chip, remoteSearch ? dq : '')
      .then((list) => !dead && (setItems(list), setState('ready'), onItems?.(list)))
      .catch(() => !dead && (setItems([]), setState('error')))
    return () => {
      dead = true
    }
  }, [chip, dq, tab, remoteSearch, load, nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setPage(1), [chip, dq, tab, q])

  const source = tab === 'saved' ? favorites : tab === 'recent' ? recent : items
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle || (remoteSearch && tab === 'discover')) return source
    return source.filter((i) => i.name.toLowerCase().includes(needle))
  }, [source, q, remoteSearch, tab])

  const perPage = Math.max(1, per)
  const pages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, pages)
  const slice = filtered.slice((safePage - 1) * perPage, safePage * perPage)
  const swipe = useSwipe(() => setPage(Math.max(1, safePage - 1)), () => setPage(Math.min(pages, safePage + 1)))
  const loading = state === 'loading' && tab === 'discover'

  return (
    <section className={cn('grid h-full min-h-0 gap-6', layout === 'rail' ? 'lg:grid-cols-[minmax(380px,470px)_1fr]' : aside ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : '')}>
      <div className="flex min-h-0 min-w-0 flex-col gap-3">
        <PageHeader kicker={kicker} title={title} sub={sub}>
          <Seg id={`tabs-${kind}`} value={tab} onChange={(id) => setTab(id as typeof tab)} tabs={[{ id: 'discover', label: 'Discover' }, { id: 'saved', label: 'Saved', badge: favorites.length || undefined }, { id: 'recent', label: 'Recent' }]} />
        </PageHeader>

        <IOSSearchBar value={q} onChange={setQ} onClear={() => setQ('')} placeholder={placeholder} collapsedWidth="100%" expandedWidth="100%" className="max-w-full" />

        {tab === 'discover' && (
          <ChipRow label="Categories">
            {chips.map((c) => (
              <motion.button
                key={c}
                whileTap={{ scale: 0.96 }}
                onClick={() => setChip(c)}
                aria-pressed={chip === c}
                className={cn('h-11 shrink-0 px-3.5 md:h-9 text-[13px] capitalize transition-colors', chip === c ? 'bg-ink text-ground' : 'bg-ink/[0.07] text-ink ring-1 ring-ink/12 hover:bg-ink/12')}
              >
                {c}
              </motion.button>
            ))}
          </ChipRow>
        )}

        <div ref={ref} className="min-h-[56px] flex-1 overflow-hidden" {...swipe}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${tab}-${chip}-${dq}-${loading}`}
              className="grid h-full content-start gap-2"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: '56px' }}
              exit={{ opacity: 0, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }}
            >
              {loading
                ? Array.from({ length: Math.min(perPage, 12) }, (_, i) => (
                    <div key={i} className="flex h-14 items-center gap-3 rounded-2xl bg-ink/[0.04] px-3 ring-1 ring-ink/8" aria-hidden>
                      <Skeleton className="size-9 rounded-[10px]" />
                      <div className="grid flex-1 gap-1.5">
                        <Skeleton className="h-3 w-2/3 " />
                        <Skeleton className="h-2.5 w-1/3 " />
                      </div>
                    </div>
                  ))
                : slice.map((it, i) => <MediaRow key={it.id} item={it} queue={filtered} index={i} />)}
              {state === 'error' && tab === 'discover' && (
                <div className="col-span-full grid place-items-center gap-3 rounded-2xl border border-dashed border-ink/20 py-8 text-center text-sm text-ink-2">
                  Couldn’t load {kind === 'radio' ? 'stations' : 'channels'}. Check your connection.
                  <button className="h-11 bg-ink px-4 text-[13px] font-medium text-ground" onClick={() => setNonce((n) => n + 1)}>Try again</button>
                </div>
              )}
              {!loading && state !== 'error' && slice.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-ink/20 py-8 text-center text-sm text-ink-2">
                  {tab === 'saved' ? 'Nothing saved yet. Tap the heart on a listing to keep it here.' : tab === 'recent' ? 'Nothing played yet.' : 'No matches. Try another word or category.'}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <span className="fig whitespace-nowrap text-xs text-ink-2">{filtered.length ? `${(safePage - 1) * perPage + 1}–${Math.min(safePage * perPage, filtered.length)} of ${filtered.length}. Swipe, or drag the bar.` : '0 results'}</span>
          <Scrubber count={filtered.length} per={perPage} page={safePage} onPage={setPage} labelAt={(i) => filtered[i]?.name ?? ''} />
        </div>
      </div>
      {aside && <aside className="hidden min-h-0 lg:block">{aside}</aside>}
    </section>
  )
}
