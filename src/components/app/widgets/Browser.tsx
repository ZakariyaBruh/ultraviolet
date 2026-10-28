import { ArrowLeft, BookOpen, ExternalLink, Pencil, Play, Plus, Search, X, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LoadingBlock } from '@/components/app/LoadingBlock'
import { verdict, youtubeId } from '@/lib/blocklist'
import { PAGES_MAX, useStore, type SavedPage } from '@/lib/store'
import { field } from './Window'

/**
 * The Browser: the open web for studying, without the parts that eat a focus session. Pages are read by our own server
 * (`api/browse.ts`), cleaned of scripts, and shown in a sealed frame, so they look like documents (Wikipedia, articles, docs)
 * and sites that need scripts to work will not. That is on purpose: a page's own scripts could send the frame to a blocked site
 * or fetch around the blocklist. Games and short-form social media are refused here and again on the server; full YouTube videos
 * play in YouTube's own embedded player and Shorts are refused. The pages that cannot work without scripts and that people most
 * want are answered by the window itself: search-engine results (the engine chosen in Settings) and YouTube search.
 */
type Hit = { title: string; url: string; about: string }
type Video = { id: string; title: string; channel: string; length: string; views: string; when: string }
type View =
  | { kind: 'home' }
  | { kind: 'search' }
  | { kind: 'add' }
  | { kind: 'results'; q: string; list: Hit[]; engine: string; note: string }
  /** `q` is empty on YouTube's own start page */
  | { kind: 'youtube'; q: string; list: Video[] }
  /** `rendered`: the page's scripts were run on our server and this is what they drew */
  | { kind: 'page'; url: string; html: string; rendered?: boolean }
  | { kind: 'video'; id: string; url: string }
  | { kind: 'blocked'; url: string; why: string }
  /** `retry` is false when trying again cannot help (a site that turns programs away, or one that is only a shell for scripts) */
  | { kind: 'error'; msg: string; url?: string; retry?: boolean; redo?: () => void; run?: () => void }

/** pages opened this visit, newest first */
let history: string[] = []
const NONE: SavedPage[] = []

const ENGINE: Record<string, string> = { google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo' }
const IDEAS = ['photosynthesis', 'the Roman Empire', 'how vaccines work', 'Pythagorean theorem']
const CHANNELS = ['Khan Academy', 'CrashCourse', 'TED-Ed', '3Blue1Brown', 'Kurzgesagt', 'MIT OpenCourseWare']

/**
 * Search-engine and YouTube results pages need scripts, so an address that is one is answered by the window's own search instead
 * (and the engine chosen in Settings is the one that answers). Null for every other address.
 */
function searched(u: URL): { yt: boolean; q: string } | null {
  const h = u.hostname.replace(/^(www|m)\./, '')
  const p = u.searchParams
  if (h === 'youtube.com' && u.pathname === '/results') return { yt: true, q: (p.get('search_query') ?? '').trim() }
  const web = /^(google\.[a-z.]{2,6}|bing\.com)$/.test(h) ? u.pathname === '/search' : /^(html\.|lite\.)?duckduckgo\.com$/.test(h) || h === 'search.brave.com'
  const q = (p.get('q') ?? '').trim()
  return web && q ? { yt: false, q } : null
}
/** a search engine's own front page (it is a script app, blank or bare without scripts): the window's search page takes its place */
const engineHome = (u: URL) => /^(www\.)?(google\.[a-z.]{2,6}|bing\.com|duckduckgo\.com|search\.brave\.com)$/.test(u.hostname) && (u.pathname === '/' || u.pathname === '') && !u.searchParams.get('q')
const ytHome = (u: URL) => (/^(www\.|m\.)?youtube\.com$/.test(u.hostname) && (u.pathname === '/' || u.pathname.startsWith('/feed'))) || (u.hostname === 'youtu.be' && u.pathname === '/')

/** the frame is sandboxed with `allow-forms` only so that a form's submit reaches the bridge below (without it the browser drops Enter in a search box before any handler runs); the bridge cancels every submit and `form-action 'none'` backs it up */
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src https: 'unsafe-inline'; img-src https: data:; font-src https: data:; media-src https:; frame-src 'none'; form-action 'none'"
/** inside the frame: every link and search form is handed to the window instead of being followed, so the blocklist always applies; a form that would send data is reported, not sent */
const BRIDGE = `(function(){var P=parent;function go(u){P.postMessage({friction:1,go:u},'*')}
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;e.preventDefault();var h=a.getAttribute('href')||'';if(h.charAt(0)==='#'){var t=document.getElementById(h.slice(1))||document.getElementsByName(h.slice(1))[0];if(t&&t.scrollIntoView)t.scrollIntoView();return}go(a.href)},true);
document.addEventListener('submit',function(e){var f=e.target;e.preventDefault();if((f.method||'get').toLowerCase()!=='get'||f.querySelector('input[type=password]')){P.postMessage({friction:1,note:'form'},'*');return}try{var u=new URL(f.action||document.baseURI);new FormData(f).forEach(function(v,k){if(typeof v==='string')u.searchParams.set(k,v)});go(u.href)}catch(x){}},true)})();`

const doc = (html: string, ground: string, ink: string) =>
  `<!doctype html><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{background:${ground};color:${ink}}body{max-width:100%;overflow-x:auto}img,video{max-width:100%;height:auto}</style>${html.replace(/<!doctype[^>]*>/i, '')}<script>${BRIDGE}</script>`

function Tile({ icon, name, sub, onClick, label }: { icon: ReactNode; name: string; sub: string; onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} aria-label={label} className="flex min-h-[7rem] w-full flex-col items-center justify-center gap-2 border border-ink/25 bg-ink/[0.04] px-2 py-3 text-center transition-[transform,border-color,background-color] duration-150 ease-out hover:border-signal hover:bg-ink/[0.08] active:scale-[0.98] sm:min-h-[5.5rem] sm:flex-row sm:justify-start sm:gap-3 sm:px-3 sm:text-left">
      <span className="grid size-12 shrink-0 place-items-center bg-ink/10 text-[22px] font-bold text-signal" aria-hidden>{icon}</span>
      <span className="min-w-0 max-w-full">
        <span className="block truncate text-[16px] font-semibold leading-tight">{name}</span>
        <span className="block truncate text-[12px] text-ink-3">{sub}</span>
      </span>
    </button>
  )
}

/** the start page of one search: a big box and a few things to try */
function Start({ title, sub, placeholder, ideas, onSearch, onBack }: { title: string; sub: string; placeholder: string; ideas: string[]; onSearch: (q: string) => void; onBack: () => void }) {
  const [text, setText] = useState('')
  return (
    <div className="scroll-y grid h-full content-start justify-items-center gap-4 px-3 pb-4 pt-2 text-center">
      <button onClick={onBack} className="inline-flex h-11 items-center gap-1.5 justify-self-start text-sm text-ink-2 hover:text-ink"><ArrowLeft className="size-4" />Back</button>
      <div>
        <p className="dot text-[clamp(1.8rem,6vw,2.8rem)] font-bold leading-[1.05]">{title}</p>
        <p className="mt-1 text-[13px] text-ink-2">{sub}</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); const q = text.trim(); if (q) onSearch(q) }} className="flex w-full max-w-[32rem]">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{placeholder}</span>
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-3" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} autoComplete="off" spellCheck={false} enterKeyHint="search" autoFocus className="h-14 w-full border border-ink/40 bg-ink/[0.04] pl-12 pr-3 text-[16px] text-ink placeholder:text-ink-3 focus:border-signal" data-no-drag />
        </label>
        <button type="submit" className="h-14 shrink-0 bg-signal px-5 text-sm font-semibold text-on-signal">Search</button>
      </form>
      <ul className="m-0 flex max-w-[32rem] list-none flex-wrap justify-center gap-2 p-0" aria-label="Things to try">
        {ideas.map((i) => <li key={i}><button onClick={() => onSearch(i)} className="min-h-11 border border-ink/25 px-3 text-[13px] hover:border-signal hover:bg-ink/[0.06]">{i}</button></li>)}
      </ul>
    </div>
  )
}

/** the form that adds a page to the start page; a blocked site cannot be added */
function AddPage({ onSave, onBack }: { onSave: (name: string, url: string) => void; onBack: () => void }) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const save = () => {
    const raw = url.trim()
    if (!raw) return setErr('Type the address of the page.')
    let u: URL
    try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`) } catch { return setErr('That does not look like an address.') }
    if (!u.hostname.includes('.')) return setErr('That does not look like an address.')
    const v = verdict(u.toString())
    if (!v.ok) return setErr(v.why === 'not a web page' ? 'The Browser cannot open that.' : `That one is on the blocked list: ${v.why}.`)
    onSave((name.trim() || u.hostname.replace(/^www\./, '')).slice(0, 30), u.toString())
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); save() }} className="scroll-y grid h-full content-start gap-3 p-3">
      <button type="button" onClick={onBack} className="inline-flex h-11 items-center gap-1.5 justify-self-start text-sm text-ink-2 hover:text-ink"><ArrowLeft className="size-4" />Back</button>
      <p className="dot text-[clamp(1.4rem,4vw,2rem)] font-bold leading-[1.1]">Add a page</p>
      <label className="grid gap-1"><span className="hud">Address</span><input value={url} onChange={(e) => { setUrl(e.target.value); setErr('') }} placeholder="example.com/page" inputMode="url" autoCapitalize="none" autoComplete="off" spellCheck={false} autoFocus className={`${field} w-full`} data-no-drag /></label>
      <label className="grid gap-1"><span className="hud">Name (optional)</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoComplete="off" className={`${field} w-full`} data-no-drag /></label>
      {err && <p role="alert" className="text-[13px] text-bad">{err}</p>}
      <div className="flex gap-2"><button type="submit" className="h-11 bg-signal px-5 text-sm font-semibold text-on-signal">Add to start page</button><button type="button" onClick={onBack} className="h-11 border border-ink/30 px-4 text-sm hover:bg-ink/10">Cancel</button></div>
    </form>
  )
}

export function Browser() {
  const [view, setView] = useState<View>({ kind: 'home' })
  const [stack, setStack] = useState<View[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [doing, setDoing] = useState('Loading the page')
  const engine = useStore((s) => s.settings.searchEngine)
  const scripts = useStore((s) => s.settings.browserScripts)
  const saved = useStore((s) => s.widgets.pages ?? NONE)
  const addPage = useStore((s) => s.addPage)
  const removePage = useStore((s) => s.removePage)
  const frame = useRef<HTMLIFrameElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const recent = history.filter((u) => !/[?&](search|q|query)=|Special:Search/i.test(u)).slice(0, 4)
  const token = useRef(0)
  const engineName = ENGINE[engine] ?? 'Google'

  const show = (v: View, push = true) => { if (push) setStack((s) => [...s.slice(-20), view]); setNote(''); setView(v) }

  /**
   * `how`: auto reads the page as it is and, when that shows nothing, has its scripts run on our server (unless Settings says never);
   * static never runs them; render always does. `push` is false when the same page is being shown again another way.
   */
  const open = async (raw: string, how: 'auto' | 'static' | 'render' = 'auto', push = true) => {
    const my = ++token.current
    const v = verdict(raw)
    if (!v.ok) return show({ kind: 'blocked', url: raw, why: v.why }, push)
    const id = youtubeId(v.url)
    if (id) return show({ kind: 'video', id, url: v.url.toString() }, push)
    const s = searched(v.url)
    if (s) return void (s.yt ? ytSearch(s.q) : search(s.q))
    if (ytHome(v.url)) return show({ kind: 'youtube', q: '', list: [] }, push)
    if (engineHome(v.url)) return show({ kind: 'search' }, push)
    const target = v.url.toString()
    // the page as read by our server, or as drawn after its scripts ran there; the second can take a while
    type Got = { url?: string; html?: string; error?: string; why?: string; walled?: boolean; thin?: boolean }
    const ask = async (run: boolean) => {
      const q = run ? `/api/render?u=${encodeURIComponent(target)}&w=${box.current?.clientWidth ?? 1024}` : `/api/browse?u=${encodeURIComponent(target)}`
      const r = await fetch(q, { signal: AbortSignal.timeout(run ? 55000 : 25000) })
      return { r, d: (await r.json().catch(() => null)) as Got | null }
    }
    const asked = how === 'render' || (how === 'auto' && scripts === 'always')
    setDoing(asked ? "Running the page's scripts" : 'Loading the page')
    setBusy(true)
    try {
      let got = await ask(asked).catch((e: Error) => { if (asked) return { r: null, d: null, e }; throw e })
      let rendered = asked
      let tried: 'no' | 'empty' | 'failed' = 'no'
      // nothing to read without scripts: have them run
      if (!asked && how === 'auto' && scripts === 'auto' && got.r?.ok && got.d?.thin) {
        if (my !== token.current) return
        setDoing("Running the page's scripts")
        const run = await ask(true).catch(() => null)
        if (run?.d?.html && run.r.ok) { if (run.d.thin) tried = 'empty'; else { got = run; rendered = true } } else if (run?.d?.walled) got = run
        else tried = 'failed'
      }
      if (my !== token.current) return
      const { r, d } = got as { r: Response | null; d: Got | null }
      if (!r || !d) return show({ kind: 'error', msg: rendered ? 'Running page scripts is not available right now' : 'The page service is not answering right now', url: raw, retry: true }, push)
      if (r.status === 403) return show({ kind: 'blocked', url: raw, why: d.why ?? 'a blocked site' }, push)
      if (!r.ok || !d.html) return show({ kind: 'error', msg: r.status === 429 && rendered ? 'Running page scripts is busy right now. Try again in a moment' : d.error ?? 'The page did not load', url: raw, retry: !d.walled }, push)
      const here = d.url ?? raw
      if (d.thin) {
        const msg = scripts === 'off' && !asked ? 'This site builds its page with scripts, and page scripts are turned off in Settings, so there is nothing to show here' : rendered || tried === 'empty' ? 'This site builds its page with scripts, and even with them run there is nothing to show here' : tried === 'failed' ? 'This site builds its page with scripts, and running them did not work just now' : 'This site builds its page with scripts, so there is nothing to show here'
        return show({ kind: 'error', msg, url: here, retry: false, run: scripts !== 'off' && !rendered ? () => void open(here, 'render', false) : undefined }, push)
      }
      history = [here, ...history.filter((x) => x !== here)].slice(0, 8)
      show({ kind: 'page', url: here, html: d.html, rendered }, push)
    } catch (e) { if (my === token.current) show({ kind: 'error', msg: (e as Error)?.name === 'TimeoutError' ? 'The page took too long to load' : 'The page could not be reached', url: raw }, push) } finally { if (my === token.current) setBusy(false) }
  }

  const search = async (q: string) => {
    const my = ++token.current
    setBusy(true)
    try {
      const r = await fetch(`/api/browse?q=${encodeURIComponent(q)}&e=${engine}`, { signal: AbortSignal.timeout(20000) })
      const d = (await r.json().catch(() => null)) as { results?: Hit[]; error?: string; engine?: string; asked?: string; googleOff?: boolean } | null
      if (my !== token.current) return
      if (!r.ok || !d?.results) return show({ kind: 'error', msg: 'Search is busy. Try again in a moment', redo: () => void search(q) })
      const got = ENGINE[d.engine ?? ''] ?? 'Search'
      // say so when it was not the engine that was asked for
      const why = d.asked && d.engine && d.engine !== d.asked ? `${d.googleOff ? 'Google is not set up on this site yet' : `${ENGINE[d.asked] ?? 'That engine'} did not answer`}, so ${got} did.` : ''
      show({ kind: 'results', q, list: d.results, engine: got, note: why })
    } catch (e) { if (my === token.current) show({ kind: 'error', msg: (e as Error)?.name === 'TimeoutError' ? 'Search took too long' : 'Search could not be reached', redo: () => void search(q) }) } finally { if (my === token.current) setBusy(false) }
  }

  const ytSearch = async (q: string) => {
    const my = ++token.current
    if (!q) return show({ kind: 'youtube', q: '', list: [] })
    setBusy(true)
    try {
      const r = await fetch(`/api/browse?v=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(20000) })
      const d = (await r.json().catch(() => null)) as { videos?: Video[] } | null
      if (my !== token.current) return
      if (!r.ok || !d?.videos) return show({ kind: 'error', msg: 'YouTube is not answering searches from here right now. It sometimes asks servers to prove they are people, and the Browser does not work around that', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, retry: false, redo: () => void ytSearch(q) })
      show({ kind: 'youtube', q, list: d.videos })
    } catch (e) { if (my === token.current) show({ kind: 'error', msg: (e as Error)?.name === 'TimeoutError' ? 'YouTube search took too long' : 'YouTube search could not be reached', redo: () => void ytSearch(q) }) } finally { if (my === token.current) setBusy(false) }
  }

  const go = (input: string, yt = view.kind === 'youtube') => {
    const t = input.trim()
    if (!t) return
    if (/^https?:\/\//i.test(t)) void open(t)
    else if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t)) void open(`https://${t}`)
    else if (yt) void ytSearch(t)
    else void search(t)
  }

  // links and forms inside a page come here
  useEffect(() => {
    const hear = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      const d = e.data as { friction?: number; go?: string; note?: string } | null
      if (d?.friction !== 1) return
      if (typeof d.go === 'string' && d.go.length < 2000) void open(d.go)
      else if (d.note === 'form') setNote('That button sends a form. The Browser only reads pages, so it cannot send one.')
    }
    addEventListener('message', hear)
    return () => removeEventListener('message', hear)
  })

  const srcDoc = useMemo(() => {
    if (view.kind !== 'page') return ''
    return doc(view.html, '#fff', '#111')
  }, [view])

  /** run this page's scripts on our server, or load it again without them */
  const toggleScripts = () => { if (view.kind === 'page') void open(view.url, view.rendered ? 'static' : 'render', false) }

  const back = () => { const prev = stack[stack.length - 1]; if (prev) { setStack((s) => s.slice(0, -1)); setNote(''); setView(prev) } }
  const bar = view.kind !== 'search' && view.kind !== 'add' && !(view.kind === 'youtube' && !view.q)

  return (
    <div className="grid gap-2">
      {bar && <form onSubmit={(e) => { e.preventDefault(); go(text); setText('') }} className="flex gap-2">
        <button type="button" onClick={back} disabled={!stack.length} aria-label="Back" className="grid size-11 shrink-0 place-items-center border border-ink/30 hover:bg-ink/10 disabled:opacity-40"><ArrowLeft className="size-4" /></button>
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{view.kind === 'youtube' ? 'Search YouTube' : 'Search the web or type an address'}</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={view.kind === 'page' || view.kind === 'video' ? view.url : view.kind === 'youtube' ? 'Search YouTube' : `Search with ${engineName} or type an address`} autoComplete="off" spellCheck={false} enterKeyHint="go" className={`${field} w-full pl-9`} data-no-drag />
        </label>
        {view.kind === 'page' && scripts !== 'off' && (
          <button type="button" onClick={toggleScripts} aria-pressed={!!view.rendered} aria-label="Run this page's scripts" title={view.rendered ? "This page's scripts ran on our server. Tap to load it without them." : "Run this page's scripts on our server"} className={`grid size-11 shrink-0 place-items-center border transition-colors duration-150 ${view.rendered ? 'border-signal bg-signal text-on-signal' : 'border-ink/30 hover:bg-ink/10'}`}><Zap className="size-4" /></button>
        )}
        <button type="submit" className="h-11 shrink-0 bg-signal px-4 text-sm font-semibold text-on-signal">Go</button>
      </form>}
      <div ref={box} className="relative h-[min(62vh,34rem)] min-h-[14rem] overflow-hidden border border-ink/15" data-no-drag>
        {busy && <div className="absolute inset-0 z-10 grid place-items-center bg-ground/80"><LoadingBlock label={doing} size={56} /></div>}
        {view.kind === 'home' && (
          <div className="scroll-y grid h-full content-start gap-3 p-3">
            <p className="hud">Start</p>
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0" aria-label="Start pages">
              <li><Tile icon={<BookOpen className="size-6" />} name="Wikipedia" sub="The encyclopedia" onClick={() => void open('https://en.wikipedia.org/wiki/Main_Page')} /></li>
              <li><Tile icon={<Play className="size-6" />} name="YouTube" sub="Videos to learn from" onClick={() => show({ kind: 'youtube', q: '', list: [] })} /></li>
              <li><Tile icon={<Search className="size-6" />} name={engineName} sub="Search the web" onClick={() => show({ kind: 'search' })} label={`${engineName}, your search engine`} /></li>
              {saved.map((p) => (
                <li key={p.url}>
                  {editing
                    ? <Tile icon={<X className="size-6" />} name={p.name} sub="Tap to remove" onClick={() => removePage(p.url)} label={`Remove ${p.name}`} />
                    : <Tile icon={p.name[0]?.toUpperCase() ?? '?'} name={p.name} sub={p.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} onClick={() => void open(p.url)} />}
                </li>
              ))}
              {saved.length < PAGES_MAX && <li><Tile icon={<Plus className="size-6" />} name="Add page" sub="Keep a site here" onClick={() => show({ kind: 'add' })} /></li>}
            </ul>
            {saved.length > 0 && <button onClick={() => setEditing((v) => !v)} aria-pressed={editing} className="inline-flex h-11 items-center gap-1.5 justify-self-start text-[13px] text-ink-2 hover:text-ink"><Pencil className="size-3.5" />{editing ? 'Done' : 'Remove pages'}</button>}
            {recent.length > 0 && (
              <div>
                <p className="hud mb-1">Recent</p>
                <ul className="m-0 list-none p-0">{recent.map((r) => <li key={r}><button onClick={() => void open(r)} className="block min-h-11 w-full truncate py-2 text-left text-[13px] text-ink-2 hover:text-ink">{r.replace(/^https?:\/\//, '')}</button></li>)}</ul>
              </div>
            )}
            <p className="text-[12px] leading-[1.4] text-ink-3">Games and short-form social media are blocked. Full YouTube videos play; Shorts do not. Pages are shown without scripts, so articles and documents work best.</p>
          </div>
        )}
        {view.kind === 'search' && <Start title={engineName} sub={`Search the web. The results come from ${engineName}.`} placeholder={`Search with ${engineName}`} ideas={IDEAS} onSearch={(q) => go(q, false)} onBack={back} />}
        {view.kind === 'add' && <AddPage onBack={back} onSave={(n, u) => { addPage(n, u); back() }} />}
        {view.kind === 'results' && (
          <div className="scroll-y h-full p-2">
            <p className="hud mb-1" role="status">{view.list.length ? `Results for “${view.q}” · ${view.engine}` : 'Nothing found'}</p>
            {view.note && <p className="mb-1 text-[12px] leading-[1.35] text-ink-3">{view.note}</p>}
            <ul className="m-0 list-none p-0">
              {view.list.map((r) => (
                <li key={r.url} className="border-b border-ink/10">
                  <button onClick={() => void open(r.url)} className="block min-h-11 w-full py-2 text-left hover:bg-ink/[0.06]">
                    <span className="block text-[14px] font-semibold leading-[1.3] text-signal">{r.title}</span>
                    <span className="block truncate text-[12px] text-ink-3">{r.url}</span>
                    {r.about && <span className="mt-0.5 line-clamp-2 block text-[13px] leading-[1.35] text-ink-2">{r.about}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {view.kind === 'youtube' && !view.q && <Start title="YouTube" sub="Full videos to learn from. Shorts are left out. Paste a video link to play it." placeholder="Search YouTube or paste a link" ideas={CHANNELS} onSearch={(q) => go(q, true)} onBack={back} />}
        {view.kind === 'youtube' && view.q && (
          <div className="scroll-y h-full p-2">
            <p className="hud mb-1" role="status">{view.list.length ? `Videos for “${view.q}”` : 'Nothing found'}</p>
            <ul className="m-0 list-none p-0">
              {view.list.map((v) => (
                <li key={v.id} className="border-b border-ink/10">
                  <button onClick={() => show({ kind: 'video', id: v.id, url: `https://www.youtube.com/watch?v=${v.id}` })} className="flex min-h-11 w-full gap-3 py-2 text-left hover:bg-ink/[0.06]">
                    <span className="relative aspect-video w-32 shrink-0 bg-ink/10 sm:w-40">
                      <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
                      <span className="fig absolute bottom-1 right-1 bg-black/80 px-1 text-[11px] leading-4 text-white">{v.length}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 block text-[14px] font-semibold leading-[1.3]">{v.title}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-ink-2">{v.channel}</span>
                      <span className="block truncate text-[12px] text-ink-3">{[v.views && `${v.views} views`, v.when].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {view.kind === 'page' && (
          <>
            <iframe ref={frame} key={view.url} title={`Web page: ${view.url}`} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" srcDoc={srcDoc} className="size-full border-0 bg-white" />
            {note && <p role="status" className="absolute inset-x-0 bottom-0 bg-ground px-3 py-2 text-[13px] leading-[1.35] text-ink">{note}</p>}
          </>
        )}
        {view.kind === 'video' && (
          <div className="grid h-full content-start gap-2 p-2">
            <iframe title="YouTube video" src={`https://www.youtube-nocookie.com/embed/${view.id}?rel=0`} sandbox="allow-scripts allow-same-origin allow-presentation" allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="aspect-video max-h-[22rem] w-full border-0 bg-black" />
            <a href={view.url} target="_blank" rel="noopener noreferrer" className="hud inline-flex min-h-11 items-center gap-1.5 hover:text-ink">Open on YouTube <ExternalLink className="size-3.5" /></a>
          </div>
        )}
        {view.kind === 'blocked' && (
          <div className="grid h-full content-center justify-items-start gap-2 p-4" role="alert">
            <p className="hud">Blocked</p>
            <p className="text-[15px] leading-[1.4]">That page is {view.why === 'not a web page' ? 'not a web page the Browser can open' : <>on the blocked list: <strong>{view.why}</strong></>}.</p>
            <p className="break-all text-[12px] text-ink-3">{view.url.slice(0, 120)}</p>
          </div>
        )}
        {view.kind === 'error' && (
          <div className="grid h-full content-center justify-items-start gap-2 p-4" role="alert">
            <p className="hud">Could not open it</p>
            <p className="text-[15px] leading-[1.4]">{view.msg}.</p>
            <div className="flex flex-wrap gap-2">
              {view.run && <button onClick={view.run} className="inline-flex h-11 items-center gap-1.5 bg-signal px-4 text-sm font-semibold text-on-signal"><Zap className="size-4" />Run its scripts</button>}
              {view.redo && <button onClick={view.redo} className="h-11 border border-ink/30 px-4 text-sm hover:bg-ink/10">Try again</button>}
              {view.url && <>
                {view.retry !== false && <button onClick={() => void open(view.url!)} className="h-11 border border-ink/30 px-4 text-sm hover:bg-ink/10">Try again</button>}
                <a href={view.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-1.5 px-2 text-sm underline">Open in your browser <ExternalLink className="size-3.5" /></a>
              </>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
