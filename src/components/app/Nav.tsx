import { BarChart3, Radio, ShieldCheck, Target, Tv } from 'lucide-react'
import { FloatingActionDock } from '@/components/ui/floating-action-dock'

export type View = 'focus' | 'radio' | 'tv' | 'insights' | 'pledge'

export function Nav({ view, onChange, live }: { view: View; onChange: (v: View) => void; live: boolean }) {
  const items = [
    { id: 'focus', label: 'Focus', icon: <Target />, badge: live },
    { id: 'radio', label: 'Radio', icon: <Radio /> },
    { id: 'tv', label: 'TV', icon: <Tv /> },
    { id: 'insights', label: 'Insights', icon: <BarChart3 /> },
    { id: 'pledge', label: 'Pledge', icon: <ShieldCheck /> },
  ].map((i) => ({ ...i, onClick: () => onChange(i.id as View) }))
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <FloatingActionDock items={items} activeId={view} />
    </nav>
  )
}
