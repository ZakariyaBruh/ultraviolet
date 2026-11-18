/**
 * The Grades window's arithmetic: a weighted average of what is marked so far, the score the rest of a course needs for a target,
 * and a grade point average. Pure, so it is tested against worked answers.
 */
export interface Part { id: string; name: string; weight: number; score: number | null }
export interface Course { id: string; name: string; credits: number; grade: string }
export interface Grades { parts: Part[]; target: number; courses: Course[] }

/** what has been marked: its share of the course (weight), the points it earned towards 100, and its average */
export function standing(parts: Part[]) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.weight || 0), 0)
  const marked = parts.filter((p) => p.score !== null && Number.isFinite(p.score) && p.weight > 0)
  const done = marked.reduce((s, p) => s + p.weight, 0)
  const points = marked.reduce((s, p) => s + (p.weight * (p.score as number)) / 100, 0)
  return { total, done, points, avg: done > 0 ? (points / done) * 100 : null }
}

/** the average needed on what is not marked yet to finish with `target` overall (null: nothing left to mark) */
export function needed(parts: Part[], target: number): number | null {
  const { total, done, points } = standing(parts)
  const rest = total - done
  if (rest <= 0 || total <= 0) return null
  return ((target * total) / 100 - points) * 100 / rest
}

export const LETTERS: [string, number][] = [['A+', 4], ['A', 4], ['A-', 3.7], ['B+', 3.3], ['B', 3], ['B-', 2.7], ['C+', 2.3], ['C', 2], ['C-', 1.7], ['D+', 1.3], ['D', 1], ['D-', 0.7], ['F', 0]]
export function gpa(courses: Course[]): number | null {
  const ok = courses.filter((c) => c.credits > 0 && LETTERS.some(([l]) => l === c.grade))
  const credits = ok.reduce((s, c) => s + c.credits, 0)
  if (!credits) return null
  return ok.reduce((s, c) => s + c.credits * (LETTERS.find(([l]) => l === c.grade)![1]), 0) / credits
}

const num = (x: unknown, lo: number, hi: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null)
export function sanitizeGrades(v: unknown): Grades | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const parts = (Array.isArray(o.parts) ? o.parts : []).slice(0, 40).filter((p): p is Record<string, unknown> => !!p && typeof p === 'object').map((p, i) => ({ id: String(p.id ?? i).slice(0, 24), name: String(p.name ?? '').slice(0, 60), weight: num(p.weight, 0, 1000) ?? 0, score: num(p.score, 0, 200) }))
  const courses = (Array.isArray(o.courses) ? o.courses : []).slice(0, 40).filter((c): c is Record<string, unknown> => !!c && typeof c === 'object').map((c, i) => ({ id: String(c.id ?? i).slice(0, 24), name: String(c.name ?? '').slice(0, 60), credits: num(c.credits, 0, 60) ?? 0, grade: LETTERS.some(([l]) => l === c.grade) ? String(c.grade) : 'A' }))
  return { parts, courses, target: num(o.target, 0, 100) ?? 70 }
}
