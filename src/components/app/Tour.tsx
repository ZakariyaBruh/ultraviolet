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

/** where things were when a step asked for something to be done (the session length, a window's corner) */
const startMin = { v: 0 }
const startAt = { x: 0, y: 0, down: false }
/** the window's top-left corner on screen, or null when it is not there */
const cornerOf = (sel: string) => { const r = document.querySelector<HTMLElement>(sel)?.getBoundingClientRect(); return r ? { x: r.left, y: r.top } : null }

/**
 * The first-run walk-through, in chapters across the screens, about two minutes. Each step points at one part of a screen and some ask you to
 * do the thing. Only the welcome at the very start is a black title card; moving to the next screen is a plain step. It starts once, after
 * the welcome, and can be run again from Settings > Help.
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

    { id: 'dial', view: 'focus', chapter: 'Focus', target: `${timer} > :first-child`, scope: timer, place: 'right', title: 'This is your clock', body: 'It counts down only while you are locked in and on this tab.' },
    { id: 'length', target: () => document.querySelector<HTMLElement>(`${timer} [role="slider"]`)?.lastElementChild as HTMLElement | null, scope: `${timer} [role="slider"]`, place: 'top', pad: 6, title: 'Pick a length', body: 'The yellow tag is the minutes.', task: 'Drag it left or right', setup: () => { startMin.v = useStore.getState().settings.sessionMin }, done: () => useStore.getState().settings.sessionMin !== startMin.v },
    { id: 'lock', target: withText('button', 'lock in', timer), scope: timer, place: 'bottom', title: 'Then lock in', body: 'Leave this tab for 6 seconds or more and it counts as a drift. Finish and you earn credits.' },
    { id: 'pay', target: '[data-tour="ladder"]', place: 'right', title: 'Longer pays more', body: 'Clean minutes pay 1 credit a minute, then more at each checkpoint: 1.5, 2, 3 and 4. The checkpoints follow the length you pick, so a 25 minute session reaches 4 a minute at 20. A drift starts the climb over.' },
    { id: 'deck', target: '[data-tour="widgets"] button', place: 'bottom', title: 'Study windows', body: 'A deck of tools: notepad, timer, calculator and more.', task: 'Tap the deck', done: () => !!document.querySelector('[role="group"][aria-label="Widgets"]') },
    { id: 'card', target: '[role="group"][aria-label="Widgets"] [aria-label^="Timer"]', scope: '[role="group"][aria-label="Widgets"]', place: 'left', title: 'Open one', body: 'Each card is a window.', task: 'Press the Timer card', setup: (c) => c.onClose(() => { useStore.getState().setWidget('timer', false); useStore.getState().closeWidgets?.() }), done: () => useStore.getState().widgets.open.includes('timer') },
    { id: 'window', target: '[data-movable="widget-timer"]', place: 'bottom', title: 'It floats', body: 'Grab it by the title bar or a bare edge and move it. It stays where you leave it.', task: 'Drag the window',
      // a drag is a press inside the window followed by it actually moving, so a window that settles on its own does not count
      setup: (c) => {
        const at = cornerOf('[data-movable="widget-timer"]')
        startAt.x = at?.x ?? 0; startAt.y = at?.y ?? 0; startAt.down = false
        const down = (e: PointerEvent) => { if ((e.target as Element | null)?.closest?.('[data-movable="widget-timer"]')) startAt.down = true }
        document.addEventListener('pointerdown', down, true)
        c.onClose(() => document.removeEventListener('pointerdown', down, true))
      },
      done: () => { const at = cornerOf('[data-movable="widget-timer"]'); return startAt.down && !!at && Math.hypot(at.x - startAt.x, at.y - startAt.y) > 12 } },
    { id: 'tray', target: '[role="toolbar"][aria-label="Windows"]', place: 'top', title: 'Keep them out of the way', body: 'Hide a window to this tray and it keeps running. Layers puts them in order, makes one see-through or tidies them all.' },
    { id: 'nav', target: tabEl('radio'), scope: '[data-movable="shell-nav"]', place: 'top', title: 'Tabs take you around', body: 'No scrolling, no feed. Visit Radio.', task: 'Tap Radio', done: () => path() === '/radio' },

    { id: 'search', view: 'radio', chapter: 'Tune in', target: 'input[placeholder="Search every station"]', place: 'bottom', title: 'Find a station', body: 'Search looks at every station, not only the chip you are on.', task: 'Type any word', done: () => ((document.querySelector('input[placeholder="Search every station"]') as HTMLInputElement | null)?.value.length ?? 0) > 1 },
    { id: 'player', target: () => document.querySelector<HTMLElement>('[data-movable="shell-player"] [aria-label="Previous"]')?.nextElementSibling as HTMLElement | null, scope: '[data-movable="shell-player"]', place: 'top', title: 'The player', body: 'Play and skip from here on any screen. It never stops when you move around.' },

    { id: 'learn', view: 'learn', chapter: 'Learn', target: 'input[placeholder="Learn about anything"]', place: 'bottom', title: 'Learn anything', body: 'Lessons are built from Wikipedia by fixed rules. No AI writes them.', task: 'Type any subject', done: () => ((document.querySelector('input[placeholder="Learn about anything"]') as HTMLInputElement | null)?.value.length ?? 0) > 1 },

    { id: 'credits', view: 'arcade', chapter: 'Credits', target: '[aria-label="Your credits"]', place: 'bottom', title: 'Your credits', body: 'You earn them by focusing. A game can never win you any.' },
    { id: 'shop', target: withText('button', 'shop'), place: 'bottom', title: 'The Shop', body: 'Breaks, a streak shield, a sound machine and more.', task: 'Open the Shop', done: () => /Sound machine|Long break|Streak shield/i.test(document.getElementById('canvas')?.textContent ?? '') },

    { id: 'dials', view: 'settings', chapter: 'Settings', target: '[role="slider"][aria-label^="Retro"]', scope: '[role="slider"][aria-label^="Retro"]', place: 'top', title: 'Two dials', body: 'Retro changes how old the screen looks. ASCII changes how many text-drawn shapes roam the page. Both are here, under Look.', setup: () => click('button', 'look') },

    { id: 'end', view: 'focus', chapter: 'Done', title: 'That is the tour', body: 'Lock in when you are ready. You can run this again any time from Settings, then Help.' },
  ], [])

  const close = (why: 'done' | 'skip') => {
    useUI.getState().set({ tourOpen: false })
    setSettings({ toured: true })
    // finishing the walk-through earns the small celebration; skipping it does not
    if (why === 'done') useUI.getState().set({ celebrate: { title: 'You know your way around', detail: 'Lock in when you are ready.' } })
  }
  return <Guide steps={steps} open={open} onClose={close} view={view} go={go} label="Tour" />
}

/** The Browser's own first-open walk-through: how to use it like any browser, that it is experimental, and what to do when a site will not run. */
export function BrowserTour({ view, go }: { view: View; go: (v: View) => void }) {
  const open = useUI((s) => s.browserTour)
  const setSettings = useStore((s) => s.setSettings)
  const win = '[data-movable="widget-browser"]'
  const start = `${win} [aria-label="Start pages"]`
  const steps = useMemo<GStep[]>(() => [
    { id: 'b-what', chapter: 'Browser', target: win, place: 'left', title: 'A browser, with a warning', body: 'Use it like any browser. It is experimental, though, and most sites will not work properly here. Games and short-form social media are blocked.' },
    { id: 'b-bar', target: `${win} form input`, scope: `${win} form`, place: 'bottom', title: 'Type an address or search', body: 'Type a site or any words and press Enter. Pages open inside this window.', task: 'Type anything', done: () => ((document.querySelector(`${win} form input`) as HTMLInputElement | null)?.value.length ?? 0) > 1 },
    { id: 'b-tiles', target: start, place: 'left', title: 'Or start from a tile', body: 'Wikipedia opens as it is. YouTube, FrictionX search, Maps, Translate, Scholar and Stack Overflow are versions made here, for sites that do not run.', task: 'Open Wikipedia', done: () => !document.querySelector(start) },
    { id: 'b-back', target: () => document.querySelector<HTMLElement>(`${win} [aria-label="Back"]`), place: 'bottom', title: 'Back works as usual', body: 'Back returns to the last page. Reload is next to the address bar.', task: 'Press Back', done: () => !!document.querySelector(start) },
    { id: 'b-cloud', target: win, place: 'left', title: 'If a site does not work', body: 'If a site has a version made here, you are offered it first. Otherwise press Issues, or Open in the cloud browser when an error shows. It runs the site in a real browser on a remote computer: 30 minutes a day, counted only while you are here.' },
  ], [win, start])
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
