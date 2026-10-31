import { ArrowLeft, Check, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ALT } from '@/lib/alts'
import { field } from '../Window'
import { AltFrame, getJson, linkClick, plain, PROSE, safeHtml, type AltProps } from './kit'

/**
 * Friction Stack, in place of Stack Overflow and the other Stack Exchange sites. It reads the Stack Exchange API: free, no key, and
 * it answers browsers (about 300 requests a day for each network). A question and its answers are shown as text, never as a page.
 */
const SITES: [string, string][] = [
  ['stackoverflow', 'Stack Overflow'], ['math', 'Mathematics'], ['physics', 'Physics'], ['chemistry', 'Chemistry'], ['biology', 'Biology'], ['english', 'English Language'],
  ['superuser', 'Super User'], ['askubuntu', 'Ask Ubuntu'], ['serverfault', 'Server Fault'], ['unix', 'Unix and Linux'], ['stats', 'Cross Validated'], ['cs', 'Computer Science'],
]
const API = 'https://api.stackexchange.com/2.3'
interface Owner { display_name?: string }
interface Q { question_id?: number; title?: string; score?: number; answer_count?: number; is_answered?: boolean; accepted_answer_id?: number; tags?: string[]; link?: string; body?: string; owner?: Owner; creation_date?: number }
interface A { answer_id?: number; score?: number; is_accepted?: boolean; body?: string; owner?: Owner }
const num = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
const ago = (t?: number) => { if (!t) return ''; const d = Math.max(0, (Date.now() / 1000 - t) / 86400); return d < 1 ? 'today' : d < 30 ? `${Math.floor(d)} days ago` : d < 365 ? `${Math.floor(d / 30)} months ago` : `${Math.floor(d / 365)} years ago` }

export default function Stack({ hit, onBack, onOpen, onCloud }: AltProps) {
  const [site, setSite] = useState(SITES.some(([k]) => k === hit.stack) ? hit.stack! : 'stackoverflow')
  const [text, setText] = useState(hit.q ?? '')
  const [sort, setSort] = useState<'relevance' | 'votes' | 'activity'>('relevance')
  const [asked, setAsked] = useState('')
  const [list, setList] = useState<Q[]>([])
  const [q, setQ] = useState<{ q: Q; answers: A[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const run = useRef(0)
  const top = useRef<HTMLDivElement>(null)

  const fail = (e: unknown) => setErr(/429|502|throttle/i.test(String((e as Error)?.message)) ? 'Stack Exchange has limited this network for today. It starts over tomorrow.' : 'Stack Exchange did not answer. Try again in a moment.')
  const search = async (term: string, s = site, o = sort) => {
    const t = term.trim()
    if (!t) return
    const my = ++run.current
    setBusy(true); setErr(''); setAsked(t); setQ(null)
    try {
      const d = (await getJson(`${API}/search/advanced?${new URLSearchParams({ order: 'desc', sort: o, q: t, site: s, pagesize: '20' })}`)) as { items?: Q[] }
      if (my !== run.current) return
      setList(d.items ?? [])
    } catch (e) { if (my === run.current) fail(e) } finally { if (my === run.current) setBusy(false) }
  }
  const read = async (id: number, s = site) => {
    const my = ++run.current
    setBusy(true); setErr('')
    try {
      const [qs, as] = (await Promise.all([
        getJson(`${API}/questions/${id}?${new URLSearchParams({ site: s, filter: 'withbody' })}`),
        getJson(`${API}/questions/${id}/answers?${new URLSearchParams({ order: 'desc', sort: 'votes', site: s, filter: 'withbody', pagesize: '10' })}`),
      ])) as [{ items?: Q[] }, { items?: A[] }]
      if (my !== run.current) return
      const one = qs.items?.[0]
      if (!one) { setErr('That question could not be found.'); return }
      const answers = (as.items ?? []).slice().sort((a, b) => Number(!!b.is_accepted) - Number(!!a.is_accepted) || (b.score ?? 0) - (a.score ?? 0))
      setQ({ q: one, answers })
      setTimeout(() => top.current?.scrollTo({ top: 0 }), 0)
    } catch (e) { if (my === run.current) fail(e) } finally { if (my === run.current) setBusy(false) }
  }
  useEffect(() => { if (hit.question) void read(hit.question); else if (hit.q) void search(hit.q) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const siteName = SITES.find(([k]) => k === site)?.[1] ?? site
  const real = site === 'stackoverflow' ? 'https://stackoverflow.com/' : `https://${site}.stackexchange.com/`

  return (
    <AltFrame alt={ALT.stack} site={hit.site} cloudUrl={q?.q.link ?? real} onBack={q ? () => setQ(null) : onBack} onCloud={onCloud} credit="Questions and answers from Stack Exchange, under their open licence.">
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)]">
        <div className="grid gap-2 border-b border-ink/10 p-3">
          <form onSubmit={(e) => { e.preventDefault(); void search(text) }} className="flex gap-2">
            <label className="relative min-w-0 flex-1"><span className="sr-only">Search questions</span>
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe the problem or paste an error" autoComplete="off" spellCheck={false} enterKeyHint="search" autoFocus={!hit.q && !hit.question} className={`${field} w-full pl-9`} data-no-drag />
            </label>
            <button type="submit" className="h-11 shrink-0 bg-signal px-4 text-sm font-semibold text-on-signal">Search</button>
          </form>
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="flex"><span className="sr-only">Site</span>
              <select value={site} onChange={(e) => { setSite(e.target.value); if (asked) void search(asked, e.target.value) }} className={`${field} py-0 pr-8 text-[13px]`} data-no-drag>{SITES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
            </label>
            <div role="group" aria-label="Order" className="flex flex-wrap gap-1.5">
              {([['relevance', 'Relevant'], ['votes', 'Most votes'], ['activity', 'Recent']] as const).map(([k, n]) => <button key={k} aria-pressed={sort === k} onClick={() => { setSort(k); if (asked) void search(asked, site, k) }} className={`min-h-11 px-3 text-[13px] ${sort === k ? 'bg-ink text-ground' : 'border border-ink/25 hover:bg-ink/10'}`}>{n}</button>)}
            </div>
          </div>
        </div>
        <div ref={top} className="scroll-y min-h-0 px-3" data-no-drag>
          {busy && <p className="hud py-3" role="status">Loading…</p>}
          {err && <p role="alert" className="py-3 text-[13px] text-bad">{err}</p>}
          {q ? (
            <article className="pb-4">
              <button onClick={() => setQ(null)} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-2 hover:text-ink"><ArrowLeft className="size-4" aria-hidden />Results</button>
              <h3 className="dot text-[1.25rem] font-bold leading-[1.2]">{plain(q.q.title, 200)}</h3>
              <p className="fig mt-1 text-[12px] text-ink-3">{num(q.q.score ?? 0)} votes · {siteName}{q.q.owner?.display_name ? ` · ${plain(q.q.owner.display_name, 40)}` : ''} · {ago(q.q.creation_date)}</p>
              <div className={PROSE} onClick={linkClick(onOpen)} dangerouslySetInnerHTML={{ __html: safeHtml(q.q.body ?? '') }} />
              <h4 className="hud mt-4 border-t border-ink/15 pt-3">{q.answers.length ? `${q.answers.length} ${q.answers.length === 1 ? 'answer' : 'answers'}` : 'No answers yet'}</h4>
              {q.answers.map((a) => (
                <section key={a.answer_id} className={`mt-2 border-l-4 pl-3 ${a.is_accepted ? 'border-ok' : 'border-ink/20'}`} aria-label={a.is_accepted ? 'Accepted answer' : 'Answer'}>
                  <p className="fig flex items-center gap-2 text-[12px] text-ink-3">{a.is_accepted && <span className="inline-flex items-center gap-1 text-ok"><Check className="size-3.5" aria-hidden />Accepted</span>}{num(a.score ?? 0)} votes{a.owner?.display_name ? ` · ${plain(a.owner.display_name, 40)}` : ''}</p>
                  <div className={PROSE} onClick={linkClick(onOpen)} dangerouslySetInnerHTML={{ __html: safeHtml(a.body ?? '') }} />
                </section>
              ))}
            </article>
          ) : (
            <>
              {!asked && !busy && <p className="py-6 text-center text-[13px] text-ink-2">Search the way you would search Stack Overflow, like “python list comprehension if else”.</p>}
              {asked && !busy && !err && !list.length && <p className="py-4 text-[13px] text-ink-2">No questions found. Try other words.</p>}
              <ul className="m-0 list-none p-0">
                {list.map((x) => (
                  <li key={x.question_id} className="border-b border-ink/10">
                    <button onClick={() => x.question_id && void read(x.question_id)} className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)] gap-3 py-3 text-left hover:bg-ink/[0.05]">
                      <span className="grid content-start justify-items-center gap-1">
                        <span className="fig text-[15px] font-bold leading-none">{num(x.score ?? 0)}</span>
                        <span className={`fig whitespace-nowrap px-1.5 py-0.5 text-[11px] leading-none ${x.accepted_answer_id ? 'bg-ok text-ground' : x.answer_count ? 'border border-ok text-ok' : 'border border-ink/30 text-ink-3'}`}>{x.answer_count ?? 0} {x.answer_count === 1 ? 'answer' : 'answers'}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-semibold leading-[1.3] text-signal">{plain(x.title, 200)}</span>
                        <span className="mt-1 flex flex-wrap gap-1">{(x.tags ?? []).slice(0, 5).map((t) => <span key={t} className="bg-ink/10 px-1.5 text-[12px] text-ink-2">{t}</span>)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </AltFrame>
  )
}
