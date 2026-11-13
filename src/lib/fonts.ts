import type { ThemeId } from './themes'

/**
 * The faces only some looks use. The four every look shares (Hanken, Barlow Condensed, Unbounded, Geist Mono) are in index.css.
 * These are not: each is a small stylesheet in src/fonts that is fetched the first time its look is on screen. Before, every visit
 * carried all of them in the one stylesheet, and the Paper theme's display face alone (it covers Japanese, so it is listed in
 * about 120 pieces) was 148 KB of it. Until a face arrives the text shows in the next face named in its stack.
 */
const THEME: Partial<Record<ThemeId, () => Promise<unknown>>> = {
  paper: () => import('@/fonts/paper.css'),
  library: () => import('@/fonts/library.css'),
  observatory: () => import('@/fonts/observatory.css'),
  mono: () => import('@/fonts/mono.css'),
  receipt: () => import('@/fonts/receipt.css'),
  chalkboard: () => import('@/fonts/chalkboard.css'),
}

const asked = new Set<string>()
const once = (key: string, load: () => Promise<unknown>) => {
  if (asked.has(key)) return
  asked.add(key)
  // a fetch that fails is forgotten, so the next change of look asks again
  void load().catch(() => asked.delete(key))
}

/** the faces a theme needs, if it has any of its own */
export const fontsForTheme = (id: ThemeId) => { const load = THEME[id]; if (load) once(id, load) }

/** the Retro dial's pixel faces: Silkscreen from Broadcast (stop 2) on, VT323 from Arcade (stop 3) on */
export const fontsForRetro = (stage: number) => {
  if (stage >= 2) once('pixel', () => import('@/fonts/pixel.css'))
  if (stage >= 3) once('terminal', () => import('@/fonts/terminal.css'))
}

/** the Support screen draws a tile in each supporter theme's own face */
export const supporterFonts = () => { for (const id of ['library', 'observatory', 'mono', 'receipt', 'chalkboard'] as ThemeId[]) fontsForTheme(id) }
