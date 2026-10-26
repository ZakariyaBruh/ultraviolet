import { useState, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { key } from './Window'

type Op = '+' | '-' | '×' | '÷'
interface C { cur: string; acc: number | null; op: Op | null; fresh: boolean; line: string }
const START: C = { cur: '0', acc: null, op: null, fresh: true, line: '' }

const show = (n: number) => (Number.isFinite(n) ? String(parseFloat(n.toPrecision(12))) : 'Error')
const run = (a: number, b: number, op: Op) => (op === '+' ? a + b : op === '-' ? a - b : op === '×' ? a * b : b === 0 ? NaN : a / b)

/** One key press. The sum is worked out as you go, left to right, like a pocket calculator. Nothing is ever evaluated as code. */
export function press(c: C, k: string): C {
  if (c.cur === 'Error' && k !== 'C') return press(START, k)
  if (/^\d$/.test(k)) return { ...c, cur: (c.fresh || c.cur === '0' ? k : c.cur === '-0' ? `-${k}` : c.cur + k).slice(0, 14), fresh: false }
  if (k === '.') return c.fresh ? { ...c, cur: '0.', fresh: false } : c.cur.includes('.') ? c : { ...c, cur: c.cur + '.' }
  if (k === '±') return c.cur === '0' ? c : { ...c, cur: c.cur.startsWith('-') ? c.cur.slice(1) : `-${c.cur}` }
  if (k === '%') return { ...c, cur: show(parseFloat(c.cur) / 100), fresh: true }
  if (k === 'C') return START
  if (k === '⌫') {
    if (c.fresh) return c
    const cur = c.cur.length > 1 ? c.cur.slice(0, -1) : '0'
    return { ...c, cur: cur === '-' ? '0' : cur }
  }
  if (k === '+' || k === '-' || k === '×' || k === '÷') {
    const v = parseFloat(c.cur)
    const acc = c.acc !== null && c.op && !c.fresh ? run(c.acc, v, c.op) : v
    return { cur: show(acc), acc: Number.isFinite(acc) ? acc : null, op: Number.isFinite(acc) ? k : null, fresh: true, line: Number.isFinite(acc) ? `${show(acc)} ${k}` : '' }
  }
  if (k === '=') {
    if (c.acc === null || !c.op) return c
    const v = parseFloat(c.cur)
    return { cur: show(run(c.acc, v, c.op)), acc: null, op: null, fresh: true, line: `${show(c.acc)} ${c.op} ${show(v)} =` }
  }
  return c
}

const ROWS = [['C', '⌫', '%', '÷'], ['7', '8', '9', '×'], ['4', '5', '6', '-'], ['1', '2', '3', '+'], ['±', '0', '.', '=']]
const NAMES: Record<string, string> = { C: 'Clear', '⌫': 'Delete', '%': 'Percent', '÷': 'Divide', '×': 'Times', '-': 'Minus', '+': 'Plus', '±': 'Plus or minus', '=': 'Equals', '.': 'Point' }
const KEYMAP: Record<string, string> = { '*': '×', x: '×', '/': '÷', Enter: '=', Backspace: '⌫', Escape: 'C', Delete: 'C', ',': '.' }

/** A four-function calculator, on the keys or on the keyboard. */
export function Calculator() {
  const [c, setC] = useState<C>(START)
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const k = KEYMAP[e.key] ?? e.key
    if (/^[\d.+\-×÷=%C⌫]$/.test(k)) { e.preventDefault(); setC((v) => press(v, k)) }
  }
  return (
    <div className="grid gap-2" onKeyDown={onKey}>
      <div className="border border-ink/25 px-3 py-1.5 text-right" role="status" aria-live="polite" aria-label="Result">
        <p className="fig h-4 truncate text-[12px] text-ink-2">{c.line || ' '}</p>
        <p className="fig truncate text-[1.75rem] font-semibold leading-[1.3]">{c.cur}</p>
      </div>
      <div className="grid grid-cols-4 gap-1" role="group" aria-label="Keys">
        {ROWS.flat().map((k) => (
          <button key={k} onClick={() => setC((v) => press(v, k))} aria-label={NAMES[k] ?? k} className={cn(key, 'h-11', k === '=' && 'bg-signal text-on-signal hover:bg-signal', '÷×-+'.includes(k) && c.op === k && c.fresh && 'border-signal text-signal', 'C⌫%'.includes(k) && 'text-ink-2')}>{k === '-' ? '−' : k}</button>
        ))}
      </div>
    </div>
  )
}
