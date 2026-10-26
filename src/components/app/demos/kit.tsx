import { useId, type ReactNode } from 'react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/** every demo tells the lesson when someone first plays with it */
export interface DemoProps { played: () => void }

export const ghost = 'inline-flex h-11 items-center justify-center gap-2 border border-ink/30 px-4 text-sm hover:bg-ink/10 disabled:opacity-40'
export const solid = 'inline-flex h-11 items-center justify-center gap-2 bg-signal px-5 text-sm font-semibold text-on-signal disabled:opacity-40'

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const fmt = (n: number) => n.toLocaleString('en-US')

/** no animation for people who asked for none; the demo just shows where it ends up */
export const calm = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || useStore.getState().settings.motion === 0

/** the shared layout: what to try, the thing to try it on, and what it shows */
export function Frame({ kicker, task, children, note }: { kicker: string; task: string; children: ReactNode; note?: ReactNode }) {
  return (
    <>
      <div className="shrink-0">
        <p className="hud mb-1">Try it · {kicker}</p>
        <p className="max-w-[58ch] text-[15px] leading-[1.4]">{task}</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3">{children}</div>
      {note && <p className="shrink-0 text-[13px] leading-[1.4] text-ink-2">{note}</p>}
    </>
  )
}

export function Slide({ label, value, min, max, step = 1, onChange, show, marks }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; show?: (v: number) => string; marks?: { at: number; label: string }[] }) {
  const id = useId()
  return (
    <div className="shrink-0">
      <label htmlFor={id} className="flex items-baseline justify-between gap-3"><span className="hud">{label}</span><span className="fig text-sm font-semibold">{show ? show(value) : value}</span></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={show ? show(value) : undefined} className="block h-11 w-full accent-signal" />
      {marks && <div className="relative -mt-1 h-5" aria-hidden>{marks.map((m) => <span key={m.label} className="hud absolute whitespace-nowrap text-[12px]" style={{ left: `${((m.at - min) / (max - min)) * 100}%`, transform: `translateX(${m.at <= min ? 0 : m.at >= max ? -100 : -50}%)` }}>{m.label}</span>)}</div>}
    </div>
  )
}

export function Chips<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 flex-wrap gap-1.5">
      {items.map((i) => <button key={i.id} aria-pressed={value === i.id} onClick={() => onChange(i.id)} className={cn('h-11 px-3.5 text-[13px]', value === i.id ? 'bg-ink text-ground' : 'bg-ink/[0.07] text-ink ring-1 ring-ink/12 hover:bg-ink/12')}>{i.label}</button>)}
    </div>
  )
}

/** a labelled bar for readouts; the figure is always written out as well */
export function Meter({ label, value, max, text, strong }: { label: string; value: number; max: number; text: string; strong?: boolean }) {
  return (
    <div className="shrink-0">
      <div className="flex items-baseline justify-between gap-3"><span className="hud">{label}</span><span className="fig text-sm font-semibold">{text}</span></div>
      <div className="mt-1 h-3 border border-ink/30"><i className={cn('block h-full', strong ? 'bg-signal' : 'bg-ink/45')} style={{ width: `${clamp(value / max, 0, 1) * 100}%` }} /></div>
    </div>
  )
}
