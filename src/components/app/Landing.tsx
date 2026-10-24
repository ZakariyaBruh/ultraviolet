import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { LineImage } from '@/components/app/LineImage'
import { useMedia } from '@/lib/hooks'

const BOOT = [
  'FRICTION.SYS  v1.0',
  '> scroll reflex ........ FOUND',
  '> feed .................. DISABLED',
  '> storage .............. THIS BROWSER',
  '> server ............... NONE',
  '> ai ................... NONE',
  '> ready',
]

/** Retro: a terminal types its boot log one stepped character at a time. */
function Boot({ still }: { still: boolean }) {
  const total = BOOT.join('\n').length
  const [n, setN] = useState(still ? total : 0)
  useEffect(() => {
    if (still) return
    const id = setInterval(() => setN((v) => (v >= total ? v : v + 1)), 22)
    return () => clearInterval(id)
  }, [still, total])
  const text = BOOT.join('\n').slice(0, n)
  return (
    <pre className="m-0 min-h-[10.5rem] whitespace-pre-wrap font-mono text-[13px] leading-[1.6] text-[#ff7a45]" aria-label={BOOT.join('. ')}>
      <span aria-hidden>{text}</span>
      <span aria-hidden className="caret" />
    </pre>
  )
}

/** The front door. Always black, whatever the theme. Retro terminal over a futuristic line field. */
export function Landing({ onEnter }: { onEnter: () => void }) {
  const reduced = !!useReducedMotion()
  const wide = useMedia('(min-width: 900px)')
  const readout = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (readout.current) readout.current.textContent = `X ${(e.clientX / innerWidth).toFixed(3)}  Y ${(e.clientY / innerHeight).toFixed(3)}`
    }
    addEventListener('pointermove', move, { passive: true })
    return () => removeEventListener('pointermove', move)
  }, [])
  return (
    <motion.div className="fixed inset-0 z-[100] flex flex-col bg-black text-[#f4f1e8]" exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}>
      <div className="relative min-h-0 flex-[1.3]">
        <LineImage still={reduced} focus={wide ? [0.68, 0.46] : [0.5, 0.36]} className="absolute inset-0 size-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-5 pt-5 font-mono text-xs uppercase tracking-[0.16em] sm:px-8">
          <span className="bg-black px-1.5 py-0.5">Friction / 01</span>
          <span ref={readout} className="hidden bg-black px-1.5 py-0.5 sm:block" aria-hidden>X 0.500  Y 0.500</span>
        </div>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0, 0, 1], delay: 0.15 }}
          className="crt crt-flicker absolute bottom-5 left-5 w-[min(25rem,calc(100%-2.5rem))] border border-[#ff5a1f] bg-black sm:bottom-8 sm:left-8"
        >
          <div className="flex items-center justify-between border-b border-[#ff5a1f]/50 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.14em] text-[#ff7a45]">
            <span>friction.sys</span>
            <span aria-hidden className="flex gap-1"><i className="size-2 border border-[#ff7a45]" /><i className="size-2 bg-[#ff7a45]" /></span>
          </div>
          <div className="px-3 py-3"><Boot still={reduced} /></div>
        </motion.div>
      </div>

      <div className="grid shrink-0 gap-4 border-t border-[#f4f1e8]/30 bg-black px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-end">
        <motion.h1
          className="dot m-0 text-[clamp(2.4rem,11vw,3.4rem)] uppercase text-[#f4f1e8] sm:text-[clamp(3rem,8.4vw,8.5rem)]"
          initial={reduced ? false : { fontWeight: 200, opacity: 0, letterSpacing: '0.04em' }}
          animate={{ fontWeight: 800, opacity: 1, letterSpacing: '-0.04em' }}
          transition={{ duration: 1.4, ease: [0.2, 0, 0, 1], delay: 0.2 }}
        >
          Friction
        </motion.h1>
        <div className="flex min-w-0 flex-col gap-4">
          <p className="max-w-[44ch] text-[15px] leading-[22px]">
            Scrolling has no friction. That is the whole problem. Stay on one radio station or one live channel and every scroll you skip gets counted.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button onClick={onEnter} autoFocus className="h-12 min-w-36 bg-[#eaf6ff] px-7 font-mono text-[13px] font-semibold uppercase tracking-[0.14em] text-black transition-colors hover:bg-white">
              Enter →
            </button>
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-[#bdb9ac]">Press Enter. Nothing leaves this browser.</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
