import { Calculator as CalcIcon, CloudRain, Globe, Sparkles, ListChecks, Music, PartyPopper, RotateCw, NotebookPen, PencilRuler, Scale, Timer as TimerIcon, type LucideIcon } from 'lucide-react'
import { lazy, type ComponentType } from 'react'
import { useStore } from '@/lib/store'
import type { ItemId } from '@/lib/credits'

function body<T extends Record<string, unknown>>(load: () => Promise<T>, name: keyof T & string) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }))
}
const Notepad = body(() => import('./Notepad'), 'Notepad')
const Calculator = body(() => import('./Calculator'), 'Calculator')
const Todo = body(() => import('./Todo'), 'Todo')
const Timer = body(() => import('./Timer'), 'Timer')
const Converter = body(() => import('./Converter'), 'Converter')
const Ask = body(() => import('./Ask'), 'Ask')
const Browser = body(() => import('./Browser'), 'Browser')
const Sketch = body(() => import('./Sketch'), 'Sketch')
const Mixer = body(() => import('@/components/app/shop/Mixer'), 'Mixer')
const MusicBody = lazy(() => import('@/components/app/MusicControls').then((m) => ({ default: function MusicBody() { return <m.MusicControls compact /> } })))
const SpinnerBody = lazy(() => import('@/components/app/shop/Toys').then((m) => ({ default: function SpinnerBody() { const locked = useStore((s) => !!s.session); return <m.Spinner locked={locked} /> } })))
const CannonBody = lazy(() => import('@/components/app/shop/Toys').then((m) => ({ default: function CannonBody() { const locked = useStore((s) => !!s.session); return <m.Cannon locked={locked} /> } })))

export interface WidgetDef { id: string; name: string; blurb: string; icon: LucideIcon; Body: ComponentType; /** a Shop item that has to be bought before the window exists */ needs?: ItemId; /** a wide window, for things that need room */ large?: boolean }

/** The study windows, in the order they are offered. Each body loads the first time that window opens. */
export const WIDGETS: WidgetDef[] = [
  { id: 'notes', name: 'Notepad', blurb: 'Write while you read. It saves as you type and stays in this browser.', icon: NotebookPen, Body: Notepad },
  { id: 'calc', name: 'Calculator', blurb: 'Four functions, on the keys or the keyboard.', icon: CalcIcon, Body: Calculator },
  { id: 'todo', name: 'To-do list', blurb: 'A short list of what to finish before you stop.', icon: ListChecks, Body: Todo },
  { id: 'timer', name: 'Timer', blurb: 'A countdown that rings when it ends, and a stopwatch. It keeps running if you close the window.', icon: TimerIcon, Body: Timer },
  { id: 'convert', name: 'Converter', blurb: 'Length, mass, volume, speed, time and temperature.', icon: Scale, Body: Converter },
  { id: 'music', name: 'Music', blurb: 'Auto music: Calm, Focus, Night or Retro, made as it goes (bought in the Shop). It stays quiet while a song or station plays.', icon: Music, Body: MusicBody, needs: 'automusic' },
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
