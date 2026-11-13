import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { PageHeader, Seg } from '@/components/app/shared'
import { spanOf } from '@/lib/insights'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { ReviewView } from '@/views/review/ReviewView'
import { LogTab, SessionsTab } from '@/views/insights/Lists'
import { PatternsTab, RingsTab, TodayTab, TrendsTab } from '@/views/insights/Tabs'

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'patterns', label: 'Patterns' },
  { id: 'trends', label: 'Trends' },
  { id: 'rings', label: 'Rings' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'log', label: 'Log' },
  { id: 'review', label: 'Review' },
]

const drifts = (n: number) => `${n} drift${n === 1 ? '' : 's'}`

/**
 * Looking back. This screen is a page that scrolls, not a set of slides: every number is on it, nothing is cut off, and a finger or a
 * wheel moves it. Its panels stay in the page (they can be made taller or wider, not carried off), because a finger that lands on a panel
 * that can be carried off cannot scroll.
 */
export function InsightsView() {
  const [tab, setTab] = useState(() => useUI.getState().insightsTab ?? 'today')
  useEffect(() => { if (useUI.getState().insightsTab) useUI.getState().set({ insightsTab: null }) }, [])
  const focusLog = useStore((s) => s.focusLog)
  const urgeLog = useStore((s) => s.urgeLog)
  const sessions = useStore((s) => s.sessions)
  const now = spanOf({ focusLog, urgeLog, sessions }, 0, 7)
  const before = spanOf({ focusLog, urgeLog, sessions }, 7, 7)
  const finding = now.perHour !== null && before.perHour !== null
    ? `${drifts(now.perHour)} per focused hour over the last 7 days, against ${before.perHour} over the 7 days before.`
    : now.perHour !== null
      ? `${drifts(now.perHour)} per focused hour over the last 7 days. The 7 days before had too little focus to compare.`
      : 'Ten focused minutes in a day is enough to start comparing weeks.'
  return (
    <section className="flex h-full min-h-0 flex-col gap-3" data-flow>
      <PageHeader kicker="Your attention, measured" title="Insights" sub={finding}>
        <Seg id="ins" value={tab} onChange={setTab} tabs={TABS} />
      </PageHeader>
      {/* a floor, not min-h-0: in a short window the region would shrink to a sliver; with a floor the page overflows instead and the shell's small-window scroll (data-scroll) takes over */}
      <div className="relative min-h-[12rem] flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} className="scroll-y h-full pb-1 pr-1" data-no-drag tabIndex={0} role="region" aria-label={`Insights: ${TABS.find((t) => t.id === tab)?.label}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}>
            {tab === 'today' && <TodayTab />}
            {tab === 'patterns' && <PatternsTab />}
            {tab === 'trends' && <TrendsTab />}
            {tab === 'rings' && <RingsTab />}
            {tab === 'sessions' && <SessionsTab />}
            {tab === 'log' && <LogTab />}
            {tab === 'review' && <ReviewView />}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
