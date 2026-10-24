import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { useFx, type Burst } from '@/lib/fx'

const LINES = ['resisted', 'nice try', 'eyes up', 'not today', 'stay here', 'held the line', 'no feed']

function Pop({ b }: { b: Burst }) {
  const drop = useFx((s) => s.drop)
  useEffect(() => {
    const t = setTimeout(() => drop(b.id), 1100)
    return () => clearTimeout(t)
  }, [b.id, drop])
  const x = Math.min(Math.max(b.x, 70), innerWidth - 70)
  const y = Math.min(Math.max(b.y, 90), innerHeight - 120)
  return (
    <div className="pointer-events-none fixed z-[70]" style={{ left: x, top: y }}>
      <div style={{ animation: 'float-up 1100ms cubic-bezier(.2,.8,.2,1) forwards' }} className="-translate-x-1/2 text-center">
        <div className="font-display text-xl font-black text-[#ff7cf5] drop-shadow-[0_0_12px_rgba(255,61,242,.9)]">+1</div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-200/90">
          {LINES[b.id % LINES.length]}
        </div>
      </div>
      {[...Array(10)].map((_, i) => {
        const a = (i / 10) * Math.PI * 2
        return (
          <motion.span
            key={i}
            className="absolute left-0 top-0 h-1.5 w-1.5 rounded-full"
            style={{ background: i % 2 ? '#c8ff3d' : '#ff3df2' }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * 64, y: Math.sin(a) * 64, opacity: 0, scale: 0.2 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        )
      })}
    </div>
  )
}

/** Edge flash + floating "+1" whenever a scroll attempt is swallowed. */
export function UrgeLayer() {
  const bursts = useFx((s) => s.bursts)
  const flash = useFx((s) => s.flash)
  return (
    <>
      <AnimatePresence>{flash > 0 && <div key={flash} className="urge-flash" />}</AnimatePresence>
      {bursts.map((b) => (
        <Pop key={b.id} b={b} />
      ))}
    </>
  )
}
