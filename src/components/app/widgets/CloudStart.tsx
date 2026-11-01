import { useEffect, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

/**
 * What the cloud browser shows while it starts, on the main one (Hyperbeam) and on the backup (Scramjet 2, alpha): the Friction mark drawing
 * itself and "Finding you a free browser". It stays up until the first page is on the stream, so the other service's own loading screen
 * (its name and logo) is never what the person sees; the intro card still says who runs the browser.
 */

/** the Friction mark, drawn on as the browser starts */
export function StartMark() {
  const calm = useReducedMotion()
  return (
    <svg width="132" height="132" viewBox="0 0 64 64" role="img" aria-label="Friction" className="text-ink">
      <motion.circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="butt" style={{ rotate: -100, transformOrigin: '32px 32px' }} initial={{ pathLength: calm ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: calm ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }} />
      <motion.rect x="40" y="10" width="16" height="16" fill="var(--signal)" style={{ transformOrigin: '48px 18px' }} initial={{ scale: calm ? 1 : 0 }} animate={{ scale: [0, 1.25, 1] }} transition={{ delay: calm ? 0 : 0.9, duration: calm ? 0 : 0.28, ease: 'easeOut' }} />
    </svg>
  )
}

/** covers the stream; `gone` fades it out (ease-in, under 300 ms) and takes it out of the way for pointers and screen readers */
export function CloudOverlay({ gone, children }: { gone?: boolean; children: ReactNode }) {
  return (
    <div
      className={`absolute inset-0 z-10 grid place-items-center bg-ground p-4 text-center transition-opacity duration-200 ease-in motion-reduce:transition-none ${gone ? 'pointer-events-none opacity-0' : ''}`}
      role="status" aria-live="polite" aria-hidden={gone || undefined} inert={gone || undefined}
    >
      {children}
    </div>
  )
}

export function StartCard({ backup }: { backup?: boolean }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setSlow(true), 9000); return () => clearTimeout(t) }, [])
  return (
    <div className="grid justify-items-center gap-5">
      <StartMark />
      <p className="hud">{backup ? 'Cloud browser · backup · experimental' : 'Cloud browser · experimental · may fail'}</p>
      <p className="text-[15px] text-ink">Finding you a free browser…</p>
      <p className="max-w-[34ch] text-[12px] leading-[1.4] text-ink-3">
        {slow
          ? 'Still looking. This can take up to half a minute.'
          : backup
            ? 'The main servers are busy, so this is the older backup browser (Scramjet 2, alpha). It is slower and more likely to break.'
            : 'Very new and prone to errors, with no uptime guarantee. A real browser on a server, streamed to you.'}
      </p>
    </div>
  )
}
