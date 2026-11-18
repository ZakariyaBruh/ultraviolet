/**
 * The Formulas window: a library of physics, chemistry, maths and money formulas. Pick one, fill in what you know, and it solves for
 * the one thing left, by the same hand-written maths reader as the Graph window (never `eval`): every known value is written into the
 * equation, the unknown becomes x, and the roots of (left - right) are found by scanning for sign changes and bisecting. A formula that
 * has two answers (a square root of either sign) lists both; one with none says so.
 */
import { compile, parse, show, MathError } from './mathexpr'

export interface Var { sym: string; name: string; unit: string }
export interface Formula { id: string; name: string; group: string; eq: string; vars: Var[]; note?: string }
const V = (sym: string, name: string, unit = ''): Var => ({ sym, name, unit })

export const FORMULAS: Formula[] = [
  { id: 'newton2', group: 'Physics', name: 'Force', eq: 'f = m*a', vars: [V('f', 'force', 'N'), V('m', 'mass', 'kg'), V('a', 'acceleration', 'm/s²')] },
  { id: 'speed', group: 'Physics', name: 'Speed', eq: 'v = d/t', vars: [V('v', 'speed', 'm/s'), V('d', 'distance', 'm'), V('t', 'time', 's')] },
  { id: 'accel', group: 'Physics', name: 'Acceleration', eq: 'a = (v - u)/t', vars: [V('a', 'acceleration', 'm/s²'), V('v', 'final speed', 'm/s'), V('u', 'start speed', 'm/s'), V('t', 'time', 's')] },
  { id: 'suvat1', group: 'Physics', name: 'Distance, constant acceleration', eq: 's = u*t + a*t^2/2', vars: [V('s', 'distance', 'm'), V('u', 'start speed', 'm/s'), V('t', 'time', 's'), V('a', 'acceleration', 'm/s²')] },
  { id: 'suvat2', group: 'Physics', name: 'Speed from distance', eq: 'v^2 = u^2 + 2*a*s', vars: [V('v', 'final speed', 'm/s'), V('u', 'start speed', 'm/s'), V('a', 'acceleration', 'm/s²'), V('s', 'distance', 'm')], note: 'A square, so it can have two answers.' },
  { id: 'ke', group: 'Physics', name: 'Kinetic energy', eq: 'k = m*v^2/2', vars: [V('k', 'energy', 'J'), V('m', 'mass', 'kg'), V('v', 'speed', 'm/s')] },
  { id: 'pe', group: 'Physics', name: 'Gravitational potential energy', eq: 'p = m*9.81*h', vars: [V('p', 'energy', 'J'), V('m', 'mass', 'kg'), V('h', 'height', 'm')], note: 'g is 9.81 m/s².' },
  { id: 'momentum', group: 'Physics', name: 'Momentum', eq: 'p = m*v', vars: [V('p', 'momentum', 'kg·m/s'), V('m', 'mass', 'kg'), V('v', 'speed', 'm/s')] },
  { id: 'work', group: 'Physics', name: 'Work', eq: 'w = f*d', vars: [V('w', 'work', 'J'), V('f', 'force', 'N'), V('d', 'distance', 'm')] },
  { id: 'power', group: 'Physics', name: 'Power', eq: 'p = w/t', vars: [V('p', 'power', 'W'), V('w', 'work', 'J'), V('t', 'time', 's')] },
  { id: 'density', group: 'Physics', name: 'Density', eq: 'd = m/v', vars: [V('d', 'density', 'kg/m³'), V('m', 'mass', 'kg'), V('v', 'volume', 'm³')] },
  { id: 'pressure', group: 'Physics', name: 'Pressure', eq: 'p = f/a', vars: [V('p', 'pressure', 'Pa'), V('f', 'force', 'N'), V('a', 'area', 'm²')] },
  { id: 'wave', group: 'Physics', name: 'Wave speed', eq: 'v = f*w', vars: [V('v', 'speed', 'm/s'), V('f', 'frequency', 'Hz'), V('w', 'wavelength', 'm')] },
  { id: 'ohm', group: 'Physics', name: "Ohm's law", eq: 'v = i*r', vars: [V('v', 'voltage', 'V'), V('i', 'current', 'A'), V('r', 'resistance', 'Ω')] },
  { id: 'epower', group: 'Physics', name: 'Electrical power', eq: 'p = v*i', vars: [V('p', 'power', 'W'), V('v', 'voltage', 'V'), V('i', 'current', 'A')] },
  { id: 'gravity', group: 'Physics', name: 'Gravitational force', eq: 'f = 6.674e-11*m*n/r^2', vars: [V('f', 'force', 'N'), V('m', 'mass 1', 'kg'), V('n', 'mass 2', 'kg'), V('r', 'distance', 'm')], note: 'G is 6.674e-11.' },
  { id: 'gas', group: 'Chemistry', name: 'Ideal gas', eq: 'p*v = n*8.314*t', vars: [V('p', 'pressure', 'kPa'), V('v', 'volume', 'L'), V('n', 'amount', 'mol'), V('t', 'temperature', 'K')], note: 'R is 8.314 with kPa and litres.' },
  { id: 'moles', group: 'Chemistry', name: 'Moles', eq: 'n = m/k', vars: [V('n', 'amount', 'mol'), V('m', 'mass', 'g'), V('k', 'molar mass', 'g/mol')] },
  { id: 'conc', group: 'Chemistry', name: 'Concentration', eq: 'c = n/v', vars: [V('c', 'concentration', 'mol/L'), V('n', 'amount', 'mol'), V('v', 'volume', 'L')] },
  { id: 'dilute', group: 'Chemistry', name: 'Dilution', eq: 'c*v = d*w', vars: [V('c', 'start concentration', ''), V('v', 'start volume', ''), V('d', 'end concentration', ''), V('w', 'end volume', '')] },
  { id: 'pyth', group: 'Maths', name: 'Pythagoras', eq: 'c^2 = a^2 + b^2', vars: [V('c', 'hypotenuse', ''), V('a', 'side a', ''), V('b', 'side b', '')], note: 'A length is positive; a negative answer is the other root.' },
  { id: 'circle', group: 'Maths', name: 'Circle area', eq: 'a = pi*r^2', vars: [V('a', 'area', ''), V('r', 'radius', '')] },
  { id: 'circum', group: 'Maths', name: 'Circumference', eq: 'c = 2*pi*r', vars: [V('c', 'circumference', ''), V('r', 'radius', '')] },
  { id: 'cyl', group: 'Maths', name: 'Cylinder volume', eq: 'v = pi*r^2*h', vars: [V('v', 'volume', ''), V('r', 'radius', ''), V('h', 'height', '')] },
  { id: 'sphere', group: 'Maths', name: 'Sphere volume', eq: 'v = 4/3*pi*r^3', vars: [V('v', 'volume', ''), V('r', 'radius', '')] },
  { id: 'slope', group: 'Maths', name: 'Slope between two points', eq: 'm = (y - z)/(x1 - x2)', vars: [V('m', 'slope', ''), V('y', 'y of point 1', ''), V('z', 'y of point 2', ''), V('x1', 'x of point 1', ''), V('x2', 'x of point 2', '')] },
  { id: 'pct', group: 'Money', name: 'Percent change', eq: 'p = (n - o)/o*100', vars: [V('p', 'change', '%'), V('n', 'new value', ''), V('o', 'old value', '')] },
  { id: 'simple', group: 'Money', name: 'Simple interest', eq: 'i = p*r*t/100', vars: [V('i', 'interest', ''), V('p', 'principal', ''), V('r', 'rate', '% a year'), V('t', 'time', 'years')] },
  { id: 'compound', group: 'Money', name: 'Compound interest', eq: 'a = p*(1 + r/100/n)^(n*t)', vars: [V('a', 'final amount', ''), V('p', 'principal', ''), V('r', 'rate', '% a year'), V('n', 'times a year', ''), V('t', 'years', '')] },
]

export type Solved = { ok: true; roots: number[] } | { ok: false; error: string }
export const GROUPS = [...new Set(FORMULAS.map((f) => f.group))]

/** a number from what someone typed: a comma as the decimal mark is accepted; nothing else is guessed */
export function readNumber(s: string): number | null {
  const t = s.trim().replace(/,/g, '.').replace(/\s/g, '')
  if (!t || !/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function solve(f: Formula, target: string, given: Record<string, string>): Solved {
  const others = f.vars.filter((v) => v.sym !== target)
  const values: Record<string, number> = {}
  for (const v of others) {
    const raw = given[v.sym] ?? ''
    if (!raw.trim()) return { ok: false, error: `Fill in the ${v.name}.` }
    const n = readNumber(raw)
    if (n === null) return { ok: false, error: `The ${v.name} is not a number.` }
    values[v.sym] = n
  }
  const [l, r] = f.eq.split('=')
  let src = `(${l}) - (${r})`
  // longest names first, so x1 is not read as x
  for (const v of [...others].sort((a, b) => b.sym.length - a.sym.length)) src = src.replace(new RegExp(`\\b${v.sym}\\b`, 'g'), `(${values[v.sym]})`)
  src = src.replace(new RegExp(`\\b${target}\\b`, 'g'), 'x')
  let fn: (x: number) => number
  try { fn = compile(parse(src)) } catch (e) { return { ok: false, error: e instanceof MathError ? e.message : 'That formula could not be worked out.' } }
  // roots: a signed, log-spaced grid, each sign change refined by bisection; an exact zero on the grid counts
  const grid: number[] = []
  for (let p = -9; p <= 12; p += 0.05) { const m = 10 ** p; grid.push(m) }
  const pts = [...grid.map((m) => -m).reverse(), 0, ...grid]
  const roots: number[] = []
  const add = (x: number) => { if (!roots.some((r) => Math.abs(r - x) <= 1e-9 * Math.max(1, Math.abs(x)))) roots.push(x) }
  let prevX = pts[0], prevY = fn(prevX)
  if (prevY === 0) add(prevX)
  for (let i = 1; i < pts.length; i++) {
    const x = pts[i], y = fn(x)
    if (y === 0) add(x)
    else if (Number.isFinite(prevY) && Number.isFinite(y) && prevY * y < 0) {
      let a = prevX, b = x, ya = prevY
      for (let k = 0; k < 200; k++) { const m = (a + b) / 2, ym = fn(m); if (ym === 0 || Math.abs(b - a) <= 1e-15 * Math.abs(m)) { a = b = m; break } if (ya * ym < 0) b = m; else { a = m; ya = ym } }
      const root = (a + b) / 2
      // a jump through zero (1/x at 0) is not a root: the function must be small there
      if (Math.abs(fn(root)) <= Math.min(Math.abs(prevY), Math.abs(y))) add(root)
    }
    prevX = x; prevY = y
  }
  if (!roots.length) return { ok: false, error: 'No answer with these numbers.' }
  roots.sort((p, q) => p - q)
  return { ok: true, roots: roots.slice(0, 4).map((x) => Number(show(x).includes('e') ? x : x)) }
}
export const showRoot = show
