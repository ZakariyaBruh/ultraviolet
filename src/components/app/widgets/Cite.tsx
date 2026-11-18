import { Check, Copy, Download, Link2, Pencil, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useStore } from '@/lib/store'
import { cite, html, lookUp, parseNames, plain, recognise, sortKey, type Kind, type Run, type Source, type Style } from '@/lib/cite'
import { CITES_MAX } from '@/lib/citeData'
import { cn } from '@/lib/utils'
import { field, key } from './Window'
import { shareItem } from './shareItem'

/**
 * References in APA 7, MLA 9, Chicago or Harvard. A DOI is looked up on Crossref, an ISBN on Open Library and a Wikipedia address
 * on Wikipedia, from this browser, sending only what was pasted; anything else is typed in. The list stays in this browser.
 */
const STYLES: [Style, string][] = [['apa', 'APA 7'], ['mla', 'MLA 9'], ['chicago', 'Chicago'], ['harvard', 'Harvard']]
const KINDS: [Kind, string][] = [['article', 'Article'], ['book', 'Book'], ['web', 'Web page']]
const STYLE_KEY = 'friction:cite-style'

type Draft = { kind: Kind; authors: string; title: string; container: string; year: string; month: string; day: string; volume: string; issue: string; pages: string; publisher: string; edition: string; doi: string; url: string; accessed: string }
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const EMPTY: Draft = { kind: 'article', authors: '', title: '', container: '', year: '', month: '', day: '', volume: '', issue: '', pages: '', publisher: '', edition: '', doi: '', url: '', accessed: '' }
const int = (s: string, lo: number, hi: number) => { const n = Math.round(Number(s)); return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined }
const opt = (s: string) => s.trim() || undefined

function toSource(d: Draft, id: string): Source {
  return {
    id, kind: d.kind, authors: parseNames(d.authors), title: d.title.trim(), container: opt(d.container),
    year: int(d.year, -3000, 3000), month: int(d.month, 1, 12), day: int(d.day, 1, 31),
    volume: opt(d.volume), issue: opt(d.issue), pages: opt(d.pages), publisher: opt(d.publisher), edition: opt(d.edition),
    doi: opt(d.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')), url: opt(d.url), accessed: opt(d.accessed),
  }
}
function fromSource(s: Partial<Source>, base: Draft = EMPTY): Draft {
  const str = (x: unknown) => (x === undefined || x === null ? '' : String(x))
  return {
    ...base, kind: s.kind ?? base.kind,
    authors: s.authors ? s.authors.map((a) => (a.given ? `${a.family}, ${a.given}` : a.family)).join('\n') : base.authors,
    title: s.title ?? base.title, container: s.container ?? '', year: str(s.year), month: str(s.month), day: str(s.day),
    volume: s.volume ?? '', issue: s.issue ?? '', pages: s.pages ?? '', publisher: s.publisher ?? '', edition: s.edition ?? '',
    doi: s.doi ?? '', url: s.url ?? '', accessed: s.accessed ?? '',
  }
}

/** a Wikipedia article: its title and when it was last edited, from Wikipedia's own API */
async function wikipedia(url: string, signal: AbortSignal): Promise<Partial<Source> | null> {
  const m = /^https?:\/\/([a-z-]+)\.(?:m\.)?wikipedia\.org\/wiki\/([^?#]+)/i.exec(url)
  if (!m) return null
  const r = await fetch(`https://${m[1]}.wikipedia.org/api/rest_v1/page/summary/${m[2]}`, { signal })
  if (!r.ok) return null
  const j = await r.json() as { title?: string; timestamp?: string }
  const t = j.timestamp ? new Date(j.timestamp) : null
  return { kind: 'web', title: j.title ?? decodeURIComponent(m[2]).replace(/_/g, ' '), container: 'Wikipedia', url, accessed: today(), ...(t && !Number.isNaN(+t) ? { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() } : {}) }
}

const Cited = ({ runs }: { runs: Run[] }) => <>{runs.map((r, i) => (r.i ? <i key={i}>{r.t}</i> : <span key={i}>{r.t}</span>))}</>

async function copyRuns(list: Run[][]) {
  const text = list.map(plain).join('\n\n')
  const rich = list.map((r) => `<p style="padding-left:2em;text-indent:-2em">${html(r)}</p>`).join('')
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([rich], { type: 'text/html' }) })])
      return true
    }
    await navigator.clipboard.writeText(text)
    return true
  } catch { return false }
}

export function Cite() {
  const list = useStore((s) => s.widgets.cites) ?? []
  const setCites = useStore((s) => s.setCites)
  const [style, setStyleState] = useState<Style>(() => { try { const v = localStorage.getItem(STYLE_KEY); return (STYLES.some(([s]) => s === v) ? v : 'apa') as Style } catch { return 'apa' } })
  const setStyle = (s: Style) => { setStyleState(s); try { localStorage.setItem(STYLE_KEY, s) } catch { /* private window */ } }
  const [tab, setTab] = useState<'add' | 'list'>('add')
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [say, setSay] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [sure, setSure] = useState(false)
  const ctl = useRef<AbortController | null>(null)
  useEffect(() => () => ctl.current?.abort(), [])
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(null), 1600); return () => clearTimeout(t) }, [copied])

  const put = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))
  const src = useMemo(() => toSource(draft, editing ?? 'draft'), [draft, editing])
  const ready = src.title.length > 0
  const sorted = useMemo(() => [...list].sort((a, b) => sortKey(a).localeCompare(sortKey(b))), [list])

  const find = async (e: FormEvent) => {
    e.preventDefault()
    const what = recognise(q)
    if (!what) { setSay('Paste a DOI (10.…), an ISBN or a web address.'); return }
    ctl.current?.abort()
    const c = new AbortController(); ctl.current = c
    const timer = setTimeout(() => c.abort(), 15000)
    setBusy(true); setSay('Looking it up…')
    try {
      const got = what.kind === 'url' ? (await wikipedia(what.v, c.signal)) ?? await lookUp(q, c.signal) : await lookUp(q, c.signal)
      if (!got) { setSay(what.kind === 'doi' ? 'Crossref has no record of that DOI.' : what.kind === 'isbn' ? 'Open Library has no record of that ISBN.' : 'Nothing found.'); return }
      setDraft(fromSource(got, { ...EMPTY }))
      setEditing(null)
      setSay(what.kind === 'url' && got.container !== 'Wikipedia' ? 'Address and date filled in. Add the title and author.' : `Found: ${got.title || 'untitled'}. Check it before you use it.`)
    } catch {
      setSay(c.signal.aborted ? 'That took too long. Try again or type it in.' : 'Could not reach the lookup. Type it in instead.')
    } finally { clearTimeout(timer); setBusy(false) }
  }

  const save = () => {
    if (!ready) return
    if (editing) setCites(list.map((s) => (s.id === editing ? toSource(draft, editing) : s)))
    else if (list.length < CITES_MAX) setCites([...list, toSource(draft, Math.random().toString(36).slice(2, 10))])
    setDraft({ ...EMPTY, kind: draft.kind }); setEditing(null); setQ(''); setSay(editing ? 'Saved.' : 'Added to the list.')
  }
  const edit = (s: Source) => { setDraft(fromSource(s)); setEditing(s.id); setTab('add'); setSay('Editing. Save keeps its place in the list.') }
  const copyOne = async (s: Source) => { if (await copyRuns([cite(s, style)])) setCopied(s.id) }
  const copyAll = async () => { if (await copyRuns(sorted.map((s) => cite(s, style)))) setCopied('all') }
  const saveTxt = () => {
    const name = STYLES.find(([s]) => s === style)![1]
    const blob = new Blob([`References (${name})\n\n${sorted.map((s) => plain(cite(s, style))).join('\n\n')}\n`], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `references-${style}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const seg = 'h-11 border px-2.5 text-[13px] md:h-9'
  const on = 'border-signal bg-signal text-on-signal'
  const off = 'border-ink/25 text-ink-2 hover:text-ink'
  const label = 'grid gap-0.5 text-[11px] text-ink-3'
  const input = cn(field, 'h-11 w-full px-2 text-[14px] md:h-9')
  const k = draft.kind
  const where = k === 'article' ? 'Journal' : k === 'web' ? 'Website' : null

  return (
    <div className="grid gap-2">
      <div role="radiogroup" aria-label="Citation style" className="flex flex-wrap">
        {STYLES.map(([s, name], i) => <button key={s} role="radio" aria-checked={style === s} onClick={() => setStyle(s)} className={cn(seg, i > 0 && '-ml-px', style === s ? on : off)}>{name}</button>)}
      </div>
      <div role="tablist" aria-label="Cite" className="flex border-b border-ink/15">
        <button role="tab" aria-selected={tab === 'add'} onClick={() => setTab('add')} className={cn('h-11 px-3 text-[13px] font-semibold md:h-9', tab === 'add' ? 'border-b-2 border-signal text-ink' : 'text-ink-3 hover:text-ink')}>{editing ? 'Edit' : 'Add'}</button>
        <button role="tab" aria-selected={tab === 'list'} onClick={() => setTab('list')} className={cn('h-11 px-3 text-[13px] font-semibold md:h-9', tab === 'list' ? 'border-b-2 border-signal text-ink' : 'text-ink-3 hover:text-ink')}>List <span className="fig">{list.length}</span></button>
      </div>

      {tab === 'add' ? (
        <>
          <form onSubmit={find} className="flex gap-1.5">
            <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="DOI, ISBN or web address" placeholder="DOI, ISBN or address" className={cn(field, 'flex-1 md:h-9')} />
            <button type="submit" disabled={busy || !q.trim()} className={cn(key, 'h-11 shrink-0 gap-1.5 px-3 text-[13px] md:h-9')}><Search className="size-4" />Look up</button>
          </form>
          {say && <p role="status" className="text-[12px] text-ink-2">{say}</p>}
          <div data-no-drag className="scroll-y grid max-h-[min(19rem,42cqh)] gap-1.5 pr-1">
            <div role="radiogroup" aria-label="Kind of source" className="flex">
              {KINDS.map(([v, name], i) => <button key={v} role="radio" aria-checked={k === v} onClick={() => put({ kind: v, ...(v === 'web' && !draft.accessed ? { accessed: today() } : {}) })} className={cn(seg, i > 0 && '-ml-px', k === v ? on : off)}>{name}</button>)}
            </div>
            <label className={label}>Authors, one a line (Ada Lovelace or Lovelace, Ada)
              <textarea value={draft.authors} onChange={(e) => put({ authors: e.target.value })} rows={2} className={cn(field, 'h-auto w-full resize-y px-2 py-1.5 text-[14px] leading-snug')} />
            </label>
            <label className={label}>Title<input value={draft.title} onChange={(e) => put({ title: e.target.value })} className={input} /></label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {where && <label className={cn(label, 'col-span-2')}>{where}<input value={draft.container} onChange={(e) => put({ container: e.target.value })} className={input} /></label>}
              <label className={label}>Year<input value={draft.year} onChange={(e) => put({ year: e.target.value.replace(/[^\d-]/g, '').slice(0, 5) })} inputMode="numeric" className={cn(input, 'fig')} /></label>
              {k === 'web' && <label className={label}>Month<input value={draft.month} onChange={(e) => put({ month: e.target.value.replace(/\D/g, '').slice(0, 2) })} inputMode="numeric" placeholder="1–12" className={cn(input, 'fig')} /></label>}
              {k === 'web' && <label className={label}>Day<input value={draft.day} onChange={(e) => put({ day: e.target.value.replace(/\D/g, '').slice(0, 2) })} inputMode="numeric" className={cn(input, 'fig')} /></label>}
              {k === 'article' && <label className={label}>Volume<input value={draft.volume} onChange={(e) => put({ volume: e.target.value })} className={cn(input, 'fig')} /></label>}
              {k === 'article' && <label className={label}>Issue<input value={draft.issue} onChange={(e) => put({ issue: e.target.value })} className={cn(input, 'fig')} /></label>}
              {k === 'article' && <label className={label}>Pages<input value={draft.pages} onChange={(e) => put({ pages: e.target.value })} placeholder="12-30" className={cn(input, 'fig')} /></label>}
              {k === 'book' && <label className={cn(label, 'col-span-2')}>Publisher<input value={draft.publisher} onChange={(e) => put({ publisher: e.target.value })} className={input} /></label>}
              {k === 'book' && <label className={label}>Edition<input value={draft.edition} onChange={(e) => put({ edition: e.target.value })} placeholder="2nd" className={input} /></label>}
              {k !== 'web' && <label className={cn(label, 'col-span-2')}>DOI<input value={draft.doi} onChange={(e) => put({ doi: e.target.value })} placeholder="10.…" className={input} /></label>}
              {k === 'web' && <label className={cn(label, 'col-span-2')}>Accessed<input type="date" value={draft.accessed} onChange={(e) => put({ accessed: e.target.value })} className={input} /></label>}
            </div>
            {k !== 'article' && <label className={label}>Address{k === 'book' ? ' (if online)' : ''}<input value={draft.url} onChange={(e) => put({ url: e.target.value })} inputMode="url" placeholder="https://" className={input} /></label>}
          </div>
          <div className="grid gap-1.5 border border-ink/15 p-2">
            <p className="text-[11px] text-ink-3">Preview</p>
            <p className="select-text text-[14px] leading-[1.45] [overflow-wrap:anywhere] text-ink" aria-live="polite">{ready ? <Cited runs={cite(src, style)} /> : <span className="text-ink-3">Fill in a title, or look one up.</span>}</p>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={save} disabled={!ready || (!editing && list.length >= CITES_MAX)} className="h-11 bg-signal px-4 text-[13px] font-semibold text-on-signal disabled:opacity-40 md:h-9">{editing ? 'Save' : list.length >= CITES_MAX ? 'The list is full' : 'Add to list'}</button>
              {(editing || ready) && <button onClick={() => { setDraft({ ...EMPTY, kind: draft.kind }); setEditing(null); setSay('') }} className={cn(key, 'h-11 px-3 text-[13px] md:h-9')}>{editing ? 'Cancel' : 'Clear'}</button>}
            </div>
          </div>
        </>
      ) : list.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-ink-2">No references yet.</p>
      ) : (
        <>
          <div data-no-drag tabIndex={0} role="region" aria-label="References" className="scroll-y max-h-[min(20rem,45cqh)]">
            <ul className="grid">
              {sorted.map((s) => (
                <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1 border-b border-ink/10 py-1.5 last:border-b-0">
                  <p className="select-text pl-4 -indent-4 text-[14px] leading-[1.45] [overflow-wrap:anywhere] text-ink"><Cited runs={cite(s, style)} /></p>
                  <div className="flex">
                    <button onClick={() => copyOne(s)} aria-label={`Copy ${s.title}`} title="Copy" className="grid size-11 place-items-center text-ink-3 hover:text-ink md:size-9">{copied === s.id ? <Check className="size-4 text-signal" /> : <Copy className="size-4" />}</button>
                    <button onClick={() => edit(s)} aria-label={`Edit ${s.title}`} title="Edit" className="grid size-11 place-items-center text-ink-3 hover:text-ink md:size-9"><Pencil className="size-4" /></button>
                    <button onClick={() => setCites(list.filter((x) => x.id !== s.id))} aria-label={`Remove ${s.title}`} title="Remove" className="grid size-11 place-items-center text-ink-3 hover:text-ink md:size-9"><X className="size-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={copyAll} className={cn(key, 'h-11 gap-1.5 px-3 text-[13px] md:h-9')}>{copied === 'all' ? <Check className="size-4 text-signal" /> : <Copy className="size-4" />}Copy all</button>
            <button onClick={saveTxt} className={cn(key, 'h-11 gap-1.5 px-3 text-[13px] md:h-9')}><Download className="size-4" />Save .txt</button>
            <button onClick={() => void shareItem('refs', JSON.stringify(sorted))} className={cn(key, 'h-11 gap-1.5 px-3 text-[13px] md:h-9')}><Link2 className="size-4" />Share link</button>
            <button onClick={() => { if (sure) { setCites([]); setSure(false) } else setSure(true) }} onBlur={() => setSure(false)} className={cn('h-11 px-2 text-[13px] md:h-9', sure ? 'font-semibold text-danger' : 'text-ink-3 hover:text-ink')}>{sure ? 'Press again to clear' : 'Clear list'}</button>
          </div>
        </>
      )}
      <p className="text-[12px] text-ink-3">Sorted A to Z. Copy keeps the italics. Lookups go to Crossref, Open Library or Wikipedia.</p>
    </div>
  )
}
