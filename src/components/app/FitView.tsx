import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Nothing scrolls, so a view that is taller than the space it has is scaled down until it fits (never below 62%).
 * The inner box is resized to compensate, so views that fill their height keep doing so.
 */
export function FitView({ children, watch }: { children: ReactNode; watch?: unknown }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(1)

  useLayoutEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const fit = () => {
      const W = o.clientWidth
      const H = o.clientHeight
      let z = 1
      for (let n = 0; n < 5; n++) {
        i.style.width = `${W / z}px`
        i.style.height = `${H / z}px`
        i.style.transform = `scale(${z})`
        const top = i.getBoundingClientRect().top
        let bottom = top
        i.querySelectorAll('*').forEach((el) => {
          if (el.closest('.sr-only, [aria-hidden="true"][class*="absolute"]')) return
          const q = el.getBoundingClientRect()
          if (q.height > 0 && q.bottom > bottom) bottom = q.bottom
        })
        const need = (bottom - top) / z
        const have = i.clientHeight
        if (need <= have + 1 || z <= 0.62) break
        z = Math.max(0.62, z * (have / need) * 0.99)
      }
      setK((prev) => (Math.abs(prev - z) > 0.005 ? z : prev))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(o)
    let t: ReturnType<typeof setTimeout> | undefined
    const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(fit, 200) })
    mo.observe(i, { childList: true, subtree: true })
    return () => { ro.disconnect(); mo.disconnect(); clearTimeout(t) }
  }, [watch])

  return (
    <div ref={outer} className="h-full w-full overflow-hidden">
      <div ref={inner} style={{ transformOrigin: 'top left', width: `${100 / k}%`, height: `${100 / k}%`, transform: `scale(${k})` }}>
        {children}
      </div>
    </div>
  )
}
