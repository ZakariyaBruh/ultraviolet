/**
 * The Statistics window's arithmetic: pasted numbers (any mix of spaces, commas, semicolons, tabs and lines) summarised, with quartiles
 * by the median-of-halves method, outliers by the 1.5 x IQR rule, and, for pairs of numbers, a least-squares line with r and r squared.
 */
export interface Summary { n: number; sum: number; mean: number; median: number; modes: number[]; min: number; max: number; range: number; q1: number; q3: number; iqr: number; sd: number | null; sdPop: number; variance: number | null; outliers: number[]; sorted: number[] }
export interface Fit { n: number; slope: number; intercept: number; r: number; r2: number }

/** every number in the text, and how many words were not numbers */
export function numbersIn(text: string): { nums: number[]; skipped: number } {
  const nums: number[] = []
  let skipped = 0
  for (const w of text.split(/[\s;]+|,(?=\s|$)|(?<=\s),/).map((x) => x.trim()).filter(Boolean)) {
    // 1,5 is one and a half when it stands alone; 1,2,3 is a list
    const parts = /^[+-]?\d+(,\d+)+$/.test(w) && !/^[+-]?\d+,\d{1,2}$/.test(w) ? w.split(',') : [w.replace(/^([+-]?\d+),(\d{1,2})$/, '$1.$2')]
    for (const p of parts) { const t = p.replace(/^[+-]?(?=\.)/, (m) => m + '0'); if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(p) && Number.isFinite(Number(t))) nums.push(Number(p)); else skipped++ }
  }
  return { nums, skipped }
}
/** lines with two numbers each: x and y */
export function pairsIn(text: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (const line of text.split(/\n/)) {
    const { nums } = numbersIn(line.replace(/,/g, ' '))
    if (nums.length === 2) out.push({ x: nums[0], y: nums[1] })
  }
  return out
}
const med = (s: number[]) => { const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2 }

export function summarise(values: number[]): Summary | null {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b)
  const n = s.length
  if (!n) return null
  const sum = s.reduce((a, b) => a + b, 0), mean = sum / n
  const ss = s.reduce((a, b) => a + (b - mean) ** 2, 0)
  const lo = s.slice(0, Math.floor(n / 2)), hi = s.slice(Math.ceil(n / 2))
  const q1 = lo.length ? med(lo) : s[0], q3 = hi.length ? med(hi) : s[n - 1]
  const iqr = q3 - q1
  const count = new Map<number, number>()
  for (const v of s) count.set(v, (count.get(v) ?? 0) + 1)
  const top = Math.max(...count.values())
  const modes = top > 1 ? [...count].filter(([, c]) => c === top).map(([v]) => v) : []
  return { n, sum, mean, median: med(s), modes, min: s[0], max: s[n - 1], range: s[n - 1] - s[0], q1, q3, iqr, sd: n > 1 ? Math.sqrt(ss / (n - 1)) : null, sdPop: Math.sqrt(ss / n), variance: n > 1 ? ss / (n - 1) : null, outliers: s.filter((v) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr), sorted: s }
}

/** the least-squares line through the pairs, or null when there are fewer than two points or every x is the same */
export function fit(pts: { x: number; y: number }[]): Fit | null {
  const n = pts.length
  if (n < 2) return null
  const mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n
  let sxx = 0, syy = 0, sxy = 0
  for (const p of pts) { sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; sxy += (p.x - mx) * (p.y - my) }
  if (sxx === 0) return null
  const slope = sxy / sxx
  const r = syy === 0 ? 1 : sxy / Math.sqrt(sxx * syy) // every y the same: a flat line that fits exactly
  return { n, slope, intercept: my - slope * mx, r, r2: r * r }
}
