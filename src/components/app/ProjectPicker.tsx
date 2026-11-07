import { Plus, Tag, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { fx_say } from '@/lib/actions'
import { PROJECT_MAX } from '@/lib/review'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * Supporters: label the next session with a project (Maths, Thesis, a client) so Insights can say where the hours went.
 * One quiet button under the length band; the list lives in a sheet. Nothing here is required to lock in.
 */
export function ProjectPicker() {
  const project = useStore((s) => s.settings.project)
  const projects = useStore((s) => s.settings.projects)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const pick = (name: string) => { useStore.getState().setProject(name); setOpen(false) }
  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    if (useStore.getState().addProject(text)) { setText(''); setOpen(false) }
    else fx_say({ title: projects.length >= PROJECT_MAX ? `Up to ${PROJECT_MAX} projects` : 'Pick a name first', description: projects.length >= PROJECT_MAX ? 'Take one off the list to add another. Past sessions keep their label.' : undefined, variant: 'danger' })
  }
  const chip = 'inline-flex h-11 max-w-full items-center gap-2 border px-4 text-sm'
  return (
    <>
      <button onClick={() => setOpen(true)} data-tour="project" aria-label={project ? `Project: ${project}. Change it` : 'Label this session with a project'} className={cn('inline-flex h-11 max-w-[420px] items-center gap-2 border px-4 text-[13px] hover:bg-ink/10', project ? 'border-signal/60 text-ink' : 'border-ink/25 text-ink-2')}>
        <Tag className={cn('size-3.5 shrink-0', project && 'text-signal')} aria-hidden />
        <span className="truncate">{project || 'Add a project'}</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Project</SheetTitle>
            <SheetDescription>Label this session so Insights can show where your hours went. It is optional, and you can change it before every lock-in.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => pick('')} aria-pressed={!project} className={cn(chip, !project ? 'border-signal bg-signal/10 text-ink' : 'border-ink/25 text-ink-2 hover:bg-ink/10')}>No project</button>
              {projects.map((p) => (
                <span key={p} className={cn('inline-flex h-11 max-w-full items-stretch border', p === project ? 'border-signal bg-signal/10' : 'border-ink/25')}>
                  <button onClick={() => pick(p)} aria-pressed={p === project} className="min-w-0 truncate px-4 text-sm text-ink hover:bg-ink/10">{p}</button>
                  <button onClick={() => useStore.getState().removeProject(p)} aria-label={`Take ${p} off the list`} className="grid w-9 place-items-center border-l border-ink/15 text-ink-3 hover:bg-ink/10 hover:text-ink"><X className="size-3.5" /></button>
                </span>
              ))}
            </div>
            <form onSubmit={add} className="mt-4 flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={24} aria-label="New project name" placeholder="New project, for example Thesis" className="h-11 min-w-0 flex-1 border border-ink/30 bg-transparent px-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-signal" />
              <button type="submit" disabled={!text.trim()} className="inline-flex h-11 items-center gap-2 bg-signal px-5 text-sm font-semibold text-on-signal disabled:opacity-40"><Plus className="size-4" />Add</button>
            </form>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  )
}
