import { Check } from 'lucide-react'
import { useMemo } from 'react'
import { Panel } from '@/components/app/shared'
import { ACHIEVEMENTS, factsOf, progressOf, type AchGroup } from '@/lib/achievements'
import { useStore } from '@/lib/store'

const GROUPS: AchGroup[] = ['Focus', 'Habit', 'Learn', 'Credits']
const when = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
/** progress in the words of its own unit: minutes of focus read as hours */
const hrs = (n: number, unit: string) => unit === 'minutes' && n >= 120
const num = (n: number, unit: string) => (hrs(n, unit) ? `${Math.floor(n / 60)}` : `${Math.floor(n)}`)
const count = (n: number, unit: string) => (hrs(n, unit) ? `${Math.floor(n / 60)} hours` : `${Math.floor(n)} ${unit}`)

/** Recognition for what the numbers already show. Worked out from saved data, no credits paid, nothing estimated. */
export function AchievementsTab() {
  const have = useStore((s) => s.achievements)
  const sessions = useStore((s) => s.sessions)
  const focusLog = useStore((s) => s.focusLog)
  const credits = useStore((s) => s.credits)
  const learn = useStore((s) => s.learn)
  const settings = useStore((s) => s.settings)
  const facts = useMemo(() => factsOf({ sessions, focusLog, credits, learn, settings }), [sessions, focusLog, credits, learn, settings])
  const earned = ACHIEVEMENTS.filter((a) => have[a.id]).length
  return (
    <div className="grid gap-4">
      <Panel className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="text-base font-semibold">Achievements</h2>
          <p className="mt-1 max-w-[60ch] text-[13px] leading-[1.45] text-ink-2">Worked out from what you have really done here. They pay no credits and nobody else sees them. Once earned, one stays earned.</p>
        </div>
        <p className="dot text-[34px] font-light leading-none text-ink" aria-label={`${earned} of ${ACHIEVEMENTS.length} earned`}>{earned}<span className="ml-1 text-base text-ink-3">/{ACHIEVEMENTS.length}</span></p>
      </Panel>
      {GROUPS.map((g) => (
        <section key={g} aria-label={g} className="grid gap-2">
          <h3 className="hud">{g}</h3>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
            {ACHIEVEMENTS.filter((a) => a.group === g).map((a) => {
              const at = have[a.id]
              const v = a.value(facts)
              const p = at ? 1 : progressOf(a, facts)
              return (
                <li key={a.id} className={`grid content-start gap-2 border p-4 ${at ? 'border-signal/60 bg-signal/[0.06]' : 'border-ink/15 bg-ink/[0.03]'}`}>
                  <span className="flex items-start justify-between gap-2">
                    <b className={`text-[15px] font-semibold ${at ? 'text-ink' : 'text-ink-2'}`}>{a.name}</b>
                    {at ? <Check className="size-4 shrink-0 text-signal" aria-label="Earned" /> : null}
                  </span>
                  <span className="text-[13px] leading-[1.4] text-ink-2">{a.how}</span>
                  <span className="relative block h-1.5 bg-ink/15" role="progressbar" aria-valuemin={0} aria-valuemax={a.goal} aria-valuenow={Math.min(a.goal, Math.floor(v))} aria-label={`${a.name} progress`}>
                    <span className="absolute inset-y-0 left-0 bg-signal" style={{ width: `${p * 100}%` }} />
                  </span>
                  <span className="hud !text-[11px] text-ink-3">{at ? `Earned ${when(at)}` : `${num(Math.min(v, a.goal), a.unit)} of ${count(a.goal, a.unit)}`}</span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
