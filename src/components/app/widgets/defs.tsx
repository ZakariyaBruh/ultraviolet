import { Calculator as CalcIcon, CloudRain, Globe, Sparkles, ListChecks, Music, PartyPopper, RotateCw, NotebookPen, PencilRuler, Scale, Timer as TimerIcon, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { part } from '@/components/app/Part'
import { useStore } from '@/lib/store'
import type { ItemId } from '@/lib/credits'

/**
 * Each window's body is a part of its own (`Part.tsx`), fetched the first time that window is opened: the Browser alone is bigger
 * than any screen, and the Focus screen should not have to wait for windows nobody has open.
 */
const Notepad = part(() => import('./Notepad').then((m) => m.Notepad))
const Calculator = part(() => import('./Calculator').then((m) => m.Calculator))
const Todo = part(() => import('./Todo').then((m) => m.Todo))
const Timer = part(() => import('./Timer').then((m) => m.Timer))
const Converter = part(() => import('./Converter').then((m) => m.Converter))
const Sketch = part(() => import('./Sketch').then((m) => m.Sketch))
const Ask = part(() => import('./Ask').then((m) => m.Ask))
const Browser = part(() => import('./Browser').then((m) => m.Browser))
const MusicControls = part(() => import('@/components/app/MusicControls').then((m) => m.MusicControls))
const Mixer = part(() => import('@/components/app/shop/Mixer').then((m) => m.Mixer))
const Spinner = part(() => import('@/components/app/shop/Toys').then((m) => m.Spinner))
const Cannon = part(() => import('@/components/app/shop/Toys').then((m) => m.Cannon))

/** the windows that work with no connection, fetched ahead of time so that they open offline too (the Browser and Ask AI need the network anyway) */
export const preloadLight = () => Promise.all([Notepad, Calculator, Todo, Timer, Converter, Sketch].map((w) => w.preload())).then(() => undefined)

export interface WidgetDef { id: string; name: string; blurb: string; icon: LucideIcon; Body: ComponentType; /** a Shop item that has to be bought before the window exists */ needs?: ItemId; /** a wide window, for things that need room */ large?: boolean }

/** the toys are put away while a session is running */
const SpinnerBody = () => <Spinner locked={useStore((s) => !!s.session)} />
const CannonBody = () => <Cannon locked={useStore((s) => !!s.session)} />

/** The study windows, in the order they are offered. */
export const WIDGETS: WidgetDef[] = [
  { id: 'notes', name: 'Notepad', blurb: 'Write while you read. It saves as you type and stays in this browser.', icon: NotebookPen, Body: Notepad },
  { id: 'calc', name: 'Calculator', blurb: 'Four functions, on the keys or the keyboard.', icon: CalcIcon, Body: Calculator },
  { id: 'todo', name: 'To-do list', blurb: 'A short list of what to finish before you stop.', icon: ListChecks, Body: Todo },
  { id: 'timer', name: 'Timer', blurb: 'A countdown that rings when it ends, and a stopwatch. It keeps running if you close the window.', icon: TimerIcon, Body: Timer },
  { id: 'convert', name: 'Converter', blurb: 'Length, mass, volume, speed, time and temperature.', icon: Scale, Body: Converter },
  { id: 'music', name: 'Music', blurb: 'Auto music: Calm, Focus, Night or Retro, made as it goes (bought in the Shop). It stays quiet while a song or station plays.', icon: Music, Body: () => <MusicControls compact />, needs: 'automusic' },
  { id: 'sound', name: 'Sound machine', blurb: 'Rain, wind, fire, waves and a low hum, mixed by you.', icon: CloudRain, Body: Mixer, needs: 'sound' },
  { id: 'spinner', name: 'Fidget spinner', blurb: 'Flick it and watch it go. It counts every turn.', icon: RotateCw, Body: SpinnerBody, needs: 'spinner' },
  { id: 'confetti', name: 'Confetti cannon', blurb: 'A rocket and confetti, on demand.', icon: PartyPopper, Body: CannonBody, needs: 'confetti' },
  { id: 'browser', name: 'Browser', blurb: 'The web for studying: search, read and watch YouTube videos. Games and short-form social media are blocked.', icon: Globe, Body: Browser, large: true },
  { id: 'ask', name: 'Ask AI', blurb: 'A study helper you can ask. AI generated, so check what matters.', icon: Sparkles, Body: Ask },
  { id: 'sketch', name: 'Scratch board', blurb: 'Draw a diagram or work a problem by hand. Save it as a picture.', icon: PencilRuler, Body: Sketch },
]
/** the windows this person may use: the free ones, and the ones whose item they own */
export function useAvailableWidgets(): WidgetDef[] {
  const owned = useStore((s) => s.credits?.items?.owned ?? [])
  return WIDGETS.filter((w) => !w.needs || owned.includes(w.needs))
}
export const WIDGET_IDS = WIDGETS.map((w) => w.id)
