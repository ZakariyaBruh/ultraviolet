import { motion, useReducedMotion } from 'motion/react'
import { useRef, type KeyboardEvent } from 'react'
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
      <div ref={list} onKeyDown={onKey} className="flex items-stretch gap-0.5">
        {NAV.map((n) => {
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
                'relative flex min-h-11 items-center justify-center gap-2 px-3 text-[13px] font-semibold uppercase tracking-[0.08em] transition-[flex-grow,color] duration-200 ease-[var(--ease-out)] [font-family:var(--font-cond)] max-sm:px-0',
                n.id === 'lab' && 'max-sm:hidden',
                on ? 'grow-[2] basis-0 text-on-signal max-sm:grow-[3]' : 'grow basis-0 text-ink-2 hover:text-ink',
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
      </div>
    </nav>
  )
}
