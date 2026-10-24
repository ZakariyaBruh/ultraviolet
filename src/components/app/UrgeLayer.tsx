import { motion } from 'motion/react'
import { useEffect } from 'react'
import { useFx, type Burst } from '@/lib/fx'

function Chip({ b }: { b: Burst }) {
  const drop = useFx((s) => s.drop)
  useEffect(() => {
    const t = setTimeout(() => drop(b.id), 1000)
    return () => clearTimeout(t)
  }, [b.id, drop])
  const x = Math.min(Math.max(b.x, 70), innerWidth - 70)
  const y = Math.min(Math.max(b.y, 90), innerHeight - 130)
  return (
    <motion.div className="pointer-events-none fixed z-[70] -translate-x-1/2" style={{ left: x, top: y }} initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: [0, 1, 1, 0], y: -34, scale: 1 }} transition={{ duration: 1, times: [0, 0.15, 0.7, 1], ease: [0.2, 0, 0, 1] }}>
      <div className="glass-clear px-3 py-1.5 text-[13px] font-medium text-ink [--r:999px]">
        Blocked <span className="fig text-signal">#{b.n}</span>
      </div>
      {[...Array(8)].map((_, i) => {
        const a = (i / 8) * Math.PI * 2
        return <motion.span key={i} className="absolute left-1/2 top-1/2 size-1 rounded-full bg-signal" initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos(a) * 46, y: Math.sin(a) * 30, opacity: 0, scale: 0.3 }} transition={{ duration: 0.7, ease: 'easeOut' }} />
      })}
    </motion.div>
  )
}

/** A blocked scroll answers back: a glass chip where you tried, and the whole canvas flexes. */
export function UrgeLayer() {
  const bursts = useFx((s) => s.bursts)
  const flash = useFx((s) => s.flash)

  useEffect(() => {
    if (!flash) return
    const el = document.getElementById('canvas')
    if (!el) return
    el.classList.remove('ripple')
    void el.offsetWidth
    el.classList.add('ripple')
    const t = setTimeout(() => el.classList.remove('ripple'), 460)
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
