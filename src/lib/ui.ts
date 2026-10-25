import { create } from 'zustand'
import type { SessionRec } from './store'

/** Transient UI state: never persisted. */
interface UI {
  theatre: boolean
  tuneOpen: boolean
  searchOpen: boolean
  profileOpen: boolean
  moreOpen: boolean
  landing: boolean
  tourOpen: boolean
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
  searchOpen: false,
  profileOpen: false,
  moreOpen: false,
  landing: false,
  tourOpen: false,
  onboardOpen: false,
  receipt: null,
  celebrate: null,
  set: (patch) => set(patch),
}))
