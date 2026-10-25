import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Offset = { x: number; y: number }

interface Layout {
  /** Offsets by route, then by panel id. */
  offsets: Record<string, Record<string, Offset>>
  move: (scope: string, id: string, o: Offset) => void
  reset: (scope?: string) => void
}

const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 4000

/** Where the user parked each panel. Browser-only, separate from the main store so a bad layout can never break data. */
export const useLayout = create<Layout>()(
  persist(
    (set) => ({
      offsets: {},
      move: (scope, id, o) => set((s) => ({ offsets: { ...s.offsets, [scope]: { ...s.offsets[scope], [id]: o } } })),
      reset: (scope) =>
        set((s) => {
          if (!scope) return { offsets: {} }
          const next = { ...s.offsets }
          delete next[scope]
          return { offsets: next }
        }),
    }),
    {
      name: 'friction:layout',
      version: 1,
      partialize: (s) => ({ offsets: s.offsets }),
      merge: (saved, cur) => {
        const clean: Layout['offsets'] = {}
        const raw = (saved as { offsets?: unknown } | null)?.offsets
        if (raw && typeof raw === 'object') {
          for (const [scope, m] of Object.entries(raw as Record<string, unknown>)) {
            if (!m || typeof m !== 'object') continue
            for (const [id, o] of Object.entries(m as Record<string, { x?: unknown; y?: unknown }>)) {
              if (o && finite(o.x) && finite(o.y)) (clean[scope] ??= {})[id] = { x: o.x as number, y: o.y as number }
            }
          }
        }
        return { ...cur, offsets: clean }
      },
    },
  ),
)
