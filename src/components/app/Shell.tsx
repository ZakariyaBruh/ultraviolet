import { BarChart3, ClipboardList, FlaskConical, Home, Menu, Moon, Radio, Search, Settings, Sun, Tv, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, type ReactNode } from 'react'
import { Mark } from '@/components/app/Mark'
import { PlayerIsland } from '@/components/app/PlayerIsland'
import { GlassIconButton } from '@/components/app/shared'
import { Glass } from '@/components/app/glass'
import { GlassNavbar } from '@/components/ui/glass-navbar'
import { NotificationBell } from '@/components/ui/notification-bell'
import { useMedia } from '@/lib/hooks'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { cn } from '@/lib/utils'

export type View = 'focus' | 'radio' | 'tv' | 'insights' | 'debrief' | 'lab' | 'settings'

const ic = 'size-4'
export const NAV: { id: View; label: string; icon: ReactNode }[] = [
  { id: 'focus', label: 'Focus', icon: <Home className={ic} /> },
  { id: 'radio', label: 'Radio', icon: <Radio className={ic} /> },
  { id: 'tv', label: 'TV', icon: <Tv className={ic} /> },
  { id: 'insights', label: 'Insights', icon: <BarChart3 className={ic} /> },
  { id: 'debrief', label: 'Debrief', icon: <ClipboardList className={ic} /> },
  { id: 'lab', label: 'Lab', icon: <FlaskConical className={ic} /> },
  { id: 'settings', label: 'Settings', icon: <Settings className={ic} /> },
]
const TABS: View[] = ['focus', 'radio', 'tv', 'insights']

function Brand({ compact }: { compact?: boolean }) {
  const live = useStore((s) => !!s.session && !s.session.paused)
  return (
    <button onClick={() => useUI.getState().set({ landing: true })} aria-label="Friction, show the front page" className="flex min-h-11 items-center gap-2 text-ink">
      <Mark size={compact ? 24 : 22} />
      <span className="dot text-[15px] font-bold uppercase">Friction</span>
      {live && <span className="live-dot" role="status" aria-label="Session running" />}
    </button>
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
      <button onClick={() => { const st = useStore.getState(); st.setSettings({ theme: st.settings.theme === 'dark' ? 'light' : 'dark' }) }} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} className="grid size-11 place-items-center md:size-10 text-ink-2 transition-colors hover:bg-ink/10 hover:text-ink">
        {theme === 'dark' ? <Sun className={ic} /> : <Moon className={ic} />}
      </button>
      <NotificationBell notifications={notifications} onMarkAsRead={mark} onMarkAllAsRead={markAll} />
      <button onClick={() => set({ profileOpen: true })} aria-label="Profile" className="grid size-11 place-items-center bg-signal md:size-9 text-sm font-semibold text-black">
        {(name ?? 'You')[0].toUpperCase()}
      </button>
    </div>
  )
}

export function Shell({ view, onChange, children }: { view: View; onChange: (v: View) => void; children: ReactNode }) {
  const wide = useMedia('(min-width: 1024px)')
  const theatre = useUI((s) => s.theatre)
  const set = useUI((s) => s.set)

  return (
    <div className="relative h-dvh w-screen overflow-hidden text-ink">
      <AnimatePresence initial={false}>
        {!theatre && (
          <motion.div key="chrome" className="contents" exit={{ opacity: 0, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}>
            {wide ? (
              <header className="absolute inset-x-0 top-3 z-40 flex justify-center px-4">
                <GlassNavbar
                  variant="floating"
                  glass
                  brand={<Brand />}
                  brandHref="#focus"
                  activeId={view}
                  className="!static !w-auto"
                  items={NAV.map((n) => ({ id: n.id, label: n.label, href: `#${n.id}`, icon: n.icon, onClick: (e) => { e.preventDefault(); onChange(n.id) } }))}
                  cta={<BarTools />}
                />
              </header>
            ) : (
              <header className="absolute inset-x-0 top-0 z-40 flex h-14 items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
                <Brand compact />
                <BarTools />
              </header>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <main
        id="canvas"
        className={cn('absolute inset-0 overflow-hidden px-4 transition-opacity duration-300 md:px-8 lg:px-12', wide ? 'pb-[112px] pt-[108px]' : 'pb-[calc(138px+env(safe-area-inset-bottom))] pt-[60px]', theatre && 'pointer-events-none opacity-0')}
      >
        <div className="mx-auto h-full w-full max-w-[1240px]">{children}</div>
      </main>

      {/* floating player */}
      <div className={cn('pointer-events-none absolute inset-x-0 z-40 flex justify-center px-3', wide ? 'bottom-4' : 'bottom-[calc(70px+env(safe-area-inset-bottom))]')}>
        <div className="pointer-events-auto"><PlayerIsland /></div>
      </div>

      {theatre && (
        <div className="absolute right-4 top-4 z-50">
          <GlassIconButton label="Exit theatre mode" onClick={() => set({ theatre: false })}><X className={ic} /></GlassIconButton>
        </div>
      )}

      {!wide && !theatre && <TabBar view={view} onChange={onChange} />}
    </div>
  )
}

/** Phone and tablet: a Liquid Glass tab bar with labels. "More" opens the rest. */
function TabBar({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const set = useUI((s) => s.set)
  const items = [...TABS.map((id) => NAV.find((n) => n.id === id)!), { id: 'more' as const, label: 'More', icon: <Menu className={ic} /> }]
  const inMore = !TABS.includes(view)
  return (
    <nav aria-label="Sections" className="absolute inset-x-3 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40">
      <Glass lens radius={30} className="p-1">
        <ul className="grid grid-cols-5">
          {items.map((n) => {
            const on = n.id === 'more' ? inMore : view === n.id
            return (
              <li key={n.id} className="relative">
                <button
                  type="button"
                  onClick={() => (n.id === 'more' ? set({ moreOpen: true }) : onChange(n.id as View))}
                  aria-current={on ? 'page' : undefined}
                  className={cn('relative flex h-[52px] w-full flex-col items-center justify-center gap-0.5 rounded-3xl text-[11px] transition-colors', on ? 'text-ink' : 'text-ink-3')}
                >
                  {on && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-3xl bg-ink/12 ring-1 ring-ink/15" transition={{ type: 'spring', stiffness: 600, damping: 36 }} />}
                  <span className="relative">{n.icon}</span>
                  <span className="relative">{n.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Glass>
    </nav>
  )
}

