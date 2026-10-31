import { motion } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { HANDOFF_MIN, canon, receiveData, sendData, showCode } from '@/lib/transfer'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Makes a one-time code that carries this browser's data to another one. The code is shown for ten minutes. */
export function MakeCode({ onCode, compact }: { onCode?: (code: string | null) => void; compact?: boolean }) {
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [left, setLeft] = useState(0)
  const until = useRef(0)
  useEffect(() => {
    if (!code) return
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((until.current - Date.now()) / 1000))
      setLeft(s)
      if (!s) { setCode(null); onCode?.(null) }
    }, 500)
    return () => clearInterval(t)
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps
  const make = async () => {
    setBusy(true); setErr('')
    try {
      const c = await sendData()
      until.current = Date.now() + HANDOFF_MIN * 60_000
      setLeft(HANDOFF_MIN * 60); setCode(c); onCode?.(c)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  if (code) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }} className="grid gap-1.5 border border-signal bg-signal/10 p-3 text-center" role="status">
        <span className="hud text-signal">Your code, once, for {mmss(left)}</span>
        <span className="fig select-all text-[clamp(1.8rem,7vw,2.4rem)] font-bold tracking-[0.12em]" aria-label={`Code ${showCode(code).split('').join(' ')}`}>{showCode(code)}</span>
        {!compact && <span className="text-[13px] leading-[1.4] text-ink-2">Open Friction in the other browser and type it in when it asks. It works one time. The data travels sealed: the server cannot read it.</span>}
      </motion.div>
    )
  }
  return (
    <div className="grid gap-1.5">
      <button type="button" onClick={make} disabled={busy} className="h-11 bg-signal px-4 text-sm font-semibold text-on-signal disabled:opacity-60">{busy ? 'Sealing your data…' : 'Make a code for my data'}</button>
      {err && <p role="alert" className="text-[13px] text-danger">{err}</p>}
    </div>
  )
}

/** Types in a code from the other browser and takes its data. Reloads the page when it works. */
export function EnterCode({ onDone, autoFocus }: { onDone?: () => void; autoFocus?: boolean }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  const go = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErr('')
    try { await receiveData(text); setOk(true); onDone?.() } catch (x) { setErr((x as Error).message); setBusy(false) }
  }
  const shown = canon(text).slice(0, 8)
  return (
    <form onSubmit={go} className="grid gap-1.5">
      <label className="hud" htmlFor="handoff-code">Code from the other browser</label>
      <input id="handoff-code" autoFocus={autoFocus} value={shown.length > 4 ? `${shown.slice(0, 4)}-${shown.slice(4)}` : shown} onChange={(e) => setText(e.target.value)} inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoComplete="off" placeholder="ABCD-EFGH" maxLength={9} className="fig h-12 border border-ink/30 bg-transparent px-3 text-center text-[1.4rem] font-bold tracking-[0.14em] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-signal" />
      <button type="submit" disabled={busy || shown.length !== 8} className="h-11 bg-signal px-4 text-sm font-semibold text-on-signal disabled:opacity-40">{ok ? 'Done, opening…' : busy ? 'Opening the data…' : 'Bring my data here'}</button>
      {err && <p role="alert" className="text-[13px] leading-[1.4] text-danger">{err}</p>}
    </form>
  )
}
