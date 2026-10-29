import { create } from 'zustand'
import type { SessionRec } from './store'

/** Transient UI state: never persisted. */
interface UI {
  theatre: boolean
  tuneOpen: boolean
  soundOpen: boolean
  widgetsOpen: boolean
  searchOpen: boolean
  profileOpen: boolean
  moreOpen: boolean
  landing: boolean
  tourOpen: boolean
  /** the item whose how-to walk-through is showing (a bought window: sound machine, spinner, cannon, auto music) */
  itemTour: string | null
  /** run the welcome again (Settings, Help) */
  onboardOpen: boolean
  receipt: SessionRec | null
  /** a small win worth marking: shows the celebration card */
  celebrate: { title: string; detail: string } | null
  /**
   * The cloud browser frame is mounted. A proxied page shares one thread with Friction on an iPad, so while it is open
   * we stop Friction's own forced-layout timers (the ASCII panel scan, the Shell scroll measure) — each reflow is
   * pathologically slow next to a heavy live iframe and was freezing the whole tab. Animation is untouched.
   */
  cloudOpen: boolean
  set: (patch: Partial<Omit<UI, 'set'>>) => void
}

export const useUI = create<UI>((set) => ({
  theatre: false,
  tuneOpen: false,
  soundOpen: false,
  widgetsOpen: false,
  searchOpen: false,
  profileOpen: false,
  moreOpen: false,
  landing: false,
  tourOpen: false,
  itemTour: null,
  onboardOpen: false,
  receipt: null,
  celebrate: null,
  cloudOpen: false,
  set: (patch) => set(patch),
}))
