import { create } from 'zustand'
import type { SessionRec } from './store'

/** Transient UI state: never persisted. */
interface UI {
  theatre: boolean
  tuneOpen: boolean
  searchOpen: boolean
  profileOpen: boolean
  moreOpen: boolean
  tourOpen: boolean
  receipt: SessionRec | null
  set: (patch: Partial<Omit<UI, 'set'>>) => void
}

export const useUI = create<UI>((set) => ({
  theatre: false,
  tuneOpen: false,
  searchOpen: false,
  profileOpen: false,
  moreOpen: false,
  tourOpen: false,
  receipt: null,
  set: (patch) => set(patch),
}))
