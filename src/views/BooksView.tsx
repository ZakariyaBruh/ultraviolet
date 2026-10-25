import { Bookmark, BookmarkCheck, KeyRound } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BookReader } from '@/components/app/BookReader'
import { PageHeader, Panel, Seg } from '@/components/app/shared'
import { IOSSearchBar } from '@/components/ui/ios-search-bar'
import { Skeleton } from '@/components/ui/skeleton'
import { Scrubber, useSwipe } from '@/components/app/Scrubber'
import { BooksError, getBooksKey, lastBooksError, parseVolumeId, searchBooks, setBooksKey, SUBJECTS, type BookRef } from '@/lib/books'
import { fx_say } from '@/lib/actions'
import { useGridFit } from '@/lib/hooks'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

function Cover({ b }: { b: Pick<BookRef, 'thumb' | 'title'> }) {
  const [bad, setBad] = useState(false)
  return b.thumb && !bad ? (
    <img src={b.thumb} alt="" loading="lazy" onError={() => setBad(true)} className="h-full w-full object-cover" />
  ) : (
    <span className="grid size-full place-items-center bg-raised p-1 text-center font-[family-name:var(--font-cond)] text-[11px] font-semibold uppercase leading-3 text-ink-3">{b.title.slice(0, 24)}</span>
  )
}

function KeyPanel({ reason, onSaved }: { reason: 'nokey' | 'quota' | 'bad'; onSaved: () => void }) {
  const [v, setV] = useState(getBooksKey())
  const submit = (e: FormEvent) => { e.preventDefault(); setBooksKey(v); onSaved() }
  return (
    <Panel className="grid gap-3 p-5">
      <div className="flex items-center gap-2"><KeyRound className="size-5 text-signal" /><h2 className="text-base font-semibold">{reason === 'nokey' ? 'Search needs a Google Books key' : reason === 'quota' ? 'That key is out of quota for today' : 'Google did not accept that key'}</h2></div>
      <p className="max-w-[60ch] text-[14px] text-ink-2">Google no longer answers Books searches without a key. Make a free one at Google Cloud (enable the Books API, restrict it to this site), paste it here, and it stays in this browser only. Opening a book by link or ID needs no key.</p>
      {reason !== 'nokey' && lastBooksError && <p role="status" className="text-[13px] text-ink">Google says: {lastBooksError}</p>}
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input value={v} onChange={(e) => setV(e.target.value)} aria-label="Google Books API key" placeholder="AIza…" autoComplete="off" spellCheck={false} className="h-11 min-w-0 flex-1 border border-ink/30 bg-transparent px-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-signal" />
        <button type="submit" className="h-11 bg-signal px-5 text-sm font-semibold text-on-signal">Save key</button>
        <a href="https://console.cloud.google.com/apis/library/books.googleapis.com" target="_blank" rel="noreferrer" className="inline-flex h-11 items-center border border-ink/30 px-4 text-sm text-ink hover:bg-ink/10">Get a key</a>
      </form>
    </Panel>
  )
}

export function BooksView() {
  const shelf = useStore((s) => s.books)
  const toggle = useStore((s) => s.toggleBook)
  const [tab, setTab] = useState<'discover' | 'shelf' | 'open'>('discover')
  const [subject, setSubject] = useState(SUBJECTS[0])
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [items, setItems] = useState<BookRef[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error' | BooksError['kind']>('loading')
  const [page, setPage] = useState(1)
  const [nonce, setNonce] = useState(0)
  const [reading, setReading] = useState<(Pick<BookRef, 'id'> & Partial<BookRef>) | null>(null)
  const [link, setLink] = useState('')
  const { ref, per, cols } = useGridFit(300, 108, 8, 3)

  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 380); return () => clearTimeout(t) }, [q])
  useEffect(() => setPage(1), [tab, subject, dq])

  useEffect(() => {
    if (tab !== 'discover') return
    let dead = false
    setState('loading')
    searchBooks(dq || `subject:${subject}`)
      .then((r) => { if (!dead) { setItems(r.items); setState('ready') } })
      .catch((e) => { if (!dead) setState(e instanceof BooksError ? e.kind : 'error') })
    return () => { dead = true }
  }, [tab, subject, dq, nonce])

  const list = tab === 'shelf' ? shelf : items
  const pages = Math.max(1, Math.ceil(list.length / per))
  const safe = Math.min(page, pages)
  const slice = useMemo(() => list.slice((safe - 1) * per, safe * per), [list, safe, per])
  const swipe = useSwipe(() => setPage(Math.max(1, safe - 1)), () => setPage(Math.min(pages, safe + 1)))
  const loading = tab === 'discover' && state === 'loading'
  const needsKey = tab === 'discover' && (state === 'nokey' || state === 'quota' || state === 'bad')

  const openLink = (e: FormEvent) => {
    e.preventDefault()
    const id = parseVolumeId(link)
    if (!id) return fx_say({ title: 'That is not a Google Books link or ID', description: 'Paste a books.google.com link, or just the id after id=.', variant: 'danger' })
    setReading({ id })
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader kicker="Free ebooks" title="Books" sub="Free and public-domain titles from Google Books. Read them here, with the dial still under your thumb.">
        <Seg id="tabs-books" value={tab} onChange={(id) => setTab(id as typeof tab)} tabs={[{ id: 'discover', label: 'Discover' }, { id: 'shelf', label: 'Shelf', badge: shelf.length || undefined }, { id: 'open', label: 'Open' }]} />
      </PageHeader>

      {tab === 'discover' && (
        <>
          <IOSSearchBar value={q} onChange={setQ} onClear={() => setQ('')} placeholder="Search free ebooks" collapsedWidth="100%" expandedWidth="100%" className="max-w-full" />
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" data-allow-scroll role="group" aria-label="Subjects">
            {SUBJECTS.map((c) => (
              <button key={c} onClick={() => setSubject(c)} aria-pressed={!dq && subject === c} className={cn('h-11 shrink-0 px-3.5 text-[13px] capitalize transition-colors md:h-9', !dq && subject === c ? 'bg-ink text-ground' : 'bg-ink/[0.07] text-ink ring-1 ring-ink/12 hover:bg-ink/12')}>{c}</button>
            ))}
          </div>
        </>
      )}

      {tab === 'open' ? (
        <Panel className="grid gap-4 p-5">
          <div>
            <h2 className="text-base font-semibold">Open a book by link or ID</h2>
            <p className="mt-1 max-w-[60ch] text-[14px] text-ink-2">Paste a link from books.google.com, or the id after <code>id=</code>. This works without a key.</p>
          </div>
          <form onSubmit={openLink} className="flex flex-wrap gap-2">
            <input value={link} onChange={(e) => setLink(e.target.value)} aria-label="Google Books link or ID" placeholder="https://books.google.com/books?id=…" className="h-11 min-w-0 flex-1 border border-ink/30 bg-transparent px-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-signal" />
            <button type="submit" className="h-11 bg-signal px-5 text-sm font-semibold text-on-signal">Open</button>
          </form>
          <KeyRow />
        </Panel>
      ) : needsKey ? (
        <KeyPanel reason={state as 'nokey' | 'quota' | 'bad'} onSaved={() => { setNonce((n) => n + 1) }} />
      ) : (
        <>
          <div ref={ref} className="min-h-[108px] flex-1 overflow-hidden" {...swipe}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={`${tab}-${subject}-${dq}-${loading}`} className="grid h-full content-start gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: '108px' }} exit={{ opacity: 0, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }}>
                {loading
                  ? Array.from({ length: Math.min(per, 9) }, (_, i) => (
                      <div key={i} className="flex h-[108px] gap-3 border border-ink/10 p-2" aria-hidden><Skeleton className="h-full w-[64px]" /><div className="grid flex-1 content-start gap-2 pt-1"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-2.5 w-1/2" /></div></div>
                    ))
                  : slice.map((b, i) => (
                      <motion.div key={b.id} layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: Math.min(i, 8) * 0.025 }} className="relative min-w-0">
                        <button onClick={() => setReading(b)} className="flex h-[108px] w-full gap-3 border border-ink/15 bg-ink/[0.03] p-2 text-left transition-colors hover:border-signal/60 hover:bg-ink/[0.06]">
                          <span className="block h-full w-[64px] shrink-0 overflow-hidden bg-raised"><Cover b={b} /></span>
                          <span className="min-w-0 flex-1 pr-9">
                            <span className="line-clamp-2 text-[14px] font-semibold leading-[18px] text-ink">{b.title}</span>
                            <span className="mt-1 block truncate text-[13px] text-ink-2">{b.authors || 'Unknown author'}</span>
                            <span className="hud mt-1 block">Read here{b.pages ? ` · ${b.pages} p` : ''}</span>
                          </span>
                        </button>
                        <button onClick={() => toggle(b)} aria-pressed={shelf.some((s) => s.id === b.id)} aria-label={shelf.some((s) => s.id === b.id) ? `Remove ${b.title} from shelf` : `Keep ${b.title} on shelf`} className="absolute right-1 top-1 grid size-11 place-items-center text-ink-2 hover:text-signal">
                          {shelf.some((s) => s.id === b.id) ? <BookmarkCheck className="size-5 text-signal" /> : <Bookmark className="size-5" />}
                        </button>
                      </motion.div>
                    ))}
                {!loading && slice.length === 0 && (
                  <div className="col-span-full border border-dashed border-ink/25 p-8 text-center text-sm text-ink-2">
                    {tab === 'shelf' ? 'Nothing on your shelf yet. Press the bookmark on any book.' : state === 'error' || state === 'network' ? 'Could not reach Google Books. Check your connection.' : 'No free ebooks you can read here matched that. Try another word.'}
                    {(state === 'error' || state === 'network') && tab === 'discover' && <button className="ml-3 h-11 bg-ink px-4 text-ground" onClick={() => setNonce((n) => n + 1)}>Try again</button>}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <span className="hud">{list.length ? `${(safe - 1) * per + 1}-${Math.min(safe * per, list.length)} of ${list.length}` : ' '}</span>
            <Scrubber count={list.length} per={per} page={safe} onPage={setPage} labelAt={(i) => list[i]?.title ?? ''} />
          </div>
        </>
      )}
      {reading && <BookReader book={reading} onClose={() => setReading(null)} />}
    </section>
  )
}

function KeyRow() {
  const [open, setOpen] = useState(false)
  const has = !!getBooksKey()
  return open ? <KeyPanel reason="nokey" onSaved={() => { setOpen(false); fx_say({ title: 'Key saved in this browser' }) }} /> : (
    <button onClick={() => setOpen(true)} className="hud inline-flex min-h-11 items-center gap-2 justify-self-start hover:text-ink"><KeyRound className="size-4" />{has ? 'Change search key' : 'Add a search key'}</button>
  )
}
