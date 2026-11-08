import { fx_say } from './actions'
import { isSupporter } from './supporter'
import { useStore } from './store'
import { THEMES, themeDef, themesFor, type ThemeId } from './themes'
import { useUI } from './ui'
import { stop as stopPlayer } from './player'
import { stopMusic } from './music'
import { useAmbience } from './ambience'
import { isTrying, markTrial, refuse, setTrying, trialAvailable } from './trial'

if (typeof window !== 'undefined') addEventListener('friction:trial-refused', () => fx_say({ title: 'Look around only', description: 'While you try a theme nothing plays and nothing can be locked in.' }))

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
/** Show a supporter theme for two minutes without saving it, so anyone can see what they would get. Once a day, never during a session, and nothing plays while it is on. */
export function startPreview(id: ThemeId) {
  if (useStore.getState().session) { fx_say({ title: 'Finish your session first', description: 'A theme can be tried only between sessions.' }); return }
  if (useUI.getState().previewTheme === id) return
  if (!isTrying() && !trialAvailable()) { fx_say({ title: 'You tried a theme today', description: 'Supporters keep every theme. A free try comes back tomorrow.' }); return }
  if (!isTrying()) { markTrial(); stopPlayer(); stopMusic(); useAmbience.getState().stop(); previewTimer = setTimeout(() => endPreview(true), 120_000) } // switching themes never adds time
  setTrying(true)
  useUI.getState().set({ previewTheme: id })
  fx_say({ title: `Trying ${themeDef(id).name}`, description: 'Look around. Nothing plays and nothing locks in while you try it. It goes back in two minutes.' })
}
function endPreview(timed: boolean) {
  clearTimeout(previewTimer)
  setTrying(false)
  if (useUI.getState().previewTheme) { useUI.getState().set({ previewTheme: null }); if (timed) fx_say({ title: 'Back to your theme' }) }
}
export const stopPreview = () => endPreview(false)
void refuse
