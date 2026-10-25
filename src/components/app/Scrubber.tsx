import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'

/**
 * Move through a long list without scrolling. The track stands for the whole list and the thumb is the window you can
 * see. Drag it and the page changes live while a bubble names the item under your thumb. Keys: arrows step a page,
 * PageUp/PageDown jump ten, Home and End go to the ends.
 */
export function Scrubber({ count, per, page, onPage, labelAt, className }: { count: number; per: number; page: number; onPage: (p: number) => void; labelAt: (i: number) => string; className?: string }) {
  const track = useRef<HTMLDivElement>(null)
  const down = useRef(false)
  const [bubble, setBubble] = useState<number | null>(null)
  const pages = Math.max(1, Math.ceil(count / Math.max(1, per)))
  const win = Math.max(0.05, Math.min(1, per / Math.max(1, count)))
  const left = pages <= 1 ? 0 : ((page - 1) / (pages - 1)) * (1 - win)
  const atIndex = (clientX: number) => {
    const r = track.current!.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - r.left - (win * r.width) / 2) / Math.max(1, r.width * (1 - win))))
    const p = 1 + Math.round(f * (pages - 1))
    return { p, i: Math.min(count - 1, (p - 1) * per) }
  }
  const move = (e: PointerEvent) => {
    const { p, i } = atIndex(e.clientX)
    setBubble(i)
    if (p !== page) onPage(p)
  }
  const onDown = (e: PointerEvent) => { down.current = true; track.current?.setPointerCapture?.(e.pointerId); move(e) }
  const onMove = (e: PointerEvent) => { if (down.current) move(e) }
  const onUp = () => { down.current = false; setBubble(null) }
  const key = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'PageDown' ? 10 : e.key === 'PageUp' ? -10 : 0
    if (d) { e.preventDefault(); onPage(Math.min(pages, Math.max(1, page + d))); return }
    if (e.key === 'Home') { e.preventDefault(); onPage(1) } else if (e.key === 'End') { e.preventDefault(); onPage(pages) }
  }
  const first = Math.min(count - 1, (page - 1) * per)
  const marks = Math.min(40, pages)
  if (count <= per) return null
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Previous page" className="grid size-11 shrink-0 place-items-center border border-ink/30 text-ink hover:bg-ink/10 disabled:opacity-40"><ChevronLeft className="size-5" /></button>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Move through the list"
        aria-valuemin={1}
        aria-valuemax={pages}
        aria-valuenow={page}
        aria-valuetext={`Page ${page} of ${pages}, starting at ${labelAt(first)}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={key}
        className="relative h-11 min-w-0 flex-1 cursor-ew-resize touch-none select-none"
      >
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-ink/40" aria-hidden />
        {Array.from({ length: marks }, (_, i) => <i key={i} aria-hidden className="pointer-events-none absolute top-1/2 h-2 w-px -translate-y-1/2 bg-ink/40" style={{ left: `${(i / Math.max(1, marks - 1)) * 100}%` }} />)}
        <div className="pointer-events-none absolute top-1/2 h-6 -translate-y-1/2 border border-signal bg-signal/25 transition-[left] duration-100" style={{ left: `${left * 100}%`, width: `${win * 100}%`, minWidth: 28 }} aria-hidden />
        {bubble !== null && (
          <div className="pointer-events-none absolute bottom-[calc(100%+6px)] z-10 max-w-[70vw] -translate-x-1/2 whitespace-nowrap bg-signal px-2.5 py-1 text-[13px] font-semibold text-on-signal" style={{ left: `clamp(60px, ${(left + win / 2) * 100}%, calc(100% - 60px))` }}>
            <span className="block max-w-[260px] truncate">{labelAt(bubble)}</span>
            <span className="block text-[11px] font-medium opacity-80">{bubble + 1} of {count}</span>
          </div>
        )}
      </div>
      <button onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages} aria-label="Next page" className="grid size-11 shrink-0 place-items-center border border-ink/30 text-ink hover:bg-ink/10 disabled:opacity-40"><ChevronRight className="size-5" /></button>
    </div>
  )
}

/** Swipe left or right across an area to turn the page. A swipe never also counts as a click. */
export function useSwipe(onPrev: () => void, onNext: () => void) {
  const s = useRef({ x: 0, y: 0, on: false, swiped: false })
  return {
    onPointerDown: (e: PointerEvent) => { s.current = { x: e.clientX, y: e.clientY, on: true, swiped: false } },
    onPointerUp: (e: PointerEvent) => {
      const d = s.current
      if (!d.on) return
      d.on = false
      const dx = e.clientX - d.x, dy = e.clientY - d.y
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6) { d.swiped = true; (dx < 0 ? onNext : onPrev)() }
    },
    onClickCapture: (e: { stopPropagation: () => void; preventDefault: () => void }) => { if (s.current.swiped) { e.stopPropagation(); e.preventDefault(); s.current.swiped = false } },
    style: { touchAction: 'pan-y' as const },
  }
}
