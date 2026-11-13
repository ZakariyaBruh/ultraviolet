/**
 * A supporter theme can be tried once a day, for two minutes, as a look around: nothing plays and nothing can be locked in while it is on,
 * and it cannot be started during a session. No imports, so the player, the store and the arcade can all ask it.
 */
let trying = false
export const isTrying = () => trying
export const setTrying = (v: boolean) => { trying = v }
/** told when something was refused; themeCycle says why */
export const refuse = () => { try { dispatchEvent(new Event('friction:trial-refused')) } catch { /* no window */ } }
const KEY = 'friction:trial'
const DAY = 86_400_000
export const trialAvailable = () => { try { const t = Number(localStorage.getItem(KEY)); return !(t && Date.now() - t < DAY) } catch { return true } }
export const markTrial = () => { try { localStorage.setItem(KEY, String(Date.now())) } catch { /* private mode */ } }
/** things that make sound sign up here, so starting a trial can silence them without the theme switcher having to load them first */
const hush = new Set<() => void>()
export const onHush = (f: () => void) => { hush.add(f) }
export const hushAll = () => hush.forEach((f) => { try { f() } catch { /* nothing was playing */ } })
