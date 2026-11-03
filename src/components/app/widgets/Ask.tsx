import { Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { field } from './Window'

interface Msg { role: 'user' | 'assistant'; content: string }
/** kept for the visit only: closing the window does not lose the chat, and nothing is written to storage */
let log: Msg[] = []

/** Ask AI: a study helper. The chat goes through our relay (`api/chat.ts`) to free services, and is labelled as AI generated. */
export function Ask() {
  const [msgs, setMsgs] = useState<Msg[]>(log)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { log = msgs; end.current?.scrollIntoView({ block: 'end' }) }, [msgs, busy])

  const send = async (again?: Msg[]) => {
    const t = text.trim()
    const next = again ?? (t ? [...msgs, { role: 'user' as const, content: t.slice(0, 2000) }] : null)
    if (!next || busy) return
    setMsgs(next); setText(''); setBusy(true); setErr(false)
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: next.slice(-12) }), signal: AbortSignal.timeout(45000) })
      const d = (await r.json()) as { text?: string }
      if (!r.ok || !d.text) throw new Error('chat')
      setMsgs([...next, { role: 'assistant', content: d.text }])
    } catch { setErr(true) } finally { setBusy(false) }
  }

  return (
    <div className="grid gap-2">
      <p className="hud !text-[11px] leading-[14px]"><span className="border border-signal px-1 text-signal">AI generated</span> can be wrong · free services · nothing saved</p>
      <div className="scroll-y h-[15rem] border border-ink/15 bg-ink/[0.03] p-2" data-no-drag role="log" aria-live="polite" aria-label="Conversation">
        {!msgs.length && <p className="text-[13px] leading-[1.45] text-ink-2">Ask it to explain something, quiz you, or check your understanding. It does not know you or your notes, and it is not part of any lesson, so check anything important.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'mb-2 ml-6 bg-signal/15 p-2 text-[14px] leading-[1.4]' : 'mb-2 mr-4 border-l-2 border-ink/25 pl-2 text-[14px] leading-[1.45] text-ink'}>
            <span className="hud mb-0.5 block !text-[11px]">{m.role === 'user' ? 'You' : 'AI generated'}</span>
            <span className="whitespace-pre-wrap break-words">{m.content}</span>
          </div>
        ))}
        {busy && <p className="hud" role="status">Thinking…</p>}
        {err && (
          <p role="alert" className="text-[13px] text-bad">That did not go through. <button onClick={() => void send(msgs)} className="underline">Try again</button></p>
        )}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send() }} className="flex gap-2">
        <label className="min-w-0 flex-1"><span className="sr-only">Ask a question</span><input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Ask anything about what you are studying" autoComplete="off" className={`${field} w-full`} data-no-drag /></label>
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="grid size-11 shrink-0 place-items-center bg-signal text-on-signal disabled:opacity-40"><Send className="size-4" /></button>
      </form>
      {msgs.length > 0 && <button onClick={() => { setMsgs([]); setErr(false) }} className="h-11 justify-self-start px-1 text-[13px] text-ink-2 underline hover:text-ink">Clear the chat</button>}
    </div>
  )
}
