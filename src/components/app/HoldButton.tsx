import { useEffect, useRef, useState } from 'react'

/** Going in takes a deliberate act: hold the button. Letting go early drains it back out. */
export function HoldButton({ label, holdLabel = 'Keep holding', onDone, still = false, autoFocus = false, className = '' }: { label: string; holdLabel?: string; onDone: () => void; still?: boolean; autoFocus?: boolean; className?: string }) {
  const [p, setP] = useState(0)
  const pr = useRef(0)
  const raf = useRef(0)
  const holding = useRef(false)
  const last = useRef(0)
  const done = useRef(false)
  const HOLD = still ? 1 : 900
  const loop = (now: number) => {
    const dt = now - last.current
    last.current = now
    pr.current = holding.current ? Math.min(1, pr.current + dt / HOLD) : Math.max(0, pr.current - (dt / HOLD) * 2)
    setP(pr.current)
    if (pr.current >= 1 && !done.current) { done.current = true; setTimeout(() => { onDone(); done.current = false; pr.current = 0; setP(0) }, 120) }
    if (holding.current || pr.current > 0) raf.current = requestAnimationFrame(loop)
  }
  const start = () => {
    if (holding.current || done.current) return
    holding.current = true
    last.current = performance.now()
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(loop)
  }
  const stop = () => { holding.current = false; last.current = performance.now(); cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(loop) }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  return (
    <button
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); start() }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); start() } }}
      onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') stop() }}
      onBlur={stop}
      onContextMenu={(e) => e.preventDefault()}
      autoFocus={autoFocus}
      className={`relative h-14 w-full touch-none select-none overflow-hidden border border-signal bg-transparent text-left ${className}`}
      aria-label={label}
    >
      <span className="absolute inset-y-0 left-0 bg-signal" style={{ width: `${p * 100}%` }} aria-hidden />
      <span className="relative flex h-full items-center justify-between px-5 font-[family-name:var(--font-cond)] text-[19px] font-bold uppercase tracking-[0.1em] mix-blend-difference text-signal">
        <span>{p > 0.02 && p < 1 ? holdLabel : label}</span>
        <span aria-hidden>{Math.round(p * 100).toString().padStart(2, '0')}</span>
      </span>
    </button>
  )
}

