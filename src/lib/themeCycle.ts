import { fx_say } from './actions'
import { isSupporter } from './supporter'
import { useStore } from './store'
import { THEMES, themeDef, themesFor, type ThemeId } from './themes'
import { useUI } from './ui'
import { stop as stopPlayer } from './player'
import { stopMusic } from './music'
import { hushAll, isTrying, markTrial, refuse, setTrying, trialAvailable } from './trial'

if (typeof window !== 'undefined') addEventListener('friction:trial-refused', () => fx_say({ title: 'Look around only', description: "While you're trying a theme, nothing plays and you can't lock in." }))

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
  if (useStore.getState().session) { fx_say({ title: 'Finish your session first', description: 'You can only try a theme between sessions.' }); return }
  if (useUI.getState().previewTheme === id) return
  if (!isTrying() && !trialAvailable()) { fx_say({ title: 'You tried a theme today', description: 'Supporters keep every theme. Your free try comes back tomorrow.' }); return }
  if (!isTrying()) { markTrial(); stopPlayer(); stopMusic(); hushAll(); previewTimer = setTimeout(() => endPreview(true), 120_000) } // switching themes never adds time
  setTrying(true)
  useUI.getState().set({ previewTheme: id })
  fx_say({ title: `Trying ${themeDef(id).name}`, description: "Look around for two minutes. Nothing plays and you can't lock in. Then it goes back." })
}
function endPreview(timed: boolean) {
  clearTimeout(previewTimer)
  setTrying(false)
  const shown = useUI.getState().previewTheme
  if (shown) {
    useUI.getState().set({ previewTheme: null })
    // the two minutes are the moment someone has seen what they would get: say what keeping it costs, once, and let them go
    if (timed) void import('./supporter').then(({ isSupporter, openSupport }) => fx_say(isSupporter() ? { title: 'Back to your theme' } : { title: `${themeDef(shown).name} is for supporters`, description: 'Keep it for $2 a month, along with the other four and an encrypted backup.', label: 'See Support', undo: openSupport }))
  }
}
export const stopPreview = () => endPreview(false)
void refuse
