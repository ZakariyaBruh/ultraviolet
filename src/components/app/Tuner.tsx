import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { hrefFor, VIEWS, type View } from '@/lib/route'
import { cn } from '@/lib/utils'

const LABEL: Record<View, string> = { focus: 'Focus', radio: 'Radio', tv: 'TV', insights: 'Insights', debrief: 'Debrief', lab: 'Lab', settings: 'Settings' }
const SHORT: Record<View, string> = { ...LABEL, insights: 'Stats', settings: 'Setup' }
const N = VIEWS.length
const freq = (i: number) => (88 + i * 3.1).toFixed(1)

/**
 * Navigation by tuning. No page scrolls here, so the way around is a radio dial: drag the needle along the band,
 * or press a station, or use the arrow keys. Letting go snaps to the nearest station.
 */
export function Tuner({ view, onChange, className }: { view: View; onChange: (v: View) => void; className?: string }) {
  const reduced = !!useReducedMotion()
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef({ down: false, moved: false, x0: 0 })
  const [near, setNear] = useState(VIEWS.indexOf(view))
  const idx = VIEWS.indexOf(view)
  const pos = useMotionValue(idx / (N - 1))
  const sp = useSpring(pos, { stiffness: reduced ? 1000 : 260, damping: reduced ? 100 : 26, mass: 0.6 })

  useEffect(() => {
    if (!drag.current.down) { pos.set(idx / (N - 1)); setNear(idx) }
  }, [idx, pos])

  const frac = (clientX: number) => {
    const r = track.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width))
  }
  const down = (e: PointerEvent) => {
    drag.current = { down: true, moved: false, x0: e.clientX }
  }
  const move = (e: PointerEvent) => {
    const d = drag.current
    if (!d.down) return
    if (!d.moved && Math.abs(e.clientX - d.x0) < 6) return
    if (!d.moved) track.current?.setPointerCapture?.(e.pointerId)
    d.moved = true
    const f = frac(e.clientX)
    pos.set(f)
    setNear(Math.round(f * (N - 1)))
  }
  const up = (e: PointerEvent) => {
    const d = drag.current
    if (!d.down) return
    d.down = false
    track.current?.releasePointerCapture?.(e.pointerId)
    if (d.moved) {
      const i = Math.round(frac(e.clientX) * (N - 1))
      pos.set(i / (N - 1))
      setNear(i)
      if (VIEWS[i] !== view) onChange(VIEWS[i])
    }
  }
  const key = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const i = Math.min(N - 1, Math.max(0, idx + step))
    if (i !== idx) {
      onChange(VIEWS[i])
      requestAnimationFrame(() => track.current?.querySelectorAll('a')[i]?.focus())
    }
  }

  return (
    <nav aria-label="Sections" className={cn('select-none', className)} onKeyDown={key}>
      <div ref={track} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="relative mx-5 h-[64px] cursor-grab touch-none active:cursor-grabbing" style={{ touchAction: 'none' }}>
        {/* the band: 60 ticks, a long one at every station */}
        <div className="pointer-events-none absolute inset-x-0 top-2 h-3" aria-hidden>
          {Array.from({ length: 61 }, (_, i) => (
            <i key={i} className={cn('absolute top-0 w-px -translate-x-1/2 bg-ink/35', i % 10 === 0 ? 'h-3 bg-ink/70' : i % 5 === 0 ? 'h-2' : 'h-1')} style={{ left: `${(i / 60) * 100}%` }} />
          ))}
        </div>
        {VIEWS.map((v, i) => (
          <a
            key={v}
            href={hrefFor(v)}
            aria-current={v === view ? 'page' : undefined}
            onClick={(e) => { e.preventDefault(); if (drag.current.moved) return; if (v !== view) onChange(v) }}
            draggable={false}
            className={cn('absolute bottom-0 flex h-[44px] min-w-11 -translate-x-1/2 flex-col items-center justify-end gap-0 pb-1 text-center outline-offset-0 transition-colors', near === i ? 'text-ink' : 'text-ink-3 hover:text-ink')}
            style={{ left: `${(i / (N - 1)) * 100}%` }}
          >
            <span className="fig hidden text-[11px] leading-none sm:block">{freq(i)}</span>
            <span className="font-[family-name:var(--font-cond)] text-[14px] font-semibold uppercase leading-[18px] tracking-[0.06em]"><span className="sm:hidden">{SHORT[v]}</span><span className="hidden sm:inline">{LABEL[v]}</span></span>
          </a>
        ))}
        {/* the needle */}
        <motion.div className="pointer-events-none absolute top-0 h-[34px] w-0.5 -translate-x-1/2 bg-signal" style={{ left: useLeft(sp) }} aria-hidden>
          <span className="absolute -top-px left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-signal" />
        </motion.div>
      </div>
    </nav>
  )
}

function useLeft(sp: ReturnType<typeof useSpring>) {
  const left = useMotionValue('0%')
  useEffect(() => sp.on('change', (v) => left.set(`${v * 100}%`)), [sp, left])
  useEffect(() => { left.set(`${sp.get() * 100}%`) }, [sp, left])
  return left
}
