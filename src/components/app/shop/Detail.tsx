import { useState } from 'react'
import { AsciiSolid } from '@/components/app/AsciiSolid'
import { STRETCHES, useBreath, useStretch } from '@/components/app/BreakKit'
import { Chips, ghost, solid } from '@/components/app/demos/kit'
import { CAPSULE_MAX, SHOP } from '@/lib/credits'
import { SHAPE_NAME, SHAPES, type Shape } from '@/lib/ascii3d'
import { itemsOf, useStore } from '@/lib/store'
import { fx_say } from '@/lib/actions'
import { cn } from '@/lib/utils'

/** Write a note to yourself. It is kept, sealed, until your next finished session. */
export function Capsule() {
  const credits = useStore((s) => s.credits)
  const sealed = itemsOf(credits).capsule
  const [text, setText] = useState('')
  if (sealed) return (
    <div className="grid gap-2">
      <p role="status" className="text-[15px]">Sealed. It opens after your next finished session.</p>
      <p className="text-[13px] text-ink-2">Only one at a time. Finish a session (to the end, not early) and you will hear from yourself.</p>
    </div>
  )
  const seal = () => { if (useStore.getState().sealCapsule(text)) { setText(''); fx_say({ title: 'Sealed', description: 'It opens after your next finished session.', variant: 'success' }) } }
  return (
    <div className="grid gap-2">
      <label htmlFor="capsule" className="hud">A note for the you who just sat down to focus</label>
      <textarea id="capsule" value={text} onChange={(e) => setText(e.target.value.slice(0, CAPSULE_MAX))} rows={3} maxLength={CAPSULE_MAX} placeholder="Remember why you started. Say something kind." className="w-full resize-none border border-ink/30 bg-transparent p-3 text-base text-ink placeholder:text-ink-3 focus:border-signal" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="fig text-[13px] text-ink-2">{text.length} of {CAPSULE_MAX}</span>
        <button onClick={seal} disabled={!text.trim() || credits.bal < SHOP.capsule.price} className={solid}>Seal it · {SHOP.capsule.price} credits</button>
      </div>
    </div>
  )
}

/** Choose what turns in the timer. Every solid can be spun by hand before you pick. */
export function Solids({ owned }: { owned: boolean }) {
  const dial = useStore((s) => itemsOf(s.credits).dial)
  const calm = useStore((s) => s.settings.motion === 0)
  const [pick, setPick] = useState<Shape>((SHAPES.find((s) => s === dial) ?? 'torus') as Shape)
  const using = (dial || 'torus') === pick
  return (
    <div className="grid min-h-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] md:items-center md:gap-6">
      <div className="grid place-items-center overflow-hidden border border-ink/20 bg-ground py-1 text-signal">
        <AsciiSolid shape={pick} cols={46} rows={17} speed={0.9} still={calm} interactive className="text-[8px] md:text-[10px]" />
      </div>
      <div className="grid gap-3">
        <Chips label="Solid" value={pick} onChange={setPick} items={SHAPES.map((s) => ({ id: s, label: SHAPE_NAME[s] }))} />
        <button onClick={() => useStore.getState().setDial(pick === 'torus' ? '' : pick)} disabled={!owned || using} className={cn(solid, 'w-full')}>{using ? 'In the timer now' : 'Use it in the timer'}</button>
        {!owned && <span className="text-[13px] text-ink-2">Buy the pack to put one in the timer. Spinning them is free.</span>}
      </div>
    </div>
  )
}

/** What the break kit looks like, live, so you can try it before you need it. */
export function KitPreview() {
  const { label, left, phase } = useBreath()
  const { text, next } = useStretch()
  const calm = useStore((s) => s.settings.motion === 0) || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  const big = phase === 0 || phase === 1
  return (
    <div className="grid items-center justify-items-center gap-3 text-center md:grid-cols-[10rem_minmax(0,1fr)] md:justify-items-start md:gap-8 md:text-left">
      <div className="grid size-28 place-items-center md:size-40" aria-hidden>
        <div className="grid size-full place-items-center rounded-full border-2 border-signal" style={{ transform: `scale(${big ? 1 : 0.55})`, transition: calm ? 'none' : 'transform 4s ease-in-out' }}>
          <span className="fig dot text-3xl leading-[1.4] text-signal">{left}</span>
        </div>
      </div>
      <div className="grid justify-items-center gap-2 md:justify-items-start">
        <p className="text-lg font-semibold" role="status" aria-live="off">{label}</p>
        <p className="max-w-[40ch] text-[14px] text-ink-2">{text}</p>
        <div className="flex flex-wrap items-center gap-3"><button onClick={next} className={ghost}>Next stretch</button><span className="text-[12px] text-ink-3">{STRETCHES.length} in the deck</span></div>
      </div>
    </div>
  )
}
