import { useEffect, useMemo } from 'react'
import { ProductTour, type TourStep } from '@/components/ui/product-tour'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import type { View } from '@/lib/route'

import { Guide, type GStep } from '@/components/app/Guide'

/** the first element matching `sel` whose text starts with `text` */
const withText = (sel: string, text: string, root = 'body') => () => Array.from(document.querySelectorAll<HTMLElement>(`${root} ${sel}`)).find((e) => (e.textContent ?? '').trim().toLowerCase().startsWith(text)) ?? null
const click = (sel: string, text: string) => withText(sel, text)()?.click()
const timer = '[data-movable="timer"]'
const tabEl = (id: string) => () => document.querySelector<HTMLElement>(`[data-tab="${id}"]`)
const path = () => location.pathname.replace(/\/+$/, '')

/** Opens a bought window's how-to later; the main walk-through below is the long one. */
const startMin = { v: 0 }
const startEra = { v: 0 }
const startAscii = { v: 0 }

/**
 * The first-run walk-through, in chapters across the screens, about two minutes. Each step points at one part of a screen, some ask you to
 * do the thing, and a title card cuts between chapters. It starts once, after the welcome, and can be run again from Settings > Help.
 * It says in plain words what is built by rules, what is AI and what is stored where, since that is what people ask.
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

  const steps = useMemo<GStep[]>(() => [
    { id: 'open', view: 'focus', card: { kicker: 'Friction', title: 'Welcome', lines: ['Nothing here scrolls.', 'Every time you leave is counted.', 'A two-minute tour. Try the things it asks.'] } },

    { id: 'c-focus', view: 'focus', card: { kicker: '1 · Focus', title: 'Lock in' } },
    { id: 'dial', target: `${timer} > :first-child`, scope: timer, place: 'right', title: 'This is your clock', body: 'It counts down only while you are locked in and on this tab.' },
    { id: 'length', target: () => document.querySelector<HTMLElement>(`${timer} [role="slider"]`)?.lastElementChild as HTMLElement | null, scope: `${timer} [role="slider"]`, place: 'top', pad: 6, title: 'Pick a length', body: 'The yellow tag is the minutes.', task: 'Drag it left or right', setup: () => { startMin.v = useStore.getState().settings.sessionMin }, done: () => useStore.getState().settings.sessionMin !== startMin.v },
    { id: 'lock', target: withText('button', 'lock in', timer), scope: timer, place: 'bottom', title: 'Then lock in', body: 'Leave this tab for 6 seconds or more and it counts as a drift. Finish and you earn credits.' },
    { id: 'deck', target: '[data-tour="widgets"] button', place: 'bottom', title: 'Study windows', body: 'A deck of tools: notepad, timer, calculator and more.', task: 'Tap the deck', done: () => !!document.querySelector('[role="group"][aria-label="Widgets"]') },
    { id: 'card', target: '[role="group"][aria-label="Widgets"] [aria-label^="Timer"]', scope: '[role="group"][aria-label="Widgets"]', place: 'left', title: 'Open one', body: 'Each card is a window.', task: 'Press the Timer card', setup: (c) => c.onClose(() => { useStore.getState().setWidget('timer', false); useStore.getState().closeWidgets?.() }), done: () => useStore.getState().widgets.open.includes('timer') },
    { id: 'window', target: '[data-movable="widget-timer"]', place: 'bottom', title: 'It floats', body: 'Drag it by the title bar and it stays where you leave it.' },
    { id: 'nav', target: tabEl('radio'), scope: '[data-movable="shell-nav"]', place: 'top', title: 'Tabs take you around', body: 'No scrolling, no feed. Visit Radio.', task: 'Tap Radio', done: () => path() === '/radio' },

    { id: 'c-radio', view: 'radio', card: { kicker: '2 · Tune in', title: 'Radio and TV' } },
    { id: 'search', target: 'input[placeholder="Search every station"]', place: 'bottom', title: 'Find a station', body: 'Search looks at every station, not only the chip you are on.', task: 'Type any word', done: () => ((document.querySelector('input[placeholder="Search every station"]') as HTMLInputElement | null)?.value.length ?? 0) > 1 },
    { id: 'player', target: () => document.querySelector<HTMLElement>('[data-movable="shell-player"] [aria-label="Previous"]')?.nextElementSibling as HTMLElement | null, scope: '[data-movable="shell-player"]', place: 'top', title: 'The player', body: 'Play and skip from here on any screen. It never stops when you move around.' },

    { id: 'c-learn', view: 'learn', card: { kicker: '3 · Learn', title: 'Lessons' } },
    { id: 'learn', target: 'input[placeholder="Learn about anything"]', place: 'bottom', title: 'Learn anything', body: 'Lessons are built from Wikipedia by fixed rules. No AI writes them.', task: 'Type any subject', done: () => ((document.querySelector('input[placeholder="Learn about anything"]') as HTMLInputElement | null)?.value.length ?? 0) > 1 },

    { id: 'c-credits', view: 'arcade', card: { kicker: '4 · Credits', title: 'Earn, then spend' } },
    { id: 'credits', target: '[aria-label="Your credits"]', place: 'bottom', title: 'Your credits', body: 'You earn them by focusing. A game can never win you any.' },
    { id: 'shop', target: withText('button', 'shop'), place: 'bottom', title: 'The Shop', body: 'Breaks, a streak shield, a sound machine and more.', task: 'Open the Shop', done: () => /Sound machine|Long break|Streak shield/i.test(document.getElementById('canvas')?.textContent ?? '') },

    { id: 'c-look', view: 'settings', card: { kicker: '5 · Settings', title: 'Make it yours' } },
    { id: 'retro', target: '[role="slider"][aria-label^="Retro"]', scope: '[role="slider"][aria-label^="Retro"]', place: 'top', title: 'Retro', body: 'How old the screen looks, from clean to full terminal.', task: 'Slide it one stop', setup: (c) => { click('button', 'look'); startEra.v = useStore.getState().settings.era; c.onClose(() => useStore.getState().setSettings({ era: startEra.v })) }, done: () => useStore.getState().settings.era !== startEra.v },
    { id: 'ascii', target: '[role="slider"][aria-label^="ASCII"]', place: 'top', title: 'ASCII', body: 'How many text-drawn 3D shapes roam the page.', task: 'Slide it one stop', setup: (c) => { startAscii.v = useStore.getState().settings.ascii; c.onClose(() => useStore.getState().setSettings({ ascii: startAscii.v })) }, done: () => useStore.getState().settings.ascii !== startAscii.v },

    { id: 'end', view: 'focus', card: { kicker: 'That is the tour', title: 'Lock in', lines: ['Your dials are back as you had them.', 'Run it again any time: Settings, Help.'] } },
  ], [])

  const close = (why: 'done' | 'skip') => {
    useUI.getState().set({ tourOpen: false })
    setSettings({ toured: true })
    // finishing the walk-through earns the small celebration; skipping it does not
    if (why === 'done') useUI.getState().set({ celebrate: { title: 'You know your way around', detail: 'Lock in when you are ready.' } })
  }
  return <Guide steps={steps} open={open} onClose={close} view={view} go={go} label="Tour" />
}

/** The Browser's own first-open walk-through: what it is, what it will not do, and what happens when a site cannot run here. */
export function BrowserTour({ view, go }: { view: View; go: (v: View) => void }) {
  const open = useUI((s) => s.browserTour)
  const setSettings = useStore((s) => s.setSettings)
  const win = '[data-movable="widget-browser"]'
  const steps = useMemo<GStep[]>(() => [
    { id: 'b-open', card: { kicker: 'Browser', title: 'A browser for studying', lines: ['Small on purpose. Some doors stay shut.'] } },
    { id: 'b-win', target: win, place: 'left', title: 'What it blocks', body: 'Games and short-form social media. A free AI helps screen sites it does not know, from the address and a short excerpt only.' },
    { id: 'b-bar', target: `${win} form input`, scope: `${win} form`, place: 'bottom', title: 'Type or search', body: 'An address, or any words to search.' },
    { id: 'b-alts', target: () => withText('button', 'friction alts', win)(), scope: `${win} [aria-label="Start pages"]`, place: 'left', title: 'Friction alts', body: 'Sites that cannot run here, rebuilt: maps, weather, dictionary and more.', task: 'Open Friction alts', done: () => !document.querySelector(`${win} [aria-label="Start pages"]`) },
    { id: 'b-back', target: () => withText('button', 'back', win)() ?? document.querySelector<HTMLElement>(`${win} [aria-label="Back"]`), place: 'bottom', title: 'Back to start', body: 'Back goes to the last page.', task: 'Press Back', done: () => !!document.querySelector(`${win} [aria-label="Start pages"]`) },
    { id: 'b-cloud', target: win, place: 'left', title: 'When a site will not run', body: 'The cloud browser opens it for you. Its timer shows your 30 minutes a day, and only counts down while you are here. It switches off when you leave.' },
    { id: 'b-end', card: { kicker: 'Browser', title: 'Page not working?', lines: ['Every error has a button for what to try next.'] } },
  ], [win])
  const close = () => { useUI.getState().set({ browserTour: false }); setSettings({ browserToured: true }) }
  return <Guide steps={steps} open={open} onClose={close} view={view} go={go} label="Browser" />
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
