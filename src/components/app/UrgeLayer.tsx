import { motion } from 'motion/react'
import { useEffect } from 'react'
import { useFx, type Burst } from '@/lib/fx'

function Chip({ b }: { b: Burst }) {
  const drop = useFx((s) => s.drop)
  useEffect(() => {
    const t = setTimeout(() => drop(b.id), 900)
    return () => clearTimeout(t)
  }, [b.id, drop])
  const x = Math.min(Math.max(b.x, 64), innerWidth - 64)
  const y = Math.min(Math.max(b.y, 72), innerHeight - 120)
  return (
    <motion.div
      className="pointer-events-none fixed z-[70] -translate-x-1/2 rounded-full border border-[var(--control)] bg-surface px-2.5 py-1 text-[13px] font-medium text-ink float-lift"
      style={{ left: x, top: y }}
      initial={{ opacity: 0, y: 6, scale: 0.9 }}
      animate={{ opacity: [0, 1, 1, 0], y: -26, scale: 1 }}
      transition={{ duration: 0.9, times: [0, 0.15, 0.7, 1], ease: [0.2, 0, 0, 1] }}
    >
      Blocked <span className="fig text-ink-2">#{b.n}</span>
    </motion.div>
  )
}

/** A blocked scroll answers back: a chip where you tried, and the canvas recoils. */
export function UrgeLayer() {
  const bursts = useFx((s) => s.bursts)
  const flash = useFx((s) => s.flash)

  useEffect(() => {
    if (!flash) return
    const el = document.getElementById('canvas')
    if (!el) return
    el.classList.remove('recoil')
    void el.offsetWidth
    el.classList.add('recoil')
    const t = setTimeout(() => el.classList.remove('recoil'), 400)
    return () => clearTimeout(t)
  }, [flash])

  return (
    <>
      {bursts.map((b) => (
        <Chip key={b.id} b={b} />
      ))}
    </>
  )
}
