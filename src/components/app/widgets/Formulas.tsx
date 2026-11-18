import { Copy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { FORMULAS, GROUPS, showRoot, solve } from '@/lib/formulas'
import { fx_say } from '@/lib/actions'
import { cn } from '@/lib/utils'
import { field, key } from './Window'

/** Pick a formula, fill in what you know, get the one thing left (lib/formulas.ts: worked out by the Graph window's maths reader, not eval). */
export function Formulas() {
  const [group, setGroup] = useState(GROUPS[0])
  const inGroup = FORMULAS.filter((f) => f.group === group)
  const [id, setId] = useState(inGroup[0].id)
  const f = FORMULAS.find((x) => x.id === id) ?? inGroup[0]
  const [target, setTarget] = useState(f.vars[0].sym)
  const [vals, setVals] = useState<Record<string, string>>({})
  const t = f.vars.some((v) => v.sym === target) ? target : f.vars[0].sym
  const res = useMemo(() => {
    const need = f.vars.filter((v) => v.sym !== t)
    if (need.every((v) => !(vals[v.sym] ?? '').trim())) return null
    return solve(f, t, vals)
  }, [f, t, vals])
  const pickGroup = (g: string) => { setGroup(g); const first = FORMULAS.find((x) => x.group === g)!; setId(first.id); setTarget(first.vars[0].sym); setVals({}) }
  const pickFormula = (i: string) => { const nf = FORMULAS.find((x) => x.id === i)!; setId(i); setTarget(nf.vars[0].sym); setVals({}) }
  const tv = f.vars.find((v) => v.sym === t)!
  const input = cn(field, 'fig h-11 w-full px-2 text-[14px] md:h-9')
  const sel = cn(field, 'h-11 w-full px-2 text-[14px] md:h-9')
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[7rem_1fr] gap-1.5">
        <label className="sr-only" htmlFor="fm-group">Subject</label>
        <select id="fm-group" value={group} onChange={(e) => pickGroup(e.target.value)} className={sel}>{GROUPS.map((g) => <option key={g} value={g} className="bg-surface text-ink">{g}</option>)}</select>
        <label className="sr-only" htmlFor="fm-formula">Formula</label>
        <select id="fm-formula" value={f.id} onChange={(e) => pickFormula(e.target.value)} className={sel}>{inGroup.map((x) => <option key={x.id} value={x.id} className="bg-surface text-ink">{x.name}</option>)}</select>
      </div>
      <p className="fig border border-ink/15 p-2 text-center text-[16px] text-ink" aria-label={`Formula: ${f.eq}`}>{f.eq.replace(/\*/g, '·')}</p>
      <div role="radiogroup" aria-label="Solve for" className="flex flex-wrap gap-1">
        {f.vars.map((v) => <button key={v.sym} role="radio" aria-checked={t === v.sym} onClick={() => setTarget(v.sym)} className={cn('h-11 border px-2.5 text-[13px] md:h-9', t === v.sym ? 'border-signal bg-signal text-on-signal' : 'border-ink/25 text-ink-2 hover:text-ink')}><span className="fig">{v.sym}</span> <span className="opacity-80">{v.name}</span></button>)}
      </div>
      <div data-no-drag className="grid gap-1.5 sm:grid-cols-2">
        {f.vars.filter((v) => v.sym !== t).map((v) => (
          <label key={v.sym} className="grid gap-0.5 text-[11px] text-ink-3">{v.name}{v.unit ? ` (${v.unit})` : ''}
            <input value={vals[v.sym] ?? ''} inputMode="decimal" onChange={(e) => setVals({ ...vals, [v.sym]: e.target.value.slice(0, 30) })} className={input} />
          </label>
        ))}
      </div>
      <div aria-live="polite" className="min-h-[3.5rem] border border-ink/15 p-2">
        {!res ? <p className="text-[13px] text-ink-3">Fill in the other values to work out the {tv.name}.</p>
          : !res.ok ? <p className="text-[13px] text-ink-2">{res.error}</p>
            : <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[14px] text-ink">{tv.name} <span className="fig">{t}</span> = {res.roots.map((r, i) => <b key={i} className="fig text-[20px]">{i ? ' or ' : ''}{showRoot(r)}</b>)} <span className="text-ink-3">{tv.unit}</span></p>
              <button onClick={() => void navigator.clipboard?.writeText(res.roots.map(showRoot).join(' or ')).then(() => fx_say({ title: 'Copied', variant: 'success' }), () => undefined)} aria-label="Copy the answer" className={cn(key, 'size-11 md:size-9')}><Copy className="size-4" /></button>
            </div>}
      </div>
      {f.note && <p className="text-[12px] text-ink-3">{f.note}</p>}
    </div>
  )
}
