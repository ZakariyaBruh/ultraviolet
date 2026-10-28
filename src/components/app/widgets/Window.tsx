import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Glass } from '@/components/app/glass'
import { useStore } from '@/lib/store'

/**
 * One study window on the Focus screen. It is a panel like any other (grab the title bar or any bare edge and move it),
 * stacked from the top right so a new one never lands exactly on the last.
 */
let front = 30
const STEP = 28

export function WidgetWindow({ id, title, index, wide, large, children }: { id: string; title: string; index: number; wide: boolean; large?: boolean; children: ReactNode }) {
  const setWidget = useStore((s) => s.setWidget)
  const n = index % 5 // after five, start the stack again so a window never lands off the screen
  return (
    <Glass
      data-movable={`widget-${id}`}
      role="group"
      aria-label={title}
      onPointerDownCapture={(e) => { e.currentTarget.style.zIndex = String(++front) }} // whichever you touch comes to the front
      className="win-in pointer-events-auto !absolute flex flex-col"
      style={wide ? { top: 8 + n * STEP, right: 8 + n * STEP, width: large ? 'min(50rem, calc(100% - 1rem))' : 'min(21rem, calc(100% - 1rem))' } : { top: 6 + n * 14, left: 8, right: 8 }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-ink/15 pl-3">
        <h2 className="hud !text-ink">{title}</h2>
        <button onClick={() => setWidget(id, false)} aria-label={`Close ${title}`} className="grid size-11 place-items-center text-ink-2 hover:text-ink md:size-9"><X className="size-4" /></button>
      </div>
      <div className="p-3">{children}</div>
    </Glass>
  )
}

export const field = 'h-11 min-w-0 border border-ink/30 bg-transparent px-3 text-[15px] text-ink placeholder:text-ink-3 focus:border-signal'
export const key = 'inline-flex min-w-0 items-center justify-center border border-ink/25 text-base font-semibold text-ink hover:bg-ink/10 active:bg-ink/20'
