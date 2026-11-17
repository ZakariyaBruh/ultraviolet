import { Play, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useStore } from '@/lib/store'
import { htmlDoc, LANGS, RUNNER, STARTERS, type Lang } from '@/lib/coderun'
import { cn } from '@/lib/utils'
import { key } from './Window'

const OUT_MAX = 100_000
const LIMIT = { py: 90_000, js: 20_000, sql: 30_000 }

/** Write and run code without leaving the page. Everything runs in this browser; see `lib/coderun.ts`. */
export function Code() {
  const code = useStore((s) => s.widgets.code)
  const setCode = useStore((s) => s.setCode)
  const [lang, setLang] = useState<Lang>('python')
  const text = code?.[lang] ?? STARTERS[lang]
  const kind = LANGS.find((l) => l.id === lang)!.run
  const frame = useRef<HTMLIFrameElement>(null)
  const [out, setOut] = useState<{ s: string; err?: boolean }[]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(0) // bumps to reload the HTML preview
  const run = useRef(0)
  const timer = useRef(0)
  const ready = useRef(false)

  const stop = useCallback((why?: string) => {
    clearTimeout(timer.current)
    frame.current?.contentWindow?.postMessage({ t: 'stop' }, '*')
    setBusy(false); setStatus(why ?? '')
  }, [])

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      const d = e.data as { t: string; s?: string; err?: boolean; id?: number }
      if (d.t === 'ready') { ready.current = true; return }
      if (d.id !== undefined && d.id !== run.current) return
      if (d.t === 'out') setOut((o) => (o.reduce((n, x) => n + x.s.length, 0) > OUT_MAX ? o : [...o, { s: d.s ?? '', err: d.err }]))
      if (d.t === 'status') setStatus(d.s ?? '')
      if (d.t === 'done') { clearTimeout(timer.current); setBusy(false); setStatus('') }
    }
    window.addEventListener('message', on)
    return () => { window.removeEventListener('message', on); clearTimeout(timer.current) }
  }, [])
  useEffect(() => () => frame.current?.contentWindow?.postMessage({ t: 'stop' }, '*'), [])

  const go = () => {
    if (lang === 'html') { setPage((n) => n + 1); return }
    if (!kind || busy) return
    const id = ++run.current
    setOut([]); setBusy(true); setStatus('Starting')
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { stop('Stopped: it ran too long.'); setOut((o) => [...o, { s: 'Stopped after too long. Press Run to start again.\n', err: true }]) }, LIMIT[kind])
    const send = () => frame.current?.contentWindow?.postMessage({ t: 'run', lang: kind, code: text, id }, '*')
    if (ready.current) send(); else setTimeout(send, 250)
  }
  const keys = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go(); return }
    if (e.key === 'Escape') { e.currentTarget.blur(); return }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      const t = e.currentTarget, a = t.selectionStart, b = t.selectionEnd
      setCode(lang, text.slice(0, a) + '  ' + text.slice(b))
      requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = a + 2 })
    }
  }
  const pick = (l: Lang) => { if (busy) stop(); setLang(l); setOut([]) }
  const reset = () => { setCode(lang, STARTERS[lang]); setOut([]) }

  return (
    <div className="grid gap-2">
      <div role="tablist" aria-label="Language" className="flex flex-wrap gap-1">
        {LANGS.map((l) => <button key={l.id} role="tab" aria-selected={lang === l.id} onClick={() => pick(l.id)} className={cn(key, 'h-11 px-3 text-[13px] md:h-9', lang === l.id && 'border-signal bg-signal text-on-signal hover:bg-signal')}>{l.label}</button>)}
      </div>
      <textarea
        data-fill style={{ '--fill': '15rem' } as React.CSSProperties}
        value={text} onChange={(e) => setCode(lang, e.target.value)} onKeyDown={keys}
        aria-label={`${lang} code`} spellCheck={false} autoCapitalize="off" autoCorrect="off"
        className="h-44 w-full resize-none border border-ink/25 bg-transparent p-2 font-mono text-[13px] leading-[1.45] text-ink focus:border-signal"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-ink-2" role="status">{busy ? status : 'Ctrl + Enter runs it. Esc leaves the box.'}</p>
        <div className="flex gap-1">
          <button onClick={reset} className={cn(key, 'h-11 px-3 text-[13px] md:h-9')}>Reset</button>
          {busy
            ? <button onClick={() => stop('Stopped.')} className={cn(key, 'h-11 gap-1.5 px-4 text-[13px] md:h-9')}><Square className="size-3.5" />Stop</button>
            : <button onClick={go} className="inline-flex h-11 items-center gap-1.5 bg-signal px-4 text-sm font-semibold text-on-signal md:h-9"><Play className="size-3.5" />Run</button>}
        </div>
      </div>
      {lang === 'html' ? (
        <iframe key={page} title="Result" sandbox="allow-scripts" srcDoc={htmlDoc(text)} className="h-44 w-full border border-ink/25 bg-white" />
      ) : (
        <pre data-no-drag tabIndex={0} aria-label="Output" aria-live="polite" className="scroll-y max-h-44 min-h-[4rem] whitespace-pre-wrap break-words border border-ink/15 bg-ink/[0.04] p-2 font-mono text-[12.5px] leading-[1.4] text-ink">
          {out.length ? out.map((o, i) => <span key={i} className={o.err ? 'text-signal' : undefined}>{o.s}</span>) : <span className="text-ink-3">Output shows here.</span>}
        </pre>
      )}
      <iframe ref={frame} title="Code runner" sandbox="allow-scripts" srcDoc={RUNNER} className="hidden" aria-hidden />
      <p className="text-[12px] leading-[1.35] text-ink-3">Runs in this browser, in a sealed frame. {lang === 'python' && 'Python and its packages are fetched once from jsDelivr. '}{lang === 'sql' && 'SQL (SQLite) is fetched once from jsDelivr. The database lasts until you stop or close the window. '}{lang === 'html' && 'The page has no network. '}Your code is saved here and sent nowhere.</p>
    </div>
  )
}
