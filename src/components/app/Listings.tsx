import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'
import { useNow } from '@/lib/hooks'
import { dateKey, fmtMinutes, pad } from '@/lib/dates'
import { useStore, type SourceKey } from '@/lib/store'
import { sum } from '@/lib/stats'
import { cn } from '@/lib/utils'

const ROWS: { id: SourceKey; label: string }[] = [
  { id: 'radio', label: 'Radio' },
  { id: 'tv', label: 'TV' },
  { id: 'silent', label: 'Silent' },
]

const MAX_TICKS = 6

/**
 * The day as a programme guide: sources down the side, hours across.
 * A blue block is focused time in that hour; an ink tick is a scroll that was blocked.
 */
export function Listings({ day = dateKey(), className }: { day?: string; className?: string }) {
  const sourceLog = useStore((s) => s.sourceLog[day])
  const urges = useStore((s) => s.urgeLog[day])
  const live = useStore((s) => s.session)
  const now = useNow(20000)
  const isToday = day === dateKey()

  const { from, to } = useMemo(() => {
    let lo = 6
    let hi = 23
    const all = [urges, ...ROWS.map((r) => sourceLog?.[r.id])]
    for (const row of all) {
      row?.forEach((v, h) => {
        if (v > 0) {
          lo = Math.min(lo, h)
          hi = Math.max(hi, h)
        }
      })
    }
    return { from: lo, to: hi }
  }, [sourceLog, urges])

  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  const cols = `64px repeat(${hours.length}, minmax(0, 1fr)) 52px`
  const d = new Date(now)
  const nowPct = isToday ? ((d.getHours() + d.getMinutes() / 60 - from) / hours.length) * 100 : -1
  const showNow = isToday && nowPct >= 0 && nowPct <= 100

  return (
    <div className={cn('text-[13px]', className)} role="table" aria-label={`Focus listings for ${day}`}>
      <div className="grid items-end pb-1.5 text-ink-3" style={{ gridTemplateColumns: cols }} role="row">
        <span aria-hidden />
        {hours.map((h) =>
          h % 3 === 0 ? (
            <span key={h} className="fig min-w-0 overflow-visible whitespace-nowrap" role="columnheader">
              {pad(h)}
            </span>
          ) : (
            <span key={h} aria-hidden />
          ),
        )}
        <span className="text-right" role="columnheader">Total</span>
      </div>

      <div className="relative">
        {showNow && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-ice"
            style={{ left: `calc(64px + (100% - 116px) * ${nowPct / 100})` }}
            initial={false}
            animate={{ opacity: 1 }}
          >
            <span className="fig absolute -top-4 -translate-x-1/2  bg-ice px-1 text-xs leading-4 text-ground">
              {pad(d.getHours())}:{pad(d.getMinutes())}
            </span>
          </motion.div>
        )}

        {ROWS.map((r, ri) => {
          const row = sourceLog?.[r.id]
          const total = row ? sum(row) : 0
          return (
            <motion.div
              key={r.id}
              role="row"
              className="grid h-8 items-center border-t border-[var(--rule)]"
              style={{ gridTemplateColumns: cols }}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: ri * 0.04, duration: 0.22, ease: [0.2, 0, 0, 1] }}
            >
              <span className="text-[13px] text-ink-2" role="rowheader">{r.label}</span>
              {hours.map((h) => {
                const m = Math.min(60, row?.[h] ?? 0)
                const liveHere = isToday && live && !live.paused && live.source === r.id && h === d.getHours()
                return (
                  <div key={h} className="relative h-full border-l border-[var(--rule)] px-px" role="cell" aria-label={m > 0 ? `${pad(h)}:00, ${Math.round(m)} minutes` : undefined}>
                    {m > 0 && (
                      <motion.div
                        className="absolute left-px top-1/2 h-3 -translate-y-1/2 bg-ice"
                        initial={{ width: 0 }}
                        animate={{ width: `calc(${(m / 60) * 100}% - 2px)` }}
                        transition={{ type: 'spring', stiffness: 320, damping: 32, delay: 0.06 + (h - from) * 0.01 }}
                      >
                        {liveHere && <span className="absolute -right-0.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-white ring-2 ring-signal" />}
                      </motion.div>
                    )}
                  </div>
                )
              })}
              <span className={cn('fig text-right', total > 0 ? 'text-ink' : 'text-ink-3')}>{total > 0 ? fmtMinutes(total) : '–'}</span>
            </motion.div>
          )
        })}

        <div role="row" className="grid h-8 items-center border-y border-[var(--rule)]" style={{ gridTemplateColumns: cols }}>
          <span className="text-[13px] text-ink-2" role="rowheader">Blocked</span>
          {hours.map((h) => {
            const n = Math.round(urges?.[h] ?? 0)
            return (
              <div key={h} className="flex h-full items-center gap-[3px] border-l border-[var(--rule)] pl-1" role="cell" aria-label={n ? `${pad(h)}:00, ${n} blocked` : undefined}>
                <AnimatePresence initial={false}>
                  {Array.from({ length: Math.min(n, MAX_TICKS) }, (_, i) => (
                    <motion.i
                      key={i}
                      className="block h-3.5 w-[2px] rounded-[1px] bg-ink"
                      initial={{ y: -14, opacity: 0, scaleY: 0.6 }}
                      animate={{ y: 0, opacity: 1, scaleY: 1 }}
                      transition={{ type: 'spring', stiffness: 560, damping: 26 }}
                    />
                  ))}
                </AnimatePresence>
                {n > MAX_TICKS && <span className="fig text-xs text-ink-2">+{n - MAX_TICKS}</span>}
              </div>
            )
          })}
          <span className={cn('fig text-right', urges && sum(urges) > 0 ? 'text-ink' : 'text-ink-3')}>{urges ? Math.round(sum(urges)) : '–'}</span>
        </div>
      </div>
    </div>
  )
}
