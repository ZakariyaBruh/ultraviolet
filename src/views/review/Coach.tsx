import { useMemo } from 'react'
import { Panel } from '@/components/app/shared'
import { fx_say } from '@/lib/actions'
import { coach, type Finding } from '@/lib/review'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

function Spark({ v }: { v: number[] }) {
  const max = Math.max(1, ...v)
  return (
    <div className="flex h-10 items-end gap-1" role="img" aria-label="Minutes held in each of the last eight full weeks, oldest first">
      {v.map((x, i) => <i key={i} className="flex-1 bg-signal" style={{ height: `${Math.max(4, (x / max) * 100)}%`, opacity: i >= v.length - 4 ? 1 : 0.45 }} />)}
    </div>
  )
}

function Card({ f }: { f: Finding }) {
  return (
    <li className={cn('grid min-w-0 content-start gap-2 border p-4', f.ready ? 'border-ink/15 bg-ink/[0.03]' : 'border-dashed border-ink/20')}>
      <p className="hud">{f.ready ? f.evidence : 'Needs more data'}</p>
      <h3 className={cn('text-[16px] font-semibold leading-snug', !f.ready && 'text-ink-2')}>{f.title}</h3>
      <p className="text-[14px] leading-[1.5] text-ink-2">{f.body}</p>
      {f.spark && f.ready && <Spark v={f.spark} />}
      {!f.ready && <p className="text-[13px] text-ink-3">{f.evidence}</p>}
      {f.action && (
        <button className="mt-1 h-11 justify-self-start border border-signal/60 px-4 text-sm font-semibold text-ink hover:bg-signal/10" onClick={() => { useStore.getState().setSettings({ sessionMin: f.action!.minutes }); fx_say({ title: `Session length set to ${f.action!.minutes} min`, description: 'Change it any time with the length band on Focus.' }) }}>{f.action.label}</button>
      )}
    </li>
  )
}

/** What your own numbers say. Plain arithmetic on your saved sessions and focus log, with the amount of data behind each line. No AI. */
export function Coach() {
  const focusLog = useStore((s) => s.focusLog)
  const urgeLog = useStore((s) => s.urgeLog)
  const sessions = useStore((s) => s.sessions)
  const list = useMemo(() => coach({ focusLog, urgeLog, sessions }), [focusLog, urgeLog, sessions])
  const sorted = [...list.filter((f) => f.ready), ...list.filter((f) => !f.ready)]
  return (
    <Panel className="flex h-full min-h-[20rem] flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="hud">What your own numbers say</p>
        <p className="text-[13px] text-ink-3">Rules and arithmetic on this device, no AI. {sessions.length} session{sessions.length === 1 ? '' : 's'} kept.</p>
      </div>
      <ul className="scroll-y grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(260px,1fr))] content-start gap-3" data-no-drag tabIndex={0} aria-label="Findings">
        {sorted.map((f) => <Card key={f.id} f={f} />)}
      </ul>
    </Panel>
  )
}
