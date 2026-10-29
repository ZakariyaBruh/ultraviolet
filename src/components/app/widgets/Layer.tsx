import { LayoutPanelTop } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMedia } from '@/lib/hooks'
import { useStore } from '@/lib/store'
import { useAvailableWidgets } from './defs'
import { WidgetWindow } from './Window'

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
    <div data-widget-layer className="pointer-events-none absolute inset-0 z-[35] [container-type:size]">
      {live.map((w, i) => (
        <WidgetWindow key={w.id} id={w.id} title={w.name} index={i} wide={wide} large={w.large}><w.Body /></WidgetWindow>
      ))}
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
                      <button key={w.id} type="button" aria-pressed={on} onClick={() => { setWidget(w.id, !on); if (!on && window.innerWidth < 640) deal(false) }} onPointerEnter={() => setHint(w.id)} onFocus={() => setHint(w.id)} onBlur={() => setHint(null)} aria-label={`${w.name}${on ? ', open' : ''}`}
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
          <p aria-live="polite" className="mt-1 min-h-[2.6rem] border-t border-ink/15 pt-2 text-[12px] leading-[1.35] text-ink-2">{hint ? have.find((w) => w.id === hint)?.blurb : n ? 'Press an open window to put it away.' : 'Press a card to open it as a window.'}</p>
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
