import { ArrowDownUp } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { field, key } from './Window'

/** Each unit is worth so much of the category's base unit. Temperature is the one that is not a plain multiple. */
const SETS = {
  Length: { base: 'm', units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 } },
  Mass: { base: 'kg', units: { mg: 1e-6, g: 0.001, kg: 1, oz: 0.028349523125, lb: 0.45359237, stone: 6.35029318 } },
  Volume: { base: 'L', units: { mL: 0.001, L: 1, tsp: 0.00492892159375, tbsp: 0.01478676478125, 'fl oz': 0.0295735295625, cup: 0.2365882365, gal: 3.785411784 } },
  Speed: { base: 'm/s', units: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, knot: 0.514444444 } },
  Time: { base: 's', units: { s: 1, min: 60, h: 3600, day: 86400, week: 604800 } },
  Temperature: { base: '°C', units: { '°C': 1, '°F': 1, K: 1 } },
} as const
type Cat = keyof typeof SETS

const toC = (v: number, u: string) => (u === '°F' ? ((v - 32) * 5) / 9 : u === 'K' ? v - 273.15 : v)
const fromC = (c: number, u: string) => (u === '°F' ? (c * 9) / 5 + 32 : u === 'K' ? c + 273.15 : c)

export function convert(cat: Cat, v: number, from: string, to: string): number {
  if (cat === 'Temperature') return fromC(toC(v, from), to)
  const u = SETS[cat].units as Record<string, number>
  return (v * u[from]) / u[to]
}

const out = (n: number) => {
  if (!Number.isFinite(n)) return '–'
  if (n === 0) return '0'
  const a = Math.abs(n)
  return a >= 1e9 || a < 1e-4 ? n.toExponential(3) : String(parseFloat(n.toPrecision(7)))
}

/** Length, mass, volume, speed, time and temperature. */
export function Converter() {
  const id = useId()
  const [cat, setCat] = useState<Cat>('Length')
  const names = Object.keys(SETS[cat].units)
  const [from, setFrom] = useState('km')
  const [to, setTo] = useState('mi')
  const [raw, setRaw] = useState('1')
  const value = parseFloat(raw.replace(',', '.'))
  const result = useMemo(() => (Number.isFinite(value) ? convert(cat, value, from, to) : NaN), [cat, value, from, to])
  const pick = (c: Cat) => {
    const n = Object.keys(SETS[c].units)
    const f = n[Math.min(2, n.length - 1)]
    // a sensible mid-range unit for "to", but never the same unit as "from" (Temperature has only three, so 2 and 3 collapse)
    const t = n[Math.min(3, n.length - 1)]
    setCat(c); setFrom(f); setTo(t === f ? (n.find((u) => u !== f) ?? t) : t)
  }
  const sel = 'h-11 min-w-0 flex-1 border border-ink/30 bg-transparent px-2 text-[15px] text-ink focus:border-signal'
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label="What to convert">
        {(Object.keys(SETS) as Cat[]).map((c) => <button key={c} aria-pressed={cat === c} onClick={() => pick(c)} className={cn('h-11 px-2.5 text-[12px] md:h-9', cat === c ? 'bg-ink text-ground' : 'bg-ink/[0.07] text-ink ring-1 ring-ink/12 hover:bg-ink/12')}>{c}</button>)}
      </div>
      <div className="flex gap-2">
        <label htmlFor={`${id}-v`} className="sr-only">Amount</label>
        <input id={`${id}-v`} value={raw} onChange={(e) => setRaw(e.target.value.slice(0, 16))} inputMode="decimal" className={cn(field, 'w-24 shrink-0')} />
        <label htmlFor={`${id}-f`} className="sr-only">From</label>
        <select id={`${id}-f`} value={from} onChange={(e) => setFrom(e.target.value)} className={sel}>{names.map((n) => <option key={n} value={n} className="bg-surface text-ink">{n}</option>)}</select>
      </div>
      <div className="flex gap-2">
        <button onClick={() => { setFrom(to); setTo(from) }} aria-label="Swap the units" className={`${key} size-11 shrink-0`}><ArrowDownUp className="size-4" /></button>
        <label htmlFor={`${id}-t`} className="sr-only">To</label>
        <select id={`${id}-t`} value={to} onChange={(e) => setTo(e.target.value)} className={sel}>{names.map((n) => <option key={n} value={n} className="bg-surface text-ink">{n}</option>)}</select>
      </div>
      <p className="fig border border-ink/25 px-3 py-2 text-center text-lg font-semibold" role="status" aria-live="polite">{Number.isFinite(value) ? <>{out(value)} {from} = <strong>{out(result)}</strong> {to}</> : 'Type a number'}</p>
    </div>
  )
}
