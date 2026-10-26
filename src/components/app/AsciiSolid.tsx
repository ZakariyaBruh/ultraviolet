import { useEffect, useRef, type PointerEvent } from 'react'
import { clearGrid, gridText, makeGrid, plot, type Shape } from '@/lib/ascii3d'

/**
 * A solid drawn in text and slowly turning. Spin follows `speed`; `still` (calm motion or reduced motion) draws one frame.
 * With `interactive`, dragging across it turns it by hand (and it still drifts on its own afterwards).
 */
export function AsciiSolid({ shape = 'torus', cols = 44, rows = 22, speed = 1, still = false, phase = 0, interactive = false, className = '' }: { shape?: Shape; cols?: number; rows?: number; speed?: number; still?: boolean; phase?: number; interactive?: boolean; className?: string }) {
  const ref = useRef<HTMLPreElement>(null)
  const spd = useRef(speed)
  spd.current = speed
  const turn = useRef({ A: 1.1 + phase, B: 0.4 + phase * 0.6, C: 0, x: 0, y: 0, down: false })
  const draw = useRef<() => void>(() => undefined)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const g = makeGrid(cols, rows, 0.6)
    const t = turn.current
    let raf = 0
    let last = 0
    const size = Math.min(cols * 0.46, rows * 0.8)
    const frame = () => {
      clearGrid(g)
      plot(g, shape, cols / 2, rows / 2, size, t.A, t.B, t.C)
      el.textContent = gridText(g)
    }
    draw.current = frame
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || now - last < 1000 / 24) return
      const dt = last ? Math.min(0.2, (now - last) / 1000) : 0
      last = now
      if (!t.down) { t.A += 0.9 * spd.current * dt; t.B += 0.5 * spd.current * dt; t.C += 0.12 * spd.current * dt }
      frame()
    }
    frame()
    if (!still) raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [cols, rows, still, shape])

  const grab = interactive
    ? {
        onPointerDown: (e: PointerEvent<HTMLPreElement>) => { const t = turn.current; t.down = true; t.x = e.clientX; t.y = e.clientY; e.currentTarget.setPointerCapture(e.pointerId) },
        onPointerMove: (e: PointerEvent<HTMLPreElement>) => {
          const t = turn.current
          if (!t.down) return
          t.B += (e.clientX - t.x) * 0.02; t.A += (e.clientY - t.y) * 0.02
          t.x = e.clientX; t.y = e.clientY
          draw.current() // follow the finger even when the spin is still
        },
        onPointerUp: () => { turn.current.down = false },
        onPointerCancel: () => { turn.current.down = false },
      }
    : {}
  return <pre ref={ref} aria-hidden={!interactive} {...(interactive ? { 'data-no-drag': true, role: 'img', 'aria-label': 'A solid drawn in text. Drag to turn it.' } : {})} {...grab} className={`m-0 select-none font-mono leading-[1] ${interactive ? 'cursor-grab touch-none active:cursor-grabbing' : ''} ${className}`} />
}
