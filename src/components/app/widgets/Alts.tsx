import { ArrowLeft, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { LoadingBlock } from '@/components/app/LoadingBlock'
import { ALTS, type Alt, type Row } from '@/lib/alts'
import { field } from './Window'

/** the list of Friction alts: one tile for each, named for the site it stands in for */
export function AltsHome({ onPick, onBack }: { onPick: (id: string) => void; onBack: () => void }) {
  return (
    <div className="scroll-y grid h-full content-start gap-3 p-3">
      <button onClick={onBack} className="inline-flex h-11 items-center gap-1.5 justify-self-start text-sm text-ink-2 hover:text-ink"><ArrowLeft className="size-4" />Back</button>
      <div>
        <p className="dot text-[clamp(1.4rem,4vw,2rem)] font-bold leading-[1.1]">Friction alts</p>
        <p className="mt-1 text-[13px] leading-[1.4] text-ink-2">Made-here versions of sites that do not open in this Browser. Each asks a free public service for plain facts: no feed, nothing kept, only the words you type are sent.</p>
      </div>
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3" aria-label="Friction alts">
        {ALTS.map((a) => (
          <li key={a.id}>
            <button onClick={() => onPick(a.id)} className="flex min-h-[4.5rem] w-full flex-col justify-center border border-ink/25 bg-ink/[0.04] px-3 py-2 text-left transition-[transform,border-color,background-color] duration-150 ease-out hover:border-signal hover:bg-ink/[0.08] active:scale-[0.98]">
              <span className="block truncate text-[15px] font-semibold leading-tight">{a.name}</span>
              <span className="line-clamp-2 block text-[12px] leading-[1.3] text-ink-3">instead of {a.stands}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** one alt: a box (when it needs words), a choice (when it has one) and its rows */
export function AltView({ alt, onBack, onOpen }: { alt: Alt; onBack: () => void; onOpen: (url: string) => void }) {
  const [text, setText] = useState('')
  const [opt, setOpt] = useState(alt.option?.choices[0][0] ?? '')
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'busy' } | { kind: 'error'; msg: string } | { kind: 'rows'; q: string; rows: Row[]; note?: string }>({ kind: 'idle' })
  const run = useRef(0)
  const go = (q: string, o: string) => {
    const my = ++run.current
    setState({ kind: 'busy' })
    alt.run(q, o).then((r) => { if (my === run.current) setState({ kind: 'rows', q, rows: r.rows, note: r.note }) }).catch((e: unknown) => {
      if (my !== run.current) return
      const m = e instanceof Error ? e.message : ''
      setState({ kind: 'error', msg: /^\d{3}$/.test(m) || !m || /fetch|network|abort|timeout/i.test(m) ? `${alt.name} could not reach its data service. Try again in a moment.` : m })
    })
  }
  useEffect(() => { if (alt.ask === null) go('', opt); return () => { run.current++ } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const submit = (q: string) => { const t = q.trim(); if (t) { setText(t); go(t, opt) } }
  return (
    <div className="scroll-y grid h-full content-start gap-3 p-3">
      <button onClick={onBack} className="inline-flex h-11 items-center gap-1.5 justify-self-start text-sm text-ink-2 hover:text-ink"><ArrowLeft className="size-4" />All alts</button>
      <div>
        <p className="dot text-[clamp(1.4rem,4vw,2rem)] font-bold leading-[1.1]">{alt.name}</p>
        <p className="mt-0.5 text-[12px] text-ink-3">A Friction alt for {alt.stands}</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (alt.ask === null) go('', opt); else submit(text) }} className="flex flex-wrap gap-2">
        {alt.ask !== null && (
          <label className="relative min-w-[12rem] flex-1">
            <span className="sr-only">{alt.ask}</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={alt.ask} autoComplete="off" spellCheck={false} enterKeyHint="search" autoFocus className={`${field} h-11 w-full pl-9`} data-no-drag />
          </label>
        )}
        {alt.option && (
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            {alt.option.label}
            <select value={opt} onChange={(e) => { setOpt(e.target.value); if (alt.ask === null) go('', e.target.value); else if (text.trim()) go(text.trim(), e.target.value) }} className={`${field} h-11`} data-no-drag>
              {alt.option.choices.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        )}
        {alt.ask !== null && <button type="submit" className="h-11 bg-signal px-5 text-sm font-semibold text-on-signal">{alt.id === 'translate' ? 'Translate' : 'Look up'}</button>}
      </form>
      {alt.ask !== null && state.kind === 'idle' && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Things to try">
          {alt.ideas.map((i) => <li key={i}><button onClick={() => submit(i)} className="min-h-11 border border-ink/25 px-3 text-[13px] hover:border-signal hover:bg-ink/[0.06]">{i}</button></li>)}
        </ul>
      )}
      {state.kind === 'busy' && <div className="grid min-h-[6rem] place-items-center"><LoadingBlock label="Looking" size={48} /></div>}
      {state.kind === 'error' && <p role="alert" className="text-[13px] text-bad">{state.msg}</p>}
      {state.kind === 'rows' && (
        <div>
          <p className="hud mb-1" role="status">{state.rows.length ? `${state.rows.length} ${state.rows.length === 1 ? 'result' : 'results'}` : 'Nothing found'}</p>
          <ul className="m-0 list-none p-0">
            {state.rows.map((r, i) => (
              <li key={i} className="flex gap-3 border-b border-ink/10 py-2">
                {r.swatch && <span className="size-12 shrink-0 border border-ink/30" style={{ background: r.swatch }} aria-hidden />}
                {r.image && <img src={r.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-16 shrink-0 bg-ink/10 object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold leading-[1.3]">{r.link ? <button onClick={() => onOpen(r.link!)} className="min-h-11 text-left text-signal hover:underline">{r.title}</button> : r.title}</p>
                  {r.text && <p className="whitespace-pre-line break-words text-[13px] leading-[1.4] text-ink-2">{r.text}</p>}
                </div>
              </li>
            ))}
          </ul>
          {state.note && <p className="mt-2 text-[12px] leading-[1.4] text-ink-3">{state.note}</p>}
        </div>
      )}
    </div>
  )
}
