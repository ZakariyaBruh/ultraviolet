import { Ghost, Minus, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Glass } from '@/components/app/glass'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * One study window on the Focus screen. It is a panel like any other (grab the title bar or any bare part and move it, drag an edge or a corner to resize it),
 * stacked from the top right so a new one never lands exactly on the last. Three controls keep it out of the way without losing it:
 * See-through (it fades and clicks go to what is behind it; only its title bar still answers), Hide (it goes to the layer tray and
 * keeps running, so a half-written note or an open page is still there when it comes back) and Close.
 */
let front = 30
const STEP = 28
const LAYER_BASE = 30
/** the windows in the layer, front first (their z-index is the stacking order; the ones never touched sit at the back in the order they opened) */
export function layerOrder(): string[] {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-movable^="widget-"]'))
  return els
    .map((el, i) => ({ id: (el.dataset.movable ?? '').slice('widget-'.length), z: Number(el.style.zIndex) || 0, i }))
    .sort((a, b) => b.z - a.z || b.i - a.i)
    .map((x) => x.id)
}
const announce = () => dispatchEvent(new Event('friction:layers'))
/** put a window above the others in the widget layer */
export const raiseWidget = (el: HTMLElement) => { el.style.zIndex = String(++front); announce() }
export const frontWidget = (id: string) => { const el = document.querySelector<HTMLElement>(`[data-movable="widget-${id}"]`); if (el) raiseWidget(el) }
/** write a stacking order (front first) onto the windows */
export function setLayerOrder(ids: string[]) {
  ids.forEach((id, i) => { const el = document.querySelector<HTMLElement>(`[data-movable="widget-${id}"]`); if (el) el.style.zIndex = String(LAYER_BASE + ids.length - i) })
  front = Math.max(front, LAYER_BASE + ids.length)
  announce()
}
/** move a window one step towards the front (+1) or the back (-1) */
export function stepLayer(id: string, dir: 1 | -1) {
  const order = layerOrder()
  const at = order.indexOf(id)
  const to = at - dir
  if (at < 0 || to < 0 || to >= order.length) return
  ;[order[at], order[to]] = [order[to], order[at]]
  setLayerOrder(order)
}

export function WidgetWindow({ id, title, index, wide, large, children }: { id: string; title: string; index: number; wide: boolean; large?: boolean; children: ReactNode }) {
  const setWidget = useStore((s) => s.setWidget)
  const minWidget = useStore((s) => s.minWidget)
  const ghostWidget = useStore((s) => s.ghostWidget)
  const min = useStore((s) => !!s.widgets.min?.includes(id))
  const ghost = useStore((s) => !!s.widgets.ghost?.includes(id))
  const n = index % 5 // after five, start the stack again so a window never lands off the screen
  const btn = 'grid size-11 place-items-center text-ink-2 hover:text-ink md:size-9'
  return (
    <Glass
      data-movable={`widget-${id}`}
      role="group"
      aria-label={title}
      inert={min}
      data-min={min || undefined}
      data-ghost={ghost || undefined}
      onPointerDownCapture={(e) => raiseWidget(e.currentTarget)} // whichever you touch comes to the front (Arrange also lifts the whole layer over the panels)
      className={cn('win-in pointer-events-auto !absolute flex flex-col transition-[opacity,scale,visibility] duration-150 ease-out motion-reduce:transition-none', min && 'invisible !pointer-events-none scale-95 opacity-0', ghost && !min && '!pointer-events-none opacity-[0.38]')}
      style={wide ? { top: 8 + n * STEP, right: 8 + n * STEP, width: large ? 'min(50rem, calc(100% - 1rem))' : 'min(21rem, calc(100% - 1rem))' } : { top: 6 + n * 26, left: 8, right: 8 }}
    >
      <div className="pointer-events-auto flex shrink-0 items-center justify-between border-b border-ink/15 pl-3">
        <h2 className="hud !text-ink" onDoubleClick={() => minWidget(id, true)}>{title}</h2>
        <div className="flex">
          <button onClick={() => ghostWidget(id, !ghost)} aria-pressed={ghost} aria-label={ghost ? `Make ${title} solid again` : `See through ${title}: clicks go to what is behind it`} title={ghost ? 'Make it solid again' : 'See through it: clicks go to what is behind'} className={cn(btn, ghost && 'text-signal')}><Ghost className="size-4" /></button>
          <button onClick={() => minWidget(id, true)} aria-label={`Hide ${title} to the tray`} title="Hide to the tray (it keeps running)" className={btn}><Minus className="size-4" /></button>
          <button onClick={() => setWidget(id, false)} aria-label={`Close ${title}`} title="Close" className={btn}><X className="size-4" /></button>
        </div>
      </div>
      {/* when the window is resized the body scrolls and the title bar stays put */}
      <div data-win-body className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
    </Glass>
  )
}

export const field = 'h-11 min-w-0 border border-ink/30 bg-transparent px-3 text-[15px] text-ink placeholder:text-ink-3 focus:border-signal'
export const key = 'inline-flex min-w-0 items-center justify-center border border-ink/25 text-base font-semibold text-ink hover:bg-ink/10 active:bg-ink/20'
