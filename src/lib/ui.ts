import { create } from 'zustand'
import type { SessionRec } from './store'

/** Transient UI state: never persisted. */
interface UI {
  theatre: boolean
  tuneOpen: boolean
  soundOpen: boolean
  widgetsOpen: boolean
  /** the cloud browser is showing: the backdrop goes still so the page gets the thread (an iPad shares one) */
  cloudOpen: boolean
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
  set: (patch: Partial<Omit<UI, 'set'>>) => void
}

export const useUI = create<UI>((set) => ({
  theatre: false,
  tuneOpen: false,
  soundOpen: false,
  widgetsOpen: false,
  cloudOpen: false,
  searchOpen: false,
  profileOpen: false,
  moreOpen: false,
  landing: false,
  tourOpen: false,
  itemTour: null,
  onboardOpen: false,
  receipt: null,
  celebrate: null,
  set: (patch) => set(patch),
}))
