import { LayoutPanelTop } from 'lucide-react'
import { Glass } from '@/components/app/glass'
import { useMedia } from '@/lib/hooks'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { WIDGETS } from './defs'
import { WidgetWindow } from './Window'

/** The open windows, floating over the Focus screen. The layer lets everything under it through; only the windows catch the pointer. */
export function WidgetLayer() {
  const open = useStore((s) => s.widgets.open)
  const wide = useMedia('(min-width: 640px)')
  const live = open.map((id) => WIDGETS.find((w) => w.id === id)).filter((w): w is (typeof WIDGETS)[number] => !!w)
  if (!live.length) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {live.map((w, i) => (
        <WidgetWindow key={w.id} id={w.id} title={w.name} index={i} wide={wide}><w.Body /></WidgetWindow>
      ))}
    </div>
  )
}

/** The button on the Focus screen that opens the picker. */
export function WidgetsButton({ className = '' }: { className?: string }) {
  const n = useStore((s) => s.widgets.open.length)
  return (
    <Glass radius={999} clear as="button" data-tour="widgets" onClick={() => useUI.getState().set({ widgetsOpen: true })} aria-label={n ? `Widgets, ${n} open` : 'Widgets'} className={`inline-flex h-11 items-center gap-2 px-4 text-[14px] font-medium text-ink ${className}`}>
      <LayoutPanelTop className="size-4" />Widgets{n > 0 && <span className="fig text-signal">{n}</span>}
    </Glass>
  )
}

/** The picker: every window, with a switch for each. */
export function WidgetsPicker() {
  const open = useStore((s) => s.widgets.open)
  const setWidget = useStore((s) => s.setWidget)
  const closeAll = useStore((s) => s.closeWidgets)
  return (
    <div className="grid gap-2">
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {WIDGETS.map((w) => {
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
