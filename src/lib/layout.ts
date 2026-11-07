import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Offset = { x: number; y: number }
/** The size a panel was dragged to, in the panel's own CSS px (before any FitView scale). */
export type Size = { w: number; h: number }

interface Layout {
  /** Offsets by route, then by panel id. */
  offsets: Record<string, Record<string, Offset>>
  /** Sizes by route, then by panel id; a panel with no entry is the size its layout gives it. Study windows and the player keep one size on every screen (scope "shell"). */
  sizes: Record<string, Record<string, Size>>
  /** Pairs of panels the user deliberately overlapped on a screen ("a|b"); automatic tidying leaves these alone. */
  keep: Record<string, string[]>
  move: (scope: string, id: string, o: Offset) => void
  resize: (scope: string, id: string, s: Size) => void
  unsize: (scope: string, id: string) => void
  setKeep: (scope: string, pairs: string[]) => void
  reset: (scope?: string) => void
}

const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 4000
const extent = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 40 && n <= 4000

/** Where the user parked each panel. Browser-only, separate from the main store so a bad layout can never break data. */
export const useLayout = create<Layout>()(
  persist(
    (set) => ({
      offsets: {},
      sizes: {},
      keep: {},
      setKeep: (scope, pairs) => set((s) => ({ keep: { ...s.keep, [scope]: pairs.slice(0, 60) } })),
      move: (scope, id, o) => set((s) => ({ offsets: { ...s.offsets, [scope]: { ...s.offsets[scope], [id]: o } } })),
      resize: (scope, id, size) => set((s) => ({ sizes: { ...s.sizes, [scope]: { ...s.sizes[scope], [id]: { w: Math.round(size.w), h: Math.round(size.h) } } } })),
      unsize: (scope, id) =>
        set((s) => {
          if (!s.sizes[scope]?.[id]) return s
          const inScope = { ...s.sizes[scope] }
          delete inScope[id]
          const sizes = { ...s.sizes, [scope]: inScope }
          if (!Object.keys(inScope).length) delete sizes[scope]
          return { sizes }
        }),
      reset: (scope) =>
        set((s) => {
          if (!scope) return { offsets: {}, sizes: {}, keep: {} }
          const next = { ...s.offsets }
          const sizes = { ...s.sizes }
          const keep = { ...s.keep }
          delete next[scope]
          delete sizes[scope]
          delete keep[scope]
          return { offsets: next, sizes, keep }
        }),
    }),
    {
      name: 'friction:layout',
      version: 1,
      partialize: (s) => ({ offsets: s.offsets, sizes: s.sizes, keep: s.keep }),
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
        const sizes: Layout['sizes'] = {}
        const rawSizes = (saved as { sizes?: unknown } | null)?.sizes
        if (rawSizes && typeof rawSizes === 'object') {
          for (const [scope, m] of Object.entries(rawSizes as Record<string, unknown>)) {
            if (!m || typeof m !== 'object') continue
            for (const [id, z] of Object.entries(m as Record<string, { w?: unknown; h?: unknown }>)) {
              if (z && extent(z.w) && extent(z.h)) (sizes[scope] ??= {})[id] = { w: z.w as number, h: z.h as number }
            }
          }
        }
        const keep: Layout['keep'] = {}
        const rawKeep = (saved as { keep?: unknown } | null)?.keep
        if (rawKeep && typeof rawKeep === 'object') {
          for (const [scope, v] of Object.entries(rawKeep as Record<string, unknown>)) if (Array.isArray(v)) keep[scope] = v.filter((x): x is string => typeof x === 'string').slice(0, 60)
        }
        return { ...cur, offsets: clean, sizes, keep }
      },
    },
  ),
)
