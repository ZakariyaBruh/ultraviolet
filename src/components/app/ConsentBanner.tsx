import { AnimatePresence, motion } from 'motion/react'
import { rejectNow, useConsent } from '@/lib/consent'

/** Asked once, before anything from Google loads. Accept and Reject are the same size and weight on purpose. */
export function ConsentBanner() {
  const { asking, choice, choose } = useConsent()
  return (
    <AnimatePresence>
      {asking && (
        <motion.div key="consent" role="dialog" aria-label="Cookie choice" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }} transition={{ type: 'spring', stiffness: 360, damping: 32 }}
          className="fixed bottom-3 left-3 right-3 z-[140] max-w-[30rem] border border-ink/25 bg-ground p-4 shadow-none sm:right-auto">
          <p className="hud text-signal">Cookies</p>
          <p className="mt-1 text-[14px] leading-[1.45] text-ink">Friction itself uses no cookies. Google Tag Manager (to see which screens are used) and ads on our public pages can set some. Only if you say yes.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={() => choose('granted')} className="h-11 min-w-[6.5rem] flex-1 border border-ink/40 text-sm font-semibold text-ink hover:bg-ink/10 sm:flex-none">Accept</button>
            <button onClick={() => (choice === 'granted' ? rejectNow() : choose('denied'))} className="h-11 min-w-[6.5rem] flex-1 border border-ink/40 text-sm font-semibold text-ink hover:bg-ink/10 sm:flex-none">Reject</button>
            <a href="/cookies" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center px-1 text-[13px] text-ink-2 underline underline-offset-2 hover:text-signal">Cookie policy</a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
