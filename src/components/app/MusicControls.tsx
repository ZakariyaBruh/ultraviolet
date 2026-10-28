import { Pause, Play } from 'lucide-react'
import { MOODS, type MoodId, useMusic } from '@/lib/music'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/** The music's controls: play or pause, which mood, how loud. Used in Settings and in the Music window. */
export function MusicControls({ compact = false }: { compact?: boolean }) {
  const on = useStore((s) => s.settings.music)
  const mood = useStore((s) => s.settings.musicMood) as MoodId
  const level = useStore((s) => s.settings.musicLevel)
  const set = useStore((s) => s.setSettings)
  const ducked = useMusic((s) => s.ducked)
  const motion = useStore((s) => s.settings.motion)
  const note = MOODS.find((m) => m.id === mood)?.blurb ?? ''
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <button onClick={() => set({ music: !on })} aria-pressed={on} aria-label={on ? 'Pause the music' : 'Play the music'} className="grid size-14 shrink-0 place-items-center bg-signal text-on-signal">
          {on ? <Pause className="size-6" /> : <Play className="size-6" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{on ? (ducked ? 'Waiting for the player' : MOODS.find((m) => m.id === mood)?.name) : 'Music is off'}</p>
          <p className="text-[13px] leading-[1.35] text-ink-2" role="status">{on ? (ducked ? 'A station or podcast is playing, so the music is quiet. It comes back when that stops.' : note) : 'Made as it goes, in your browser. Nothing is downloaded.'}</p>
        </div>
        <span aria-hidden className="flex h-8 shrink-0 items-end gap-[3px]">
          {[0, 1, 2, 3].map((i) => <i key={i} className={cn('w-[3px] bg-signal', on && !ducked && motion > 0 && 'bar-dance')} style={{ height: on && !ducked ? undefined : 4, animationDelay: `${i * 0.17}s` }} />)}
        </span>
      </div>
      <div role="group" aria-label="Mood" className={cn('grid gap-1.5', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
        {MOODS.map((m) => (
          <button key={m.id} aria-pressed={mood === m.id} onClick={() => set({ musicMood: m.id, music: true })} className={cn('h-11 text-[13px]', mood === m.id ? 'bg-ink text-ground' : 'bg-ink/[0.07] text-ink ring-1 ring-ink/12 hover:bg-ink/12')}>{m.name}</button>
        ))}
      </div>
      <label className="flex items-center gap-3 text-[13px] text-ink-2">
        <span className="hud shrink-0">Level</span>
        <input type="range" min={0} max={1} step={0.05} value={level} onChange={(e) => set({ musicLevel: Number(e.target.value) })} aria-label="Music level" className="h-11 min-w-0 flex-1 accent-[var(--signal)]" />
      </label>
    </div>
  )
}
