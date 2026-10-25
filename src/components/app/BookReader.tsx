import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, ExternalLink, Search, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Scrubber } from '@/components/app/Scrubber'
import { embedUrl, type BookRef } from '@/lib/books'
import { useStore } from '@/lib/store'

/**
 * The reader. Google serves the pages (there is no text to fetch), so the page itself is Google's embedded reader.
 * Everything around it is ours: the frame, page turning, jump-to-page, find-in-book, the shelf, and the keys.
 */
export function BookReader({ book, onClose }: { book: Pick<BookRef, 'id'> & Partial<BookRef>; onClose: () => void }) {
  const [page, setPage] = useState(0)
  const [jump, setJump] = useState('')
  const [term, setTerm] = useState('')
  const [find, setFind] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [slow, setSlow] = useState(false)
  const shelved = useStore((s) => s.books.some((b) => b.id === book.id))
  const toggle = useStore((s) => s.toggleBook)
  const [shown, setShown] = useState(0)
  useEffect(() => { const t = setTimeout(() => setShown(page), 350); return () => clearTimeout(t) }, [page])
  const src = embedUrl(book.id, shown, find)
  const open = `https://books.google.com/books?id=${encodeURIComponent(book.id)}`

  useEffect(() => { setLoaded(false); setSlow(false); const t = setTimeout(() => setSlow(true), 12000); return () => clearTimeout(t) }, [src])

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if ((e.target as Element | null)?.closest?.('input')) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); setPage((p) => p + 1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); setPage((p) => Math.max(0, p - 1)) }
    }
    addEventListener('keydown', key)
    return () => { removeEventListener('keydown', key); prev?.focus?.() }
  }, [onClose])

  const goto = (e: FormEvent) => { e.preventDefault(); const n = parseInt(jump, 10); if (n >= 0) { setPage(n); setJump('') } }
  const search = (e: FormEvent) => { e.preventDefault(); setFind(term.trim()) }
  const btn = 'grid size-11 place-items-center border border-ink/30 text-ink transition-colors hover:bg-ink/10 disabled:opacity-40'
  const input = 'h-11 min-w-0 border border-ink/30 bg-transparent px-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-signal'

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Reading ${book.title ?? 'book'}`} className="fixed inset-0 z-[80] flex flex-col bg-ground text-ink">
      <header className="flex shrink-0 items-center gap-3 border-b border-ink/20 px-3 py-2 sm:px-6">
        <button onClick={onClose} aria-label="Close the book" className={btn}><X className="size-5" /></button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{book.title ?? 'Book'}</div>
          <div className="hud truncate">{book.authors || 'Free ebook'}</div>
        </div>
        <button onClick={() => book.title && toggle({ id: book.id, title: book.title, authors: book.authors ?? '', thumb: book.thumb, pages: book.pages, embeddable: true, link: book.link })} disabled={!book.title} aria-pressed={shelved} aria-label={shelved ? 'Remove from shelf' : 'Keep on shelf'} className={btn}>
          {shelved ? <BookmarkCheck className="size-5 text-signal" /> : <Bookmark className="size-5" />}
        </button>
      </header>

      <div className="relative min-h-0 flex-1 bg-white">
        <iframe key={src} src={src} title={`${book.title ?? 'Book'}, read through Google Books`} onLoad={() => setLoaded(true)} className="size-full border-0" allow="fullscreen" />
        {!loaded && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-surface"><span className="hud">Opening the book…</span></div>}
        {slow && !loaded && (
          <div className="absolute inset-x-0 bottom-3 grid place-items-center px-4"><a href={open} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 bg-signal px-5 text-sm font-semibold text-on-signal">Taking long? Open on Google Books <ExternalLink className="size-4" /></a></div>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-ink/20 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="flex items-center gap-2">
          <button className={btn} onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous page"><ChevronLeft className="size-5" /></button>
          <form onSubmit={goto} className="flex items-center gap-2">
            <input value={jump} onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))} inputMode="numeric" aria-label="Go to page" placeholder={page === 0 ? 'Cover' : `p ${page}`} className={`${input} w-20 text-center`} />
          </form>
          <button className={btn} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="size-5" /></button>
        </div>
        {book.pages && book.pages > 1 && (
          <Scrubber className="order-last basis-full sm:order-none sm:min-w-[220px] sm:flex-1 sm:basis-auto" count={book.pages + 1} per={1} page={page + 1} onPage={(p) => setPage(p - 1)} labelAt={(i) => (i === 0 ? 'Cover' : `Page ${i}`)} />
        )}
        <form onSubmit={search} className="order-last flex min-w-0 basis-full items-center gap-2 sm:order-none sm:max-w-sm sm:flex-1 sm:basis-auto" role="search">
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Find in this book" aria-label="Find in this book" className={`${input} flex-1`} />
          <button type="submit" className={btn} aria-label="Find"><Search className="size-5" /></button>
        </form>
        <a href={open} target="_blank" rel="noreferrer" className="hud inline-flex min-h-11 items-center gap-1.5 hover:text-ink">Google Books <ExternalLink className="size-3.5" /></a>
      </footer>
    </div>,
    document.body,
  )
}
