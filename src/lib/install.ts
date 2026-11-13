/**
 * What the app has to know about installing before the install screens themselves are fetched (`components/app/Install.tsx`, loaded
 * only where it can be shown): which kind of device this is, whether it is already running as a Home Screen app, and the browser's
 * own install offer. That offer (`beforeinstallprompt`, Android) arrives once, soon after the page loads, so it has to be caught
 * here, at start, and kept for when the person says yes.
 */
export type Platform = 'ios' | 'android' | null
export const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent)
/** iPadOS asks for the desktop site by default, so an iPad looks like a Mac with a touch screen */
export const ipad = () => typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
export const platform = (): Platform => (/iPhone|iPod|iPad/.test(ua()) || ipad() ? 'ios' : /Android/.test(ua()) ? 'android' : null)
export const standalone = () => {
  try { return matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true } catch { return false }
}

export interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
/** the browser's install offer, once it has made one, and whether the app has been installed during this visit */
export const pending: { event: InstallEvent | null; installed: boolean } = { event: null, installed: false }
if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pending.event = e as InstallEvent })
  addEventListener('appinstalled', () => { pending.installed = true; pending.event = null })
}

const HIDE = 'friction:install-hide'
/** the ask was dismissed during this visit */
export const installSeen = () => { try { return sessionStorage.getItem(HIDE) === '1' } catch { return false } }
export const hideInstall = () => { try { sessionStorage.setItem(HIDE, '1') } catch { /* storage blocked */ } }
