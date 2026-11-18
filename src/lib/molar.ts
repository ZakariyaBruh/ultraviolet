/**
 * Molar mass from a chemical formula, for the Periodic table window: H2O, Ca(OH)2, K4[Fe(CN)6], CuSO4·5H2O. Read by hand (a
 * small recursive reader), with the standard atomic weights from lib/elements.json; an element with no stable isotope counts
 * the mass number of its longest-lived one and the answer says so. Symbols must be written with their capitals: "co" could be
 * cobalt or carbon and oxygen, so it is refused, not guessed.
 */
export interface Share { sym: string; count: number; grams: number; pct: number }
export type Molar = { ok: true; total: number; parts: Share[]; rough: boolean } | { ok: false; error: string }

export function molarMass(input: string, massOf: (sym: string) => { m: number; rough: boolean } | undefined): Molar {
  const s = input.replace(/\s+/g, '').replace(/[•∙⋅*]/g, '·').replace(/(?<=[\])A-Za-z\d])\.(?=\d*[A-Z(\[])/g, '·')
  if (!s) return { ok: false, error: '' }
  if (!/[A-Z]/.test(s)) return { ok: false, error: 'Use capitals for symbols: H2O, not h2o.' }
  let i = 0
  const add = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n)
  const num = () => { const j = i; while (i < s.length && /\d/.test(s[i])) i++; return i > j ? Number(s.slice(j, i)) : 1 }
  const group = (depth: number): Map<string, number> => {
    if (depth > 12) throw new Error('Too many brackets inside each other.')
    const m = new Map<string, number>()
    while (i < s.length) {
      const c = s[i]
      if (c === '(' || c === '[' || c === '{') {
        const close = c === '(' ? ')' : c === '[' ? ']' : '}'
        i++
        const inner = group(depth + 1)
        if (s[i] !== close) throw new Error(`A ${c} is never closed.`)
        i++
        const n = num()
        for (const [k, v] of inner) add(m, k, v * n)
      } else if (/[A-Z]/.test(c)) {
        let sym = c
        i++
        if (i < s.length && /[a-z]/.test(s[i])) { sym += s[i]; i++ }
        if (!massOf(sym)) throw new Error(sym.length === 2 && massOf(sym[0]) && massOf(sym[1].toUpperCase()) ? `No element ${sym}. For ${sym[0]} and ${sym[1].toUpperCase()}, write both in capitals.` : `No element ${sym}.`)
        add(m, sym, num())
      } else break
    }
    return m
  }
  try {
    const all = new Map<string, number>()
    for (let part = 0; ; part++) {
      const k = num() // a hydrate's water count: CuSO4·5H2O
      const g = group(0)
      if (!g.size) throw new Error(i < s.length ? `Cannot read “${s[i]}”.` : 'Something is missing after the dot.')
      for (const [sym, n] of g) add(all, sym, n * k)
      if (i >= s.length) break
      if (s[i] !== '·') throw new Error(s[i] === ')' || s[i] === ']' || s[i] === '}' ? `A ${s[i]} has nothing to close.` : `Cannot read “${s[i]}”.`)
      i++
      if (part > 20) throw new Error('Too many parts.')
    }
    let total = 0, rough = false
    const rows: Share[] = []
    for (const [sym, count] of all) {
      const e = massOf(sym)!
      rough ||= e.rough
      const grams = e.m * count
      total += grams
      rows.push({ sym, count, grams, pct: 0 })
    }
    for (const r of rows) r.pct = (r.grams / total) * 100
    return { ok: true, total, parts: rows, rough }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
