import { Power } from 'lucide-react'
import { Slide, solid, ghost } from '@/components/app/demos/kit'
import { LAYERS, PRESETS, useAmbience } from '@/lib/ambience'
import { itemsOf, useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/** The sound machine: five layers made out of noise, a few starting points, one switch. Used in the Shop and on the Focus screen. */
export function Mixer() {
  const credits = useStore((s) => s.credits)
  const mix = itemsOf(credits).mix
  const volume = useStore((s) => s.settings.volume)
  const { on, start, stop, level, preset } = useAmbience()
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => (on ? stop() : start())} aria-pressed={on} className={cn(on ? solid : ghost, 'min-w-32')}><Power className="size-4" />{on ? 'On' : 'Turn on'}</button>
        <div role="group" aria-label="Starting points" className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => <button key={p.name} onClick={() => { preset(p.mix); if (!on) start() }} className="h-11 bg-ink/[0.07] px-3 text-[13px] text-ink ring-1 ring-ink/12 hover:bg-ink/12">{p.name}</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-5">
        {LAYERS.map((l) => <Slide key={l.id} label={l.name} value={Math.round((mix[l.id] ?? 0) * 100)} min={0} max={100} step={5} onChange={(v) => level(l.id, v / 100)} show={(v) => (v ? `${v}%` : 'off')} />)}
      </div>
      {volume === 0 && <p role="status" className="text-[13px] text-ink-2">The volume in Settings is at zero, so nothing will play.</p>}
    </div>
  )
}
