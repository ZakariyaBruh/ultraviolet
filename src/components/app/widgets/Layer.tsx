import { GripVertical, ChevronDown, ChevronUp, Eye, EyeOff, Ghost, LayoutGrid, LayoutPanelTop, Layers, Plus, X } from 'lucide-react'
import { Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMedia } from '@/lib/hooks'
import { useLayout } from '@/lib/layout'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { useAvailableWidgets, type WidgetDef } from './defs'
import { frontWidget, layerOrder, setLayerOrder, stepLayer, WidgetWindow } from './Window'

/**
 * The open windows, floating over the Focus screen. The layer lets everything under it through; only the windows catch the pointer.
 * It is a size container, so a window can be sized to the room the page area really has (`cqh`) and not to the whole screen.
 */
export function WidgetLayer() {
  const open = useStore((s) => s.widgets.open)
  const wide = useMedia('(min-width: 640px)')
  const have = useAvailableWidgets()
  const live = open.map((id) => have.find((w) => w.id === id)).filter((w): w is (typeof have)[number] => !!w)
  if (!live.length) return null
  return (
    <>
      <div data-widget-layer className="pointer-events-none absolute inset-0 z-[35] [container-type:size]">
        {live.map((w, i) => (
          <WidgetWindow key={w.id} id={w.id} title={w.name} index={i} wide={wide} large={w.large}><Suspense fallback={<p className="hud p-3">Opening</p>}><w.Body /></Suspense></WidgetWindow>
        ))}
      </div>
      <LayerTray live={live} />
    </>
  )
}

const NONE: string[] = []
/**
 * Sets the shown windows out so none covers another: the tallest first, each into the first column down the right side that has
 * room, a new column to its left when none has. When they cannot all fit side by side (a wide Browser and three small windows on a
 * laptop), they are stacked from the corner with every title bar showing instead, which still leaves each one easy to reach. The
 * move animates. It only sets the saved positions that dragging sets, so Arrange paints them and keeps them inside the page.
 */
function tidyWindows(hidden: string[]) {
  const layer = document.querySelector<HTMLElement>('[data-widget-layer]')
  if (!layer) return
  const area = layer.getBoundingClientRect()
  const edge = 8, gap = 8, tray = 56
  const items = layerOrder().slice().reverse().filter((id) => !hidden.includes(id)).flatMap((id) => {
    const el = layer.querySelector<HTMLElement>(`[data-movable="widget-${id}"]`)
    if (!el) return []
    const r = el.getBoundingClientRect()
    const k = el.offsetWidth ? r.width / el.offsetWidth : 1
    const ox = Number(el.dataset.ox) || 0, oy = Number(el.dataset.oy) || 0
    return [{ id, w: r.width, h: r.height, k, baseLeft: r.left - ox * k, baseTop: r.top - oy * k }]
  })
  const place = (it: (typeof items)[number], left: number, top: number) => useLayout.getState().move('focus', `widget-${it.id}`, { x: Math.round((left - it.baseLeft) / it.k), y: Math.round((top - it.baseTop) / it.k) })
  const floor = area.bottom - edge - tray
  const cols: { right: number; w: number; y: number; at: { it: (typeof items)[number]; top: number }[] }[] = []
  for (const it of items.slice().sort((a, b) => b.h - a.h)) {
    let col = cols.find((c) => it.w <= c.w + 1 && c.y + it.h <= floor)
    if (!col) {
      const last = cols[cols.length - 1]
      col = { right: last ? last.right - last.w - gap : area.right - edge, w: it.w, y: area.top + edge, at: [] }
      cols.push(col)
    }
    col.at.push({ it, top: col.y })
    col.y += it.h + gap
  }
  const last = cols[cols.length - 1]
  const fits = !last || last.right - last.w >= area.left + edge
  layer.dataset.tidy = 'true'
  setTimeout(() => { delete layer.dataset.tidy }, 450)
  if (fits) for (const c of cols) for (const { it, top } of c.at) place(it, c.right - it.w, top)
  else {
    // the title bar's own height is the step, so every bar shows whole
    const step = (layer.querySelector<HTMLElement>('[data-movable^="widget-"] > div')?.getBoundingClientRect().height ?? 36) + 2
    // the tallest sits at the top and at the back, the smallest lowest and in front, so no title bar is ever under another window
    const stack = items.slice().sort((a, b) => b.h - a.h)
    stack.forEach((it, i) => place(it, area.right - edge - it.w - i * 30, area.top + edge + i * step))
    setLayerOrder(stack.map((it) => it.id).reverse())
  }
}

/**
 * The layer manager. A strip at the foot of the page area has one chip for every open window: press a chip to bring that window
 * to the front, press the front one to tuck it away (it keeps running), press a tucked one to bring it back. Hide all and Show all
 * clear the screen and bring it back in one press. The Layers panel lists the windows front to back with a row of controls each:
 * show or hide, see-through, forward, back and close, plus Tidy, which sets them side by side so none covers another.
 */
function LayerTray({ live }: { live: WidgetDef[] }) {
  const min = useStore((s) => s.widgets.min ?? NONE)
  const ghost = useStore((s) => s.widgets.ghost ?? NONE)
  const minWidget = useStore((s) => s.minWidget)
  const minAll = useStore((s) => s.minAllWidgets)
  const ghostWidget = useStore((s) => s.ghostWidget)
  const setWidget = useStore((s) => s.setWidget)
  const closeAll = useStore((s) => s.closeWidgets)
  const [panel, setPanel] = useState(false)
  const [, bump] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { const f = () => bump((n) => n + 1); addEventListener('friction:layers', f); return () => removeEventListener('friction:layers', f) }, [])
  useEffect(() => {
    if (!panel) return
    const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setPanel(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanel(false) }
    addEventListener('pointerdown', down); addEventListener('keydown', key)
    return () => { removeEventListener('pointerdown', down); removeEventListener('keydown', key) }
  }, [panel])

  const byId = (id: string) => live.find((w) => w.id === id)
  const order = layerOrder().filter((id) => byId(id))
  const frontShown = order.find((id) => !min.includes(id))
  const hiddenAll = live.every((w) => min.includes(w.id))
  const tap = (id: string) => {
    if (min.includes(id)) { minWidget(id, false); requestAnimationFrame(() => frontWidget(id)) }
    else if (id === frontShown) minWidget(id, true)
    else frontWidget(id)
  }
  const small = 'grid size-11 shrink-0 place-items-center text-ink-2 hover:bg-ink/10 hover:text-ink md:size-9'
  return (
    <div className="pointer-events-none absolute inset-0 z-[36]">
      <div ref={box} data-movable="shell-layers" className="pointer-events-auto absolute bottom-2 right-2 flex max-w-[calc(100%-1rem)] justify-end">
        {panel && (
          <div role="group" aria-label="Layers" className="scroll-y absolute bottom-full right-0 mb-2 max-h-[min(60vh,26rem)] w-[min(22rem,calc(100vw-1rem))] border border-ink/50 bg-ground p-2 shadow-[4px_4px_0_0_color-mix(in_srgb,var(--ink)_18%,transparent)]">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="hud !text-[11px]">Layers · front to back</p>
              <button onClick={() => setPanel(false)} aria-label="Close the layers panel" className={small}><X className="size-4" /></button>
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <button onClick={() => minAll(!hiddenAll)} className="inline-flex h-11 items-center gap-1.5 border border-ink/30 px-3 text-[13px] hover:bg-ink/10 md:h-9">{hiddenAll ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}{hiddenAll ? 'Show all' : 'Hide all'}</button>
              <button onClick={() => tidyWindows(min)} className="inline-flex h-11 items-center gap-1.5 border border-ink/30 px-3 text-[13px] hover:bg-ink/10 md:h-9"><LayoutGrid className="size-4" aria-hidden />Tidy up</button>
              <button onClick={closeAll} className="inline-flex h-11 items-center gap-1.5 px-2 text-[13px] text-ink-2 underline hover:text-ink md:h-9">Close all</button>
            </div>
            <ul className="m-0 list-none p-0">
              {order.map((id, i) => {
                const w = byId(id)!
                const hid = min.includes(id)
                const ghosted = ghost.includes(id)
                return (
                  <li key={id} className="flex items-center border-t border-ink/15">
                    <w.icon className="mx-2 size-4 shrink-0 text-ink-2" aria-hidden />
                    <span className={cn('min-w-0 flex-1 truncate text-[14px] leading-tight', hid && 'text-ink-2')}>{w.name}<span className="block text-[11px] text-ink-2">{hid ? 'Hidden' : ghosted ? 'See-through' : id === frontShown ? 'In front' : 'Shown'}</span></span>
                    <button onClick={() => (hid ? tap(id) : minWidget(id, true))} aria-label={`${hid ? 'Show' : 'Hide'} ${w.name}`} title={hid ? 'Show it' : 'Hide it (it keeps running)'} className={small}>{hid ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                    <button onClick={() => ghostWidget(id, !ghosted)} aria-pressed={ghosted} aria-label={`See through ${w.name}`} title="See through it: clicks go to what is behind" className={cn(small, ghosted && 'text-signal')}><Ghost className="size-4" /></button>
                    <button onClick={() => stepLayer(id, 1)} disabled={i === 0} aria-label={`Bring ${w.name} forward`} title="Forward" className={cn(small, 'disabled:opacity-30')}><ChevronUp className="size-4" /></button>
                    <button onClick={() => stepLayer(id, -1)} disabled={i === order.length - 1} aria-label={`Send ${w.name} back`} title="Back" className={cn(small, 'disabled:opacity-30')}><ChevronDown className="size-4" /></button>
                    <button onClick={() => setWidget(id, false)} aria-label={`Close ${w.name}`} title="Close" className={small}><X className="size-4" /></button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        <div role="toolbar" aria-label="Windows" className="flex max-w-full items-center gap-1 border border-ink/40 bg-ground p-1">
          <span title="Drag to move this bar" aria-hidden className="grid h-11 w-5 shrink-0 cursor-grab place-items-center text-ink-3 active:cursor-grabbing md:h-9"><GripVertical className="size-4" /></span>
          <div className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:thin]">
            {live.map((w) => {
              const hid = min.includes(w.id)
              const ghosted = ghost.includes(w.id)
              const here = w.id === frontShown
              return (
                <button key={w.id} onClick={() => tap(w.id)} aria-pressed={!hid} aria-label={`${w.name}, ${hid ? 'hidden. Show it' : here ? 'in front. Hide it' : 'shown. Bring it to the front'}`} title={hid ? `Show ${w.name}` : here ? `Hide ${w.name}` : `Bring ${w.name} to the front`}
                  className={cn('inline-flex h-11 shrink-0 items-center gap-1.5 border px-2.5 font-[family-name:var(--font-cond)] text-[13px] font-semibold uppercase tracking-[0.06em] md:h-9', hid ? 'border-dashed border-ink/30 text-ink-3 hover:text-ink' : here ? 'border-signal bg-signal/10 text-ink' : 'border-ink/40 text-ink hover:border-ink')}>
                  <w.icon className={cn('size-4', hid ? 'text-ink-3' : 'text-signal')} aria-hidden />
                  <span className="max-sm:sr-only">{w.name}</span>
                  {ghosted && <Ghost className="size-3 text-signal" aria-hidden />}
                </button>
              )
            })}
          </div>
          <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-ink/25" />
          <button onClick={() => useUI.getState().set({ widgetsOpen: true })} aria-label="Open another window" title="Open another window" className={small}><Plus className="size-4" /></button>
          <button onClick={() => minAll(!hiddenAll)} aria-label={hiddenAll ? 'Show all windows' : 'Hide all windows'} title={hiddenAll ? 'Show all windows' : 'Hide all windows (they keep running)'} className={small}>{hiddenAll ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
          <button onClick={() => setPanel((v) => !v)} aria-expanded={panel} aria-label="Layers: order, see-through and tidy" title="Layers" className={cn(small, panel && 'bg-ink/10 text-signal')}><Layers className="size-4" /></button>
        </div>
      </div>
    </div>
  )
}

/**
 * The Widgets deck on the Focus screen: a small stack of cards whose top card keeps turning to show what is inside. Tap or hover it
 * and the cards are dealt out in a fan; each card is a window: press one to put it on the screen (it keeps a yellow corner while it
 * is open) and press it again to put it away. Hovering or focusing a card says what it is. Flat and ruled like the rest of the app,
 * no glass; the deal is skipped under calm motion and `prefers-reduced-motion`.
 */
/** how the deck sorts its cards: the study tools, the web and AI, and what has been bought in the Shop */
const GROUPS = [
  { name: 'Study', ids: ['notes', 'calc', 'todo', 'timer', 'convert', 'sketch'] },
  { name: 'Web and AI', ids: ['browser', 'ask'] },
  { name: 'Yours', ids: ['music', 'sound', 'spinner', 'confetti'] },
]

export function WidgetsButton({ className = '' }: { className?: string }) {
  const have = useAvailableWidgets()
  const open = useStore((s) => s.widgets.open)
  const hidden = useStore((s) => s.widgets.min ?? NONE)
  const minWidget = useStore((s) => s.minWidget)
  const setWidget = useStore((s) => s.setWidget)
  const closeAll = useStore((s) => s.closeWidgets)
  const motion = useStore((s) => s.settings.motion)
  const [dealt, setDealt] = useState(false)
  const [seen, setSeen] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const [spot, setSpot] = useState<{ top: number; right: number } | null>(null)
  const deck = useRef<HTMLButtonElement>(null)
  const tray = useRef<HTMLDivElement>(null)
  const still = motion === 0 || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  const n = open.filter((id) => have.some((w) => w.id === id)).length

  // the top card turns every few seconds, so the deck says what it holds
  useEffect(() => {
    if (still || dealt || have.length < 2) return
    const t = setInterval(() => setSeen((i) => i + 1), 2600)
    return () => clearInterval(t)
  }, [still, dealt, have.length])

  const deal = (on: boolean) => {
    if (on && deck.current) {
      const r = deck.current.getBoundingClientRect()
      setSpot({ top: r.bottom + 10, right: Math.max(8, window.innerWidth - r.right - 4) })
    }
    setDealt(on)
    if (!on) setHint(null)
  }

  // outside press and Escape put the cards back
  useEffect(() => {
    if (!dealt) return
    const down = (e: PointerEvent) => { const t = e.target as Node; if (!deck.current?.contains(t) && !tray.current?.contains(t)) deal(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { deal(false); deck.current?.focus() } }
    addEventListener('pointerdown', down)
    addEventListener('keydown', key)
    return () => { removeEventListener('pointerdown', down); removeEventListener('keydown', key) }
  }, [dealt])

  const top = have[seen % Math.max(1, have.length)]
  const TopIcon = top?.icon ?? LayoutPanelTop

  return (
    <div className={`relative ${className}`} data-tour="widgets" onPointerEnter={(e) => { if (e.pointerType === 'mouse') deal(true) }}>
      <button ref={deck} type="button" aria-expanded={dealt} aria-haspopup="true" onClick={() => deal(!dealt)} aria-label={n ? `Widgets, ${n} open. Deal the cards` : 'Widgets: deal the cards'} className="group relative mb-1 mr-1 flex h-14 items-center gap-3 pr-1 text-left text-ink">
        <span aria-hidden className="relative block h-12 w-11">
          <span className="absolute inset-0 origin-bottom-left rotate-[-9deg] border border-ink/25 bg-ground transition-transform duration-200 ease-out group-hover:rotate-[-16deg] motion-reduce:transition-none" />
          <span className="absolute inset-0 origin-bottom-left rotate-[-4deg] border border-ink/40 bg-ground transition-transform duration-200 ease-out group-hover:rotate-[-7deg] motion-reduce:transition-none" />
          <span className="absolute inset-0 grid place-items-center border border-ink/70 bg-ground transition-colors group-hover:border-signal">
            <span key={top?.id} className="grid place-items-center text-signal [animation:deck-flip_320ms_ease-out] motion-reduce:[animation:none]"><TopIcon className="size-5" /></span>
            <span className="absolute left-0 top-0 size-0 border-l-[10px] border-t-[10px] border-l-signal border-t-transparent" style={{ opacity: n ? 1 : 0 }} />
          </span>
        </span>
        <span className="grid content-center">
          <span className="font-[family-name:var(--font-cond)] text-[18px] font-semibold uppercase leading-none tracking-[0.1em]">Widgets</span>
          <span className="mt-1 flex items-center gap-1.5 text-[11px] leading-none text-ink-3">
            {have.slice(0, 6).map((w) => <span key={w.id} aria-hidden className={`size-1.5 ${open.includes(w.id) ? 'bg-signal' : 'bg-ink/25'}`} />)}
            <span>{n ? `${n} open` : 'Tap to deal'}</span>
          </span>
        </span>
      </button>
      {dealt && spot && createPortal(
        <div ref={tray} role="group" aria-label="Widgets" onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHint(null) }} style={{ position: 'fixed', top: spot.top, right: spot.right, width: 'min(calc(100vw - 16px), 22rem)', maxHeight: `calc(100dvh - ${spot.top + 12}px)` }} className="scroll-y z-[70] border border-ink/50 bg-ground p-3 shadow-[4px_4px_0_0_color-mix(in_srgb,var(--ink)_18%,transparent)]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="hud !text-[11px]">{n ? `${n} of ${have.length} open` : `${have.length} windows`}</p>
            {n > 0 && <button type="button" onClick={closeAll} className="h-11 -my-2 shrink-0 px-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-2 underline hover:text-ink">Put all away</button>}
          </div>
          {GROUPS.map((g) => {
            const list = have.filter((w) => g.ids.includes(w.id))
            if (!list.length) return null
            return (
              <div key={g.name} className="mb-3 last:mb-1">
                <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3"><span>{g.name}</span><span aria-hidden className="h-px flex-1 bg-ink/15" /></p>
                <div className="grid grid-cols-3 gap-2">
                  {list.map((w, i) => {
                    const on = open.includes(w.id)
                    const Icon = w.icon
                    return (
                      <button key={w.id} type="button" aria-pressed={on} onClick={() => { if (on && hidden.includes(w.id)) minWidget(w.id, false); else setWidget(w.id, !on); if ((!on || hidden.includes(w.id)) && window.innerWidth < 640) deal(false) }} onPointerEnter={() => setHint(w.id)} onFocus={() => setHint(w.id)} onBlur={() => setHint(null)} aria-label={`${w.name}${on ? (hidden.includes(w.id) ? ', open but hidden. Show it' : ', open') : ''}`}
                        style={{ animationDelay: still ? undefined : `${Math.min(i, 9) * 22}ms` }}
                        className={`wcard ${still ? '[animation:none]' : ''} relative grid min-h-[5.25rem] content-center justify-items-center gap-1.5 border px-1 pb-2 pt-2.5 text-center transition-[translate,border-color,background-color] duration-150 ease-out hover:-translate-y-0.5 focus-visible:-translate-y-0.5 active:scale-95 motion-reduce:transition-none ${on ? 'border-signal bg-signal/10' : 'border-ink/35 hover:border-ink'}`}>
                        <Icon className={`size-6 ${on ? 'text-signal' : 'text-ink'}`} aria-hidden />
                        <span className="font-[family-name:var(--font-cond)] text-[13px] font-semibold uppercase leading-[1.05] tracking-[0.06em]">{w.name}</span>
                        {on && <><span aria-hidden className="absolute left-0 top-0 size-0 border-l-[12px] border-t-[12px] border-l-signal border-t-transparent" /><span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-signal" /></>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <p aria-live="polite" className="mt-1 min-h-[2.6rem] border-t border-ink/15 pt-2 text-[12px] leading-[1.35] text-ink-2">{hint ? have.find((w) => w.id === hint)?.blurb : n ? 'Press an open window to put it away. A hidden one comes back.' : 'Press a card to open it as a window.'}</p>
        </div>, document.body)}
    </div>
  )
}

/** The picker: every window, with a switch for each. */
export function WidgetsPicker() {
  const open = useStore((s) => s.widgets.open)
  const setWidget = useStore((s) => s.setWidget)
  const closeAll = useStore((s) => s.closeWidgets)
  const have = useAvailableWidgets()
  return (
    <div className="grid gap-2">
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {have.map((w) => {
          const on = open.includes(w.id)
          return (
            <li key={w.id}>
              <button role="switch" aria-checked={on} onClick={() => setWidget(w.id, !on)} className={`flex min-h-[4.5rem] w-full items-start gap-3 border p-3 text-left ${on ? 'border-signal bg-signal/10' : 'border-ink/25 hover:bg-ink/5'}`}>
                <w.icon className={`mt-0.5 size-5 shrink-0 ${on ? 'text-signal' : 'text-ink-2'}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2"><span className="text-[15px] font-semibold">{w.name}</span><span className="hud !text-[11px]">{on ? 'Open' : 'Closed'}</span></span>
                  <span className="mt-0.5 block text-[13px] leading-[1.35] text-ink-2">{w.blurb}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {open.length > 0 && <button onClick={closeAll} className="h-11 justify-self-start border border-ink/30 px-4 text-sm hover:bg-ink/10">Close all windows</button>}
    </div>
  )
}
