import { useEffect, useState } from 'react'
import { useStore } from './store'

export interface Colours { signal: string; ice: string; hot: string; ink: string; ink3: string }
const read = (): Colours => {
  const cs = getComputedStyle(document.documentElement)
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d
  return { signal: v('--signal', '#ffd23f'), ice: v('--ice', '#7fd3ff'), hot: v('--hot', '#ff5a8a'), ink: v('--ink', '#f3f1ea'), ink3: v('--ink-3', '#9a958a') }
}

/** The live theme colours as plain strings, for charts and SVG that cannot read CSS variables. Updates when the theme or custom colours change. */
export function useColours(): Colours {
  const theme = useStore((s) => s.settings.theme)
  const accent = useStore((s) => s.settings.accent)
  const bg = useStore((s) => s.settings.bg)
  const [c, setC] = useState<Colours>(read)
  useEffect(() => { const t = setTimeout(() => setC(read()), 0); return () => clearTimeout(t) }, [theme, accent, bg])
  return c
}
