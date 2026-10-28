import { Calculator as CalcIcon, CloudRain, ListChecks, Music, PartyPopper, RotateCw, NotebookPen, PencilRuler, Scale, Timer as TimerIcon, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { MusicControls } from '@/components/app/MusicControls'
import { Mixer } from '@/components/app/shop/Mixer'
import { Cannon, Spinner } from '@/components/app/shop/Toys'
import { useStore } from '@/lib/store'
import type { ItemId } from '@/lib/credits'
import { Calculator } from './Calculator'
import { Converter } from './Converter'
import { Notepad } from './Notepad'
import { Sketch } from './Sketch'
import { Timer } from './Timer'
import { Todo } from './Todo'

export interface WidgetDef { id: string; name: string; blurb: string; icon: LucideIcon; Body: ComponentType; /** a Shop item that has to be bought before the window exists */ needs?: ItemId }

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
  { id: 'sketch', name: 'Scratch board', blurb: 'Draw a diagram or work a problem by hand. Save it as a picture.', icon: PencilRuler, Body: Sketch },
]
/** the windows this person may use: the free ones, and the ones whose item they own */
export function useAvailableWidgets(): WidgetDef[] {
  const owned = useStore((s) => s.credits?.items?.owned ?? [])
  return WIDGETS.filter((w) => !w.needs || owned.includes(w.needs))
}
export const WIDGET_IDS = WIDGETS.map((w) => w.id)
