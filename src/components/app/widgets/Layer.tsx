import { LayoutPanelTop } from 'lucide-react'
import { useMedia } from '@/lib/hooks'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
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
    <div className="pointer-events-none absolute inset-0 z-20 [container-type:size]">
      {live.map((w, i) => (
        <WidgetWindow key={w.id} id={w.id} title={w.name} index={i} wide={wide} large={w.large}><w.Body /></WidgetWindow>
      ))}
    </div>
  )
}

/**
 * The button on the Focus screen that opens the picker. A yellow channel block (the count of windows open) beside the label, with two
 * ghost windows stacked behind it that fan out a little on hover: it reads as "a pile of study windows", not as a generic pill.
 */
export function WidgetsButton({ className = '' }: { className?: string }) {
  const n = useStore((s) => s.widgets.open.length)
  return (
    <button type="button" data-tour="widgets" onClick={() => useUI.getState().set({ widgetsOpen: true })} aria-label={n ? `Widgets, ${n} open` : 'Widgets: notes, timer, calculator and more'} className={`group relative mb-2 mr-2 inline-flex h-12 items-stretch text-left text-ink active:translate-x-px active:translate-y-px ${className}`}>
      <span aria-hidden className="pointer-events-none absolute inset-0 translate-x-2 translate-y-2 border border-ink/20 transition-transform duration-200 ease-out group-hover:translate-x-3 group-hover:translate-y-3 motion-reduce:transition-none" />
      <span aria-hidden className="pointer-events-none absolute inset-0 translate-x-1 translate-y-1 border border-ink/35 bg-ground transition-transform duration-200 ease-out group-hover:translate-x-1.5 group-hover:translate-y-1.5 motion-reduce:transition-none" />
      <span className="relative flex items-stretch border border-ink/60 bg-ground transition-colors duration-150 group-hover:border-signal">
        <span className="grid w-12 place-items-center bg-signal text-on-signal" aria-hidden>
          {n > 0 ? <span className="fig text-[19px] font-bold leading-none">{n}</span> : <LayoutPanelTop className="size-5" />}
        </span>
        <span className="grid content-center px-3 pr-4">
          <span className="font-[family-name:var(--font-cond)] text-[18px] font-semibold uppercase leading-none tracking-[0.1em]">Widgets</span>
          <span className="mt-1 text-[11px] leading-none text-ink-3">{n ? `${n} open` : 'Notes, timer, more'}</span>
        </span>
      </span>
    </button>
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
