import { fx_say } from './actions'
import { useStore } from './store'
import { THEMES, themeDef } from './themes'

export { themeDef }

/** Next theme in the list; says its name so a key press or tap is never silent. */
export function cycleTheme() {
  const st = useStore.getState()
  const i = THEMES.findIndex((t) => t.id === st.settings.theme)
  const next = THEMES[(i + 1) % THEMES.length]
  st.setSettings({ theme: next.id })
  fx_say({ title: next.name, description: next.note })
}
