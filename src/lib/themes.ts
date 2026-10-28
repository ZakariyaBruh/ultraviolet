export type ThemeId = 'station' | 'paper' | 'phosphor' | 'blueprint' | 'sunset'

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
}

export const THEMES: ThemeDef[] = [
  { id: 'station', name: 'Station', note: 'Blue-black, broadcast yellow', light: false, ground: '#05070c', signal: '#ffd23f', ink: '#f3f1ea', ice: '#7fd3ff' },
  { id: 'paper', name: 'Paper', note: 'Newsprint and signal blue', light: true, ground: '#f2efe6', signal: '#1f3bff', ink: '#0a0c12', ice: '#0a6e8a' },
  { id: 'phosphor', name: 'Phosphor', note: 'Old monitor, soft green on dark', light: false, ground: '#0d130e', signal: '#9fe870', ink: '#d4dccb', ice: '#8fd0b4' },
  { id: 'blueprint', name: 'Blueprint', note: 'White linework on drawing blue', light: false, ground: '#0a2557', signal: '#7ff0ff', ink: '#eaf3ff', ice: '#ffffff' },
  { id: 'sunset', name: 'Sunset', note: 'Plum night, hot pink, peach', light: false, ground: '#140a24', signal: '#ff4fa3', ink: '#fff1f7', ice: '#ffb86b' },
]

export const THEME_IDS = THEMES.map((t) => t.id)
export const themeDef = (id: ThemeId) => THEMES.find((t) => t.id === id) ?? THEMES[0]
export const isLightTheme = (id: ThemeId) => themeDef(id).light
/** Old saves stored 'dark' or 'light'. */
export const normalizeTheme = (v: unknown): ThemeId => (v === 'light' ? 'paper' : (THEME_IDS as unknown[]).includes(v) ? (v as ThemeId) : 'station')
