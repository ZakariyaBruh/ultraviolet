import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Offset = { x: number; y: number }

interface Layout {
  /** Offsets by route, then by panel id. */
  offsets: Record<string, Record<string, Offset>>
  /** Pairs of panels the user deliberately overlapped on a screen ("a|b"); automatic tidying leaves these alone. */
  keep: Record<string, string[]>
  move: (scope: string, id: string, o: Offset) => void
  setKeep: (scope: string, pairs: string[]) => void
  reset: (scope?: string) => void
}

const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 4000

/** Where the user parked each panel. Browser-only, separate from the main store so a bad layout can never break data. */
export const useLayout = create<Layout>()(
  persist(
    (set) => ({
      offsets: {},
      keep: {},
      setKeep: (scope, pairs) => set((s) => ({ keep: { ...s.keep, [scope]: pairs.slice(0, 60) } })),
      move: (scope, id, o) => set((s) => ({ offsets: { ...s.offsets, [scope]: { ...s.offsets[scope], [id]: o } } })),
      reset: (scope) =>
        set((s) => {
          if (!scope) return { offsets: {}, keep: {} }
          const next = { ...s.offsets }
          const keep = { ...s.keep }
          delete next[scope]
          delete keep[scope]
          return { offsets: next, keep }
        }),
    }),
    {
      name: 'friction:layout',
      version: 1,
      partialize: (s) => ({ offsets: s.offsets, keep: s.keep }),
      merge: (saved, cur) => {
        const clean: Layout['offsets'] = {}
        const raw = (saved as { offsets?: unknown } | null)?.offsets
        if (raw && typeof raw === 'object') {
          for (const [scope, m] of Object.entries(raw as Record<string, unknown>)) {
            if (!m || typeof m !== 'object') continue
            for (const [id, o] of Object.entries(m as Record<string, { x?: unknown; y?: unknown }>)) {
              if (id === 'true') continue // an older build keyed every panel the same
              if (o && finite(o.x) && finite(o.y)) (clean[scope] ??= {})[id] = { x: o.x as number, y: o.y as number }
            }
          }
        }
        const keep: Layout['keep'] = {}
        const rawKeep = (saved as { keep?: unknown } | null)?.keep
        if (rawKeep && typeof rawKeep === 'object') {
          for (const [scope, v] of Object.entries(rawKeep as Record<string, unknown>)) if (Array.isArray(v)) keep[scope] = v.filter((x): x is string => typeof x === 'string').slice(0, 60)
        }
        return { ...cur, offsets: clean, keep }
      },
    },
  ),
)
