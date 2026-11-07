import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { fmtMinutes } from '@/lib/dates'
import type { Span } from '@/lib/insights'

/** the width of an element, kept up to date, so an SVG can be drawn at the size it will be shown */
function useWidth(ref: React.RefObject<HTMLElement | null>, fallback = 600) {
  const [w, setW] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setW(Math.max(200, Math.round(el.getBoundingClientRect().width)))
    const ro = new ResizeObserver(() => setW(Math.max(200, Math.round(el.getBoundingClientRect().width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

/** a round number at or above `v` for the top of an axis: 10, 20, 30, 60, 90, 120, 180, 240 ... */
const niceMax = (v: number) => { for (const n of [10, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720]) if (v <= n) return n; return Math.ceil(v / 240) * 240 }
const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const fmtDayLong = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

const RANGES = [7, 30, 90] as const

/**
 * Minutes held on each of the last 7, 30 or 90 days: a plain area chart with a minutes axis. Hover, touch or the arrow keys read out a day.
 * Written for this screen because a stock-price chart shows a dollar sign and a percentage that is not a number when the first day was empty.
 */
export function MinutesArea({ days }: { days: { date: Date; value: number }[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30)
  const [at, setAt] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const w = useWidth(box)
  const pts = days.slice(-range)
  const total = pts.reduce((a, d) => a + d.value, 0)
  const best = pts.reduce((b, d) => (d.value > b.value ? d : b), pts[0] ?? { date: new Date(), value: 0 })
  const H = 190
  const L = 44
  const R = 10
  const T = 12
  const B = 26
  const top = niceMax(Math.max(...pts.map((d) => d.value), 1))
  const x = (i: number) => L + (pts.length <= 1 ? 0 : (i / (pts.length - 1)) * (w - L - R))
  const y = (v: number) => T + (1 - v / top) * (H - T - B)
  const line = pts.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join('')
  const area = pts.length ? `${line}L${x(pts.length - 1).toFixed(1)} ${y(0)}L${x(0).toFixed(1)} ${y(0)}Z` : ''
  const cur = at !== null ? pts[Math.min(at, pts.length - 1)] : null
  const nearest = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * w
    return Math.min(pts.length - 1, Math.max(0, Math.round(((px - L) / Math.max(1, w - L - R)) * (pts.length - 1))))
  }
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setAt((a) => Math.max(0, (a ?? pts.length) - 1)) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setAt((a) => Math.min(pts.length - 1, (a ?? -1) + 1)) }
    else if (e.key === 'Escape') setAt(null)
  }
  const ticks = [0, top / 2, top]
  const labelIdx = pts.length > 2 ? [0, Math.floor((pts.length - 1) / 2), pts.length - 1] : pts.map((_, i) => i)
  return (
    <div ref={box} className="w-full" data-no-drag>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Minutes held</h2>
          <p className="fig mt-1 text-[22px] font-semibold leading-none text-ink">{fmtMinutes(total)}</p>
          <p className="mt-1 text-[13px] text-ink-2">in the last {range} days, {pts.length ? Math.round(total / pts.length) : 0} minutes a day on average. The axis is minutes.</p>
        </div>
        <div role="radiogroup" aria-label="Range" className="flex border border-ink/20">
          {RANGES.map((r) => (
            <button key={r} role="radio" aria-checked={range === r} onClick={() => { setRange(r); setAt(null) }} className={`h-11 min-w-12 px-3 text-sm md:h-9 ${range === r ? 'bg-signal text-on-signal' : 'text-ink-2 hover:bg-ink/10'}`}>{r}D</button>
          ))}
        </div>
      </div>
      <svg
        width="100%" height={H} viewBox={`0 0 ${w} ${H}`} className="mt-3 touch-pan-y outline-none focus-visible:outline-2" tabIndex={0} role="img" onKeyDown={key} onBlur={() => setAt(null)}
        aria-label={`Minutes held on each of the last ${range} days. ${fmtMinutes(total)} in all${total > 0 ? `, most on ${fmtDayLong(best.date)} with ${fmtMinutes(best.value)}` : ''}. Use the left and right arrow keys to read one day.`}
        onPointerMove={(e) => setAt(nearest(e))} onPointerLeave={() => setAt(null)} onPointerDown={(e) => setAt(nearest(e))}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={w - R} y1={y(t)} y2={y(t)} style={{ stroke: 'var(--rule)' }} strokeDasharray={t === 0 ? undefined : '2 4'} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" style={{ fill: 'var(--ink-3)' }}>{Math.round(t)}</text>
          </g>
        ))}
        {pts.length > 1 && <path d={area} style={{ fill: 'var(--ice)' }} opacity={0.16} />}
        {pts.length > 1 && <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" style={{ stroke: 'var(--ice)' }} />}
        {pts.length === 1 && <circle cx={x(0)} cy={y(pts[0].value)} r={3} style={{ fill: 'var(--ice)' }} />}
        {labelIdx.map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'} fontSize="11" style={{ fill: 'var(--ink-3)' }}>{fmtDay(pts[i].date)}</text>)}
        {cur && at !== null && (
          <g>
            <line x1={x(at)} x2={x(at)} y1={T} y2={y(0)} style={{ stroke: 'var(--ink-2)' }} strokeDasharray="3 3" />
            <circle cx={x(at)} cy={y(cur.value)} r={4} style={{ fill: 'var(--ice)', stroke: 'var(--ground)' }} strokeWidth={2} />
          </g>
        )}
      </svg>
      <p className="mt-1 min-h-5 text-[13px] text-ink-2" aria-live="polite">{cur ? `${fmtDayLong(cur.date)}: ${fmtMinutes(cur.value)}` : 'Move over the chart, or touch it, to read a day.'}</p>
    </div>
  )
}

/** "up 66%", "down 12%", "same" or a dash when there is nothing to compare with */
const change = (now: number, before: number | null): string => {
  if (before === null || before <= 0) return '–'
  const p = Math.round(((now - before) / before) * 100)
  return p === 0 ? 'same' : `${p > 0 ? 'up' : 'down'} ${Math.abs(p)}%`
}

/** the last 7 days against the 7 before them, one row for each thing counted */
export function WeekCompare({ now, before }: { now: Span; before: Span }) {
  const rows: { label: string; a: string; b: string; c: string }[] = [
    { label: 'Minutes held', a: fmtMinutes(now.minutes), b: fmtMinutes(before.minutes), c: change(now.minutes, before.minutes) },
    { label: 'Drifts', a: String(now.drifts), b: String(before.drifts), c: change(now.drifts, before.drifts) },
    { label: 'Drifts per focused hour', a: now.perHour === null ? '–' : String(now.perHour), b: before.perHour === null ? '–' : String(before.perHour), c: now.perHour === null ? '–' : change(now.perHour, before.perHour) },
    { label: 'Sessions started', a: String(now.sessions), b: String(before.sessions), c: change(now.sessions, before.sessions) },
    { label: 'Sessions finished', a: String(now.finished), b: String(before.finished), c: change(now.finished, before.finished) },
  ]
  return (
    <div className="min-w-0 overflow-x-auto" data-no-drag tabIndex={0} role="region" aria-label="This week against last">
      <table className="w-full min-w-[22rem] text-left text-[14px]">
        <caption className="sr-only">The last 7 days against the 7 days before them</caption>
        <thead className="hud">
          <tr><th scope="col" className="pb-2 pr-3 font-normal">&nbsp;</th><th scope="col" className="pb-2 pr-3 text-right font-normal">Last 7 days</th><th scope="col" className="pb-2 pr-3 text-right font-normal">The 7 before</th><th scope="col" className="pb-2 text-right font-normal">Change</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-[var(--rule)]">
              <th scope="row" className="py-2.5 pr-3 font-normal text-ink-2">{r.label}</th>
              <td className="fig py-2.5 pr-3 text-right text-ink">{r.a}</td>
              <td className="fig py-2.5 pr-3 text-right text-ink-2">{r.b}</td>
              <td className="fig py-2.5 text-right text-ink">{r.c}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[13px] text-ink-3">Fewer drifts is better. A dash means there was too little to compare.</p>
    </div>
  )
}
