import { useMemo, useState } from 'react'
import DATA from '@/lib/elements.json'
import { molarMass } from '@/lib/molar'
import { cn } from '@/lib/utils'
import { field } from './Window'

/** The periodic table: 118 elements with their standard atomic weights (in brackets, the mass number of the longest-lived isotope where there is no stable one). */
type El = { z: number; sym: string; name: string; mass: string; group: number; period: number; kind: string }
const ELS: El[] = (DATA as [number, string, string, string, number, number, string][]).map(([z, sym, name, mass, group, period, kind]) => ({ z, sym, name, mass, group, period, kind }))
// colours from the theme's own tokens, so every theme recolours the table
const KINDS: { kind: string; tint: string }[] = [
  { kind: 'alkali metal', tint: 'color-mix(in srgb, var(--danger) 34%, transparent)' },
  { kind: 'alkaline earth metal', tint: 'color-mix(in srgb, var(--signal) 34%, transparent)' },
  { kind: 'transition metal', tint: 'color-mix(in srgb, var(--ice) 22%, transparent)' },
  { kind: 'post-transition metal', tint: 'color-mix(in srgb, var(--ink) 16%, transparent)' },
  { kind: 'metalloid', tint: 'color-mix(in srgb, var(--ok) 22%, transparent)' },
  { kind: 'nonmetal', tint: 'color-mix(in srgb, var(--ok) 40%, transparent)' },
  { kind: 'halogen', tint: 'color-mix(in srgb, var(--ice) 42%, transparent)' },
  { kind: 'noble gas', tint: 'color-mix(in srgb, var(--signal) 18%, transparent)' },
  { kind: 'lanthanide', tint: 'color-mix(in srgb, var(--danger) 16%, transparent)' },
  { kind: 'actinide', tint: 'color-mix(in srgb, var(--danger) 26%, transparent)' },
]
const MASS = new Map(ELS.map((e) => [e.sym, { m: parseFloat(e.mass.replace(/[()]/g, '')), rough: e.mass.startsWith('(') }]))
const massOf = (sym: string) => MASS.get(sym)
const tintOf = (k: string) => KINDS.find((x) => x.kind === k)?.tint ?? 'transparent'
const block = (e: El) => (e.kind === 'lanthanide' || e.kind === 'actinide' ? 'f' : e.group <= 2 || e.z === 2 ? 's' : e.group >= 13 ? 'p' : 'd')
// where each element sits: the f-block in two rows of its own under the table
const cellOf = (e: El): { col: number; row: number } => {
  if (e.kind === 'lanthanide') return { col: 3 + (e.z - 57), row: 9 }
  if (e.kind === 'actinide') return { col: 3 + (e.z - 89), row: 10 }
  return { col: e.group, row: e.period }
}

export function Elements() {
  const [tab, setTab] = useState<'table' | 'molar'>('table')
  const [pick, setPick] = useState<El>(ELS[0])
  const tabBtn = (t: 'table' | 'molar', label: string) => (
    <button role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('h-11 px-3 text-[13px] font-semibold md:h-9', tab === t ? 'border-b-2 border-signal text-ink' : 'text-ink-3 hover:text-ink')}>{label}</button>
  )
  // capped to the page (the window's own bar and padding, and a margin, come off), so a tall table never hangs below it: the
  // table is the part that gives, scrolling inside itself, while the controls keep their size
  return (
    <div className="flex max-h-[calc(100cqh-6.5rem)] min-h-0 flex-col gap-2">
      <div role="tablist" aria-label="Periodic table" className="flex shrink-0 border-b border-ink/15">{tabBtn('table', 'Table')}{tabBtn('molar', 'Molar mass')}</div>
      {tab === 'table' ? <Table pick={pick} setPick={setPick} /> : <Molar show={(sym) => { const e = ELS.find((x) => x.sym === sym); if (e) { setPick(e); setTab('table') } }} />}
    </div>
  )
}

/** a formula's molar mass and what each element adds to it */
function Molar({ show }: { show: (sym: string) => void }) {
  const [f, setF] = useState('')
  const r = useMemo(() => molarMass(f, massOf), [f])
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <label className="grid shrink-0 gap-1 text-[12px] text-ink-3">Formula (a dot or * for a hydrate: CuSO4·5H2O)
        <input value={f} onChange={(e) => setF(e.target.value.slice(0, 120))} autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="H2O, Ca(OH)2, K4[Fe(CN)6]" className={cn(field, 'fig md:h-9')} />
      </label>
      <div aria-live="polite" data-no-drag className="scroll-y min-h-[6rem]">
        {!f.trim() ? <p className="text-[13px] text-ink-2">Type a formula. Capitals matter: Co is cobalt, CO is carbon monoxide.</p>
          : !r.ok ? <p className="text-[13px] text-danger">{r.error}</p>
            : <>
              <p className="text-[14px] text-ink"><b className="fig text-[24px]">{r.total.toFixed(3)}</b> g/mol{r.rough ? <span className="text-ink-3"> (rough: it has an element with no stable isotope, counted by its mass number)</span> : null}</p>
              <table className="mt-1 w-full text-left text-[13px]">
                <caption className="sr-only">What each element adds</caption>
                <thead><tr className="text-[11px] text-ink-3"><th className="py-1 font-normal">Element</th><th className="font-normal">Atoms</th><th className="font-normal">g/mol</th><th className="w-[40%] font-normal">By mass</th></tr></thead>
                <tbody>
                  {r.parts.map((p) => (
                    <tr key={p.sym} className="border-t border-ink/10">
                      <td className="py-0.5"><button onClick={() => show(p.sym)} className="h-11 min-w-11 font-semibold text-ink underline decoration-ink/30 underline-offset-2 hover:decoration-signal md:h-8" aria-label={`${ELS.find((e) => e.sym === p.sym)?.name}, show it in the table`}>{p.sym}</button></td>
                      <td className="fig">{p.count}</td>
                      <td className="fig">{p.grams.toFixed(3)}</td>
                      <td><div className="flex items-center gap-1.5"><div className="h-2 flex-1 bg-ink/10" aria-hidden><div className="h-full bg-signal" style={{ width: `${p.pct}%` }} /></div><span className="fig w-12 text-right">{p.pct.toFixed(1)}%</span></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>}
      </div>
    </div>
  )
}

function Table({ pick, setPick }: { pick: El; setPick: (e: El) => void }) {
  const [q, setQ] = useState('')
  const [only, setOnly] = useState<string | null>(null)
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return null
    return new Set(ELS.filter((e) => e.sym.toLowerCase() === t || e.name.toLowerCase().includes(t) || String(e.z) === t).map((e) => e.z))
  }, [q])
  const dim = (e: El) => (hits ? !hits.has(e.z) : only ? e.kind !== only : false)
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && hits?.size) setPick(ELS.find((x) => hits.has(x.z))!) }} aria-label="Find an element by name, symbol or number" placeholder="Find: iron, Fe or 26" className={cn(field, 'min-w-[10rem] flex-1 md:h-9')} />
        <p className="text-[12px] text-ink-3" role="status">{hits ? `${hits.size} found` : 'Tap an element'}</p>
      </div>
      {/* full touch size on a phone, so part of the table shows and the rest scrolls inside it, both ways */}
      <div data-no-drag tabIndex={0} role="region" aria-label="Periodic table" className="scroll-x min-h-[9rem] shrink !overflow-y-auto overscroll-contain">
        <div className="grid min-w-[50rem] gap-[2px] md:min-w-[40rem]" style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))', gridTemplateRows: 'repeat(7, auto) 0.5rem repeat(2, auto)' }}>
          {ELS.map((e) => {
            const { col, row } = cellOf(e)
            return (
              <button
                key={e.z} onClick={() => setPick(e)} aria-label={`${e.name}, ${e.z}`} aria-pressed={pick.z === e.z}
                style={{ gridColumn: col, gridRow: row, background: tintOf(e.kind) }}
                className={cn('grid aspect-square min-h-0 content-center justify-items-center border text-ink transition-opacity', pick.z === e.z ? 'border-signal ring-1 ring-signal' : 'border-transparent hover:border-ink/40', dim(e) && 'opacity-25')}
              >
                <span className="fig text-[9px] leading-none text-ink-2">{e.z}</span>
                <span className="text-[13px] leading-tight font-semibold">{e.sym}</span>
              </button>
            )
          })}
          {/* on a wide screen the chosen element sits in the table's empty block, as on a printed table */}
          <Details e={pick} className="hidden md:grid" style={{ gridColumn: '3 / 13', gridRow: '1 / 4' }} />
        </div>
      </div>
      <Details e={pick} className="shrink-0 md:hidden" />
      <div data-no-drag tabIndex={0} role="region" aria-label="Show one kind" className="scroll-x flex shrink-0 gap-1 pb-0.5 md:flex-wrap">
        {KINDS.map((k) => (
          <button key={k.kind} onClick={() => { setOnly(only === k.kind ? null : k.kind); setQ('') }} aria-pressed={only === k.kind} className={cn('inline-flex h-11 shrink-0 items-center gap-1.5 border px-2 text-[12px] whitespace-nowrap text-ink md:h-9', only === k.kind ? 'border-signal' : 'border-ink/20 hover:bg-ink/10')}>
            <span aria-hidden className="size-3" style={{ background: k.tint }} />{k.kind}
          </button>
        ))}
      </div>
    </div>
  )
}

/** the chosen element: its tile, and the facts in words (shown twice in the markup, one for each width, so only one is ever seen) */
function Details({ e, className, style }: { e: El; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cn('grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border border-ink/15 p-2 md:mx-2 md:mb-1 md:gap-3 md:border-0 md:p-0', className)} style={style} aria-live="polite">
      <div className="grid size-[4.5rem] place-content-center justify-items-center border border-ink/30 md:size-[5.5rem]" style={{ background: tintOf(e.kind) }}>
        <span className="fig text-[11px] text-ink-2">{e.z}</span>
        <span className="text-[26px] leading-none font-bold text-ink md:text-[30px]">{e.sym}</span>
        <span className="fig text-[10px] text-ink-2">{e.mass}</span>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] content-center gap-x-3 gap-y-0.5 text-[12.5px] md:text-[13px]">
        <dt className="text-ink-3">Name</dt><dd className="font-semibold text-ink">{e.name}</dd>
        <dt className="text-ink-3">Atomic number</dt><dd className="fig text-ink">{e.z}</dd>
        <dt className="text-ink-3">Atomic mass</dt><dd className="fig text-ink">{e.mass}{e.mass.startsWith('(') ? ' (no stable isotope)' : ' u'}</dd>
        <dt className="text-ink-3">Kind</dt><dd className="text-ink">{e.kind}</dd>
        <dt className="text-ink-3">Group, period, block</dt><dd className="fig text-ink">{e.kind === 'lanthanide' || e.kind === 'actinide' ? '—' : e.group}, {e.period}, {block(e)}</dd>
      </dl>
    </div>
  )
}
