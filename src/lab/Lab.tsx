import { Suspense, lazy, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { CATALOG_INDEX } from '@/components/registry/catalog-index'
import { PageHeader } from '@/components/app/shared'
import { AnimatedTabs } from '@/components/ui/animated-tabs'
import { Badge } from '@/components/ui/badge'
import { IOSSearchBar } from '@/components/ui/ios-search-bar'
import { SlidePagination } from '@/components/ui/slide-pagination'
import { useGridFit } from '@/lib/hooks'
import primary from './primary.json'
import { DEMOS, STAGE_H } from './demos'
import { StageBoundary } from './ErrorBoundary'
import { USED } from './used'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'

const loaders = import.meta.glob('/src/components/ui/*.tsx') as Record<string, () => Promise<Record<string, unknown>>>
const cache = new Map<string, ComponentType>()

type Prim = { export: string; req: string[]; all: string[] }

function Stage({ id }: { id: string }) {
  const Comp = useMemo(() => {
    if (cache.has(id)) return cache.get(id)!
    const C = lazy(async () => {
      const m = await loaders[`/src/components/ui/${id}.tsx`]()
      const p = (primary as Record<string, Prim>)[id]
      const demo = DEMOS[id]
      const render = () => {
        if (demo) return demo(m as Record<string, unknown>)
        const X = (m[p.export] ?? m.default) as ComponentType | undefined
        if (!X) return <div className="text-sm text-ink-2">No renderable export.</div>
        return <X />
      }
      return { default: () => <>{render()}</> }
    })
    cache.set(id, C)
    return C
  }, [id])
  return (
    <StageBoundary name={id}>
      <Suspense fallback={<div className="grid h-full place-items-center text-xs text-ink-3">Loading…</div>}>
        <Comp />
      </Suspense>
    </StageBoundary>
  )
}

function Tile({ id, name, description, motion: isMotion, index }: { id: string; name: string; description: string; motion: boolean; index: number }) {
  const used = USED[id]
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.22, ease: [0.2, 0, 0, 1], delay: index * 0.03 }}
      className="material flex min-h-0 min-w-0 flex-col overflow-hidden [--r:16px]"
      aria-label={name}
    >
      <header className="flex items-center justify-between gap-2 px-4 pt-3">
        <h3 className="min-w-0 truncate text-sm font-medium text-ink">{name}</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {used && <Badge tone="success" variant="soft">In app</Badge>}
          <Badge tone="neutral" variant="outline">{isMotion ? 'Motion' : 'Interface'}</Badge>
        </div>
      </header>
      <div className={cn('relative mx-3 my-2 min-h-0 flex-1 overflow-hidden rounded-xl bg-black/30 [transform:translateZ(0)]', STAGE_H[id])}>
        <div className="grid h-full min-h-[150px] place-items-center overflow-hidden p-3">
          <Stage id={id} />
        </div>
      </div>
      <footer className="px-4 pb-3 text-xs text-ink-2">
        <p className="line-clamp-2">{description}</p>
        {used && <p className="mt-1 text-ink">In the app: {used}</p>}
      </footer>
    </motion.article>
  )
}

export function Lab({ onCount }: { onCount?: (n: number) => void }): ReactNode {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'app' | 'Motion' | 'Interface'>('all')
  const [page, setPage] = useState(1)
  const { ref, per } = useGridFit(340, 330, 16, 3)

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return CATALOG_INDEX.filter((c) => (filter === 'all' ? true : filter === 'app' ? !!USED[c.id] : c.category === filter)).filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.description.toLowerCase().includes(needle))
  }, [q, filter])

  useEffect(() => setPage(1), [q, filter])
  useEffect(() => onCount?.(CATALOG_INDEX.length), [onCount])

  const perPage = Math.max(1, per)
  const pages = Math.max(1, Math.ceil(list.length / perPage))
  const safe = Math.min(page, pages)
  const slice = list.slice((safe - 1) * perPage, safe * perPage)
  const usedCount = CATALOG_INDEX.filter((c) => USED[c.id]).length

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader title="Lab" sub={`All ${CATALOG_INDEX.length} EasyUI components, live in this theme. ${usedCount} are used in the app itself.`}>
        <AnimatedTabs
          variant="glass"
          renderContent={false}
          layoutId="lab-filter"
          activeTab={filter}
          onChange={(id) => setFilter(id as typeof filter)}
          tabs={[{ id: 'all', label: 'All' }, { id: 'app', label: 'In app' }, { id: 'Interface', label: 'Interface' }, { id: 'Motion', label: 'Motion' }]}
        />
      </PageHeader>
      <IOSSearchBar value={q} onChange={setQ} onClear={() => setQ('')} placeholder={`Search ${CATALOG_INDEX.length} components`} collapsedWidth="100%" expandedWidth="100%" className="max-w-full" />
      <div ref={ref} className="min-h-[200px] flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <div key={`${filter}-${q}-${safe}`} className="grid h-full gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(3, Math.floor(((ref.current?.clientWidth ?? 900) + 16) / 356)))}, minmax(0, 1fr))`, gridAutoRows: 'minmax(0, 1fr)' }}>
            {slice.map((c, i) => (
              <Tile key={c.id} id={c.id} name={c.name} description={c.description} motion={c.category === 'Motion'} index={i} />
            ))}
            {slice.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-ink-2">No components match.</div>}
          </div>
        </AnimatePresence>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="fig whitespace-nowrap text-xs text-ink-2">{list.length ? `${(safe - 1) * perPage + 1}–${Math.min(safe * perPage, list.length)} of ${list.length}` : '0'}</span>
        <SlidePagination pageCount={pages} page={safe} onChange={setPage} siblingCount={1} />
      </div>
    </section>
  )
}
