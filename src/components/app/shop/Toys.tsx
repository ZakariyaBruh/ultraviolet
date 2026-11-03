import { motion } from 'motion/react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { thud } from '@/lib/clunk'
import { itemsOf, useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'

const fmt = (n: number) => n.toLocaleString('en-US')

/** a small dry click for the spinner's bearing, made on the spot */
let tickCtx: AudioContext | null = null
function tick(strength: number) {
  const vol = useStore.getState().settings.volume
  if (!vol) return
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    tickCtx ??= new AC()
    const c = tickCtx
    const t = c.currentTime
    const o = c.createOscillator(), g = c.createGain()
    o.type = 'square'; o.frequency.setValueAtTime(700 + strength * 500, t)
    g.gain.setValueAtTime(0.05 * vol * Math.min(1, strength), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.04)
  } catch { /* silent spinner */ }
}

/** A three-lobed fidget spinner. Flick it; it keeps going and slows down on its own. Every full turn is counted, for good. */
export function Spinner({ locked }: { locked: boolean }) {
  const total = useStore((s) => itemsOf(s.credits).spins)
  const g = useRef<SVGGElement>(null)
  const box = useRef<SVGSVGElement>(null)
  const st = useRef({ a: 0, w: 0, down: false, pa: 0, pt: 0, lobe: 0, turns: 0, banked: 0, tickAt: 0 })
  const [now, setNow] = useState(0)

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let shown = 0
    const bank = () => { const whole = Math.floor(st.current.turns) - st.current.banked; if (whole > 0) { st.current.banked += whole; useStore.getState().addSpins(whole) } }
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      const s = st.current
      if (!s.down && s.w !== 0) {
        const da = s.w * dt
        s.a += da
        s.turns += Math.abs(da) / (Math.PI * 2)
        s.w *= Math.exp(-0.42 * dt)
        if (Math.abs(s.w) < 0.06) s.w = 0
        const lobe = Math.floor(s.a / ((Math.PI * 2) / 3))
        if (lobe !== s.lobe) { s.lobe = lobe; if (Math.abs(s.w) > 2.5 && t - s.tickAt > 45) { s.tickAt = t; tick(Math.min(1, Math.abs(s.w) / 25)) } }
        if (s.w === 0) bank()
      }
      g.current?.setAttribute('transform', `rotate(${((s.a * 180) / Math.PI).toFixed(2)} 100 100)`)
      if (t - shown > 120) { shown = t; setNow(Math.floor(s.turns)) }
    }
    raf = requestAnimationFrame(loop)
    const flush = setInterval(bank, 1500)
    return () => { cancelAnimationFrame(raf); clearInterval(flush); bank() }
  }, [])

  const angleOf = (e: PointerEvent) => { const r = box.current!.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) }
  const wrap = (d: number) => (d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d)
  const down = (e: PointerEvent<SVGSVGElement>) => { if (locked) return; const s = st.current; s.down = true; s.pa = angleOf(e); s.pt = performance.now(); e.currentTarget.setPointerCapture(e.pointerId) }
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const s = st.current
    if (!s.down) return
    const a = angleOf(e), t = performance.now()
    const d = wrap(a - s.pa)
    s.a += d; s.turns += Math.abs(d) / (Math.PI * 2)
    const dt = Math.max(0.008, (t - s.pt) / 1000)
    s.w = s.w * 0.5 + (d / dt) * 0.5
    s.pa = a; s.pt = t
  }
  const up = () => { const s = st.current; s.down = false; if (performance.now() - s.pt > 90) s.w = 0; if (Math.abs(s.w) > 3) navigator.vibrate?.(8) }

  return (
    <div className="grid justify-items-center gap-2">
      <svg ref={box} viewBox="0 0 200 200" role="img" aria-label={locked ? 'A fidget spinner. You are locked in, so it is put away.' : 'A fidget spinner. Drag around it to flick it.'} data-no-drag className={`aspect-square w-full max-w-[220px] touch-none select-none ${locked ? 'opacity-40' : 'cursor-grab active:cursor-grabbing'}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <g ref={g}>
          <path d="M100 100 L100 38 M100 100 L46 131 M100 100 L154 131" className="stroke-ink/40" strokeWidth={10} strokeLinecap="round" fill="none" />
          {[0, 120, 240].map((d) => <g key={d} transform={`rotate(${d} 100 100)`}><circle cx={100} cy={38} r={26} className="fill-ground stroke-ink" strokeWidth={2.5} /><circle cx={100} cy={38} r={11} className="fill-signal" /></g>)}
          <circle cx={100} cy={100} r={24} className="fill-ground stroke-ink" strokeWidth={2.5} /><circle cx={100} cy={100} r={10} className="fill-ink" />
        </g>
      </svg>
      <p className="fig text-sm" aria-live="off">This session <strong>{fmt(now)}</strong> turns · all time <strong>{fmt(total + 0)}</strong></p>
      {locked && <p role="status" className="text-[13px] text-ink-2">You are locked in. Put it down until you are done.</p>}
    </div>
  )
}

/** The Golden Brick, drawn flat in the signal colour. */
function BrickArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden>
      <polygon points="30,52 120,52 170,30 80,30" fill="var(--signal)" />
      <polygon points="30,52 120,52 120,100 30,100" fill="color-mix(in srgb, var(--signal) 72%, #000)" />
      <polygon points="120,52 170,30 170,78 120,100" fill="color-mix(in srgb, var(--signal) 48%, #000)" />
      <polygon points="36,56 114,56 114,62 36,62" fill="rgba(255,255,255,0.28)" />
      <polygon points="84,34 160,34 150,38 78,38" fill="rgba(255,255,255,0.35)" />
      <text x="75" y="88" textAnchor="middle" fontSize="13" fontWeight="700" letterSpacing="2" fill="color-mix(in srgb, var(--signal) 40%, #000)" style={{ fontFamily: 'var(--font-cond)' }}>FRICTION</text>
    </svg>
  )
}

const CLUNKS = (n: number) => (n >= 1000 ? 'It is still a brick.' : n >= 100 ? 'You have a problem.' : n >= 25 ? 'Very solid.' : n >= 5 ? 'Solid.' : 'Clunk.')

export function Brick() {
  const clunks = useStore((s) => itemsOf(s.credits).clunks)
  const motionLevel = useStore((s) => s.settings.motion)
  return (
    <div className="grid justify-items-center gap-2">
      <motion.button onClick={() => { useStore.getState().clunk(); thud() }} whileTap={motionLevel === 0 ? undefined : { scale: 0.93, rotate: -1.5 }} transition={{ duration: 0.12 }} aria-label="The Golden Brick. Press it." className="block w-full max-w-[240px] cursor-pointer">
        <BrickArt className="w-full" />
      </motion.button>
      <p className="text-center text-[13px] text-ink-2" role="status">{CLUNKS(clunks)} <span className="fig">{fmt(clunks)}</span> {clunks === 1 ? 'press' : 'presses'}, and nothing happened.</p>
    </div>
  )
}

const BOOMS = ['Nothing was achieved. Beautifully.', 'That one was for you.', 'Somewhere, a very small crowd cheers.', 'Confetti, as ordered.', 'You did not need a reason.', 'Another one for the pile.', 'The rocket sends its regards.']

/** A rocket and a lot of confetti, for no reason at all: it uses the same card as a finished session. */
export function Cannon({ locked }: { locked: boolean }) {
  const [n, setN] = useState(0)
  if (locked) return <p role="status" className="text-sm text-ink-2">You are locked in. Save the party for when you finish.</p>
  return (
    <div className="grid justify-items-start gap-3">
      <button onClick={() => { useUI.getState().set({ celebrate: { title: 'Boom', detail: BOOMS[n % BOOMS.length] } }); setN(n + 1) }} className="h-14 bg-signal px-8 text-base font-bold text-on-signal">Fire the cannon</button>
      <p className="fig text-[13px] text-ink-2" aria-live="polite">{n ? `${n} fired this visit` : 'Nobody has asked you to.'}</p>
    </div>
  )
}
