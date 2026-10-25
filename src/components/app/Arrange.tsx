import { Move, RotateCcw } from 'lucide-react'
import { useEffect } from 'react'
import { useLayout, type Offset } from '@/lib/layout'
import { cn } from '@/lib/utils'

const SEL = '[data-movable]'
const STEP = 12

/** Every panel opts in with data-movable; unnamed ones are identified by their order on the page. */
function scan(root: ParentNode = document): { el: HTMLElement; id: string }[] {
  let n = 0
  return Array.from(root.querySelectorAll<HTMLElement>(SEL)).map((el) => ({ el, id: el.dataset.movable || `p${n++}` }))
}
/** Chrome (player, nav) keeps one position everywhere; panels are remembered per screen. */
const scopeOf = (id: string, scope: string) => (id.startsWith('shell-') ? 'shell' : scope)

function paint(el: HTMLElement, o?: Offset) {
  if (o && (o.x || o.y)) {
    el.style.translate = `${o.x}px ${o.y}px`
    el.dataset.moved = 'true'
  } else {
    el.style.removeProperty('translate')
    delete el.dataset.moved
  }
}

/**
 * Makes every [data-movable] panel draggable. Off by default; the Arrange button turns it on.
 * Drag with a pointer, or focus a panel and use the arrow keys (Shift for bigger steps). Positions persist per screen.
 */
export function ArrangeLayer({ scope, reduced }: { scope: string; reduced: boolean }) {
  const arrange = useLayout((s) => s.arrange)
  const offsets = useLayout((s) => s.offsets[scope])
  const shell = useLayout((s) => s.offsets.shell)

  // apply saved offsets whenever panels mount or change
  useEffect(() => {
    let raf = 0
    const apply = () => {
      for (const { el, id } of scan()) paint(el, (id.startsWith('shell-') ? shell : offsets)?.[id])
    }
    const queue = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(apply) }
    apply()
    const mo = new MutationObserver(queue)
    mo.observe(document.body, { childList: true, subtree: true })
    return () => { mo.disconnect(); cancelAnimationFrame(raf) }
  }, [offsets, shell, scope])

  useEffect(() => {
    document.documentElement.toggleAttribute('data-arrange', arrange)
    if (!arrange) return
    const mark = () => {
      for (const { el } of scan()) {
        el.tabIndex = 0
        el.setAttribute('aria-roledescription', 'movable panel')
        el.setAttribute('aria-label', el.getAttribute('aria-label') ?? 'Panel. Arrow keys move it')
      }
    }
    mark()
    const mo = new MutationObserver(mark)
    mo.observe(document.body, { childList: true, subtree: true })

    const get = (id: string) => useLayout.getState().offsets[scopeOf(id, scope)]?.[id] ?? { x: 0, y: 0 }
    const clamp = (el: HTMLElement, id: string, want: Offset): Offset => {
      // keep at least 48px of the panel on screen
      const base = get(id)
      const r = el.getBoundingClientRect()
      const left = r.left - base.x
      const top = r.top - base.y
      const x = Math.min(window.innerWidth - 48 - left, Math.max(48 - (left + r.width), want.x))
      const y = Math.min(window.innerHeight - 48 - top, Math.max(48 - (top + r.height), want.y))
      return { x: Math.round(x), y: Math.round(y) }
    }

    let drag: { el: HTMLElement; id: string; x0: number; y0: number; o: Offset } | null = null
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      const el = (e.target as Element).closest<HTMLElement>(SEL)
      if (!el) return
      const id = scan().find((p) => p.el === el)?.id
      if (!id) return
      e.preventDefault()
      el.setPointerCapture?.(e.pointerId)
      drag = { el, id, x0: e.clientX, y0: e.clientY, o: get(id) }
      el.dataset.dragging = 'true'
    }
    const moveEv = (e: PointerEvent) => {
      if (!drag) return
      const next = clamp(drag.el, drag.id, { x: drag.o.x + e.clientX - drag.x0, y: drag.o.y + e.clientY - drag.y0 })
      paint(drag.el, next)
      drag.el.dataset.live = `${next.x},${next.y}`
    }
    const up = (e: PointerEvent) => {
      if (!drag) return
      const next = clamp(drag.el, drag.id, { x: drag.o.x + e.clientX - drag.x0, y: drag.o.y + e.clientY - drag.y0 })
      delete drag.el.dataset.dragging
      delete drag.el.dataset.live
      useLayout.getState().move(scopeOf(drag.id, scope), drag.id, next)
      drag = null
    }
    const swallow = (e: Event) => { if ((e.target as Element).closest(SEL)) { e.preventDefault(); e.stopPropagation() } }
    const key = (e: KeyboardEvent) => {
      const el = (e.target as Element).closest<HTMLElement>(SEL)
      if (!el || e.target !== el) return
      const d = e.shiftKey ? STEP * 4 : STEP
      const dir = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key]
      if (!dir) return
      e.preventDefault()
      const id = scan().find((p) => p.el === el)?.id
      if (!id) return
      const base = get(id)
      useLayout.getState().move(scopeOf(id, scope), id, clamp(el, id, { x: base.x + dir[0], y: base.y + dir[1] }))
    }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointermove', moveEv, true)
    document.addEventListener('pointerup', up, true)
    document.addEventListener('pointercancel', up, true)
    document.addEventListener('click', swallow, true)
    document.addEventListener('keydown', key)
    return () => {
      mo.disconnect()
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointermove', moveEv, true)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointercancel', up, true)
      document.removeEventListener('click', swallow, true)
      document.removeEventListener('keydown', key)
      for (const { el } of scan()) { el.removeAttribute('tabindex'); el.removeAttribute('aria-roledescription') }
    }
  }, [arrange, scope])

  void reduced
  return null
}

/** Toolbar control: toggles arrange mode; while on, a second button puts everything back. */
export function ArrangeButtons({ scope }: { scope: string }) {
  const arrange = useLayout((s) => s.arrange)
  const set = useLayout((s) => s.setArrange)
  const reset = useLayout((s) => s.reset)
  const moved = useLayout((s) => Object.keys(s.offsets[scope] ?? {}).length > 0)
  return (
    <>
      {arrange && moved && (
        <button onClick={() => reset(scope)} aria-label="Put this screen's panels back" className="grid size-11 place-items-center text-ink-2 hover:bg-ink/10 hover:text-ink md:size-10">
          <RotateCcw className="size-4" />
        </button>
      )}
      <button
        onClick={() => set(!arrange)}
        aria-pressed={arrange}
        aria-label={arrange ? 'Done arranging' : 'Arrange panels: drag them where you want them'}
        className={cn('grid size-11 place-items-center transition-colors md:size-10', arrange ? 'bg-signal text-on-signal' : 'text-ink-2 hover:bg-ink/10 hover:text-ink')}
      >
        <Move className="size-4" />
      </button>
    </>
  )
}
