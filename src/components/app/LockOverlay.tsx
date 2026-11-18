import { Maximize2 } from 'lucide-react'
import { enterLock, useLockdown } from '@/lib/lockdown'

/** Medium and High lock-ins: while full screen is not on, the app waits behind this, and one press puts it back */
export function LockOverlay() {
  const { waiting, level } = useLockdown()
  if (!waiting) return null
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="lock-title" className="fixed inset-0 z-[90] grid place-content-center justify-items-center gap-4 bg-ground/95 p-6 text-center">
      <p className="hud">{level >= 2 ? 'High lock-in' : 'Medium lock-in'}</p>
      <h2 id="lock-title" className="max-w-[24ch] text-[22px] font-semibold text-ink">Full screen is part of this session.</h2>
      <p className="max-w-[40ch] text-[14px] leading-[1.45] text-ink-2">Leaving it counted as a drift. The timer is waiting.</p>
      <button autoFocus onClick={() => void enterLock(level)} className="inline-flex h-12 items-center gap-2 bg-signal px-6 font-semibold text-on-signal"><Maximize2 className="size-4" />Back to full screen</button>
    </div>
  )
}
