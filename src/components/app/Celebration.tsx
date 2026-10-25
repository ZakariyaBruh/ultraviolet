import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Glass } from '@/components/app/glass'
import { RocketPartyPopper } from '@/components/ui/rocket-party-popper'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'

/**
 * A small win gets a small party: the EasyUI rocket launches itself and throws confetti over the screen.
 * With Motion on Calm the card waits for you to press the rocket. It closes on its own, or with Esc.
 */
export function Celebration() {
  const c = useUI((s) => s.celebrate)
  const set = useUI((s) => s.set)
  const motionLevel = useStore((s) => s.settings.motion)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!c) return
    const launch = motionLevel > 0 ? setTimeout(() => box.current?.querySelector<HTMLButtonElement>('button')?.click(), 350) : undefined
    const close = setTimeout(() => set({ celebrate: null }), 14000)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && set({ celebrate: null })
    addEventListener('keydown', key)
    return () => { clearTimeout(launch); clearTimeout(close); removeEventListener('keydown', key) }
  }, [c, motionLevel, set])

  return (
    <AnimatePresence>
      {c && (
        <motion.div key={c.title + c.detail} className="pointer-events-none fixed inset-0 z-[60] grid place-items-center px-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}>
          <Glass role="status" aria-live="polite" className="pointer-events-auto relative w-[min(380px,100%)] px-5 pb-4 pt-5 text-center">
            <button onClick={() => set({ celebrate: null })} aria-label="Close" className="absolute right-1 top-1 grid size-11 place-items-center text-ink-2 hover:text-ink"><X className="size-4" /></button>
            <p className="hud">Nicely done</p>
            <h2 className="dot text-[clamp(1.3rem,4vw,1.8rem)] font-bold">{c.title}</h2>
            <p className="mt-1 text-sm text-ink-2">{c.detail}</p>
            <div ref={box} className="mt-2"><RocketPartyPopper triggerLabel="Launch the confetti" confettiCount={90} /></div>
          </Glass>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
