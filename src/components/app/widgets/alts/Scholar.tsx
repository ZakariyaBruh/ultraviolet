import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ALT } from '@/lib/alts'
import { field } from '../Window'
import { AltFrame, getJson, plain, type AltProps } from './kit'

/**
 * Friction Scholar, in place of Google Scholar. Papers come from Crossref, the registry that journals report their articles to:
 * free, no key, answers browsers. It has titles, authors, journals, years, how often a paper is cited, and an abstract for many.
 */
interface Work { DOI?: string; title?: string[]; author?: { given?: string; family?: string; name?: string }[]; issued?: { 'date-parts'?: (number | null)[][] }; 'container-title'?: string[]; 'is-referenced-by-count'?: number; abstract?: string }
interface Paper { doi: string; title: string; by: string; where: string; year?: number; cited: number; abstract: string }
const PAGE = 15
const SORTS = [['relevance', 'Relevant'], ['is-referenced-by-count', 'Most cited'], ['issued', 'Newest']] as const

const initials = (g = '') => g.split(/[\s-]+/).filter(Boolean).map((w) => `${w[0].toUpperCase()}.`).join('')
function paper(w: Work): Paper | null {
  const title = plain(w.title?.[0], 220)
  if (!w.DOI || !title) return null
  const names = (w.author ?? []).map((a) => (a.family ? `${a.family}${a.given ? ` ${initials(a.given)}` : ''}` : a.name ?? '')).filter(Boolean)
  const abs = plain(w.abstract, 1800).replace(/^abstract[:.\s]*/i, '')
  return {
    doi: w.DOI, title,
    by: names.length > 4 ? `${names.slice(0, 4).join(', ')} et al.` : names.join(', '),
    where: plain(w['container-title']?.[0], 90),
    year: w.issued?.['date-parts']?.[0]?.[0] ?? undefined,
    cited: w['is-referenced-by-count'] ?? 0,
    abstract: abs,
  }
}
async function search(q: string, sort: string, abstractOnly: boolean, offset: number): Promise<Paper[]> {
  const qs = new URLSearchParams({
    query: q, rows: String(PAGE), offset: String(offset), filter: `type:journal-article${abstractOnly ? ',has-abstract:true' : ''}`,
    select: 'DOI,title,author,issued,container-title,is-referenced-by-count,abstract',
    ...(sort === 'relevance' ? {} : { sort, order: 'desc' }),
  })
  const d = (await getJson(`https://api.crossref.org/works?${qs}`, 15000)) as { message?: { items?: Work[] } }
  return (d.message?.items ?? []).map(paper).filter((p): p is Paper => !!p)
}

export default function Scholar({ hit, onBack, onOpen, onCloud }: AltProps) {
  const [text, setText] = useState(hit.q ?? '')
  const [asked, setAsked] = useState('')
  const [sort, setSort] = useState<(typeof SORTS)[number][0]>('relevance')
  const [withAbs, setWithAbs] = useState(true)
  const [list, setList] = useState<Paper[]>([])
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const run = useRef(0)

  const go = async (q: string, s = sort, a = withAbs, offset = 0) => {
    const t = q.trim()
    if (!t) return
    const my = ++run.current
    setBusy(true); setErr(''); setAsked(t)
    try {
      const r = await search(t, s, a, offset)
      if (my !== run.current) return
      setList((l) => (offset ? [...l, ...r] : r)); setMore(r.length === PAGE)
    } catch { if (my === run.current) setErr('The article service did not answer. Try again in a moment.') } finally { if (my === run.current) setBusy(false) }
  }
  useEffect(() => { if (hit.q) void go(hit.q) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AltFrame alt={ALT.scholar} site="Google Scholar" cloudUrl="https://scholar.google.com/" onBack={onBack} onCloud={onCloud} credit="Articles from Crossref. Not every paper has an abstract.">
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)]">
        <div className="grid gap-2 border-b border-ink/10 p-3">
          <form onSubmit={(e) => { e.preventDefault(); void go(text) }} className="flex gap-2">
            <label className="relative min-w-0 flex-1"><span className="sr-only">Search articles</span>
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="A topic, a title or an author" autoComplete="off" spellCheck={false} enterKeyHint="search" autoFocus={!hit.q} className={`${field} w-full pl-9`} data-no-drag />
            </label>
            <button type="submit" className="h-11 shrink-0 bg-signal px-4 text-sm font-semibold text-on-signal">Search</button>
          </form>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Order and filter">
            {SORTS.map(([k, n]) => <button key={k} aria-pressed={sort === k} onClick={() => { setSort(k); void go(asked || text, k) }} className={`min-h-11 px-3 text-[13px] ${sort === k ? 'bg-ink text-ground' : 'border border-ink/25 hover:bg-ink/10'}`}>{n}</button>)}
            <button aria-pressed={withAbs} onClick={() => { setWithAbs(!withAbs); void go(asked || text, sort, !withAbs) }} className={`min-h-11 px-3 text-[13px] ${withAbs ? 'bg-ink text-ground' : 'border border-ink/25 hover:bg-ink/10'}`}>With an abstract</button>
          </div>
        </div>
        <div className="scroll-y min-h-0 px-3" data-no-drag>
          {!asked && !busy && <p className="py-6 text-center text-[13px] text-ink-2">Search a topic, like “how vaccines work” or “photosynthesis efficiency”.</p>}
          {busy && !list.length && <p className="hud py-4" role="status">Searching…</p>}
          {err && <p role="alert" className="py-3 text-[13px] text-bad">{err}</p>}
          {asked && !busy && !err && !list.length && <p className="py-4 text-[13px] text-ink-2">Nothing found. Try other words{withAbs ? ', or turn off “With an abstract”' : ''}.</p>}
          <ul className="m-0 list-none p-0">
            {list.map((p) => (
              <li key={p.doi} className="grid gap-1 border-b border-ink/10 py-3">
                <a href={`https://doi.org/${p.doi}`} onClick={(e) => { e.preventDefault(); onOpen(`https://doi.org/${p.doi}`) }} className="text-[16px] font-semibold leading-[1.25] text-signal hover:underline">{p.title}</a>
                <p className="text-[13px] leading-[1.35] text-ink-2">{[p.by, p.where, p.year].filter(Boolean).join(' · ')}</p>
                {p.abstract && (open === p.doi
                  ? <p className="text-[14px] leading-[1.45]">{p.abstract}</p>
                  : <p className="line-clamp-2 text-[14px] leading-[1.45]">{p.abstract}</p>)}
                <p className="flex flex-wrap items-center gap-3 text-[12px] text-ink-3">
                  <span className="fig">Cited {p.cited.toLocaleString()} {p.cited === 1 ? 'time' : 'times'}</span>
                  {p.abstract.length > 150 && <button onClick={() => setOpen(open === p.doi ? null : p.doi)} className="min-h-11 text-ink-2 hover:text-ink">{open === p.doi ? 'Less' : 'Read the abstract'}</button>}
                </p>
              </li>
            ))}
          </ul>
          {more && !busy && <button onClick={() => void go(asked, sort, withAbs, list.length)} className="my-3 h-11 border border-ink/30 px-4 text-sm hover:bg-ink/10">More results</button>}
          {busy && list.length > 0 && <p className="hud py-3" role="status">Loading…</p>}
        </div>
      </div>
    </AltFrame>
  )
}
