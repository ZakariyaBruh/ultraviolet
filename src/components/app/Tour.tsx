import { useEffect, useMemo } from 'react'
import { ProductTour, type TourCloseReason, type TourStep } from '@/components/ui/product-tour'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import type { View } from '@/lib/route'

/** the element if it is on screen (a phone has fewer tabs than a desk), otherwise the whole nav, so a step is never left pointing at nothing */
const tab = (id: string) => () => document.querySelector<HTMLElement>(`[data-tab="${id}"]`) ?? document.querySelector<HTMLElement>('[data-movable="shell-nav"]')

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
    { target: '[data-tour="widgets"]', title: 'Widgets', body: 'This is a deck of study windows. Tap it to deal the cards, press one to open a notepad, calculator, timer or more on this screen, and drag it wherever it helps.', placement: 'bottom' },
    { target: tab('learn'), title: 'Lessons', body: 'Lessons are made from Wikipedia text by fixed rules. No AI writes them, or their questions. A lesson’s demo is built in when there is one for the topic. When there is not, an AI generates it, and it is labelled AI generated.', placement: 'top' },
    { target: tab('arcade'), title: 'Credits', body: 'Focused minutes earn credits. Spend them on games and in the shop, where extras like auto music and the sound machine live (each one shows you how it works when you buy it). Credits are never won in a game.', placement: 'top' },
    { target: tab('settings'), title: 'Make it yours', body: 'Settings has a theme, your own colours, and two dials: Retro, for how old the screen looks, and ASCII, for how many shapes drawn in text roam the page. You can run this tour again from Help.', placement: 'top' },
    { title: 'That is all', body: 'Lock in when you are ready.' },
  ], [])

  // started from Settings: go to the Focus screen first, then show the steps there
  useEffect(() => { if (open && view !== 'focus') go('focus') }, [open, view, go])
  const close = (why: TourCloseReason) => {
    useUI.getState().set({ tourOpen: false })
    setSettings({ toured: true })
    // finishing the walk-through earns the small celebration; skipping it does not
    if (why === 'done') useUI.getState().set({ celebrate: { title: 'You know your way around', detail: 'Lock in when you are ready.' } })
  }
  return <ProductTour steps={steps} open={open && view === 'focus'} onClose={close} />
}

const win = (id: string) => `[data-movable="widget-${id}"]`
/** What each bought window does, shown once when it is unlocked and again from its Shop page. */
const ITEM_STEPS: Record<string, { title: string; steps: TourStep[] }> = {
  sound: { title: 'Sound machine', steps: [
    { target: win('sound'), title: 'Your sound machine', body: 'It sits on the Focus screen as a window you can drag anywhere. Everything in it is made on the spot, nothing is downloaded.', placement: 'left' },
    { target: win('sound'), title: 'Mix it', body: 'Raise the sliders for rain, wind, fire, waves and a low hum. Combine as many as you like. Your mix is remembered, and it keeps going while you are locked in.', placement: 'left' },
  ] },
  spinner: { title: 'Fidget spinner', steps: [
    { target: win('spinner'), title: 'Your fidget spinner', body: 'A toy window on the Focus screen. Drag it anywhere you like.', placement: 'left' },
    { target: win('spinner'), title: 'Flick it', body: 'Press on the spinner, swipe and let go. A harder flick spins longer. Every turn is counted, forever. It is put away while you are locked in.', placement: 'left' },
  ] },
  confetti: { title: 'Confetti cannon', steps: [
    { target: win('confetti'), title: 'Your confetti cannon', body: 'A window on the Focus screen. It needs no reason.', placement: 'left' },
    { target: win('confetti'), title: 'Fire', body: 'Press the button for a rocket and a shower of confetti. It is put away while you are locked in, so save it for when you finish.', placement: 'left' },
  ] },
  music: { title: 'Auto music', steps: [
    { target: win('music'), title: 'Your auto music', body: 'A window on the Focus screen that makes music as it goes, so no session sounds the same.', placement: 'left' },
    { target: win('music'), title: 'Play it', body: 'Press play, pick Calm, Focus, Night or Retro, and set the level. It goes quiet by itself while a song or station plays. Real songs are on the Music screen.', placement: 'left' },
  ] },
}
export const hasItemTour = (id: string) => id in ITEM_STEPS

/** The how-to for a window that was just bought: opens the window on Focus and points at it. */
export function ItemTour({ view, go }: { view: View; go: (v: View) => void }) {
  const id = useUI((s) => s.itemTour)
  const def = id ? ITEM_STEPS[id] : undefined
  useEffect(() => { if (id && view !== 'focus') go('focus') }, [id, view, go])
  const close = () => useUI.getState().set({ itemTour: null })
  if (!def) return null
  return <ProductTour steps={def.steps} open={view === 'focus'} onClose={close} />
}

/** Open a bought window and start its how-to. */
export function showItem(id: string) {
  useStore.getState().setWidget(id, true)
  useUI.getState().set({ itemTour: id })
}
