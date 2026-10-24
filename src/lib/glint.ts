import { useEffect } from 'react'
import { useStore } from './store'

/** The specular glint on glass follows the pointer; glass mode lands on <html>. */
export function useGlass() {
  const mode = useStore((s) => s.settings.glass)
  useEffect(() => {
    document.documentElement.dataset.glass = mode
  }, [mode])

  useEffect(() => {
    let raf = 0
    const move = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('.glass, .glass-clear') as HTMLElement | null
      if (!el) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${e.clientX - r.left}px`)
        el.style.setProperty('--my', `${e.clientY - r.top}px`)
      })
    }
    document.addEventListener('pointermove', move, { passive: true })
    return () => {
      document.removeEventListener('pointermove', move)
      cancelAnimationFrame(raf)
    }
  }, [])
}
