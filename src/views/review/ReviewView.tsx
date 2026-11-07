import { useEffect, useState } from 'react'
import { Seg } from '@/components/app/shared'
import { useUI } from '@/lib/ui'
import { Coach } from './Coach'
import { Projects } from './Projects'
import { Records } from './Records'
import { Week } from './Week'
import { Year } from './Year'

export const REVIEW_TABS = [
  { id: 'week', label: 'Week' },
  { id: 'projects', label: 'Projects' },
  { id: 'coach', label: 'Coach' },
  { id: 'year', label: 'Year' },
  { id: 'records', label: 'Records' },
]

/** Looking back: a week at a time, where the hours went, what your own numbers say, the year, your records. Free for everyone. */
export function ReviewView() {
  const [tab, setTab] = useState(() => useUI.getState().reviewTab ?? 'week')
  useEffect(() => { if (useUI.getState().reviewTab) useUI.getState().set({ reviewTab: null }) }, [])
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 justify-start"><Seg id="review" value={tab} onChange={setTab} tabs={REVIEW_TABS} /></div>
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
