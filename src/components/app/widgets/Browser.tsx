import { ArrowLeft, ExternalLink, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LoadingBlock } from '@/components/app/LoadingBlock'
import { verdict, youtubeId } from '@/lib/blocklist'
import { field } from './Window'

/**
 * The Browser: the open web for studying, without the parts that eat a focus session. Pages are read by our own server
 * (`api/browse.ts`), cleaned of scripts, and shown in a sealed frame, so they look like documents (Wikipedia, articles, docs)
 * and sites that need scripts to work will not. Games and short-form social media are refused here and again on the server;
 * full YouTube videos play in YouTube's own embedded player, and Shorts are refused.
 */
type View =
  | { kind: 'home' }
  | { kind: 'results'; q: string; list: { title: string; url: string; about: string }[] }
  | { kind: 'page'; url: string; html: string }
  | { kind: 'video'; id: string; url: string }
  | { kind: 'blocked'; url: string; why: string }
  | { kind: 'error'; msg: string; url?: string }

const START = [
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
  { name: 'Khan Academy', url: 'https://www.khanacademy.org/' },
  { name: 'MDN Web Docs', url: 'https://developer.mozilla.org/' },
  { name: 'Project Gutenberg', url: 'https://www.gutenberg.org/' },
  { name: 'Britannica', url: 'https://www.britannica.com/' },
  { name: 'Wolfram MathWorld', url: 'https://mathworld.wolfram.com/' },
]

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src https: 'unsafe-inline'; img-src https: data:; font-src https: data:; media-src https:; frame-src 'none'; form-action 'none'"
/** inside the frame: every link and search form is handed to the window instead of being followed, so the blocklist always applies */
const BRIDGE = `(function(){var P=parent;function go(u){P.postMessage({friction:1,go:u},'*')}
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;e.preventDefault();var h=a.getAttribute('href')||'';if(h.charAt(0)==='#'){var t=document.getElementById(h.slice(1))||document.getElementsByName(h.slice(1))[0];if(t&&t.scrollIntoView)t.scrollIntoView();return}go(a.href)},true);
document.addEventListener('submit',function(e){var f=e.target;e.preventDefault();if((f.method||'get').toLowerCase()!=='get')return;try{var u=new URL(f.action||document.baseURI);new FormData(f).forEach(function(v,k){if(typeof v==='string')u.searchParams.set(k,v)});go(u.href)}catch(x){}},true)})();`

const doc = (html: string, ground: string, ink: string) =>
  `<!doctype html><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{background:${ground};color:${ink}}body{max-width:100%;overflow-x:auto}img,video{max-width:100%;height:auto}</style>${html.replace(/<!doctype[^>]*>/i, '')}<script>${BRIDGE}</script>`

export function Browser() {
  const [view, setView] = useState<View>({ kind: 'home' })
  const [stack, setStack] = useState<View[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  const token = useRef(0)

  const show = (v: View, push = true) => { if (push) setStack((s) => [...s.slice(-20), view]); setView(v) }

  const open = async (raw: string) => {
    const my = ++token.current
    const v = verdict(raw)
    if (!v.ok) return show({ kind: 'blocked', url: raw, why: v.why })
    const id = youtubeId(v.url)
    if (id) return show({ kind: 'video', id, url: v.url.toString() })
    setBusy(true)
    try {
      const r = await fetch(`/api/browse?u=${encodeURIComponent(v.url.toString())}`, { signal: AbortSignal.timeout(25000) })
      const d = (await r.json()) as { url?: string; html?: string; error?: string; why?: string }
      if (my !== token.current) return
      if (r.status === 403) return show({ kind: 'blocked', url: raw, why: d.why ?? 'a blocked site' })
      if (!r.ok || !d.html) return show({ kind: 'error', msg: d.error ?? 'The page did not load', url: raw })
      show({ kind: 'page', url: d.url ?? raw, html: d.html })
    } catch { if (my === token.current) show({ kind: 'error', msg: 'The page did not load in time', url: raw }) } finally { if (my === token.current) setBusy(false) }
  }

  const search = async (q: string) => {
    const my = ++token.current
    setBusy(true)
    try {
      const r = await fetch(`/api/browse?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(20000) })
      const d = (await r.json()) as { results?: { title: string; url: string; about: string }[]; error?: string }
      if (my !== token.current) return
      if (!r.ok || !d.results) return show({ kind: 'error', msg: 'Search is busy. Try again in a moment.' })
      show({ kind: 'results', q, list: d.results })
    } catch { if (my === token.current) show({ kind: 'error', msg: 'Search did not answer in time.' }) } finally { if (my === token.current) setBusy(false) }
  }

  const go = (input: string) => {
    const t = input.trim()
    if (!t) return
    if (/^https?:\/\//i.test(t)) void open(t)
    else if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t)) void open(`https://${t}`)
    else void search(t)
  }

  // links and forms inside a page come here
  useEffect(() => {
    const hear = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      const d = e.data as { friction?: number; go?: string } | null
      if (d?.friction === 1 && typeof d.go === 'string' && d.go.length < 2000) void open(d.go)
    }
    addEventListener('message', hear)
    return () => removeEventListener('message', hear)
  })

  const srcDoc = useMemo(() => {
    if (view.kind !== 'page') return ''
    return doc(view.html, '#fff', '#111')
  }, [view])

  const back = () => { const prev = stack[stack.length - 1]; if (prev) { setStack((s) => s.slice(0, -1)); setView(prev) } }

  return (
    <div className="grid gap-2">
      <form onSubmit={(e) => { e.preventDefault(); go(text); setText('') }} className="flex gap-2">
        <button type="button" onClick={back} disabled={!stack.length} aria-label="Back" className="grid size-11 shrink-0 place-items-center border border-ink/30 hover:bg-ink/10 disabled:opacity-40"><ArrowLeft className="size-4" /></button>
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search the web or type an address</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={view.kind === 'page' || view.kind === 'video' ? view.url : 'Search the web or type an address'} autoComplete="off" spellCheck={false} enterKeyHint="go" className={`${field} w-full pl-9`} data-no-drag />
        </label>
        <button type="submit" className="h-11 shrink-0 bg-signal px-4 text-sm font-semibold text-on-signal">Go</button>
      </form>
      <div className="relative h-[min(58vh,26rem)] min-h-[14rem] overflow-hidden border border-ink/15" data-no-drag>
        {busy && <div className="absolute inset-0 z-10 grid place-items-center bg-ground/80"><LoadingBlock label="Loading the page" size={56} /></div>}
        {view.kind === 'home' && (
          <div className="scroll-y h-full p-3">
            <p className="text-[14px] leading-[1.45]">The open web for studying. Games and short-form social media (TikTok, Reels, YouTube Shorts and the like) are blocked. Full YouTube videos play.</p>
            <p className="hud mb-1.5 mt-3">Start somewhere</p>
            <ul className="m-0 grid list-none gap-1.5 p-0 sm:grid-cols-2">
              {START.map((s) => <li key={s.url}><button onClick={() => void open(s.url)} className="flex h-11 w-full items-center border border-ink/25 px-3 text-left text-[14px] hover:bg-ink/10">{s.name}</button></li>)}
            </ul>
            <p className="mt-3 text-[12px] leading-[1.4] text-ink-3">Pages are read by Friction’s server and shown without scripts, so documents and articles work best, and sites that are all scripts will not.</p>
          </div>
        )}
        {view.kind === 'results' && (
          <div className="scroll-y h-full p-2">
            <p className="hud mb-1" role="status">{view.list.length ? `Results for “${view.q}”` : 'Nothing found'}</p>
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
        {view.kind === 'page' && <iframe ref={frame} key={view.url} title={`Web page: ${view.url}`} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={srcDoc} className="size-full border-0 bg-white" />}
        {view.kind === 'video' && (
          <div className="grid h-full content-start gap-2 p-2">
            <iframe title="YouTube video" src={`https://www.youtube-nocookie.com/embed/${view.id}?rel=0`} sandbox="allow-scripts allow-same-origin allow-presentation" allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="aspect-video max-h-[18rem] w-full border-0 bg-black" />
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
            {view.url && <div className="flex flex-wrap gap-2"><button onClick={() => void open(view.url!)} className="h-11 border border-ink/30 px-4 text-sm hover:bg-ink/10">Try again</button><a href={view.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-1.5 px-2 text-sm underline">Open in your browser <ExternalLink className="size-3.5" /></a></div>}
          </div>
        )}
      </div>
    </div>
  )
}
