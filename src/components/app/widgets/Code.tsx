import { Copy, Download, FolderOpen, ImageDown, Keyboard, Link2, Play, Square, Trash2, X } from 'lucide-react'
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { HighlightStyle, StreamLanguage, bracketMatching, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { tags as t } from '@lezer/highlight'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { SQLite, sql } from '@codemirror/lang-sql'
import { cpp } from '@codemirror/lang-cpp'
import { php } from '@codemirror/lang-php'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { ruby } from '@codemirror/legacy-modes/mode/ruby'
import { lua } from '@codemirror/legacy-modes/mode/lua'
import { fx_say } from '@/lib/actions'
import { NOTE_MAX, useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { decodeShare, encodeShare, shareUrl } from '@/lib/codeshare'
import { htmlDoc, runnerDoc } from '@/lib/coderun'
import { LANGS, langOf, type Example, type LangId } from '@/lib/codelangs'
import { cn } from '@/lib/utils'
import { key } from './Window'
import { PartBoundary, Waiting } from '@/components/app/Part'

// the PC (v86 and MS-DOS) is a part of its own: a third of a megabyte that only the MS-DOS choice needs
const Dos = lazy(() => import('./Dos').then((m) => ({ default: m.Dos })))

const OUT_MAX = 100_000
const LOAD_LIMIT = 120 // seconds an engine may take to arrive before the run is given up
type Chunk = { s: string; k: number } | { img: string }

const syntax = (id: LangId): Extension => {
  switch (id) {
    case 'python': return python()
    case 'javascript': return javascript()
    case 'typescript': return javascript({ typescript: true })
    case 'html': return html()
    case 'sql': return sql({ dialect: SQLite })
    case 'bash': return StreamLanguage.define(shell)
    case 'cpp': return cpp()
    case 'ruby': return StreamLanguage.define(ruby)
    case 'lua': return StreamLanguage.define(lua)
    case 'php': return php()
    default: return []
  }
}

// the editor in the station's colours: tokens only, so every theme (Paper, Mono, Receipt...) restyles it by itself
const look = EditorView.theme({
  '&': { color: 'var(--ink)', backgroundColor: 'transparent', fontSize: '13px', height: '100%' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.5', overflow: 'auto', overscrollBehavior: 'contain' },
  '.cm-content': { caretColor: 'var(--signal)', padding: '6px 0' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--ink-3)', border: 'none', borderRight: '1px solid var(--rule)' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 6px', minWidth: '2.2em' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--ink) 5%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--ink)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--signal)', borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--signal-soft) !important' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': { backgroundColor: 'transparent', outline: '1px solid var(--signal)' },
  '.cm-tooltip': { backgroundColor: 'var(--raised)', color: 'var(--ink)', border: '1px solid var(--rule)' },
  '.cm-tooltip-autocomplete > ul > li': { padding: '4px 8px', fontFamily: 'var(--font-mono)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--signal)', color: 'var(--on-signal)' },
})
const colours = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword, t.modifier, t.self], color: 'var(--signal)' },
  { tag: [t.string, t.special(t.string), t.regexp, t.character, t.escape], color: 'var(--ice)' },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: 'var(--ink-3)', fontStyle: 'italic' },
  { tag: [t.number, t.bool, t.null, t.atom, t.unit], color: 'var(--ok)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], fontWeight: '600' },
  { tag: [t.typeName, t.className, t.namespace, t.macroName], color: 'var(--ink)', fontStyle: 'italic' },
  { tag: [t.tagName, t.heading], color: 'var(--signal)' },
  { tag: [t.attributeName, t.propertyName, t.labelName], color: 'var(--ink-2)' },
  { tag: [t.operator, t.punctuation, t.bracket, t.separator, t.angleBracket], color: 'var(--ink-2)' },
  { tag: [t.meta, t.processingInstruction, t.documentMeta, t.annotation], color: 'var(--ink-3)' },
  { tag: t.invalid, color: 'var(--danger)' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.link, textDecoration: 'underline' },
])

/** add new output to the old, joining runs of the same kind, and stop at OUT_MAX characters */
function merge(old: Chunk[], add: Chunk[]): Chunk[] {
  let size = old.reduce((n, c) => n + ('s' in c ? c.s.length : 200), 0)
  if (size >= OUT_MAX) return old
  const out = old.slice()
  for (const c of add) {
    if (size >= OUT_MAX) { out.push({ s: `\nOutput cut at ${OUT_MAX.toLocaleString('en-US')} characters.\n`, k: 1 }); break }
    const last = out[out.length - 1]
    if ('s' in c && last && 's' in last && last.k === c.k) out[out.length - 1] = { s: last.s + c.s, k: c.k }
    else out.push(c)
    size += 's' in c ? c.s.length : 200
  }
  return out
}
/** printed SVG shows as a picture: any language can draw by printing it (an SVG shown through an img cannot run scripts or load anything) */
const SVG = /<svg[\s\S]*?<\/svg>/gi
function withPictures(text: string, cls?: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let at = 0, m: RegExpExecArray | null, n = 0
  SVG.lastIndex = 0
  while ((m = SVG.exec(text))) {
    if (m.index > at) parts.push(<span key={n++} className={cls}>{text.slice(at, m.index)}</span>)
    const svg = m[0].replace(/^<svg(?![^>]*xmlns=)/i, '<svg xmlns="http://www.w3.org/2000/svg"')
    parts.push(<img key={n++} src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)} alt="A picture your program printed" className="my-1 block max-w-full bg-white" />)
    at = m.index + m[0].length
  }
  if (at < text.length) parts.push(<span key={n++} className={cls}>{text.slice(at)}</span>)
  return parts
}
const secs = (ms: number) => (ms < 1000 ? `${Math.max(1, Math.round(ms))} ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`)

/** Write and run code without leaving the page. Everything runs in this browser; see `lib/coderun.ts` and `lib/codelangs.ts`. */
export function Code() {
  const setCode = useStore((s) => s.setCode)
  const saved = (k: string) => useStore.getState().widgets.code?.[k]
  const [lang, setLang] = useState<LangId>(() => langOf(saved('@lang')).id)
  const L = langOf(lang)
  const [input, setInput] = useState(() => saved(`in:${lang}`) ?? '')
  const [showIn, setShowIn] = useState(() => !!saved(`in:${lang}`))
  const [out, setOut] = useState<Chunk[]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [took, setTook] = useState<string | null>(null)
  const [pic, setPic] = useState(false)
  const picRef = useRef<HTMLCanvasElement>(null)
  const [page, setPage] = useState(() => ({ n: 0, doc: lang === 'html' ? saved('html') ?? LANGS[3].examples[0].code : '' }))
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const states = useRef(new Map<LangId, EditorState>())
  const frame = useRef<HTMLIFrameElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const run = useRef(0)
  const timer = useRef(0)
  const begun = useRef(0)
  const limit = useRef(30)
  const ready = useRef(false)
  const pending = useRef<(() => void) | null>(null)
  const queue = useRef<Chunk[]>([])
  const raf = useRef(0)
  const saveTimer = useRef(0)
  const go = useRef<() => void>(() => {})
  const doc = useMemo(() => runnerDoc(location.origin), [])
  // a share link that opened the app: offered, never loaded or run by itself
  const sharedRaw = useUI((s) => s.sharedCode)
  const [shared, setShared] = useState<{ lang: LangId; text: string } | null>(null)
  useEffect(() => {
    if (!sharedRaw) return
    let live = true
    void decodeShare(sharedRaw).then((d) => {
      if (!live) return
      useUI.setState({ sharedCode: null })
      const known = d && LANGS.some((l) => l.id === d.lang && l.id !== 'dos')
      if (known) setShared({ lang: d.lang as LangId, text: d.text.slice(0, NOTE_MAX) })
      else fx_say({ title: 'That link is broken', description: 'The code in it could not be read.', variant: 'warning' })
    })
    return () => { live = false }
  }, [sharedRaw])

  // the editor keeps what you type; it is written to the store a moment after you stop, and at once when you switch or close
  const dirty = useRef<{ id: LangId; text: string } | null>(null)
  const flush = () => { clearTimeout(saveTimer.current); if (dirty.current) { setCode(dirty.current.id, dirty.current.text); dirty.current = null } }
  const make = (id: LangId, text: string) => EditorState.create({
    doc: text,
    extensions: [
      lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), history(), drawSelection(), indentOnInput(), bracketMatching(), closeBrackets(),
      autocompletion({ icons: false }), syntaxHighlighting(colours), look, indentUnit.of(id === 'python' || id === 'php' || id === 'cpp' ? '    ' : '  '),
      keymap.of([{ key: 'Mod-Enter', run: () => { go.current(); return true } }, ...closeBracketsKeymap, ...completionKeymap, ...historyKeymap, ...defaultKeymap, indentWithTab]),
      syntax(id),
      EditorView.contentAttributes.of({ 'aria-label': `${langOf(id).label} code`, autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' }),
      EditorView.updateListener.of((u) => {
        if (!u.docChanged) return
        dirty.current = { id, text: u.state.doc.toString().slice(0, NOTE_MAX) }
        clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(flush, 500)
      }),
    ],
  })
  const textNow = () => view.current?.state.doc.toString() ?? ''

  useEffect(() => {
    const v = new EditorView({ parent: host.current!, state: make(lang, saved(lang) ?? L.examples[0].code) })
    view.current = v
    return () => { flush(); v.destroy(); view.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the editor is made once; languages swap its state
  }, [])

  const flushOut = () => { cancelAnimationFrame(raf.current); raf.current = 0; const q = queue.current; queue.current = []; if (q.length) setOut((o) => merge(o, q)) }
  const push = (c: Chunk) => { queue.current.push(c); if (!raf.current) raf.current = requestAnimationFrame(flushOut) }
  const arm = (s: number, why: string) => { clearTimeout(timer.current); timer.current = window.setTimeout(() => halt(why), s * 1000) }
  const halt = (why: string) => {
    clearTimeout(timer.current)
    frame.current?.contentWindow?.postMessage({ t: 'stop' }, '*')
    run.current++ // anything still on its way from the old run is ignored
    push({ s: `\n${why}\n`, k: 1 }); flushOut()
    setBusy(false); setStatus(''); setTook(null)
  }

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      const d = e.data as { t: string; s?: string; k?: number; src?: string; id?: number }
      if (d.t === 'ready') { ready.current = true; pending.current?.(); pending.current = null; return }
      if (d.id !== run.current) return
      if (d.t === 'out') push({ s: d.s ?? '', k: d.k ?? 0 })
      else if (d.t === 'img' && typeof d.src === 'string' && d.src.startsWith('data:image/png;base64,')) push({ img: d.src })
      else if (d.t === 'frame') {
        const b = (d as unknown as { bmp?: ImageBitmap }).bmp, c = picRef.current
        if (b && c) { if (c.width !== b.width) c.width = b.width; if (c.height !== b.height) c.height = b.height; c.getContext('2d')?.drawImage(b, 0, 0); b.close(); setPic(true) }
      }
      else if (d.t === 'status') {
        setStatus(d.s ?? '')
        // the clock for a run starts once its engine is here; fetching an engine has a longer allowance of its own
        if (d.s === 'Running') { begun.current = performance.now(); arm(limit.current, `Stopped after ${limit.current} seconds. Press Run to start again.`) }
        else arm(LOAD_LIMIT, 'It took too long to load. Check the connection and press Run again.')
      } else if (d.t === 'done') {
        clearTimeout(timer.current); flushOut()
        setBusy(false); setStatus('')
        setTook(begun.current ? secs(performance.now() - begun.current) : null)
      }
    }
    window.addEventListener('message', on)
    return () => { window.removeEventListener('message', on); clearTimeout(timer.current); cancelAnimationFrame(raf.current) }
  }, [])
  useEffect(() => { const f = frame.current; return () => f?.contentWindow?.postMessage({ t: 'stop' }, '*') }, [])

  go.current = () => {
    flush()
    if (L.id === 'html') { setPage((p) => ({ n: p.n + 1, doc: textNow() })); setTook(null); return }
    if (busy || !L.engine) return
    const id = ++run.current
    queue.current = []; setOut([]); setBusy(true); setStatus('Starting'); setTook(null); setPic(false)
    begun.current = 0
    limit.current = L.limit
    arm(LOAD_LIMIT, 'It took too long to load. Check the connection and press Run again.')
    const msg = { t: 'run', engine: L.engine, lang: L.sub ?? L.engine, code: textNow(), input, id }
    const send = () => frame.current?.contentWindow?.postMessage(msg, '*')
    if (ready.current) send(); else pending.current = send
  }

  const switchTo = (id: LangId, text?: string) => {
    if (id !== lang) {
      flush()
      if (busy) halt('Stopped.')
      if (view.current) states.current.set(lang, view.current.state)
      const next = text === undefined ? states.current.get(id) ?? make(id, saved(id) ?? langOf(id).examples[0].code) : make(id, text)
      view.current?.setState(next)
      setLang(id); setCode('@lang', id)
      const inp = saved(`in:${id}`) ?? ''
      setInput(inp); setShowIn(!!inp)
      setOut([]); setTook(null)
      if (id === 'html') setPage((p) => ({ n: p.n + 1, doc: next.doc.toString() }))
    } else if (text !== undefined && view.current) {
      view.current.dispatch({ changes: { from: 0, to: view.current.state.doc.length, insert: text } })
    }
    if (text !== undefined) { dirty.current = { id, text: text.slice(0, NOTE_MAX) }; flush() }
  }
  const example = (ex: Example) => {
    const v = view.current
    if (!v) return
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: ex.code } })
    changeInput(ex.input ?? '')
    setShowIn(!!ex.input)
    setOut([]); setTook(null)
    if (lang === 'html') setPage((p) => ({ n: p.n + 1, doc: ex.code }))
    fx_say({ title: `${ex.name} example`, description: 'Ctrl + Z in the editor brings yours back.' })
    v.focus()
  }
  const changeInput = (s: string) => { setInput(s); setCode(`in:${lang}`, s) }
  const open = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > NOTE_MAX * 4) { fx_say({ title: 'Too big', description: `The editor keeps up to ${NOTE_MAX.toLocaleString('en-US')} characters.`, variant: 'warning' }); return }
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    const by = LANGS.find((l) => l.ext === ext || (ext === 'htm' && l.id === 'html') || (['c', 'h', 'hpp', 'cc'].includes(ext) && l.id === 'cpp') || (['bash', 'zsh'].includes(ext) && l.id === 'bash') || (['mjs', 'cjs', 'jsx'].includes(ext) && l.id === 'javascript') || (ext === 'tsx' && l.id === 'typescript'))
    void f.text().then((s) => {
      if (s.length > NOTE_MAX) fx_say({ title: 'Cut short', description: `Only the first ${NOTE_MAX.toLocaleString('en-US')} characters fit.`, variant: 'warning' })
      switchTo(by?.id ?? lang, s.slice(0, NOTE_MAX))
    })
  }
  const takeShared = () => {
    if (!shared) return
    switchTo(shared.lang)
    const v = view.current
    if (v) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: shared.text } }) // an edit, so Ctrl + Z brings yours back
    dirty.current = { id: shared.lang, text: shared.text }; flush()
    if (shared.lang === 'html') setPage((p) => ({ n: p.n + 1, doc: shared.text }))
    setOut([]); setTook(null); setShared(null)
    v?.focus()
  }
  const share = async () => {
    const code = textNow()
    if (!code.trim()) return
    const url = shareUrl(await encodeShare(L.id, code))
    try {
      await navigator.clipboard.writeText(url)
      fx_say({ title: 'Link copied', description: url.length > 8000 ? 'The code is in the link. It is long, so some apps may cut it.' : 'The code is in the link. Nothing is stored.', variant: 'success' })
    } catch { fx_say({ title: 'Could not copy the link', variant: 'warning' }) }
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([textNow()], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url; a.download = L.id === 'html' ? 'index.html' : `main.${L.ext}`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const text = out.map((c) => ('s' in c ? c.s : '')).join('')
  const savePic = () => picRef.current?.toBlob((b) => { if (!b) return; const url = URL.createObjectURL(b); const a = document.createElement('a'); a.href = url; a.download = 'picture.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) })
  const dos = L.id === 'dos'
  const copyOut = () => { void navigator.clipboard?.writeText(text).then(() => fx_say({ title: 'Output copied', variant: 'success' }), () => fx_say({ title: 'Could not copy', variant: 'warning' })) }
  const lines = input ? input.replace(/\n$/, '').split('\n').length : 0
  const sel = 'h-11 min-w-0 border border-ink/25 bg-transparent px-2 text-[14px] text-ink focus:border-signal md:h-9'
  const icon = cn(key, 'size-11 md:size-9')
  const said = busy ? status || 'Running' : took ? `Done in ${took}.` : out.length ? '' : L.engine ? 'Ctrl + Enter runs it.' : 'Run shows the page.'

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <label className="sr-only" htmlFor="code-lang">Language</label>
        <select id="code-lang" value={lang} onChange={(e) => switchTo(e.target.value as LangId)} className={cn(sel, 'font-semibold')}>
          {LANGS.map((l) => <option key={l.id} value={l.id} className="bg-surface text-ink">{l.label}</option>)}
        </select>
        {!dos && <>
        <label className="sr-only" htmlFor="code-ex">Load an example</label>
        <select id="code-ex" value="" onChange={(e) => { const ex = L.examples[Number(e.target.value)]; if (ex) example(ex) }} className={cn(sel, 'max-w-[9.5rem] text-ink-2')}>
          <option value="" disabled className="bg-surface text-ink">Examples</option>
          {L.examples.map((ex, i) => <option key={ex.name} value={i} className="bg-surface text-ink">{ex.name}</option>)}
        </select>
        <div className="ml-auto flex gap-1">
          <button onClick={() => file.current?.click()} aria-label="Open a file from this device" title="Open a file" className={icon}><FolderOpen className="size-4" /></button>
          <button onClick={download} aria-label={`Save the code as ${L.id === 'html' ? 'index.html' : `main.${L.ext}`}`} title="Save as a file" className={icon}><Download className="size-4" /></button>
          <button onClick={() => void share()} aria-label="Copy a link with this code in it" title="Share as a link" className={icon}><Link2 className="size-4" /></button>
        </div>
        <input ref={file} type="file" hidden accept=".py,.js,.mjs,.cjs,.jsx,.ts,.tsx,.html,.htm,.sql,.sh,.bash,.zsh,.c,.cc,.cpp,.h,.hpp,.rb,.lua,.php,.txt" onChange={open} />
        </>}
      </div>

      {shared && (
        <div role="group" aria-label="Shared code" className="flex flex-wrap items-center gap-1.5 border border-signal p-2">
          <p className="min-w-0 flex-1 text-[13px] text-ink">Someone shared {langOf(shared.lang).label} code with you. Read it before you run it.</p>
          <button onClick={takeShared} className="h-11 bg-signal px-3 text-[13px] font-semibold text-on-signal md:h-9">Open it</button>
          <button onClick={() => setShared(null)} className={cn(key, 'h-11 px-3 text-[13px] md:h-9')}>No thanks</button>
        </div>
      )}

      <div
        ref={host} data-no-drag data-fill
        style={{ '--fill': showIn ? '27rem' : '22rem' } as React.CSSProperties}
        className={cn('h-[min(40vh,19rem)] min-h-[7rem] overflow-hidden border border-ink/25 focus-within:border-signal', dos && 'hidden')}
      />

      {dos && <PartBoundary small><Suspense fallback={<Waiting small label="Loading the PC" />}><Dos /></Suspense></PartBoundary>}

      {!dos && <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-[12px] text-ink-2" role="status" aria-live="polite">{said}</p>
        <div className="flex gap-1">
          {L.reads && (
            <button onClick={() => setShowIn((v) => !v)} aria-expanded={showIn} aria-controls="code-input" className={cn(key, 'h-11 gap-1.5 px-3 text-[13px] md:h-9', showIn && 'border-signal')}>
              <Keyboard className="size-4" />Input{lines ? <span className="fig text-ink-2">{lines}</span> : null}
            </button>
          )}
          {busy
            ? <button onClick={() => halt('Stopped. Variables, tables and files made so far are gone.')} className={cn(key, 'h-11 gap-1.5 px-4 text-[13px] md:h-9')}><Square className="size-3.5" />Stop</button>
            : <button onClick={() => go.current()} className="inline-flex h-11 items-center gap-1.5 bg-signal px-4 text-sm font-semibold text-on-signal md:h-9"><Play className="size-3.5" />Run</button>}
        </div>
      </div>

      {showIn && L.reads && (
        <textarea
          id="code-input" value={input} onChange={(e) => changeInput(e.target.value.slice(0, NOTE_MAX))} rows={3} spellCheck={false}
          aria-label="Input: the program takes one line each time it asks" placeholder="Input. The program takes one line each time it asks."
          className="h-[4.5rem] w-full resize-none border border-ink/25 bg-transparent p-2 font-mono text-[13px] leading-[1.45] text-ink placeholder:text-ink-3 focus:border-signal"
        />
      )}

      <div className={cn('relative border border-ink/15 bg-white', !pic && 'hidden')}>
        <canvas ref={picRef} width={480} height={320} role="img" aria-label="The picture your program drew" className="block h-[min(30vh,13rem)] w-full object-contain" />
        <div className="absolute top-1 right-1 flex gap-1">
          <button onClick={savePic} aria-label="Save the picture" title="Save the picture" className={cn(icon, 'bg-surface')}><ImageDown className="size-4" /></button>
          <button onClick={() => setPic(false)} aria-label="Hide the picture" title="Hide" className={cn(icon, 'bg-surface')}><X className="size-4" /></button>
        </div>
      </div>

      {L.id === 'html' ? (
        <iframe key={page.n} title="Your page" sandbox="allow-scripts" srcDoc={htmlDoc(page.doc)} className="h-[10rem] w-full border border-ink/25 bg-white" />
      ) : (
        <div className="relative">
          <pre data-no-drag tabIndex={0} role="region" aria-label="Output" className="scroll-y h-[10rem] whitespace-pre-wrap break-words border border-ink/15 bg-ink/[0.04] p-2 pr-[5.5rem] font-mono text-[12.5px] leading-[1.45] text-ink">
            {out.length ? out.map((c, i) => ('img' in c
              ? <img key={i} src={c.img} alt={`Plot ${out.slice(0, i + 1).filter((x) => 'img' in x).length}`} className="my-1 block max-w-full bg-white" />
              : <span key={i}>{withPictures(c.s, c.k === 1 ? 'text-danger' : c.k === 2 ? 'text-ink-3' : undefined)}</span>))
              : <span className="text-ink-3">Output shows here.</span>}
          </pre>
          {out.length > 0 && (
            <div className="absolute top-1 right-1 flex gap-1">
              <button onClick={copyOut} disabled={!text} aria-label="Copy the output" title="Copy the output" className={cn(icon, 'bg-surface disabled:opacity-40')}><Copy className="size-4" /></button>
              <button onClick={() => { setOut([]); setTook(null) }} aria-label="Clear the output" title="Clear" className={cn(icon, 'bg-surface')}><Trash2 className="size-4" /></button>
            </div>
          )}
        </div>
      )}

      <p className="text-[12px] leading-[1.35] text-ink-3">{L.note} Esc, then Tab, leaves the editor. Your code stays in this browser.</p>
      </>}

      <iframe ref={frame} title="Code runner" sandbox="allow-scripts" srcDoc={doc} className="hidden" aria-hidden />
    </div>
  )
}
