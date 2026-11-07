import { Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Panel, Seg } from '@/components/app/shared'
import { openSupport, useSupporter } from '@/lib/supporter'
import { useUI } from '@/lib/ui'
import { Coach } from './Coach'
import { Projects } from './Projects'
import { Records } from './Records'
import { Week } from './Week'
import { Year } from './Year'

export const PLUS_TABS = [
  { id: 'week', label: 'Week' },
  { id: 'projects', label: 'Projects' },
  { id: 'coach', label: 'Coach' },
  { id: 'year', label: 'Year' },
  { id: 'records', label: 'Records' },
]
const ABOUT: [string, string][] = [
  ['Week', 'Each week against the one before, a weekly goal with a streak, and a picture of your week to keep or share.'],
  ['Projects', 'Label a session on the Focus screen and see where your hours went, by week, month or all time.'],
  ['Coach', 'What your own numbers say: the length you finish most, your calmest hours, your strongest day, when in a session you drift.'],
  ['Year', 'Every day of the last 52 weeks in one grid.'],
  ['Records', 'Best day, longest run, longest session, clean finishes and the hour you hold the most.'],
]

/** The supporter tools in Insights. Everyone sees what is here; the numbers appear for supporters. */
export function PlusView() {
  const supporter = useSupporter()
  const [tab, setTab] = useState(() => useUI.getState().plusTab ?? 'week')
  useEffect(() => { if (useUI.getState().plusTab) useUI.getState().set({ plusTab: null }) }, [])
  if (!supporter) {
    return (
      <Panel className="grid h-full min-h-0 content-start gap-4 p-5">
        <Lock className="size-6 text-signal" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold">Plus is for supporters</h2>
          <p className="mt-1 max-w-[60ch] text-[14px] leading-[1.5] text-ink-2">Friction stays free. For $2 a month you also get these tools, all worked out from your own saved numbers on this device.</p>
        </div>
        <ul className="scroll-y grid min-h-0 gap-2 sm:grid-cols-2" data-no-drag>
          {ABOUT.map(([t, d]) => (
            <li key={t} className="grid content-start gap-1 border border-ink/15 bg-ink/[0.03] p-3"><b className="text-[15px] font-semibold">{t}</b><span className="text-[13px] leading-[1.45] text-ink-2">{d}</span></li>
          ))}
        </ul>
        <button className="h-11 justify-self-start bg-signal px-5 text-sm font-semibold text-on-signal" onClick={openSupport}>See Support, $2 a month</button>
      </Panel>
    )
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 justify-start"><Seg id="plus" value={tab} onChange={setTab} tabs={PLUS_TABS} /></div>
      <div className="min-h-0 flex-1 [&>*]:h-full">
        {tab === 'week' && <Week />}
        {tab === 'projects' && <Projects />}
        {tab === 'coach' && <Coach />}
        {tab === 'year' && <Year />}
        {tab === 'records' && <Records />}
      </div>
    </div>
  )
}
