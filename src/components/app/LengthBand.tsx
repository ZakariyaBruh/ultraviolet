import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'


/** Session length as a ruler: drag the marker along it (or arrow keys). It snaps to five minutes. */
export function LengthBand({ value, onChange, className, min: MIN = 10, max: MAX = 90, step: STEP = 5, label = 'Session length in minutes', ends, format }: { value: number; onChange: (v: number) => void; className?: string; min?: number; max?: number; step?: number; label?: string; ends?: string[]; format?: (v: number) => string }) {
  const SPAN = (MAX - MIN) / STEP
  const ref = useRef<HTMLDivElement>(null)
  const on = useRef(false)
  const at = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    return MIN + Math.round(f * SPAN) * STEP
  }
  const down = (e: PointerEvent) => { on.current = true; ref.current?.setPointerCapture?.(e.pointerId); onChange(at(e.clientX)) }
  const move = (e: PointerEvent) => { if (on.current) onChange(at(e.clientX)) }
  const up = () => { on.current = false }
  const key = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? STEP : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -STEP : 0
    if (d) { e.preventDefault(); onChange(Math.min(MAX, Math.max(MIN, value + d))) }
  }
  const f = (value - MIN) / (MAX - MIN)
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-valuenow={value}
      aria-valuetext={format ? format(value) : `${value} minutes`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
      className={cn('relative h-12 w-full max-w-[420px] cursor-ew-resize touch-none select-none', className)}
    >
      <div className="absolute inset-x-0 top-0 h-5" aria-hidden>
        {Array.from({ length: SPAN + 1 }, (_, i) => <i key={i} className={cn('absolute top-0 w-px -translate-x-1/2 bg-ink/50', i % Math.max(1, Math.round(SPAN / 8)) === 0 ? 'h-4 bg-ink/80' : 'h-2')} style={{ left: `${(i / SPAN) * 100}%` }} />)}
        <div className="absolute inset-y-0 left-0 w-0 border-t border-ink/0" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 flex justify-between font-[family-name:var(--font-cond)] text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3" aria-hidden>
        {(ends ?? [`${MIN}`, `${Math.round((MIN + MAX) / 2)}`, `${MAX} min`]).map((t) => <span key={t}>{t}</span>)}
      </div>
      <div className="pointer-events-none absolute top-0 h-5 w-0.5 -translate-x-1/2 bg-signal" style={{ left: `${f * 100}%` }} aria-hidden />
      {/* the value tag leans away from the ends so it never hangs outside the ruler */}
      <div className="pointer-events-none absolute top-[19px] bg-signal px-1.5 text-[13px] font-bold leading-5 text-on-signal" style={{ left: `${f * 100}%`, transform: `translateX(-${f * 100}%)` }} aria-hidden>{format ? format(value) : value}</div>
    </div>
  )
}
