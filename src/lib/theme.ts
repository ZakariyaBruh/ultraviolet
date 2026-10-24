import { useEffect } from 'react'
import { useStore } from './store'

/** Dark is the default; the toggle swaps one class on <html> and the theme-color meta. */
export function useTheme() {
  const theme = useStore((s) => s.settings.theme)
  useEffect(() => {
    const el = document.documentElement
    el.classList.toggle('dark', theme === 'dark')
    el.classList.toggle('light', theme === 'light')
    el.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#000000' : '#efece1')
  }, [theme])
}
