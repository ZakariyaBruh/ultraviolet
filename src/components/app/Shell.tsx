import { BarChart3, Radio, Settings, Target, Tv } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Mark } from '@/components/app/Mark'
import { NowPlaying } from '@/components/app/NowPlaying'
import { Sidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'

export type View = 'focus' | 'radio' | 'tv' | 'insights' | 'settings'

const ICON = 'size-[18px]'
export const NAV: { id: View; label: string; icon: ReactNode }[] = [
  { id: 'focus', label: 'Focus', icon: <Target className={ICON} /> },
  { id: 'radio', label: 'Radio', icon: <Radio className={ICON} /> },
  { id: 'tv', label: 'TV', icon: <Tv className={ICON} /> },
  { id: 'insights', label: 'Insights', icon: <BarChart3 className={ICON} /> },
  { id: 'settings', label: 'Settings', icon: <Settings className={ICON} /> },
]

function Brand() {
  const live = useStore((s) => !!s.session && !s.session.paused)
  return (
    <div className="flex min-w-0 items-center gap-2.5 text-ink">
      <Mark size={26} />
      <div className="min-w-0 leading-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          Anti-Scroll
          {live && <span className="live-dot" role="status" aria-label="Session running" />}
        </div>
        <div className="truncate text-[13px] text-ink-2">On this device</div>
      </div>
    </div>
  )
}

export function Shell({ view, onChange, children }: { view: View; onChange: (v: View) => void; children: ReactNode }) {
  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-ground text-ink">
      {/* tablet and desktop: labelled sidebar on the page ground */}
      <Sidebar
        className="!border-r-0 !bg-transparent"
        header={<Brand />}
        sections={[
          { items: NAV.slice(0, 3).map(({ id, label, icon }) => ({ id, label, icon })) },
          { title: 'Review', items: NAV.slice(3).map(({ id, label, icon }) => ({ id, label, icon })) },
        ]}
        activeId={view}
        onActiveChange={(id) => onChange(id as View)}
        footer={<NowPlaying onOpen={() => onChange('focus')} />}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* phone: 48px bar with the screen name */}
        <header className="flex h-12 shrink-0 items-center justify-between px-4 md:hidden">
          <Brand />
        </header>
        <main id="canvas" className="min-h-0 flex-1 overflow-hidden px-4 pb-3 pt-1 md:px-9 md:pb-6 md:pt-8">
          {children}
        </main>
        <aside aria-label="Now playing" className="shrink-0 px-3 md:hidden">
          <NowPlaying onOpen={() => onChange('focus')} className="mb-2" />
        </aside>
        <TabBar view={view} onChange={onChange} />
      </div>
    </div>
  )
}

/** Phone tab bar: five labelled destinations, 44pt targets, safe-area aware. */
function TabBar({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <nav aria-label="Sections" className="shrink-0 border-t border-[var(--border)] bg-surface pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden">
      <ul className="grid grid-cols-5">
        {NAV.map((n) => {
          const on = view === n.id
          return (
            <li key={n.id} className="relative">
              <button
                type="button"
                onClick={() => onChange(n.id)}
                aria-current={on ? 'page' : undefined}
                className={cn('flex h-[52px] w-full flex-col items-center justify-center gap-0.5 text-[11px] transition-colors', on ? 'text-ink' : 'text-ink-3')}
              >
                {on && <motion.span layoutId="tab-on" className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
                <motion.span animate={{ y: on ? -1 : 0, scale: on ? 1.05 : 1 }} transition={{ type: 'spring', stiffness: 600, damping: 32 }}>
                  {n.icon}
                </motion.span>
                {n.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
