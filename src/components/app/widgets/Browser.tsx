import { ArrowLeft, BookOpen, Cloud, CircleHelp, ExternalLink, LayoutGrid, Pencil, Play, Plus, RotateCw, Search, Sparkles, X, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useUI } from '@/lib/ui'
import { LoadingBlock } from '@/components/app/LoadingBlock'
import { verdict, youtubeId } from '@/lib/blocklist'
import { screenPage } from '@/lib/screen'
import { FRAME_SHIM, frameRequest } from '@/lib/frameproxy'
import { PAGES_MAX, useStore, type SavedPage } from '@/lib/store'
import { ALTS, altFor } from '@/lib/alts'
import { field } from './Window'
import { AltsHome, AltView } from './Alts'

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
  | { kind: 'alts' }
  | { kind: 'alt'; id: string }
  | { kind: 'results'; q: string; list: Hit[]; engine: string; note: string }
  /** `q` is empty on YouTube's own start page */
  | { kind: 'youtube'; q: string; list: Video[] }
  /** `rendered`: the page's scripts were run on our server and this is what they drew */
  | { kind: 'page'; url: string; html: string; rendered?: boolean }
  /** the page runs in this browser through the relay (a separate project on its own address); `n` makes Reload start it afresh */
  | { kind: 'relay'; url: string; src: string; n: number }
  | { kind: 'video'; id: string; url: string }
  | { kind: 'blocked'; url: string; why: string }
  /** `retry` is false when trying again cannot help (a site that turns programs away, or one that is only a shell for scripts) */
  | { kind: 'error'; msg: string; url?: string; retry?: boolean; redo?: () => void; run?: () => void }

/** the relay pass in use: asked for when the first relay page opens and again when it is about to run out */
let pass: { base: string; token: string; exp: number; left: number } | null = null
/** a pass with at least this long left is reused when a page opens or comes back */
const FRESH = 60
/** the next lease is fetched when this few seconds are left of the one in use */
const RENEW = 2
/** the cloud browser is switched off when the tab has been out of sight (or out of focus) this long */
const AWAY_MS = 20_000

/** asks Friction for a lease of cloud browser time (api/relay.ts); on success it becomes `pass` */
async function lease(): Promise<'ok' | 'limit' | 'full' | 'down'> {
  try {
    const r = await fetch('/api/relay', { signal: AbortSignal.timeout(15000) })
    const d = (await r.json().catch(() => null)) as { base?: string; token?: string; exp?: number; left?: number; error?: string } | null
    if (r.status === 429) return d?.error === 'full' ? 'full' : 'limit'
    if (!r.ok || !d?.token || !d.base || !d.exp) return 'down'
    pass = { base: d.base, token: d.token, exp: d.exp, left: typeof d.left === 'number' ? d.left : 0 }
    return 'ok'
  } catch { return 'down' }
}
const spent = (got: 'limit' | 'full') => (got === 'full' ? 'The cloud browser is full for today. It resets at midnight UTC' : 'You have used all of your cloud browser time for today. It resets at midnight UTC')

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
/** inside the frame: every link and search form is handed to the window instead of being followed, so the blocklist always applies; a form that would send data, or a control that needs a live script, is reported, not run */
const BRIDGE = `(function(){var P=parent;function go(u){P.postMessage({friction:1,go:u},'*')}
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a){var c=e.target&&e.target.closest&&e.target.closest('button,[role=button],[role=tab],[role=menuitem],[aria-expanded],[aria-haspopup]');if(c&&!/^(INPUT|SELECT|TEXTAREA|OPTION)$/.test(c.tagName)&&!(c.form&&(c.type||'submit')==='submit')&&!c.closest('summary'))P.postMessage({friction:1,note:'control'},'*');return}e.preventDefault();var h=a.getAttribute('href')||'';if(h.charAt(0)==='#'){var t=document.getElementById(h.slice(1))||document.getElementsByName(h.slice(1))[0];if(t&&t.scrollIntoView)t.scrollIntoView();return}go(a.href)},true);
addEventListener('load',function(){setTimeout(function(){P.postMessage({friction:1,health:((document.body&&document.body.innerText)||'').replace(/\s+/g,' ').trim().length},'*')},3500)});
document.addEventListener('submit',function(e){var f=e.target;e.preventDefault();if((f.method||'get').toLowerCase()!=='get'||f.querySelector('input[type=password]')){P.postMessage({friction:1,note:'form'},'*');return}try{var u=new URL(f.action||document.baseURI);new FormData(f).forEach(function(v,k){if(typeof v==='string')u.searchParams.set(k,v)});go(u.href)}catch(x){}},true)})();`

const LIVE_CSP = "default-src 'none'; script-src https: 'unsafe-inline' 'unsafe-eval' blob:; style-src https: 'unsafe-inline'; img-src https: data: blob:; font-src https: data:; media-src https: blob:; connect-src https:; worker-src blob:; frame-src 'none'; form-action 'none'"

const doc = (html: string, ground: string, ink: string, live: boolean) =>
  `<!doctype html><meta http-equiv="Content-Security-Policy" content="${live ? LIVE_CSP : CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{background:${ground};color:${ink}}body{max-width:100%;overflow-x:auto}img,video{max-width:100%;height:auto}</style>${live ? `<script>${FRAME_SHIM}</script>` : ''}${html.replace(/<!doctype[^>]*>/i, '')}<script>${BRIDGE}</script>`

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
  // the first time the Browser is opened, a short tour of it (once the main tour is done or skipped)
  const browserToured = useStore((s) => s.settings.browserToured)
  useEffect(() => {
    if (browserToured) return
    const t = setTimeout(() => { const u = useUI.getState(); if (!u.tourOpen && !u.onboardOpen && !u.celebrate) u.set({ browserTour: true }) }, 900)
    return () => clearTimeout(t)
  }, [browserToured])
  // tell the rest of the app the cloud browser's live frame is up, so Friction pauses its forced-layout timers (the
  // ASCII panel scan, the Shell scroll measure) that otherwise reflow against the heavy iframe and freeze an iPad
  const cloud = view.kind === 'relay'
  useEffect(() => {
    useUI.getState().set({ cloudOpen: cloud })
    return () => useUI.getState().set({ cloudOpen: false })
  }, [cloud])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [doing, setDoing] = useState('Loading the page')
  // Bing is the engine and page scripts are always on: neither is a setting any more
  const engine = 'bing'
  const scripts: string = 'on'
  const [issues, setIssues] = useState(false)
  const [leave, setLeave] = useState<string | null>(null)
  const [, tick] = useState(0)
  const locked = useStore((s) => !!s.session)
  const [empty, setEmpty] = useState(false)
  const [relayReady, setRelayReady] = useState(false)
  // the cloud browser is only on while the tab is in front: away, its page is taken down (its connections close) and nothing is spent
  const [away, setAway] = useState(false)
  const awayRef = useRef(false)
  const busyLease = useRef(false)
  const frozen = useRef(0)
  const relayFrame = useRef<HTMLIFrameElement>(null)
  const saved = useStore((s) => s.widgets.pages ?? NONE)
  const addPage = useStore((s) => s.addPage)
  const removePage = useStore((s) => s.removePage)
  const frame = useRef<HTMLIFrameElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const recent = history.filter((u) => !/[?&](search|q|query)=|Special:Search/i.test(u)).slice(0, 4)
  const token = useRef(0)
  const loads = useRef(0)
  const engineName = ENGINE[engine] ?? 'Google'

  const show = (v: View, push = true) => { if (push) setStack((s) => [...s.slice(-20), view]); setNote(''); setIssues(false); setLeave(null); setEmpty(false); setRelayReady(false); loads.current = 0; setView(v) }

  /** hosts that were sent to the cloud browser on our own this visit, so a page that fails there as well is not sent back and forth */
  const tried = useRef(new Set<string>())
  /** the normal browser could not run this page: the cloud browser takes it, once for each site; if that was tried, `fail` is shown */
  const fallback = (raw: string, fail: View | null, push: boolean) => {
    let host = ''
    try { host = new URL(raw).hostname } catch { /* not an address */ }
    if (!host || tried.current.has(host)) return fail ? show(fail, push) : undefined
    tried.current.add(host)
    return openRelay(raw, push, true)
  }

  /**
   * `how`: auto follows Settings (run the page's scripts on our server by default; only when a page shows nothing; or never);
   * static never runs them; render always does. `push` is false when the same page is being shown again another way.
   */
  const open = async (raw: string, how: 'auto' | 'static' | 'render' = 'auto', push = true) => {
    const my = ++token.current
    const v = verdict(raw)
    if (!v.ok) return show({ kind: 'blocked', url: raw, why: v.why }, push)
    const id = youtubeId(v.url)
    if (id) return show({ kind: 'video', id, url: v.url.toString() }, push)
    // with page scripts on, Google, YouTube and the rest are opened as themselves; the window's own search pages stand in only when scripts are off
    if (scripts === 'off' || how === 'static') {
      const s = searched(v.url)
      if (s) return void (s.yt ? ytSearch(s.q) : search(s.q))
      if (ytHome(v.url)) return show({ kind: 'youtube', q: '', list: [] }, push)
      if (engineHome(v.url)) return show({ kind: 'search' }, push)
    }
    const target = v.url.toString()
    // scripts run in the person's own browser (in the sealed frame), never on a server, once the address has passed the list and a
    // page the list does not know has been looked at
    const live = how === 'render' || (how === 'auto' && scripts !== 'off')
    type Got = { url?: string; html?: string; error?: string; why?: string; walled?: boolean; thin?: boolean }
    setDoing('Loading the page')
    setBusy(true)
    try {
      const r = await fetch(`/api/browse?u=${encodeURIComponent(target)}${live ? '&s=1' : ''}`, { signal: AbortSignal.timeout(25000) })
      const d = (await r.json().catch(() => null)) as Got | null
      if (my !== token.current) return
      if (!d) return show({ kind: 'error', msg: 'The page service is not answering right now', url: raw, retry: true }, push)
      if (r.status === 403) return show({ kind: 'blocked', url: raw, why: d.why ?? 'a blocked site' }, push)
      if (!r.ok || !d.html) { const fail: View = { kind: 'error', msg: d.error ?? 'The page did not load', url: raw, retry: !d.walled }; return d.walled || [401, 403, 451].includes(r.status) ? fallback(raw, fail, push) : show(fail, push) }
      const here = d.url ?? raw
      const hv = verdict(here) // where redirects ended up
      if (!hv.ok) return show({ kind: 'blocked', url: here, why: hv.why }, push)
      if (!live && d.thin) return fallback(here, { kind: 'error', msg: scripts === 'off' ? 'This site builds its page with scripts, and page scripts are turned off in Settings, so there is nothing to show here' : 'This site builds its page with scripts, so there is nothing to show here', url: here, retry: false, run: scripts !== 'off' ? () => void open(here, 'render', false) : undefined }, push)
      setDoing('Checking the page')
      const sc = await screenPage(hv.url, d.html)
      if (my !== token.current) return
      if (sc.block) return show({ kind: 'blocked', url: here, why: 'a game or short-form site (checked by AI)' }, push)
      history = [here, ...history.filter((x) => x !== here)].slice(0, 8)
      show({ kind: 'page', url: here, html: d.html, rendered: live }, push)
    } catch (e) { if (my === token.current) show({ kind: 'error', msg: (e as Error)?.name === 'TimeoutError' ? 'The page took too long to load' : 'The page could not be reached', url: raw }, push) } finally { if (my === token.current) setBusy(false) }
  }

  /** opens a page through the relay: the page runs here, in this browser, and the relay only fetches its files (api/relay.ts, relay/) */
  const openRelay = async (raw: string, push = true, auto = false) => {
    const my = ++token.current
    const v = verdict(raw)
    if (!v.ok) return show({ kind: 'blocked', url: raw, why: v.why }, push)
    setDoing(auto ? 'This page does not run here, so the cloud browser is opening it' : 'Opening in the cloud browser')
    setBusy(true)
    try {
      if (!pass || pass.exp < Date.now() / 1000 + FRESH) {
        const got = await lease()
        if (my !== token.current) return
        if (got === 'limit' || got === 'full') return show({ kind: 'error', msg: spent(got), url: raw, retry: false }, push)
        if (got === 'down') return show({ kind: 'error', msg: 'The cloud browser is not available right now', url: raw, retry: true }, push)
      }
      const sc = await screenPage(v.url, '')
      if (my !== token.current) return
      if (sc.block) return show({ kind: 'blocked', url: raw, why: 'a game or short-form site (checked by AI)' }, push)
      try { localStorage.setItem('friction:relay', '1') } catch { /* storage blocked */ }
      history = [v.url.toString(), ...history.filter((x) => x !== v.url.toString())].slice(0, 8)
      show({ kind: 'relay', url: v.url.toString(), src: `${pass!.base}/go.html?u=${encodeURIComponent(v.url.toString())}&t=${pass!.token}`, n: Date.now() }, push)
    } catch { if (my === token.current) show({ kind: 'error', msg: 'The cloud browser could not be reached', url: raw, retry: true }, push) } finally { if (my === token.current) setBusy(false) }
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
      const d = e.data as { friction?: number; go?: string; note?: string; fx?: number; url?: unknown; method?: unknown; headers?: unknown; body?: unknown } | null
      if (d?.friction !== 1) return
      if (typeof (d as { health?: unknown }).health === 'number') { const n = (d as { health: number }).health; if (n < 80) setEmpty(true); if (n < 30 && view.kind === 'page') void fallback(view.url, null, false); return }
      if (typeof d.fx === 'number') {
        const id = d.fx
        void frameRequest(d).then((r) => {
          const w = frame.current?.contentWindow
          if (!w) return
          if (r.ok) w.postMessage({ fxr: id, status: r.status, statusText: r.statusText, headers: r.headers, body: r.body, url: r.url }, '*', [r.body])
          else { w.postMessage({ fxr: id, err: 1 }, '*'); if (r.limit) setNote('The service that lets pages fetch their own data is busy right now, so parts of this page may be missing. Try Reload in a moment.') }
        })
        return
      }
      if (typeof d.go === 'string' && d.go.length < 2000) void open(d.go)
      else if (d.note === 'form') setNote('That button sends a form. The Browser only reads pages, so it cannot send one.')
      else if (d.note === 'control') { if (!(view.kind === 'page' && view.rendered)) setNote('That button needs the page to be running, and it is not. Try Reload.') }
    }
    addEventListener('message', hear)
    return () => removeEventListener('message', hear)
  })

  const srcDoc = useMemo(() => {
    if (view.kind !== 'page') return ''
    return doc(view.html, '#fff', '#111', !!view.rendered)
  }, [view])

  /** a friendlier version of this site that the window can open instead, when there is one */
  const wrapFor = (raw: string): { name: string; go: () => void } | null => {
    let u: URL
    try { u = new URL(raw) } catch { return null }
    const h = u.hostname.replace(/^(www|m)\./, '')
    const alt = altFor(u)
    if (alt) return { name: `Friction ${alt.name}`, go: () => show({ kind: 'alt', id: alt.id }) }
    if (/^(youtube\.com|youtu\.be|music\.youtube\.com)$/.test(h)) return { name: 'Friction YouTube', go: () => show({ kind: 'youtube', q: '', list: [] }) }
    if (/^(google\.[a-z.]{2,6}|bing\.com|duckduckgo\.com|search\.brave\.com|yahoo\.com|ecosia\.org)$/.test(h)) return { name: 'FrictionX search', go: () => show({ kind: 'search' }) }
    if (/^(chatgpt\.com|chat\.openai\.com|openai\.com|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|perplexity\.ai|character\.ai|poe\.com)$/.test(h)) return { name: 'Friction Ask AI', go: () => useStore.getState().setWidget('ask', true) }
    return null
  }
  const pageUrl = view.kind === 'page' || view.kind === 'error' || view.kind === 'relay' ? view.url : undefined
  const wrap = pageUrl ? wrapFor(pageUrl) : null
  const nowLeft = () => (pass ? Math.max(0, pass.left + Math.max(0, pass.exp - Math.floor(Date.now() / 1000))) : 0)
  /** while a cloud browser page is open: the clock, the next lease before this one ends, and the switch-off when the tab is away */
  useEffect(() => {
    if (view.kind !== 'relay') { awayRef.current = false; setAway(false); return }
    let since = 0
    const run = async () => {
      tick((n) => n + 1)
      if (document.hidden || !document.hasFocus()) {
        since ||= Date.now()
        if (!awayRef.current && Date.now() - since > AWAY_MS) { frozen.current = nowLeft(); awayRef.current = true; setAway(true) }
        return
      }
      since = 0
      if (busyLease.current) return
      if (awayRef.current) {
        // back: the page starts again on a lease still in date, or a new one
        busyLease.current = true
        let got: 'ok' | 'limit' | 'full' | 'down' = 'ok'
        if (!pass || pass.exp < Date.now() / 1000 + FRESH) got = await lease()
        busyLease.current = false
        if (got === 'limit' || got === 'full') { awayRef.current = false; setAway(false); show({ kind: 'error', msg: spent(got), url: view.url, retry: false }, false); return }
        if (got === 'down' || !pass) return
        awayRef.current = false; setAway(false)
        setRelayReady(false); loads.current = 0
        setView({ ...view, src: `${pass.base}/go.html?u=${encodeURIComponent(view.url)}&t=${pass.token}`, n: Date.now() })
        return
      }
      if (pass && pass.exp - Date.now() / 1000 <= RENEW) {
        busyLease.current = true
        const got = await lease()
        busyLease.current = false
        if (got === 'ok' && pass) relayFrame.current?.contentWindow?.postMessage({ frictionPass: pass.token }, pass.base)
        else if (got === 'limit' || got === 'full') show({ kind: 'error', msg: spent(got), url: view.url, retry: false }, false)
      }
    }
    const t = setInterval(() => void run(), 1000)
    return () => clearInterval(t)
  }, [view])
  useEffect(() => {
    if (view.kind !== 'relay') return
    const t = setTimeout(() => setRelayReady(true), 9000)
    return () => clearTimeout(t)
  }, [view])
  const leftNow = pass ? (away ? frozen.current : nowLeft()) : null
  const mmss = (n: number) => `${n >= 3600 ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, '0')}` : Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
  const reload = () => { if (view.kind === 'relay') void openRelay(view.url, false); else if (view.kind === 'page' || view.kind === 'error') { if (view.url) void open(view.url, 'auto', false) } }

  const back = () => { const prev = stack[stack.length - 1]; if (prev) { setStack((s) => s.slice(0, -1)); setNote(''); setView(prev) } }
  const bar = view.kind !== 'search' && view.kind !== 'add' && view.kind !== 'alts' && view.kind !== 'alt' && !(view.kind === 'youtube' && !view.q)

  return (
    <div className="grid gap-2">
      {bar && <form onSubmit={(e) => { e.preventDefault(); go(text); setText('') }} className="flex gap-2">
        <button type="button" onClick={back} disabled={!stack.length} aria-label="Back" className="grid size-11 shrink-0 place-items-center border border-ink/30 hover:bg-ink/10 disabled:opacity-40"><ArrowLeft className="size-4" /></button>
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{view.kind === 'youtube' ? 'Search YouTube' : 'Search the web or type an address'}</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={view.kind === 'page' || view.kind === 'video' || view.kind === 'relay' ? view.url : view.kind === 'youtube' ? 'Search YouTube' : `Search with ${engineName} or type an address`} autoComplete="off" spellCheck={false} enterKeyHint="go" className={`${field} w-full pl-9`} data-no-drag />
        </label>
        {view.kind === 'relay' && leftNow !== null && (
          <span role="timer" title="Cloud browser time left today. The page runs on your device and blocked sites stay blocked." aria-label={`${mmss(leftNow)} of cloud browser time left today`} className="inline-flex h-11 shrink-0 items-center gap-1.5 border border-ink/30 px-2.5 text-[13px] text-ink-2"><Cloud className="size-4 text-signal" aria-hidden /><span className="fig text-ink">{mmss(leftNow)}</span></span>
        )}
        {(view.kind === 'page' || view.kind === 'relay') && (
          <button type="button" onClick={reload} aria-label="Reload this page" className="grid size-11 shrink-0 place-items-center border border-ink/30 hover:bg-ink/10"><RotateCw className="size-4" aria-hidden /></button>
        )}
        {(view.kind === 'page' || view.kind === 'relay') && (
          <button type="button" onClick={() => setIssues(true)} aria-label="Page not working? Open the Issues panel" className={`inline-flex h-11 shrink-0 items-center gap-1.5 border px-3 text-sm transition-colors duration-150 ${empty ? 'border-signal bg-signal font-semibold text-on-signal' : 'border-ink/30 hover:bg-ink/10'}`}><CircleHelp className="size-4" aria-hidden />Issues</button>
        )}
        <button type="submit" className="h-11 shrink-0 bg-signal px-4 text-sm font-semibold text-on-signal max-[480px]:sr-only">Go</button>
      </form>}
      <div ref={box} className="relative h-[min(62vh,34rem,calc(100cqh_-_9rem))] min-h-[10rem] overflow-hidden border border-ink/15" data-no-drag>
        {busy && <div className="absolute inset-0 z-10 grid place-items-center bg-ground/80"><LoadingBlock label={doing} size={56} /></div>}
        {view.kind === 'home' && (
          <div className="scroll-y grid h-full content-start gap-3 p-3">
            <p className="hud">Start</p>
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0" aria-label="Start pages">
              <li><Tile icon={<BookOpen className="size-6" />} name="Wikipedia" sub="The encyclopedia" onClick={() => void open('https://en.wikipedia.org/wiki/Main_Page')} /></li>
              <li><Tile icon={<Play className="size-6" />} name="YouTube" sub="Videos to learn from" onClick={() => (scripts === 'off' ? show({ kind: 'youtube', q: '', list: [] }) : void open('https://www.youtube.com/'))} /></li>
              <li><Tile icon={<Search className="size-6" />} name="FrictionX" sub="Our own search" onClick={() => show({ kind: 'search' })} /></li>
              <li><Tile icon={<Search className="size-6" />} name={engineName} sub="Search the web" onClick={() => (scripts === 'off' ? show({ kind: 'search' }) : void open(engine === 'bing' ? 'https://www.bing.com/' : engine === 'duckduckgo' ? 'https://duckduckgo.com/' : 'https://www.google.com/'))} label={`${engineName}, your search engine`} /></li>
              {saved.map((p) => (
                <li key={p.url}>
                  {editing
                    ? <Tile icon={<X className="size-6" />} name={p.name} sub="Tap to remove" onClick={() => removePage(p.url)} label={`Remove ${p.name}`} />
                    : <Tile icon={p.name[0]?.toUpperCase() ?? '?'} name={p.name} sub={p.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} onClick={() => void open(p.url)} />}
                </li>
              ))}
              <li><Tile icon={<LayoutGrid className="size-6" />} name="Friction alts" sub={`${ALTS.length} sites, made here`} onClick={() => show({ kind: 'alts' })} /></li>
              {saved.length < PAGES_MAX && <li><Tile icon={<Plus className="size-6" />} name="Add page" sub="Keep a site here" onClick={() => show({ kind: 'add' })} /></li>}
            </ul>
            {saved.length > 0 && <button onClick={() => setEditing((v) => !v)} aria-pressed={editing} className="inline-flex h-11 items-center gap-1.5 justify-self-start text-[13px] text-ink-2 hover:text-ink"><Pencil className="size-3.5" />{editing ? 'Done' : 'Remove pages'}</button>}
            {recent.length > 0 && (
              <div>
                <p className="hud mb-1">Recent</p>
                <ul className="m-0 list-none p-0">{recent.map((r) => <li key={r}><button onClick={() => void open(r)} className="block min-h-11 w-full truncate py-2 text-left text-[13px] text-ink-2 hover:text-ink">{r.replace(/^https?:\/\//, '')}</button></li>)}</ul>
              </div>
            )}
            <p className="text-[12px] leading-[1.4] text-ink-3">Games and short-form social media are blocked. Full YouTube videos play; Shorts do not. Sites that do not work here open in the cloud browser.</p>
          </div>
        )}
        {view.kind === 'search' && <Start title="FrictionX" sub={`Search the web, made here. The results come from ${engineName}.`} placeholder={`Search with ${engineName}`} ideas={IDEAS} onSearch={(q) => go(q, false)} onBack={back} />}
        {view.kind === 'alts' && <AltsHome onBack={back} onPick={(id) => show({ kind: 'alt', id })} />}
        {view.kind === 'alt' && <AltView key={view.id} alt={ALTS.find((a) => a.id === view.id)!} onBack={() => show({ kind: 'alts' })} onOpen={(u) => void open(u)} />}
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
          <div className="flex size-full flex-col">
            <div className="relative min-h-0 flex-1">
            <iframe ref={frame} key={view.url} title={`Web page: ${view.url}`} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" srcDoc={srcDoc} onLoad={() => { if (++loads.current > 1) fallback(view.url, { kind: 'error', msg: 'The page tried to take the window to another address by itself, which the Browser does not allow', url: view.url, retry: false }, false) }} className="size-full border-0 bg-white" />
            {note && <p role="status" className="absolute inset-x-0 bottom-0 bg-ground px-3 py-2 text-[13px] leading-[1.35] text-ink">{note}</p>}
            {empty && !note && !issues && <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-ground px-3 py-1 text-[13px] text-ink"><span>This page looks empty.</span><button onClick={() => setIssues(true)} className="h-11 shrink-0 px-3 font-semibold text-signal underline">Facing issues?</button></div>}
            </div>
          </div>
        )}
        {view.kind === 'relay' && (
          <div className="flex size-full flex-col">
            <div className="relative min-h-0 flex-1">
              {!relayReady && <div className="absolute inset-0 z-10 grid place-items-center bg-ground"><LoadingBlock label="Starting the page" size={56} /></div>}
              {away
                ? <div className="grid size-full place-items-center bg-ground p-4 text-center"><p className="max-w-[28ch] text-sm text-ink-2" role="status">The cloud browser is off while you are away, so it is not using your time. It starts again when you come back.</p></div>
                : <iframe ref={relayFrame} key={view.n} title={`Cloud browser page: ${view.url}`} src={view.src} sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-storage-access-by-user-activation" allow="clipboard-read; clipboard-write; fullscreen; autoplay; encrypted-media; picture-in-picture; publickey-credentials-get; storage-access" referrerPolicy="no-referrer" onLoad={() => { if (++loads.current > 1) setRelayReady(true) }} className="size-full border-0 bg-white" />}
            </div>
          </div>
        )}
        {view.kind === 'video' && (
          <div className="grid h-full content-start gap-2 p-2">
            <iframe title="YouTube video" src={`https://www.youtube-nocookie.com/embed/${view.id}?rel=0`} sandbox="allow-scripts allow-same-origin allow-presentation" allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="aspect-video max-h-[22rem] w-full border-0 bg-black" />
            <button type="button" onClick={() => setLeave(view.url!)} className="hud inline-flex min-h-11 items-center gap-1.5 hover:text-ink">Open on YouTube <ExternalLink className="size-3.5" /></button>
          </div>
        )}
        {view.kind === 'blocked' && (
          <div className="grid h-full content-center justify-items-start gap-2 p-4" role="alert">
            <p className="hud">Blocked</p>
            <p className="text-[15px] leading-[1.4]">That page is {view.why === 'not a web page' ? 'not a web page the Browser can open' : <>on the blocked list: <strong>{view.why}</strong></>}.</p>
            <p className="break-all text-[12px] text-ink-3">{view.url.slice(0, 120)}</p>
          </div>
        )}
        {leave && (
          <div className="absolute inset-0 z-30 grid content-center justify-items-start gap-3 bg-ground p-4" role="alertdialog" aria-modal="true" aria-labelledby="leave-t" aria-describedby="leave-d">
            <p id="leave-t" className="hud">Leaving Friction</p>
            <p id="leave-d" className="text-[15px] leading-[1.4]">{locked ? 'Opening this in your browser takes you out of Friction, and that will count as drifting.' : 'Opening this in your browser takes you out of Friction. If you were locked in, that would count as drifting.'}</p>
            <p className="break-all text-[12px] text-ink-3">{leave.slice(0, 100)}</p>
            <div className="flex flex-wrap gap-2">
              <button autoFocus onClick={() => setLeave(null)} className="h-11 bg-signal px-4 text-sm font-semibold text-on-signal">Stay here</button>
              <button onClick={() => { window.open(leave, '_blank', 'noopener,noreferrer'); setLeave(null) }} className="h-11 border border-ink/30 px-4 text-sm hover:bg-ink/10">{locked ? 'Open and drift' : 'Open anyway'}</button>
            </div>
          </div>
        )}
        {issues && (
          <div className="scroll-y absolute inset-0 z-20 grid content-start justify-items-start gap-3 bg-ground p-4" role="dialog" aria-label="Facing issues">
            <p className="hud">Page not working?</p>
            <p className="text-[15px] leading-[1.4]">{wrap ? `This site does not work well inside Friction. ${wrap.name} is a version we made that does.` : 'Some sites will not work inside Friction, for example ones that need you to log in or to prove you are a person. Here is what you can try.'}</p>
            {view.kind !== 'relay' && <p className="text-[13px] leading-[1.4] text-ink-2"><strong className="text-ink">Cloud browser:</strong> the page runs on your own device and Friction only fetches its files, so most sites work properly, including chat and live ones. You get about four hours a day. Logins, and sites that check you are a person, may still fail.</p>}
            <div className="flex flex-wrap gap-2">
              {wrap && <button onClick={() => { setIssues(false); wrap.go() }} className="inline-flex h-11 items-center gap-1.5 bg-signal px-4 text-sm font-semibold text-on-signal"><Sparkles className="size-4" />Open {wrap.name}</button>}
              {pageUrl && view.kind !== 'relay' && <button onClick={() => { setIssues(false); void openRelay(pageUrl, false) }} className={`inline-flex h-11 items-center gap-1.5 px-4 text-sm ${wrap ? 'border border-ink/30 hover:bg-ink/10' : 'bg-signal font-semibold text-on-signal'}`}><Cloud className="size-4" aria-hidden />Open in the cloud browser</button>}
              {pageUrl && <button type="button" onClick={() => setLeave(pageUrl!)} className="inline-flex h-11 items-center gap-1.5 border border-ink/30 px-4 text-sm hover:bg-ink/10">Open in your browser <ExternalLink className="size-3.5" /></button>}
              <button onClick={() => setIssues(false)} className="h-11 px-3 text-sm text-ink-2 hover:text-ink">Close</button>
            </div>
          </div>
        )}
        {view.kind === 'error' && (
          <div className="grid h-full content-center justify-items-start gap-2 p-4" role="alert">
            <p className="hud">Could not open it</p>
            <p className="text-[15px] leading-[1.4]">{view.msg}.</p>
            <div className="flex flex-wrap gap-2">
              {view.url && <button onClick={() => void openRelay(view.url!, false)} className="inline-flex h-11 items-center gap-1.5 bg-signal px-4 text-sm font-semibold text-on-signal"><Cloud className="size-4" aria-hidden />Open in the cloud browser</button>}
              {view.url && <button onClick={() => setIssues(true)} className="inline-flex h-11 items-center gap-1.5 border border-ink/30 px-4 text-sm hover:bg-ink/10"><CircleHelp className="size-4" />Facing issues?</button>}
              {view.run && <button onClick={view.run} className="inline-flex h-11 items-center gap-1.5 bg-signal px-4 text-sm font-semibold text-on-signal"><Zap className="size-4" />Run its scripts</button>}
              {view.redo && <button onClick={view.redo} className="h-11 border border-ink/30 px-4 text-sm hover:bg-ink/10">Try again</button>}
              {view.url && <>
                {view.retry !== false && <button onClick={() => void open(view.url!)} className="h-11 border border-ink/30 px-4 text-sm hover:bg-ink/10">Try again</button>}
                <button type="button" onClick={() => setLeave(view.url!)} className="inline-flex h-11 items-center gap-1.5 px-2 text-sm underline">Open in your browser <ExternalLink className="size-3.5" /></button>
              </>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
