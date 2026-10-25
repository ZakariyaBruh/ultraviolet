import { useEffect } from 'react'
import { useStore } from './store'
import { themeDef } from './themes'

/** One attribute on <html> picks the palette; the light/dark class switches EasyUI's own variants. */
export function useTheme() {
  const id = useStore((s) => s.settings.theme)
  useEffect(() => {
    const t = themeDef(id)
    const el = document.documentElement
    el.dataset.theme = t.id
    el.classList.toggle('dark', !t.light)
    el.classList.toggle('light', t.light)
    el.style.colorScheme = t.light ? 'light' : 'dark'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.ground)
  }, [id])
}
