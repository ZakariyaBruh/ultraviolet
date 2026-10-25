import { BarChart3, BookOpen, ClipboardList, FlaskConical, Home, Palette, Radio, Search, Settings, Tv, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, type ReactNode } from 'react'
import { Mark } from '@/components/app/Mark'
import { PlayerIsland } from '@/components/app/PlayerIsland'
import { GlassIconButton } from '@/components/app/shared'
import { Glass } from '@/components/app/glass'
import { Tuner } from '@/components/app/Tuner'
import { VideoSlot } from '@/components/app/VideoSlot'
import { NotificationBell } from '@/components/ui/notification-bell'
import { useMedia } from '@/lib/hooks'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { cycleTheme, themeDef } from '@/lib/themeCycle'
import type { View } from '@/lib/route'
import { cn } from '@/lib/utils'

export type { View } from '@/lib/route'

const ic = 'size-4'
export const NAV: { id: View; label: string; icon: ReactNode }[] = [
  { id: 'focus', label: 'Focus', icon: <Home className={ic} /> },
  { id: 'radio', label: 'Radio', icon: <Radio className={ic} /> },
  { id: 'tv', label: 'TV', icon: <Tv className={ic} /> },
  { id: 'books', label: 'Books', icon: <BookOpen className={ic} /> },
  { id: 'insights', label: 'Insights', icon: <BarChart3 className={ic} /> },
  { id: 'debrief', label: 'Debrief', icon: <ClipboardList className={ic} /> },
  { id: 'lab', label: 'Lab', icon: <FlaskConical className={ic} /> },
  { id: 'settings', label: 'Settings', icon: <Settings className={ic} /> },
]

function Brand({ onHome }: { onHome: () => void }) {
  const live = useStore((s) => !!s.session && !s.session.paused)
  return (
    <a href="/" onClick={(e) => { e.preventDefault(); onHome() }} aria-label="Friction, front page" className="flex min-h-11 items-center gap-2 text-ink">
      <Mark size={24} />
      <span className="dot text-[15px] font-bold uppercase">Friction</span>
      {live && <span className="live-dot" role="status" aria-label="Session running" />}
    </a>
  )
}

/** Bell + avatar + search: the right end of the bar. */
export function BarTools() {
  const events = useStore((s) => s.events)
  const name = useStore((s) => s.profile?.name)
  const mark = useStore((s) => s.markEventRead)
  const markAll = useStore((s) => s.markEventsRead)
  const set = useUI((s) => s.set)
  const theme = useStore((s) => s.settings.theme)
  const notifications = useMemo(() => events.slice(0, 30).map((e) => ({ id: e.id, message: e.text, timestamp: new Date(e.t), read: e.read })), [events])
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => set({ searchOpen: true })} aria-label="Search (⌘K)" className="grid size-11 place-items-center md:size-10 text-ink-2 transition-colors hover:bg-ink/10 hover:text-ink">
        <Search className={ic} />
      </button>
      <button onClick={cycleTheme} aria-label={`Theme: ${themeDef(theme).name}. Change theme`} className="grid size-11 place-items-center md:size-10 text-ink-2 transition-colors hover:bg-ink/10 hover:text-ink">
        <Palette className={ic} />
      </button>
      <NotificationBell notifications={notifications} onMarkAsRead={mark} onMarkAllAsRead={markAll} />
      <button onClick={() => set({ profileOpen: true })} aria-label="Profile" className="grid size-11 place-items-center bg-signal md:size-9 text-sm font-semibold text-on-signal">
        {(name ?? 'You')[0].toUpperCase()}
      </button>
    </div>
  )
}

export function Shell({ view, onChange, onHome, children }: { view: View; onChange: (v: View) => void; onHome: () => void; children: ReactNode }) {
  const wide = useMedia('(min-width: 1024px)')
  const theatre = useUI((s) => s.theatre)
  const set = useUI((s) => s.set)

  return (
    <div className="relative h-dvh w-screen overflow-hidden text-ink">
      <AnimatePresence initial={false}>
        {!theatre && (
          <motion.header key="chrome" className="absolute inset-x-0 top-0 z-40 flex h-14 items-center justify-between px-4 pt-[env(safe-area-inset-top)] md:px-8 lg:top-2 lg:px-12" exit={{ opacity: 0, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}>
            <Brand onHome={onHome} />
            <BarTools />
          </motion.header>
        )}
      </AnimatePresence>

      <main
        id="canvas"
        className={cn('absolute inset-0 overflow-hidden px-4 transition-opacity duration-300 md:px-8 lg:px-12', wide ? 'pb-[112px] pt-[76px]' : 'pb-[calc(150px+env(safe-area-inset-bottom))] pt-[60px]', theatre && 'pointer-events-none opacity-0')}
      >
        <div className="mx-auto h-full w-full max-w-[1240px]">{children}</div>
      </main>

      {!theatre && (
        <div className={cn('pointer-events-none absolute inset-x-0 z-40 px-3', wide ? 'bottom-4 mx-auto flex max-w-[1240px] items-end gap-3 px-8 lg:px-12' : 'bottom-[max(0.5rem,env(safe-area-inset-bottom))] grid gap-2')}>
          <div className="pointer-events-auto"><PlayerIsland /></div>
          <Glass radius={4} className="pointer-events-auto min-w-0 flex-1 py-1">
            <Tuner view={view} onChange={onChange} />
          </Glass>
        </div>
      )}

      {theatre && (
        <div className="absolute inset-0 z-30 bg-black"><VideoSlot className="size-full" /></div>
      )}
      {theatre && (
        <div className="absolute right-4 top-4 z-50">
          <GlassIconButton label="Exit theatre mode" onClick={() => set({ theatre: false })}><X className={ic} /></GlassIconButton>
        </div>
      )}
    </div>
  )
}
