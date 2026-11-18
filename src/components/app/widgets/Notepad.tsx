import { BookOpen, Copy, Download, PenLine, Plus, Square, Trash2, Volume2 } from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { fx_say } from '@/lib/actions'
import { NOTE_MAX, NOTES_MAX, useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { key } from './Window'

const titleOf = (t: string, i: number) => t.trim().split('\n')[0].replace(/^#+\s*/, '').trim().slice(0, 24) || `Page ${i + 1}`

/** the page as plain sentences for the browser's own voice: Markdown marks and addresses left out, cut into pieces short
 * enough that Chrome does not stop part way through a long one */
function spoken(text: string): string[] {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\(https?:\/\/[^\s)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^#{1,6}\s+/gm, '').replace(/^>\s?/gm, '').replace(/^\s*([-*+]|\d+[.)])\s+(\[[ x]\]\s+)?/gim, '')
    .replace(/[*_`~]+/g, '')
    // each line is its own thought (a heading, an item), so it gets a stop the voice can pause on
    .split('\n').map((l) => l.trim()).filter(Boolean).map((l) => (/[.!?:;]$/.test(l) ? l : `${l}.`)).join(' ')
    .replace(/\s+/g, ' ').trim()
  const out: string[] = []
  for (const s of plain.match(/[^.!?]+[.!?]*\s*/g) ?? []) {
    const t = s.trim()
    if (!t) continue
    if (out.length && (out[out.length - 1] + ' ' + t).length <= 220) out[out.length - 1] += ' ' + t
    else for (let i = 0; i < t.length; i += 220) out.push(t.slice(i, i + 220))
  }
  return out
}

/** **bold**, *italic*, `code`, [links](https://...) and bare https links, as React nodes: nothing from the note is ever read as HTML */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\(https?:\/\/[^\s)]+\))|(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g
  let last = 0, m: RegExpExecArray | null, n = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const s = m[0]
    if (m[1]) out.push(<code key={n++} className="bg-ink/10 px-1 font-mono text-[0.9em]">{s.slice(1, -1)}</code>)
    else if (m[2]) out.push(<strong key={n++}>{s.slice(2, -2)}</strong>)
    else if (m[3]) out.push(<em key={n++}>{s.slice(1, -1)}</em>)
    else {
      const [label, href] = m[4] ? [s.slice(1, s.indexOf('](')), s.slice(s.indexOf('](') + 2, -1)] : [s, s]
      out.push(<a key={n++} href={href} target="_blank" rel="noopener noreferrer" className="text-signal underline">{label}</a>)
    }
    last = m.index + s.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** A small Markdown reader: headings, lists, quotes, code blocks and rules. */
function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  const lines = text.split('\n')
  let i = 0, k = 0
  while (i < lines.length) {
    const l = lines[i]
    if (/^```/.test(l)) {
      const code: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++])
      i++
      blocks.push(<pre key={k++} className="scroll-x my-1 bg-ink/[0.06] p-2 font-mono text-[12.5px] leading-[1.45]">{code.join('\n')}</pre>)
      continue
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(l)
    if (h) { const size = ['text-[19px]', 'text-[17px]', 'text-[15.5px]'][Math.min(2, h[1].length - 1)]; blocks.push(<p key={k++} role="heading" aria-level={Math.min(6, h[1].length + 2)} className={cn('mt-2 mb-1 font-semibold text-ink', size)}>{inline(h[2])}</p>); i++; continue }
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(l)) { blocks.push(<hr key={k++} className="my-2 border-ink/20" />); i++; continue }
    if (/^>\s?/.test(l)) {
      const q: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''))
      blocks.push(<blockquote key={k++} className="my-1 border-l-2 border-signal pl-3 text-ink-2">{q.map((x, j) => <Fragment key={j}>{j > 0 && <br />}{inline(x)}</Fragment>)}</blockquote>)
      continue
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
      const ordered = /^\s*\d/.test(l)
      const items: string[] = []
      while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/).test(lines[i])) items.push(lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, ''))
      const List = ordered ? 'ol' : 'ul'
      blocks.push(<List key={k++} className={cn('my-1 pl-5', ordered ? 'list-decimal' : 'list-disc')}>{items.map((x, j) => <li key={j}>{x.startsWith('[ ] ') ? <>☐ {inline(x.slice(4))}</> : /^\[x\] /i.test(x) ? <>☑ {inline(x.slice(4))}</> : inline(x)}</li>)}</List>)
      continue
    }
    if (!l.trim()) { i++; continue }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|\s*([-*+]|\d+[.)])\s+)/.test(lines[i])) para.push(lines[i++])
    blocks.push(<p key={k++} className="my-1">{para.map((x, j) => <Fragment key={j}>{j > 0 && <br />}{inline(x)}</Fragment>)}</p>)
  }
  return <>{blocks}</>
}

/** A notepad with pages. It saves as you type, in this browser, and nowhere else. Read shows the page as Markdown. */
export function Notepad() {
  const note = useStore((s) => s.widgets.note)
  const saved = useStore((s) => s.widgets.notes)
  const setNotes = useStore((s) => s.setNotes)
  const pages = saved?.length ? saved : [note]
  const [at, setAt] = useState(0)
  const page = Math.min(at, pages.length - 1)
  const text = pages[page] ?? ''
  const [read, setRead] = useState(false)
  const [sure, setSure] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  // about 238 words a minute, the average for silent reading in English
  const mins = words ? Math.max(1, Math.round(words / 238)) : 0
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = useState(false)
  const talking = useRef(false)
  const hush = () => { if (talking.current) speechSynthesis.cancel(); talking.current = false; setSpeaking(false) }
  useEffect(() => hush, [page]) // a new page, or the window closing, stops the voice
  const speak = () => {
    if (!canSpeak) return
    if (talking.current) { hush(); return }
    const parts = spoken(text)
    if (!parts.length) return
    speechSynthesis.cancel()
    parts.forEach((t, i) => {
      const u = new SpeechSynthesisUtterance(t)
      if (i === parts.length - 1) u.onend = () => { talking.current = false; setSpeaking(false) }
      u.onerror = () => { talking.current = false; setSpeaking(false) }
      speechSynthesis.speak(u)
    })
    talking.current = true; setSpeaking(true)
  }
  const write = (t: string) => setNotes(pages.map((p, i) => (i === page ? t : p)))
  const add = () => { if (pages.length >= NOTES_MAX) return; setNotes([...pages, '']); setAt(pages.length); setRead(false) }
  const copy = () => { void navigator.clipboard?.writeText(text).then(() => fx_say({ title: 'Copied', variant: 'success' }), () => fx_say({ title: 'Could not copy', variant: 'warning' })) }
  const save = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${titleOf(text, page).replace(/[^\w -]+/g, '').trim() || 'notes'}.${/^#|\*\*|^- /m.test(text) ? 'md' : 'txt'}`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  // one page: Clear empties it; more than one: Delete takes the page away. Both ask twice.
  const clear = () => {
    if (!sure) { setSure(true); timer.current = window.setTimeout(() => setSure(false), 3000); return }
    setSure(false)
    if (pages.length > 1) { setNotes(pages.filter((_, i) => i !== page)); setAt(Math.max(0, page - 1)) }
    else write('')
  }
  const many = pages.length > 1
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1">
        <div data-no-drag tabIndex={0} role="region" aria-label="Pages" className="scroll-x flex min-w-0 flex-1 gap-1">
          {pages.map((p, i) => (
            <button key={i} onClick={() => { setAt(i); setSure(false) }} aria-pressed={i === page} className={cn('h-11 max-w-[9rem] shrink-0 truncate border px-3 text-[13px] md:h-9', i === page ? 'border-signal text-ink' : 'border-ink/20 text-ink-2 hover:bg-ink/10')}>{titleOf(p, i)}</button>
          ))}
        </div>
        <button onClick={add} disabled={pages.length >= NOTES_MAX} aria-label={pages.length >= NOTES_MAX ? `${NOTES_MAX} pages is the most` : 'New page'} title="New page" className={cn(key, 'size-11 shrink-0 disabled:opacity-40 md:size-9')}><Plus className="size-4" /></button>
        <button onClick={() => setRead((r) => !r)} aria-pressed={read} aria-label={read ? 'Back to writing' : 'Read the page as Markdown'} title={read ? 'Write' : 'Read (Markdown)'} className={cn(key, 'size-11 shrink-0 md:size-9', read && 'border-signal')}>{read ? <PenLine className="size-4" /> : <BookOpen className="size-4" />}</button>
      </div>
      {read ? (
        <div data-fill data-no-drag tabIndex={0} role="region" aria-label={`${titleOf(text, page)}, as Markdown`} style={{ '--fill': '9.75rem' } as React.CSSProperties} className="scroll-y h-44 border border-ink/25 p-2 text-[15px] leading-[1.5] break-words text-ink">
          {text.trim() ? <Markdown text={text} /> : <p className="text-ink-3">Nothing on this page yet.</p>}
        </div>
      ) : (
        <textarea key={page} data-fill style={{ '--fill': '9.75rem' } as React.CSSProperties} value={text} onChange={(e) => write(e.target.value)} maxLength={NOTE_MAX} aria-label={`Notes, ${titleOf(text, page)}`} placeholder={many ? 'The first line names the page.' : 'Write anything. It stays here. # headings, **bold** and - lists show in Read.'} spellCheck className="h-44 w-full resize-none border border-ink/25 bg-transparent p-2 text-[15px] leading-[1.45] text-ink placeholder:text-ink-3 focus:border-signal" />
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="fig text-[12px] text-ink-2" aria-live="off">{words} {words === 1 ? 'word' : 'words'} · {text.length.toLocaleString('en-US')} characters{mins ? ` · ${mins} min read` : ''}{many ? ` · page ${page + 1} of ${pages.length}` : ''}</p>
        <div className="flex gap-1">
          {canSpeak && <button onClick={speak} disabled={!text.trim()} aria-pressed={speaking} aria-label={speaking ? 'Stop reading aloud' : 'Read this page aloud'} title={speaking ? 'Stop' : 'Read aloud'} className={cn(key, 'size-11 disabled:opacity-40 md:size-9', speaking && 'border-signal text-signal')}>{speaking ? <Square className="size-4" /> : <Volume2 className="size-4" />}</button>}
          <button onClick={copy} disabled={!text} aria-label="Copy this page" className={`${key} size-11 disabled:opacity-40 md:size-9`}><Copy className="size-4" /></button>
          <button onClick={save} disabled={!text} aria-label="Save this page as a file" className={`${key} size-11 disabled:opacity-40 md:size-9`}><Download className="size-4" /></button>
          <button onClick={clear} disabled={!text && !many} aria-label={sure ? (many ? 'Press again to delete this page' : 'Press again to clear the notes') : many ? 'Delete this page' : 'Clear the notes'} className={`${key} h-11 px-3 text-[13px] disabled:opacity-40 md:h-9 ${sure ? 'border-signal text-signal' : ''}`}>{sure ? 'Sure?' : <Trash2 className="size-4" />}</button>
        </div>
      </div>
    </div>
  )
}
