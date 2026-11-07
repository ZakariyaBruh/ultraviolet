/** Minutes focused in all, from the saved hour log. */
export const dayTotalAll = (log: Record<string, number[]>) => Object.values(log).reduce((a, row) => a + row.reduce((x, y) => x + y, 0), 0)
