import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * A view that is a little taller than the space it has is scaled down until it fits, but never below 80%: smaller than that
 * the text is hard to read and the buttons too small to hit, so past that point the page area scrolls instead (see `data-scroll`
 * in Shell). The inner box is resized to compensate, so views that fill their height keep doing so.
 */
const MIN = 0.8

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
          if (el.closest('[data-moved], .sr-only, [aria-hidden="true"][class*="absolute"]')) return
          const q = el.getBoundingClientRect()
          if (q.height <= 0) return
          // what a clipping ancestor hides does not count as overflow
          let b = q.bottom
          for (let a = el.parentElement; a && a !== i && b > bottom; a = a.parentElement) {
            const ov = getComputedStyle(a).overflowY
            if (ov !== 'visible') b = Math.min(b, a.getBoundingClientRect().bottom)
          }
          if (b > bottom) bottom = b
        })
        const need = (bottom - top) / z
        const have = i.clientHeight
        if (need <= have + 1 || z <= MIN) break
        z = Math.max(MIN, z * (have / need) * 0.99)
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
    <div ref={outer} className="h-full w-full">
      <div ref={inner} style={{ transformOrigin: 'top left', width: `${100 / k}%`, height: `${100 / k}%`, transform: `scale(${k})` }}>
        {children}
      </div>
    </div>
  )
}
