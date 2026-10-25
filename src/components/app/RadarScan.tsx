import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { play, usePlayer } from '@/lib/player'
import { useStore, type MediaItem } from '@/lib/store'

const hash = (s: string, k: number) => { let h = 2166136261 ^ k; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return ((h >>> 0) % 10000) / 10000 }
const mod = (a: number) => ((a % 360) + 360) % 360

/**
 * Radio, found by scanning. Stations are blips on a radar. Turn the sweep by dragging around the dial
 * (or the arrow keys); the blip under the beam is tuned, and letting go plays it. Left alone it sweeps slowly.
 */
export function RadarScan({ items }: { items: MediaItem[] }) {
  const stations = useMemo(() => items.slice(0, 24), [items])
  const n = stations.length
  const level = useStore((s) => s.settings.motion)
  const current = usePlayer((s) => s.current)
  const status = usePlayer((s) => s.status)
  const box = useRef<HTMLDivElement>(null)
  const [angle, setAngle] = useState(0)
  const drag = useRef({ on: false, last: 0, vel: 0, moved: false })
  const ang = useRef(0)
  ang.current = angle

  const blips = useMemo(() => stations.map((s, i) => ({ s, th: mod((i / Math.max(1, n)) * 360 + (hash(s.id, 1) - 0.5) * 8), r: 0.34 + hash(s.id, 2) * 0.54, hue: Math.round(hash(s.id, 3) * 360) })), [stations, n])

  const nearest = (a: number, within: number) => {
    let best = -1, bd = within
    blips.forEach((b, i) => { const d = Math.abs(mod(b.th - a + 180) - 180); if (d < bd) { bd = d; best = i } })
    return best
  }
  const tuned = useMemo(() => nearest(angle, 16), [blips, angle]) // eslint-disable-line react-hooks/exhaustive-deps

  // idle sweep
  useEffect(() => {
    if (level === 0) return
    let raf = 0, prev = performance.now()
    const loop = (now: number) => {
      const dt = (now - prev) / 1000; prev = now
      if (!drag.current.on) {
        const v = drag.current.vel
        drag.current.vel *= Math.pow(0.04, dt)
        setAngle((a) => mod(a + (Math.abs(v) > 4 ? v * dt : 16 * dt)))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [level])

  const pointerAngle = (e: PointerEvent) => { const r = box.current!.getBoundingClientRect(); return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI + 90 }
  const down = (e: PointerEvent) => { box.current?.setPointerCapture?.(e.pointerId); drag.current = { on: true, last: pointerAngle(e), vel: 0, moved: false } }
  const move = (e: PointerEvent) => {
    const d = drag.current
    if (!d.on) return
    const a = pointerAngle(e)
    const delta = ((a - d.last + 540) % 360) - 180
    d.last = a
    if (Math.abs(delta) > 0.3) d.moved = true
    d.vel = delta * 30
    setAngle((v) => mod(v + delta))
  }
  const up = () => {
    const d = drag.current
    if (!d.on) return
    d.on = false
    if (d.moved) { const i = nearest(ang.current, 30); if (i >= 0) play(blips[i].s, stations) }
  }
  const key = (e: KeyboardEvent) => {
    const step = 360 / Math.max(6, n)
    if (e.key === 'ArrowRight') { e.preventDefault(); drag.current.vel = 0; setAngle((a) => mod(a + step)) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); drag.current.vel = 0; setAngle((a) => mod(a - step)) }
    else if ((e.key === 'Enter' || e.key === ' ') && tuned >= 0) { e.preventDefault(); play(blips[tuned].s, stations) }
  }

  const live = current?.kind === 'radio' ? current : null
  const fan = Array.from({ length: 18 }, (_, i) => i)
  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div
        ref={box}
        role="group"
        tabIndex={0}
        aria-label="Radio scanner. Drag around the dial or use the left and right arrow keys to sweep. Enter plays the station under the beam."
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
        className="relative aspect-square w-full cursor-grab touch-none select-none border border-ink/30 bg-surface active:cursor-grabbing"
      >
        <svg viewBox="-100 -100 200 200" className="absolute inset-0 size-full" aria-hidden>
          {[0.3, 0.6, 0.9].map((r) => <circle key={r} r={r * 95} fill="none" stroke="var(--ink)" strokeOpacity="0.22" />)}
          {Array.from({ length: 36 }, (_, i) => <line key={i} x1="0" y1={-95} x2="0" y2={i % 3 === 0 ? -88 : -91.5} stroke="var(--ink)" strokeOpacity="0.6" transform={`rotate(${i * 10})`} />)}
          <line x1="-95" y1="0" x2="95" y2="0" stroke="var(--ink)" strokeOpacity="0.15" /><line x1="0" y1="-95" x2="0" y2="95" stroke="var(--ink)" strokeOpacity="0.15" />
          <g transform={`rotate(${angle})`}>
            {fan.map((i) => <line key={i} x1="0" y1="0" x2="0" y2="-95" stroke="var(--ice)" strokeWidth="1.4" strokeOpacity={0.9 * (1 - i / fan.length)} transform={`rotate(${-i * 1.6})`} />)}
            <line x1="0" y1="0" x2="0" y2="-95" stroke="var(--signal)" strokeWidth="1.6" />
          </g>
          {blips.map((b, i) => {
            const x = Math.sin((b.th * Math.PI) / 180) * b.r * 95, y = -Math.cos((b.th * Math.PI) / 180) * b.r * 95
            const since = mod(angle - b.th), glow = since < 70 ? 1 - since / 70 : 0.15
            const on = i === tuned, isLive = live?.id === b.s.id
            return <rect key={b.s.id} x={x - (on ? 4 : 2.5)} y={y - (on ? 4 : 2.5)} width={on ? 8 : 5} height={on ? 8 : 5} fill={isLive ? 'var(--signal)' : `hsl(${b.hue} 90% 62%)`} opacity={on || isLive ? 1 : 0.25 + glow * 0.75} />
          })}
          <rect x="-3" y="-3" width="6" height="6" fill="var(--signal)" />
        </svg>
        {/* tap a blip to play it straight away */}
        {blips.map((b, i) => (
          <button key={b.s.id} tabIndex={-1} aria-label={`Play ${b.s.name}`} onClick={() => { if (!drag.current.moved) play(b.s, stations) }} className="absolute size-11 -translate-x-1/2 -translate-y-1/2 opacity-0" style={{ left: `${50 + Math.sin((b.th * Math.PI) / 180) * b.r * 47.5}%`, top: `${50 - Math.cos((b.th * Math.PI) / 180) * b.r * 47.5}%` }} data-i={i} />
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 grid justify-items-center px-3 text-center">
          <span className="hud">{live && status === 'playing' ? 'On air' : n ? 'Scanning' : 'No signal'}</span>
          <span className="dot max-w-full truncate text-lg font-bold text-ink">{tuned >= 0 ? blips[tuned].s.name : live?.name ?? 'Turn the dial'}</span>
        </div>
      </div>
      <div className="sr-only" aria-live="polite">{tuned >= 0 ? `Tuned to ${blips[tuned].s.name}` : ''}</div>
      <p className="hud mt-2 text-center">Drag around the dial. Let go to play.</p>
    </div>
  )
}
