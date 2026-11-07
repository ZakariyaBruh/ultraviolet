export type ThemeId = 'station' | 'paper' | 'phosphor' | 'blueprint' | 'sunset' | 'library' | 'observatory' | 'mono' | 'receipt' | 'chalkboard'

export interface ThemeDef {
  id: ThemeId
  name: string
  note: string
  /** light themes turn EasyUI's own light variants on */
  light: boolean
  ground: string
  signal: string
  ink: string
  ice: string
  /** a supporter theme: everyone can preview it, a supporter keeps it */
  premium?: boolean
}

export const THEMES: ThemeDef[] = [
  { id: 'station', name: 'Station', note: 'Blue-black, broadcast yellow', light: false, ground: '#05070c', signal: '#ffd23f', ink: '#f3f1ea', ice: '#7fd3ff' },
  { id: 'paper', name: 'Paper', note: 'Newsprint and signal blue', light: true, ground: '#f2efe6', signal: '#1f3bff', ink: '#0a0c12', ice: '#0a6e8a' },
  { id: 'phosphor', name: 'Phosphor', note: 'Old monitor, soft green on dark', light: false, ground: '#0d130e', signal: '#9fe870', ink: '#d4dccb', ice: '#8fd0b4' },
  { id: 'blueprint', name: 'Blueprint', note: 'White linework on drawing blue', light: false, ground: '#0a2557', signal: '#7ff0ff', ink: '#eaf3ff', ice: '#ffffff' },
  { id: 'sunset', name: 'Sunset', note: 'Plum night, hot pink, peach', light: false, ground: '#140a24', signal: '#ff4fa3', ink: '#fff1f7', ice: '#ffb86b' },
  // supporter themes: each one changes the structure (frames, type, the picture behind the panels), not only the colours
  { id: 'library', name: 'Library', note: 'Oxblood leather, brass frames, a serif', light: false, ground: '#190d10', signal: '#d9b45c', ink: '#f1e6d0', ice: '#8fc1b5', premium: true },
  { id: 'observatory', name: 'Observatory', note: 'Star chart, indigo night, instrument ticks', light: false, ground: '#0a0c1c', signal: '#f4d98a', ink: '#e9e8f5', ice: '#8fb4ff', premium: true },
  { id: 'mono', name: 'Mono', note: 'Black, white and nothing else', light: false, ground: '#000000', signal: '#ffffff', ink: '#ffffff', ice: '#c8c8c8', premium: true },
  { id: 'receipt', name: 'Receipt', note: 'Thermal paper, torn edges, highlighter', light: true, ground: '#d8d4c6', signal: '#141414', ink: '#141414', ice: '#254f72', premium: true },
  { id: 'chalkboard', name: 'Chalkboard', note: 'Chalk on slate, hand-drawn lines', light: false, ground: '#1c2824', signal: '#f3d95a', ink: '#eef0e6', ice: '#8fd4e8', premium: true },
]

export const THEME_IDS = THEMES.map((t) => t.id)
export const themeDef = (id: ThemeId) => THEMES.find((t) => t.id === id) ?? THEMES[0]
export const isLightTheme = (id: ThemeId) => themeDef(id).light
/** Old saves stored 'dark' or 'light'. */
export const normalizeTheme = (v: unknown): ThemeId => (v === 'light' ? 'paper' : (THEME_IDS as unknown[]).includes(v) ? (v as ThemeId) : 'station')

export const isPremiumTheme = (id: ThemeId) => !!themeDef(id).premium

/**
 * The theme that is actually shown. A supporter theme shows for a supporter, or while someone is previewing it; otherwise the
 * saved choice is kept (so it comes back if they support again) and Station is shown meanwhile.
 */
export function shownTheme(saved: ThemeId, supporter: boolean, preview: ThemeId | null): ThemeId {
  if (preview) return preview
  return isPremiumTheme(saved) && !supporter ? 'station' : saved
}
/** the themes someone can pick and keep */
export const themesFor = (supporter: boolean) => THEMES.filter((t) => supporter || !t.premium)
