import { motion, useReducedMotion } from 'motion/react'
import { MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useMedia } from '@/lib/hooks'
import { NAV } from '@/components/app/navItems'
import { hrefFor, type View } from '@/lib/route'
import { cn } from '@/lib/utils'

/**
 * The way around, with no scrolling: one deck of index tabs. The active tab opens to show its name and a ruled
 * signal block slides to it. Arrow keys, Home and End move between tabs; each tab is a real link.
 */
export function NavDeck({ view, onChange, className }: { view: View; onChange: (v: View) => void; className?: string }) {
  const reduced = !!useReducedMotion()
  const list = useRef<HTMLDivElement>(null)
  const narrow = useMedia('(max-width: 639px)')
  const [more, setMore] = useState(false)
  // on a phone the first six screens sit in the deck and the rest open from "More"
  const PRIMARY = ['focus', 'radio', 'tv', 'podcasts', 'news', 'learn']
  const shown = narrow ? NAV.filter((n) => PRIMARY.includes(n.id)) : NAV
  const rest = narrow ? NAV.filter((n) => !PRIMARY.includes(n.id) && n.id !== 'lab') : []
  const inMore = rest.some((n) => n.id === view)
  useEffect(() => { setMore(false) }, [view])
  useEffect(() => {
    if (!more) return
    const k = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setMore(false)
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [more])

  const onKey = (e: KeyboardEvent) => {
    const i = NAV.findIndex((n) => n.id === view)
    const to = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? NAV.length - 1 : null
    if (to === null) return
    e.preventDefault()
    const next = NAV[(to + NAV.length) % NAV.length].id
    onChange(next)
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus())
  }

  return (
    <nav aria-label="Screens" className={className}>
      <div ref={list} onKeyDown={onKey} className="flex min-w-0 items-stretch gap-0.5">
        {shown.map((n) => {
          const on = n.id === view
          return (
            <a
              key={n.id}
              data-tab={n.id}
              href={hrefFor(n.id)}
              aria-current={on ? 'page' : undefined}
              aria-label={n.label}
              tabIndex={on ? 0 : -1}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                e.preventDefault()
                onChange(n.id)
              }}
              className={cn(
                'relative flex min-h-11 min-w-0 items-center overflow-hidden justify-center gap-2 px-3 lg:max-xl:px-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] transition-[flex-grow,color] duration-200 ease-[var(--ease-out)] [font-family:var(--font-cond)] max-sm:px-0',
                n.id === 'lab' && 'max-sm:hidden',
                on ? 'grow-[3] basis-0 text-on-signal' : 'grow basis-0 text-ink-2 hover:text-ink',
              )}
            >
              {on && (
                <motion.span
                  layoutId="deck-block"
                  aria-hidden
                  className="deck-block absolute inset-0 bg-signal"
                  transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }}
                />
              )}
              <span className="relative [&>svg]:size-[18px]">{n.icon}</span>
              <span className={cn('relative', on ? 'inline' : 'max-2xl:sr-only')}>{n.label}</span>
            </a>
          )
        })}
        {narrow && (
          <div className="relative flex min-w-0 grow basis-0">
            <button onClick={() => setMore((m) => !m)} aria-expanded={more} aria-label="More screens" className={cn('relative flex min-h-11 w-full min-w-0 items-center justify-center', inMore ? 'text-on-signal' : 'text-ink-2 hover:text-ink')}>
              {inMore && <span aria-hidden className="absolute inset-0 bg-signal" />}
              <MoreHorizontal className="relative size-[18px]" />
            </button>
            {more && (
              <div className="absolute bottom-full right-0 z-50 mb-2 grid w-48 gap-0.5 border border-ink/25 bg-surface p-1 shadow-[0_18px_40px_-18px_rgba(0,0,0,.7)]">
                {rest.map((n) => (
                  <a key={n.id} href={hrefFor(n.id)} aria-current={n.id === view ? 'page' : undefined} onClick={(e) => { e.preventDefault(); onChange(n.id) }} className={cn('flex min-h-11 items-center gap-3 px-3 text-sm', n.id === view ? 'bg-signal text-on-signal' : 'hover:bg-ink/10')}>
                    <span className="[&>svg]:size-[18px]">{n.icon}</span>{n.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
