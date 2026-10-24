import { useEffect, useRef } from 'react'

/** Retro: a quarter second of broadcast static as you tune between stations. */
export function StaticBurst() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const w = (c.width = Math.ceil(c.clientWidth / 4))
    const h = (c.height = Math.ceil(c.clientHeight / 4))
    const t0 = performance.now()
    let raf = 0
    const draw = (now: number) => {
      const p = (now - t0) / 260
      if (p >= 1) { ctx.clearRect(0, 0, w, h); return }
      const img = ctx.createImageData(w, h)
      const a = Math.round(150 * (1 - p) * (1 - p))
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v
        img.data[i + 3] = a
      }
      ctx.putImageData(img, 0, 0)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-30 size-full [image-rendering:pixelated]" />
}
