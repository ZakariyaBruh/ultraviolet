import { motion, useReducedMotion } from 'motion/react'
import { LineImage } from '@/components/app/LineImage'
import { useMedia } from '@/lib/hooks'

/** The front door. Always black, whatever the theme: the page is one image and one sentence. */
export function Landing({ onEnter }: { onEnter: () => void }) {
  const reduced = !!useReducedMotion()
  const wide = useMedia('(min-width: 900px)')
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col bg-black text-[#f4f1e8]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, y: -24, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
    >
      <div className="relative min-h-0 flex-[1.35]">
        <LineImage still={reduced} focus={wide ? [0.68, 0.5] : [0.5, 0.52]} className="absolute inset-0 size-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-5 pt-5 sm:px-8">
          <span className="font-mono text-xs uppercase tracking-[0.18em]">Friction / 01</span>
          <span className="hidden font-mono text-xs uppercase tracking-[0.18em] sm:block">No account / No server / No AI</span>
        </div>
      </div>

      <div className="relative grid shrink-0 gap-5 border-t border-[#f4f1e8]/30 bg-black px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-end">
        <div className="min-w-0">
          <motion.h1
            className="dot text-[clamp(3.1rem,11vw,9.5rem)] text-[#f4f1e8]"
            initial={reduced ? false : { opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
            animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
            transition={{ duration: 0.9, ease: [0.2, 0, 0, 1] }}
          >
            FRICTION
          </motion.h1>
        </div>
        <div className="flex min-w-0 flex-col justify-end gap-4 ">
          <p className="max-w-[44ch] text-[15px] leading-[22px]">
            Scrolling has no friction. That is the whole problem. Stay on one radio station or one live channel and every scroll you skip gets counted.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button onClick={onEnter} autoFocus className="h-12 bg-[#ff5a1f] px-7 font-mono text-[13px] font-semibold uppercase tracking-[0.14em] text-black transition-colors hover:bg-[#ff7a45]">
              Enter
            </button>
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-[#bdb9ac]">Everything stays in this browser</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
