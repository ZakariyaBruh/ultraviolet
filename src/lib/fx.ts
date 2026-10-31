import { create } from 'zustand'

export interface Burst {
  id: number
  x: number
  y: number
  n: number
}

export interface Notice {
  id: number
  title: string
  description?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
  undo?: () => void
  /** the button text for `undo` (default "Undo") */
  label?: string
}

interface Fx {
  bursts: Burst[]
  flash: number
  notice: Notice | null
  burst: (x: number, y: number, n: number) => void
  drop: (id: number) => void
  say: (n: Omit<Notice, 'id'>) => void
  clearNotice: () => void
}

let seq = 0

export const useFx = create<Fx>((set) => ({
  bursts: [],
  flash: 0,
  notice: null,
  burst: (x, y, n) => set((s) => ({ bursts: [...s.bursts.slice(-5), { id: ++seq, x, y, n }], flash: s.flash + 1 })),
  drop: (id) => set((s) => ({ bursts: s.bursts.filter((b) => b.id !== id) })),
  say: (n) => set({ notice: { ...n, id: ++seq } }),
  clearNotice: () => set({ notice: null }),
}))
