import type { TourStep } from '@/components/ui/product-tour'
import { useStore } from './store'
import { useUI } from './ui'

/**
 * The short how-to for a window bought in the Shop: what it says, and the two calls that start it. The walk-through itself
 * (`ItemTour` in `components/app/Tour.tsx`) is fetched when one is started; this file is small enough for the Shop to carry.
 */
const win = (id: string) => `[data-movable="widget-${id}"]`
/** What each bought window does, shown once when it is unlocked and again from its Shop page. */
export const ITEM_STEPS: Record<string, { title: string; steps: TourStep[] }> = {
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


/** a Shop item's window is named after the item, except Auto music, whose window is the Music one */
const WINDOW: Record<string, string> = { automusic: 'music' }
const windowOf = (item: string) => WINDOW[item] ?? item
export const hasItemTour = (item: string) => windowOf(item) in ITEM_STEPS

/** Open a bought window and start its how-to. Takes the Shop item's id (or the window's own). */
export function showItem(item: string) {
  const id = windowOf(item)
  useStore.getState().setWidget(id, true)
  useUI.getState().set({ itemTour: id })
}
