import { useEffect, useMemo } from 'react'
import { ProductTour, type TourCloseReason, type TourStep } from '@/components/ui/product-tour'
import { MOODS, type MoodId } from '@/lib/music'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import type { View } from '@/lib/route'

/** the element if it is on screen (a phone has fewer tabs than a desk), otherwise the whole nav, so a step is never left pointing at nothing */
const tab = (id: string) => () => document.querySelector<HTMLElement>(`[data-tab="${id}"]`) ?? document.querySelector<HTMLElement>('[data-movable="shell-nav"]')

const btn = 'inline-flex h-11 items-center border border-ink/30 px-4 text-sm text-ink hover:bg-ink/10'

/** One small choice inside the tour: do you want the music? It is off until you say so. */
function MusicChoice() {
  const on = useStore((s) => s.settings.music)
  const mood = useStore((s) => s.settings.musicMood) as MoodId
  const set = useStore((s) => s.setSettings)
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Music">
      {MOODS.map((m) => (
        <button key={m.id} aria-pressed={on && mood === m.id} onClick={() => set({ music: true, musicMood: m.id })} className={`${btn} ${on && mood === m.id ? '!bg-ink !text-ground' : ''}`}>{m.name}</button>
      ))}
      <button aria-pressed={!on} onClick={() => set({ music: false })} className={`${btn} ${!on ? '!bg-ink !text-ground' : ''}`}>Off</button>
    </div>
  )
}

/**
 * The first-run walk-through: about a minute, on the Focus screen. It starts once, after the welcome, and can be run again from
 * Settings > Help. It says in plain words what is built by rules, what is AI and what is stored where, since that is what people ask.
 */
export function Tour({ view, go }: { view: View; go: (v: View) => void }) {
  const open = useUI((s) => s.tourOpen)
  const ready = useStore((s) => !!s.profile && s.seenIntro)
  const toured = useStore((s) => s.settings.toured)
  const setSettings = useStore((s) => s.setSettings)

  // after the welcome, the first time the Focus screen is up and nothing else is asking for attention
  useEffect(() => {
    if (!ready || toured || open || view !== 'focus') return
    const t = setTimeout(() => { if (!useUI.getState().onboardOpen) useUI.getState().set({ tourOpen: true }) }, 1200)
    return () => clearTimeout(t)
  }, [ready, toured, open, view])

  const steps = useMemo<TourStep[]>(() => [
    { title: 'Welcome to Friction', body: 'A short tour, about a minute. Friction counts how often you leave. Nothing in it scrolls, and everything you make stays in this browser.' },
    { target: '[data-movable="timer"]', title: 'Lock in', body: 'Pick a length under the clock, then press Lock in. Leaving this tab for six seconds or more while the timer runs counts as a drift.', placement: 'bottom' },
    { target: '[data-movable="shell-player"]', title: 'Tune in', body: 'Radio, TV and podcasts play from here and carry on across every screen. You can lock in with silence too.', placement: 'top' },
    { target: '[data-movable="shell-nav"]', title: 'Everything is one tap away', body: 'The tabs along the bottom are the way around: radio, TV, podcasts, news, lessons, rooms, books, games and your numbers. On a phone, More holds the rest.', placement: 'top' },
    { target: '[data-tour="widgets"]', title: 'Widgets', body: 'Open a notepad, calculator, to-do list, timer, converter or scratch board as a window on this screen, and drag it wherever it helps.', placement: 'bottom' },
    { target: tab('learn'), title: 'Lessons', body: 'Lessons are made from Wikipedia text by fixed rules. No AI writes them, or their questions. A lesson’s demo is built in when there is one for the topic. When there is not, an AI generates it, and it is labelled AI generated.', placement: 'top' },
    { target: tab('arcade'), title: 'Credits', body: 'Focused minutes earn credits. Spend them on games and in the shop. Credits are never won in a game.', placement: 'top' },
    { title: 'Music', body: (<><span>Friction can play its own music, made as it goes, so no two sessions sound the same. It is off until you turn it on. In Widgets, the Music window also plays whole songs from Audius, 30 second previews of any song, and your Spotify link.</span><MusicChoice /></>) },
    { target: tab('settings'), title: 'Make it yours', body: 'Settings has a theme, your own colours, and two dials: Retro, for how old the screen looks, and ASCII, for how many shapes drawn in text roam the page. You can run this tour again from Help.', placement: 'top' },
    { title: 'That is all', body: 'Lock in when you are ready.' },
  ], [])

  // started from Settings: go to the Focus screen first, then show the steps there
  useEffect(() => { if (open && view !== 'focus') go('focus') }, [open, view, go])
  const close = (_why: TourCloseReason) => { useUI.getState().set({ tourOpen: false }); setSettings({ toured: true }) }
  return <ProductTour steps={steps} open={open && view === 'focus'} onClose={close} />
}
