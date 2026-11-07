import { create } from 'zustand'
import type { SessionRec } from './store'
import type { ThemeId } from './themes'

/** Transient UI state: never persisted. */
interface UI {
  theatre: boolean
  tuneOpen: boolean
  /** the report-a-problem sheet for what is playing */
  reportOpen: boolean
  soundOpen: boolean
  widgetsOpen: boolean
  searchOpen: boolean
  profileOpen: boolean
  moreOpen: boolean
  landing: boolean
  tourOpen: boolean
  /** the Browser's first-open walkthrough */
  browserTour: boolean
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
  /** open Insights on this tab, and its Review tab on this tool (set by deep links and cleared once used) */
  insightsTab: string | null
  reviewTab: string | null
  /** a supporter theme someone is only looking at: shown now, never saved, gone on reload */
  previewTheme: ThemeId | null
  set: (patch: Partial<Omit<UI, 'set'>>) => void
}

export const useUI = create<UI>((set) => ({
  theatre: false,
  tuneOpen: false,
  reportOpen: false,
  soundOpen: false,
  widgetsOpen: false,
  searchOpen: false,
  profileOpen: false,
  moreOpen: false,
  landing: false,
  tourOpen: false,
  browserTour: false,
  itemTour: null,
  onboardOpen: false,
  receipt: null,
  celebrate: null,
  cloudOpen: false,
  insightsTab: null,
  reviewTab: null,
  previewTheme: null,
  set: (patch) => set(patch),
}))

if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __ui: typeof useUI }).__ui = useUI
