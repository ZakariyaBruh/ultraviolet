import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'

const MIN = 10, MAX = 90, STEP = 5
const SPAN = (MAX - MIN) / STEP

/** Session length as a ruler: drag the marker along it (or arrow keys). It snaps to five minutes. */
export function LengthBand({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
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
      aria-label="Session length in minutes"
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-valuenow={value}
      aria-valuetext={`${value} minutes`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
      className={cn('relative h-12 w-full max-w-[420px] cursor-ew-resize touch-none select-none', className)}
    >
      <div className="absolute inset-x-0 top-0 h-5" aria-hidden>
        {Array.from({ length: SPAN + 1 }, (_, i) => <i key={i} className={cn('absolute top-0 w-px -translate-x-1/2 bg-ink/50', i % 2 === 0 ? 'h-4 bg-ink/80' : 'h-2')} style={{ left: `${(i / SPAN) * 100}%` }} />)}
        <div className="absolute inset-y-0 left-0 w-0 border-t border-ink/0" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 flex justify-between font-[family-name:var(--font-cond)] text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3" aria-hidden>
        <span>10</span><span>30</span><span>50</span><span>70</span><span>90 min</span>
      </div>
      <div className="pointer-events-none absolute top-0 -translate-x-1/2" style={{ left: `${f * 100}%` }} aria-hidden>
        <div className="h-5 w-0.5 bg-signal" />
        <div className="-mt-px -translate-x-[calc(50%-1px)] bg-signal px-1.5 text-[13px] font-bold leading-5 text-on-signal">{value}</div>
      </div>
    </div>
  )
}
