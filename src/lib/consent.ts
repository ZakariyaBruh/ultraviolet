import { create } from 'zustand'

/**
 * The cookie choice. Google Tag Manager (and so anything Google sets for analytics or advertising) is loaded only after Accept; Reject and
 * not answering load nothing. The choice is one key in localStorage and can be changed from Settings. index.html reads the same key on load.
 */
const KEY = 'friction:consent'
export type Consent = 'granted' | 'denied' | null
const read = (): Consent => { try { const v = localStorage.getItem(KEY); return v === 'granted' || v === 'denied' ? v : null } catch { return null } }

interface ConsentState { choice: Consent; asking: boolean; choose: (c: 'granted' | 'denied') => void; reopen: () => void }
export const useConsent = create<ConsentState>((set) => ({
  choice: read(),
  asking: read() === null,
  choose: (c) => {
    try { localStorage.setItem(KEY, c) } catch { /* storage blocked: the choice lasts for this visit */ }
    if (c === 'granted') (window as unknown as { __gtm?: () => void }).__gtm?.()
    set({ choice: c, asking: false })
  },
  // changing a choice to Reject cannot unload what Google already set in this visit, so the page is reloaded to start clean
  reopen: () => set({ asking: true }),
}))

/** Reject after Accept: forget the choice and reload so nothing Google loaded stays running. */
export function rejectNow() {
  try { localStorage.setItem(KEY, 'denied') } catch { /* storage blocked */ }
  location.reload()
}
