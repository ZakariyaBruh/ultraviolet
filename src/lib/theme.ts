import { useEffect } from 'react'
import { useStore } from './store'
import { themeDef } from './themes'

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
export const lum = (h: string) => { const [r, g, b] = rgb(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) }
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
const mix = (a: string, b: string, t: number) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')
const alpha = (h: string, a: number) => `rgba(${rgb(h).join(',')},${a})`

const KEYS = ['--signal', '--on-signal', '--signal-soft', '--ground', '--surface', '--raised', '--raised-2', '--ink', '--ink-2', '--ink-3', '--rule', '--control', '--popover', '--primary-foreground']

/** Text colour that reads on a given fill. */
export const onColour = (h: string) => (contrast(h, '#0a0c12') >= contrast(h, '#ffffff') ? '#0a0c12' : '#ffffff')

/** which of the six era stops a dial value is on (0 future to 5 full ASCII) */
export const eraStage = (era: number) => Math.round((100 - Math.min(100, Math.max(0, era))) / 20)

/** One attribute on <html> picks the look; optional accent and background colours sit on top of it. */
export function useTheme() {
  const id = useStore((s) => s.settings.theme)
  const accent = useStore((s) => s.settings.accent)
  const bg = useStore((s) => s.settings.bg)
  const era = useStore((s) => s.settings.era)
  useEffect(() => {
    // the era dial: six stops, 0 future to 5 all-the-way retro. --retro is the stop as a fraction; --fx is the same
    // but never past Broadcast, because the screen effects (scanline, grain, warmth, glow) stop there. Past it the dial
    // adds more solids drawn in text, not more filters.
    const stage = eraStage(era)
    document.documentElement.style.setProperty('--retro', (stage / 5).toFixed(2))
    document.documentElement.style.setProperty('--fx', (Math.min(stage, 2) / 5).toFixed(2))
    document.documentElement.dataset.retro = String(stage)
  }, [era])
  useEffect(() => {
    const t = themeDef(id)
    const el = document.documentElement
    const light = bg ? lum(bg) > 0.4 : t.light
    el.dataset.theme = t.id
    el.classList.toggle('dark', !light)
    el.classList.toggle('light', light)
    el.style.colorScheme = light ? 'light' : 'dark'
    for (const k of KEYS) el.style.removeProperty(k)
    const set = (k: string, v: string) => el.style.setProperty(k, v)
    if (bg) {
      const ink = light ? '#0a0c12' : '#f3f1ea'
      set('--ground', bg); set('--surface', mix(bg, ink, 0.05)); set('--raised', mix(bg, ink, 0.1)); set('--raised-2', mix(bg, ink, 0.16)); set('--popover', mix(bg, ink, 0.05))
      set('--ink', ink); set('--ink-2', mix(bg, ink, 0.78)); set('--ink-3', mix(bg, ink, 0.66))
      set('--rule', alpha(ink, 0.2)); set('--control', alpha(ink, 0.5)); set('--primary-foreground', bg)
    }
    if (accent) { set('--signal', accent); set('--on-signal', onColour(accent)); set('--signal-soft', alpha(accent, 0.14)) }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || t.ground)
  }, [id, accent, bg])
}
