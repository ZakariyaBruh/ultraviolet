/**
 * A small maths language for the Graph window, read by hand (never `eval`): numbers, x, pi, e, tau, + - * / ^ % and !, brackets and
 * |absolute value|, functions with or without brackets (sin x, sqrt(2), log(8, 2)) and multiplication by juxtaposition (2x, 3(x+1),
 * (x-1)(x+1), 2pi). `-x^2` is -(x^2) and `^` groups to the right, as on paper. Juxtaposition binds a little tighter than * and /, so
 * `1/2x` is 1/(2x), as Desmos reads it. A formula is compiled once into plain functions, so a graph can ask it a few thousand times a frame.
 */
export type Angle = 'rad' | 'deg'
type Node =
  | { k: 'n'; v: number }
  | { k: 'x' }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'fact'; a: Node }
  | { k: 'fn'; name: string; args: Node[] }

export class MathError extends Error {}

const CONST: Record<string, number> = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI, phi: (1 + Math.sqrt(5)) / 2 }
/** functions and how many arguments each takes ([least, most]) */
const FNS: Record<string, [number, number]> = {
  sin: [1, 1], cos: [1, 1], tan: [1, 1], sec: [1, 1], csc: [1, 1], cot: [1, 1], asin: [1, 1], acos: [1, 1], atan: [1, 1],
  sinh: [1, 1], cosh: [1, 1], tanh: [1, 1], sqrt: [1, 1], cbrt: [1, 1], abs: [1, 1], exp: [1, 1], ln: [1, 1], log: [1, 2],
  log2: [1, 1], log10: [1, 1], floor: [1, 1], ceil: [1, 1], round: [1, 1], sign: [1, 1], min: [1, 20], max: [1, 20], mod: [2, 2],
  root: [2, 2], ncr: [2, 2], npr: [2, 2],
}
const ALIAS: Record<string, string> = { arcsin: 'asin', arccos: 'acos', arctan: 'atan', π: 'pi', '√': 'sqrt', sgn: 'sign', lg: 'log10', choose: 'ncr', nck: 'ncr' }
const NAMES = [...Object.keys(FNS), ...Object.keys(CONST), ...Object.keys(ALIAS).filter((a) => /^[a-z]/.test(a)), 'x'].sort((a, b) => b.length - a.length)

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string }

function tokens(src: string): Tok[] {
  const s = src.toLowerCase()
    .replace(/[×·∙]/g, '*').replace(/[÷∕]/g, '/').replace(/[−–]/g, '-').replace(/²/g, '^2').replace(/³/g, '^3').replace(/\*\*/g, '^')
    .replace(/[[{]/g, '(').replace(/[\]}]/g, ')')
  const out: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) { i++; continue }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(s.slice(i))
    if (num) { out.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue }
    if (c === 'π' || c === '√') { out.push({ t: 'id', v: ALIAS[c] }); i++; continue }
    if (/[a-z]/.test(c)) {
      // a run of letters is split into known names, longest first, so "2xsinx" and "pix" read as 2·x·sin(x) and pi·x
      let word = /^[a-z]+/.exec(s.slice(i))![0]
      const base = /^(10|2)(?![0-9.])/.exec(s.slice(i + word.length)) // log2 and log10 are names with digits in them
      if (base && word.endsWith('log')) word += base[0]
      let j = 0
      while (j < word.length) {
        const rest = word.slice(j)
        const name = NAMES.find((n) => rest.startsWith(n))
        if (!name) throw new MathError(`Unknown name: ${rest}`)
        out.push({ t: 'id', v: ALIAS[name] ?? name })
        j += name.length
      }
      i += word.length
      continue
    }
    if ('+-*/^%!(),|'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue }
    throw new MathError(`Not understood: ${c}`)
  }
  return out
}

/** parse a formula; "y =" or "f(x) =" in front is allowed and dropped */
export function parse(src: string): Node {
  const body = src.replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=/i, '')
  const ts = tokens(body)
  if (!ts.length) throw new MathError('Empty')
  let p = 0
  let bars = 0 // how deep inside |...| we are, so a bar can close one
  const peek = () => ts[p]
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as { v: string }).v === v
  const eat = (v: string, msg: string) => { if (!isOp(v)) throw new MathError(msg); p++ }
  // can the next token begin a term (for multiplying by juxtaposition)?
  const starts = () => { const t = peek(); return !!t && (t.t === 'num' || t.t === 'id' || (t.t === 'op' && (t.v === '(' || (t.v === '|' && bars === 0)))) }
  const BP: Record<string, number> = { '+': 10, '-': 10, '*': 20, '/': 20, '%': 20, '^': 40 }

  const expr = (rbp: number): Node => {
    let left = nud()
    for (;;) {
      const t = peek()
      if (t && t.t === 'op' && t.v === '!') { p++; left = { k: 'fact', a: left }; continue }
      if (t && t.t === 'op' && BP[t.v] !== undefined) {
        const bp = BP[t.v]
        if (bp <= rbp) break
        p++
        left = { k: 'bin', op: t.v, a: left, b: expr(t.v === '^' ? bp - 1 : bp) }
        continue
      }
      if (starts() && 22 > rbp) { left = { k: 'bin', op: '*', a: left, b: expr(22) }; continue }
      break
    }
    return left
  }
  const nud = (): Node => {
    const t = ts[p++]
    if (!t) throw new MathError('It ends too soon')
    if (t.t === 'num') return { k: 'n', v: t.v }
    if (t.t === 'id') {
      if (t.v === 'x') return { k: 'x' }
      if (CONST[t.v] !== undefined) return { k: 'n', v: CONST[t.v] }
      const [lo, hi] = FNS[t.v]
      if (isOp('(')) {
        p++
        const args = [expr(0)]
        while (isOp(',')) { p++; args.push(expr(0)) }
        eat(')', 'A bracket is not closed')
        if (args.length < lo || args.length > hi) throw new MathError(`${t.v} takes ${lo === hi ? lo : `${lo} to ${hi}`} value${hi === 1 ? '' : 's'}`)
        // sin(x)^2 means (sin x)^2
        return { k: 'fn', name: t.v, args }
      }
      if (lo > 1) throw new MathError(`${t.v} needs brackets`)
      return { k: 'fn', name: t.v, args: [expr(21)] } // sin 2x is sin(2x); sin x * 2 and sin x + 1 are sin(x) * 2 and sin(x) + 1
    }
    if (t.v === '(') { const e = expr(0); eat(')', 'A bracket is not closed'); return e }
    if (t.v === '|') { bars++; const e = expr(0); bars--; eat('|', 'An absolute value bar is not closed'); return { k: 'fn', name: 'abs', args: [e] } }
    if (t.v === '-') return { k: 'neg', a: expr(30) }
    if (t.v === '+') return expr(30)
    throw new MathError(t.v === ')' ? 'A bracket closes that was never opened' : `Nothing before ${t.v}`)
  }
  const tree = expr(0)
  if (p < ts.length) {
    const t = ts[p]
    throw new MathError(t.t === 'op' && t.v === ')' ? 'A bracket closes that was never opened' : 'Not understood after the end')
  }
  return tree
}

export const usesX = (n: Node): boolean => n.k === 'x' || (n.k === 'neg' || n.k === 'fact' ? usesX(n.a) : n.k === 'bin' ? usesX(n.a) || usesX(n.b) : n.k === 'fn' ? n.args.some(usesX) : false)

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return gamma(n + 1)
  if (n > 170) return Infinity
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}
/** the gamma function (Lanczos), so 0.5! and the like have their true value */
function gamma(z: number): number {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z))
  const g = 7
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  z -= 1
  let a = c[0]
  const t = z + g + 0.5
  for (let i = 1; i < g + 2; i++) a += c[i] / (z + i)
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * a
}
const choose = (n: number, k: number) => {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || n < 0 || k > n) return NaN
  let r = 1
  for (let i = 1; i <= Math.min(k, n - k); i++) r = (r * (n - Math.min(k, n - k) + i)) / i
  return Math.round(r)
}

type Fn = (x: number) => number
/** turn a parsed formula into a function of x; angles in degrees or radians */
export function compile(n: Node, angle: Angle = 'rad'): Fn {
  const toR = angle === 'deg' ? Math.PI / 180 : 1
  const fromR = angle === 'deg' ? 180 / Math.PI : 1
  switch (n.k) {
    case 'n': { const v = n.v; return () => v }
    case 'x': return (x) => x
    case 'neg': { const a = compile(n.a, angle); return (x) => -a(x) }
    case 'fact': { const a = compile(n.a, angle); return (x) => factorial(a(x)) }
    case 'bin': {
      const a = compile(n.a, angle), b = compile(n.b, angle)
      switch (n.op) {
        case '+': return (x) => a(x) + b(x)
        case '-': return (x) => a(x) - b(x)
        case '*': return (x) => a(x) * b(x)
        case '/': return (x) => a(x) / b(x)
        case '%': return (x) => { const m = b(x); return ((a(x) % m) + m) % m }
        default: return (x) => {
          const base = a(x), e = b(x)
          // an odd root of a negative number is real: (-8)^(1/3) is -2
          if (base < 0 && !Number.isInteger(e)) { const r = 1 / e; if (Number.isInteger(r) && Math.abs(r) % 2 === 1) return -Math.pow(-base, e) }
          return Math.pow(base, e)
        }
      }
    }
    case 'fn': {
      const args = n.args.map((a) => compile(a, angle))
      const [a, b] = args
      const one = (f: (v: number) => number): Fn => (x) => f(a(x))
      switch (n.name) {
        case 'sin': return one((v) => Math.sin(v * toR))
        case 'cos': return one((v) => Math.cos(v * toR))
        case 'tan': return one((v) => Math.tan(v * toR))
        case 'sec': return one((v) => 1 / Math.cos(v * toR))
        case 'csc': return one((v) => 1 / Math.sin(v * toR))
        case 'cot': return one((v) => 1 / Math.tan(v * toR))
        case 'asin': return one((v) => Math.asin(v) * fromR)
        case 'acos': return one((v) => Math.acos(v) * fromR)
        case 'atan': return one((v) => Math.atan(v) * fromR)
        case 'sinh': return one(Math.sinh)
        case 'cosh': return one(Math.cosh)
        case 'tanh': return one(Math.tanh)
        case 'sqrt': return one(Math.sqrt)
        case 'cbrt': return one(Math.cbrt)
        case 'abs': return one(Math.abs)
        case 'exp': return one(Math.exp)
        case 'ln': return one(Math.log)
        case 'log': return b ? (x) => Math.log(a(x)) / Math.log(b(x)) : one(Math.log10)
        case 'log2': return one(Math.log2)
        case 'log10': return one(Math.log10)
        case 'floor': return one(Math.floor)
        case 'ceil': return one(Math.ceil)
        case 'round': return one(Math.round)
        case 'sign': return one(Math.sign)
        case 'min': return (x) => Math.min(...args.map((f) => f(x)))
        case 'max': return (x) => Math.max(...args.map((f) => f(x)))
        case 'mod': return (x) => { const m = b(x); return ((a(x) % m) + m) % m }
        case 'root': return (x) => { const v = a(x), k = b(x); return v < 0 && Number.isInteger(k) && k % 2 === 1 ? -Math.pow(-v, 1 / k) : Math.pow(v, 1 / k) }
        case 'ncr': return (x) => choose(a(x), b(x))
        case 'npr': return (x) => { const nn = a(x), k = b(x); const c = choose(nn, k); return Number.isNaN(c) ? NaN : Math.round(c * factorial(k)) }
      }
    }
  }
  throw new MathError('Not understood')
}

/** a number as a person would write it: up to 10 significant figures, no float dust, scientific when huge or tiny */
export function show(v: number): string {
  if (Number.isNaN(v)) return 'undefined'
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '-∞'
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a >= 1e12 || a < 1e-7) return v.toExponential(6).replace(/\.?0+e/, 'e').replace('e+', 'e')
  return String(Number(v.toPrecision(10)))
}

/**
 * Where a function crosses zero between a and b: sign changes on a grid of `steps`, each refined by bisection. A jump through zero at a
 * pole (tan x at pi/2) is not a zero, so a crossing only counts where the function is small at the point found.
 */
export function zeros(f: Fn, a: number, b: number, steps = 600, most = 6): number[] {
  const out: number[] = []
  const dx = (b - a) / steps
  let x0 = a, y0 = f(a)
  const scale = Math.max(1e-9, Math.abs(b - a))
  for (let i = 1; i <= steps && out.length < most; i++) {
    const x1 = a + i * dx, y1 = f(x1)
    if (Number.isFinite(y0) && Number.isFinite(y1)) {
      if (y0 === 0) { if (!out.length || Math.abs(out[out.length - 1] - x0) > dx) out.push(x0) }
      else if (y0 * y1 < 0) {
        let lo = x0, hi = x1, flo = y0
        for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2, fm = f(mid); if (fm === 0) { lo = hi = mid; break } if (flo * fm < 0) hi = mid; else { lo = mid; flo = fm } }
        const r = (lo + hi) / 2
        if (Math.abs(f(r)) < 1e-6 * Math.max(1, scale)) out.push(Math.abs(r) < 1e-12 * scale ? 0 : r)
      }
    }
    x0 = x1; y0 = y1
  }
  return out
}
