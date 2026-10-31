import { Check, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { TODO_MAX, useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { field } from './Window'

/** A short list of things to do before you stop. */
export function Todo() {
  const todos = useStore((s) => s.widgets.todos)
  const { addTodo, toggleTodo, removeTodo, clearDoneTodos } = useStore.getState()
  const [text, setText] = useState('')
  const left = todos.filter((t) => !t.done).length
  const done = todos.length - left
  const submit = (e: FormEvent) => { e.preventDefault(); addTodo(text); setText('') }
  return (
    <div className="grid gap-2">
      <form onSubmit={submit} className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={160} aria-label="New task" placeholder={todos.length >= TODO_MAX ? 'The list is full' : 'Add a task'} disabled={todos.length >= TODO_MAX} className={cn(field, 'flex-1')} />
        <button type="submit" disabled={!text.trim() || todos.length >= TODO_MAX} className="h-11 shrink-0 bg-signal px-4 text-sm font-semibold text-on-signal disabled:opacity-40">Add</button>
      </form>
      {todos.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-ink-2">Nothing on the list. One small task at a time.</p>
      ) : (
        <ul data-no-drag className="scroll-y grid max-h-48 content-start">
          {todos.map((t) => (
            <li key={t.id} className="flex min-h-11 items-center gap-1 border-b border-ink/10 last:border-b-0">
              <button role="checkbox" aria-checked={t.done} onClick={() => toggleTodo(t.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left">
                <span className={cn('grid size-5 shrink-0 place-items-center border', t.done ? 'border-signal bg-signal text-on-signal' : 'border-ink/40')}>{t.done && <Check className="size-3.5" strokeWidth={3} />}</span>
                <span className={cn('min-w-0 break-words text-[15px] leading-[1.3]', t.done && 'text-ink-3 line-through')}>{t.t}</span>
              </button>
              <button onClick={() => removeTodo(t.id)} aria-label={`Remove “${t.t}”`} className="grid size-11 shrink-0 place-items-center text-ink-3 hover:text-ink md:size-9"><X className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
      {todos.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <p className="fig text-[12px] text-ink-2" role="status">{left === 0 ? 'All done' : `${left} to go`}{done > 0 && ` · ${done} done`}</p>
          {done > 0 && <button onClick={clearDoneTodos} className="h-11 px-2 text-[13px] text-signal hover:underline md:h-9">Clear done</button>}
        </div>
      )}
    </div>
  )
}
