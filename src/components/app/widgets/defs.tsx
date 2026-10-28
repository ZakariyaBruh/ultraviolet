import { Calculator as CalcIcon, ListChecks, Music, NotebookPen, PencilRuler, Scale, Timer as TimerIcon, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { MusicWindow } from '@/components/app/SongsPanel'
import { Calculator } from './Calculator'
import { Converter } from './Converter'
import { Notepad } from './Notepad'
import { Sketch } from './Sketch'
import { Timer } from './Timer'
import { Todo } from './Todo'

export interface WidgetDef { id: string; name: string; blurb: string; icon: LucideIcon; Body: ComponentType }

/** The study windows, in the order they are offered. */
export const WIDGETS: WidgetDef[] = [
  { id: 'notes', name: 'Notepad', blurb: 'Write while you read. It saves as you type and stays in this browser.', icon: NotebookPen, Body: Notepad },
  { id: 'calc', name: 'Calculator', blurb: 'Four functions, on the keys or the keyboard.', icon: CalcIcon, Body: Calculator },
  { id: 'todo', name: 'To-do list', blurb: 'A short list of what to finish before you stop.', icon: ListChecks, Body: Todo },
  { id: 'timer', name: 'Timer', blurb: 'A countdown that rings when it ends, and a stopwatch. It keeps running if you close the window.', icon: TimerIcon, Body: Timer },
  { id: 'convert', name: 'Converter', blurb: 'Length, mass, volume, speed, time and temperature.', icon: Scale, Body: Converter },
  { id: 'music', name: 'Music', blurb: 'Music made as it goes, whole songs from Audius, 30 second previews of any song, or your own Spotify link. The made music steps aside while a song plays.', icon: Music, Body: MusicWindow },
  { id: 'sketch', name: 'Scratch board', blurb: 'Draw a diagram or work a problem by hand. Save it as a picture.', icon: PencilRuler, Body: Sketch },
]
export const WIDGET_IDS = WIDGETS.map((w) => w.id)
