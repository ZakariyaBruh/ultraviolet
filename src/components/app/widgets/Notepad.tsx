import { Copy, Download, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { fx_say } from '@/lib/actions'
import { NOTE_MAX, useStore } from '@/lib/store'
import { key } from './Window'

/** A plain notepad. It saves as you type, in this browser, and nowhere else. */
export function Notepad() {
  const note = useStore((s) => s.widgets.note)
  const setNote = useStore((s) => s.setNote)
  const [sure, setSure] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const words = note.trim() ? note.trim().split(/\s+/).length : 0
  const copy = () => { void navigator.clipboard?.writeText(note).then(() => fx_say({ title: 'Copied', variant: 'success' }), () => fx_say({ title: 'Could not copy', variant: 'warning' })) }
  const save = () => {
    const url = URL.createObjectURL(new Blob([note], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'notes.txt'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const clear = () => {
    if (!sure) { setSure(true); timer.current = window.setTimeout(() => setSure(false), 3000); return }
    setSure(false); setNote('')
  }
  return (
    <div className="grid gap-2">
      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} aria-label="Notes" placeholder="Write anything. It stays here." spellCheck className="h-44 w-full resize-none border border-ink/25 bg-transparent p-2 text-[15px] leading-[1.45] text-ink placeholder:text-ink-3 focus:border-signal" />
      <div className="flex items-center justify-between gap-2">
        <p className="fig text-[12px] text-ink-2" aria-live="off">{words} {words === 1 ? 'word' : 'words'} · {note.length.toLocaleString('en-US')} characters</p>
        <div className="flex gap-1">
          <button onClick={copy} disabled={!note} aria-label="Copy the notes" className={`${key} size-11 disabled:opacity-40 md:size-9`}><Copy className="size-4" /></button>
          <button onClick={save} disabled={!note} aria-label="Save the notes as a text file" className={`${key} size-11 disabled:opacity-40 md:size-9`}><Download className="size-4" /></button>
          <button onClick={clear} disabled={!note} aria-label={sure ? 'Press again to clear the notes' : 'Clear the notes'} className={`${key} h-11 px-3 text-[13px] disabled:opacity-40 md:h-9 ${sure ? 'border-signal text-signal' : ''}`}>{sure ? 'Sure?' : <Trash2 className="size-4" />}</button>
        </div>
      </div>
    </div>
  )
}
