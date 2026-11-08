/** The supporter goals: each step a little bigger than the last (1, 10, 20, 35, 50, 70, 95, 125 ...), so the next one never jumps. */
export const GOALS = [1, 10, 20, 35, 50, 70, 95, 125, 160, 200, 250, 310, 380, 460, 550, 650, 760, 880, 1000]
export function goalFor(n: number): { goal: number; prev: number } {
  let prev = 0
  for (const g of GOALS) { if (n < g) return { goal: g, prev }; prev = g }
  const goal = Math.floor(n / 150 + 1) * 150
  return { goal: goal > n ? goal : goal + 150, prev: Math.floor(n / 150) * 150 }
}
