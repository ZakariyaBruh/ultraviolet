import { fx_say } from './actions'
import { isSupporter } from './supporter'
import { useStore } from './store'
import { THEMES, themeDef, themesFor, type ThemeId } from './themes'
import { useUI } from './ui'

export { themeDef }

/** Next theme you can keep (supporter themes only for a supporter); says its name so a key press or tap is never silent. */
export function cycleTheme() {
  const st = useStore.getState()
  const list = themesFor(isSupporter())
  const now = useUI.getState().previewTheme ?? st.settings.theme
  const i = Math.max(0, list.findIndex((t) => t.id === now))
  const next = list[(i + 1) % list.length] ?? THEMES[0]
  useUI.getState().set({ previewTheme: null })
  st.setSettings({ theme: next.id })
  fx_say({ title: next.name, description: next.note })
}

let previewTimer: ReturnType<typeof setTimeout> | undefined
/** Show a supporter theme for two minutes without saving it, so anyone can see what they would get. */
export function startPreview(id: ThemeId) {
  clearTimeout(previewTimer)
  useUI.getState().set({ previewTheme: id })
  fx_say({ title: `Trying ${themeDef(id).name}`, description: 'Supporters keep it. It goes back to normal in two minutes.' })
  previewTimer = setTimeout(() => { if (useUI.getState().previewTheme === id) { useUI.getState().set({ previewTheme: null }); fx_say({ title: 'Back to your theme' }) } }, 120_000)
}
export function stopPreview() {
  clearTimeout(previewTimer)
  if (useUI.getState().previewTheme) useUI.getState().set({ previewTheme: null })
}
