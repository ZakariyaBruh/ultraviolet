import { ArrowLeftRight, Check, Copy, Languages, Volume2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { ALT } from '@/lib/alts'
import { field } from '../Window'
import { AltFrame, getJson, plain, type AltProps } from './kit'

/**
 * Friction Translate, in place of Google Translate. The words go to MyMemory (a free translation service that needs no key and
 * answers browsers), a sentence at a time. It gives about 5,000 characters a day to each network, and says so when that is used.
 */
const LANGS: [string, string][] = [
  ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['nl', 'Dutch'], ['sv', 'Swedish'], ['da', 'Danish'], ['no', 'Norwegian'],
  ['fi', 'Finnish'], ['pl', 'Polish'], ['cs', 'Czech'], ['sk', 'Slovak'], ['hu', 'Hungarian'], ['ro', 'Romanian'], ['bg', 'Bulgarian'], ['el', 'Greek'], ['ru', 'Russian'], ['uk', 'Ukrainian'],
  ['tr', 'Turkish'], ['he', 'Hebrew'], ['ar', 'Arabic'], ['fa', 'Persian'], ['ur', 'Urdu'], ['hi', 'Hindi'], ['bn', 'Bengali'], ['ta', 'Tamil'], ['th', 'Thai'], ['vi', 'Vietnamese'],
  ['id', 'Indonesian'], ['ms', 'Malay'], ['zh-CN', 'Chinese (simplified)'], ['zh-TW', 'Chinese (traditional)'], ['ja', 'Japanese'], ['ko', 'Korean'], ['sw', 'Swahili'], ['af', 'Afrikaans'],
  ['hr', 'Croatian'], ['sr', 'Serbian'], ['ca', 'Catalan'], ['lt', 'Lithuanian'], ['lv', 'Latvian'], ['et', 'Estonian'],
]
const NAME = Object.fromEntries(LANGS)
const MAX = 2000
const known = (c?: string | null) => (c && LANGS.find(([k]) => k.toLowerCase() === c.toLowerCase())?.[0]) || undefined

/** sentences packed into pieces the service accepts (it takes about 500 bytes at a time) */
function pieces(line: string): string[] {
  const out: string[] = []
  let cur = ''
  for (const s of line.split(/(?<=[.!?。！？])\s+/)) {
    for (let at = 0; at < s.length || (at === 0 && !s.length); at += 400) {
      const part = s.slice(at, at + 400)
      if (cur && (cur + ' ' + part).length > 420) { out.push(cur); cur = part } else cur = cur ? `${cur} ${part}` : part
      if (!s.length) break
    }
  }
  if (cur) out.push(cur)
  return out
}

interface Answer { responseData?: { translatedText?: string; detectedLanguage?: string }; responseStatus?: number | string; responseDetails?: string; quotaFinished?: boolean }
async function run(text: string, from: string, to: string): Promise<{ out: string; seen?: string }> {
  let seen: string | undefined
  const lines: string[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) { lines.push(''); continue }
    const done: string[] = []
    for (const p of pieces(line.trim())) {
      const d = (await getJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(p)}&langpair=${encodeURIComponent(from === 'auto' ? 'Autodetect' : from)}%7C${encodeURIComponent(to)}`)) as Answer
      const status = Number(d.responseStatus)
      if (d.quotaFinished || status === 429 || /all available free translations|quota/i.test(d.responseDetails ?? '')) throw new Error('quota')
      if (status !== 200) throw new Error(d.responseDetails || 'failed')
      seen ??= known(d.responseData?.detectedLanguage)
      done.push(plain(d.responseData?.translatedText ?? ''))
    }
    lines.push(done.join(' '))
  }
  return { out: lines.join('\n').trim(), seen }
}

export default function Translate({ hit, onBack, onCloud }: AltProps) {
  const [from, setFrom] = useState(known(hit.sl) ?? 'auto')
  const [to, setTo] = useState(known(hit.tl) ?? (known(navigator.language.split('-')[0]) && navigator.language.split('-')[0] !== 'en' ? known(navigator.language.split('-')[0])! : 'es'))
  const [text, setText] = useState(hit.q ?? '')
  const [out, setOut] = useState('')
  const [seen, setSeen] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const run_ = useRef(0)

  const go = async () => {
    const t = text.trim()
    if (!t) return
    const my = ++run_.current
    setBusy(true); setErr(''); setCopied(false)
    try {
      const r = await run(t, from, to)
      if (my !== run_.current) return
      setOut(r.out); setSeen(r.seen)
    } catch (e) {
      if (my !== run_.current) return
      setOut('')
      setErr((e as Error).message === 'quota' ? 'The free translation service has no more for today on this network. It starts over tomorrow.' : 'The translation service did not answer. Try again in a moment.')
    } finally { if (my === run_.current) setBusy(false) }
  }
  const swap = () => {
    if (from === 'auto') { setFrom(to); setTo(seen && seen !== to ? seen : 'en') } else { setFrom(to); setTo(from) }
    setText(out || text); setOut(text.trim() ? text : ''); setSeen(undefined)
  }
  const copy = async () => { try { await navigator.clipboard.writeText(out); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* the page can still be selected by hand */ } }
  const say = () => {
    try {
      speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(out)
      u.lang = to
      speechSynthesis.speak(u)
    } catch { /* no voices here */ }
  }
  const selectCls = `${field} min-w-0 flex-1 py-0`

  return (
    <AltFrame alt={ALT.translate} site={hit.site === 'DeepL' ? 'DeepL' : 'Google Translate'} cloudUrl={hit.site === 'DeepL' ? 'https://www.deepl.com/translator' : 'https://translate.google.com/'} onBack={onBack} onCloud={onCloud} credit="Translations by MyMemory. Free, about 5,000 characters a day.">
      <div className="scroll-y grid h-full grid-cols-[minmax(0,1fr)] content-start gap-3 p-3">
        <div className="flex items-center gap-2">
          <label className="flex min-w-0 flex-1"><span className="sr-only">Translate from</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls} data-no-drag>
              <option value="auto">{seen ? `Detected: ${NAME[seen] ?? seen}` : 'Detect language'}</option>
              {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </label>
          <button onClick={swap} aria-label="Swap the languages" className="grid size-11 shrink-0 place-items-center border border-ink/30 hover:bg-ink/10"><ArrowLeftRight className="size-4" /></button>
          <label className="flex min-w-0 flex-1"><span className="sr-only">Translate to</span>
            <select value={to} onChange={(e) => setTo(e.target.value)} className={selectCls} data-no-drag>{LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <label className="grid gap-1"><span className="hud">Text</span>
              <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, MAX))} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void go() }} rows={5} placeholder="Type or paste something" spellCheck={false} className={`${field} h-auto min-h-[8rem] resize-none py-2 leading-[1.4]`} data-no-drag />
            </label>
            <div className="flex items-center gap-2">
              <button onClick={() => void go()} disabled={busy || !text.trim()} className="inline-flex h-11 items-center gap-2 bg-signal px-4 text-sm font-semibold text-on-signal disabled:opacity-50"><Languages className="size-4" aria-hidden />{busy ? 'Translating' : 'Translate'}</button>
              <span className="fig text-xs text-ink-3">{text.length} of {MAX}</span>
            </div>
          </div>
          <div className="grid content-start gap-2">
            <p className="hud">{NAME[to] ?? to}</p>
            <div role="status" aria-live="polite" data-no-drag className="min-h-[8rem] whitespace-pre-wrap break-words border border-ink/20 bg-ink/[0.04] p-3 text-[15px] leading-[1.45]">{out || <span className="text-ink-3">The translation shows here.</span>}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => void copy()} disabled={!out} className="inline-flex h-11 items-center gap-1.5 border border-ink/30 px-3 text-sm hover:bg-ink/10 disabled:opacity-40">{copied ? <Check className="size-4 text-ok" aria-hidden /> : <Copy className="size-4" aria-hidden />}{copied ? 'Copied' : 'Copy'}</button>
              {typeof speechSynthesis !== 'undefined' && <button onClick={say} disabled={!out} className="inline-flex h-11 items-center gap-1.5 border border-ink/30 px-3 text-sm hover:bg-ink/10 disabled:opacity-40"><Volume2 className="size-4" aria-hidden />Listen</button>}
            </div>
          </div>
        </div>
        {err && <p role="alert" className="text-[13px] text-bad">{err}</p>}
      </div>
    </AltFrame>
  )
}
