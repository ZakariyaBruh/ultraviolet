import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useStore } from '@/lib/store'
import { AsciiSolid } from '@/components/app/AsciiSolid'

/**
 * The station signs on when the site opens, once for each visit. It is a broadcast sign-on, not a command line: the picture opens from a line,
 * the colour bars fill as the checks go by, a ruler like the session-length one carries a needle across, and a solid turns in an ident
 * window. Every line is true and says nothing about the person (no name, no date, no numbers from their sessions); the one thing it reads is
 * the screen's own size. Retro timing is stepped, not smooth, and it ends the way a station change does: a burst of static, then the picture.
 * Any key or tap cuts it short; calm motion and reduced motion skip it.
 */
const SPECTRUM = ['#f3f1ea', '#ffd23f', '#3ee0ff', '#4ade80', '#ff5d8f', '#ff3b3b', '#3b5bff']
const KEY = 'friction:booted'
const START = 460
const STEP = 250
const OPEN = 190
const BURST = 150

const rows = (w: number, h: number): [string, string][] => [
  ['Display', `${w} × ${h}`],
  ['Storage', 'This browser'],
  ['Account', 'Not needed'],
  ['Feed', 'None'],
  ['AI', 'Minimal, labelled'],
  ['Clock', 'Only while you are here'],
]

/** a patch of static, redrawn every few frames, like a channel with nothing on it */
function Static() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const g = c.getContext('2d')
    if (!g) return
    const w = (c.width = 192), h = (c.height = 108)
    const img = g.createImageData(w, h)
    let raf = 0
    const draw = () => {
      for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() < 0.55 ? 8 + Math.random() * 70 : 70 + Math.random() * 110; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255 }
      g.putImageData(img, 0, 0)
      raf = window.setTimeout(draw, 50) as unknown as number
    }
    draw()
    return () => clearTimeout(raf)
  }, [])
  return <canvas ref={ref} aria-hidden className="absolute inset-0 z-30 size-full bg-ground" style={{ imageRendering: 'pixelated' }} />
}

export function Boot() {
  const reduced = !!useReducedMotion()
  const level = useStore((s) => s.settings.motion)
  const [shown, setShown] = useState(() => { try { return sessionStorage.getItem(KEY) !== '1' } catch { return true } })
  const [t, setT] = useState(0)
  const [cut, setCut] = useState<number | null>(null)
  const tRef = useRef(0)
  tRef.current = t
  const dims = useRef({ w: typeof innerWidth === 'number' ? innerWidth : 0, h: typeof innerHeight === 'number' ? innerHeight : 0 })
  const skip = reduced || level === 0
  const lines = rows(dims.current.w, dims.current.h)
  const doneAt = START + lines.length * STEP + 260
  const exitAt = cut ?? doneAt + 260

  useEffect(() => {
    if (!shown) return
    if (skip) { try { sessionStorage.setItem(KEY, '1') } catch { /* storage blocked */ } setShown(false); return }
    const t0 = performance.now()
    const id = setInterval(() => setT(performance.now() - t0), 33)
    return () => clearInterval(id)
  }, [shown, skip])
  useEffect(() => {
    if (!shown || skip || t < exitAt + BURST) return
    try { sessionStorage.setItem(KEY, '1') } catch { /* storage blocked */ }
    setShown(false)
  }, [t]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!shown || skip) return
    const k = () => setCut((c) => c ?? Math.max(tRef.current, 1))
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [shown, skip])

  if (!shown || skip) return null
  const open = Math.min(1, t / OPEN)
  const idx = Math.max(0, Math.min(lines.length, Math.floor((t - START) / STEP) + 1))
  const progress = Math.min(1, Math.max(0, (t - START) / (lines.length * STEP)))
  const ready = t >= doneAt
  const bursting = t >= exitAt
  const frames = Math.floor(t / 33.3)
  const tc = `${String(Math.floor(frames / 900) % 60).padStart(2, '0')}:${String(Math.floor(frames / 30) % 30).padStart(2, '0')}:${String(frames % 30).padStart(2, '0')}`
  const needle = progress * 100

  return (
    <div role="status" aria-label="Friction is starting" onPointerDown={() => setCut((c) => c ?? Math.max(t, 1))} className="fixed inset-0 z-[200] overflow-hidden bg-ground text-ink">
      {/* the picture opens from one bright line */}
      {t < OPEN && <div aria-hidden className="absolute inset-x-0 z-20 h-[2px] bg-ink" style={{ top: '50%' }} />}
      <div className="absolute inset-0" style={{ clipPath: `inset(${(1 - open) * 50}% 0 ${(1 - open) * 50}% 0)` }}>
        {/* the colour bars: the only full spectrum in the app, and here they are the progress bar */}
        <div aria-hidden className="absolute inset-x-0 top-0 flex h-[10px] overflow-hidden">
          <div className="flex h-full w-full" style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}>{SPECTRUM.map((c) => <i key={c} className="h-full flex-1" style={{ background: c }} />)}</div>
        </div>

        <div className="absolute left-5 top-6 flex items-center gap-3 font-[family-name:var(--font-cond)] text-sm font-semibold uppercase tracking-[0.18em] text-ink-2 sm:left-8">
          <i className="size-2.5 bg-signal" /> <span className="text-signal">CH 00</span> <span>Sign-on</span>
        </div>
        <div aria-hidden className="absolute right-5 top-5 font-[family-name:var(--font-dot)] text-[13px] font-semibold tabular-nums tracking-[0.04em] text-ink-2 sm:right-8">{tc}</div>

        {/* a solid turning in the ident window */}
        <div aria-hidden className="crt absolute right-5 top-16 hidden w-[min(30rem,46vw)] border border-ink/25 bg-ground p-3 min-[560px]:block min-[900px]:right-[7%] min-[900px]:top-[13%]">
          <i className="absolute -left-1 -top-1 size-2 border-l-2 border-t-2 border-signal" /><i className="absolute -right-1 -top-1 size-2 border-r-2 border-t-2 border-signal" />
          <i className="absolute -bottom-1 -left-1 size-2 border-b-2 border-l-2 border-signal" /><i className="absolute -bottom-1 -right-1 size-2 border-b-2 border-r-2 border-signal" />
          <AsciiSolid shape="knot" cols={46} rows={24} speed={1.5} className="text-signal text-[13px]" />
        </div>

        {/* the station's name, a ghost of the wordmark, large and not in the way */}
        <div aria-hidden className="pointer-events-none absolute bottom-3 right-4 select-none font-[family-name:var(--font-dot)] font-extrabold uppercase leading-none tracking-[-0.04em] max-[899px]:hidden sm:right-8" style={{ fontSize: 'clamp(3.5rem, 8vw, 8rem)', color: 'color-mix(in srgb, var(--ink) 9%, transparent)' }}>Friction</div>
        {/* the readout */}
        <div className="crt absolute bottom-6 left-5 w-[min(32rem,calc(100%-2.5rem))] border border-signal bg-ground sm:bottom-9 sm:left-8">
          <div className="flex items-center justify-between border-b border-signal/60 px-3 py-2 font-[family-name:var(--font-cond)] text-base font-semibold uppercase tracking-[0.14em] text-signal">
            <span>Station check</span>
            <span className={ready ? 'bg-signal px-1.5 text-on-signal' : 'text-ink-3'}>{ready ? 'Ready' : `${idx}/${lines.length}`}</span>
          </div>
          <div className="px-3 pb-2 pt-2.5">
            {lines.map(([k, v], i) => {
              const typed = Math.max(0, Math.min(v.length, Math.floor(((t - START - i * STEP) / STEP) * v.length * 1.6)))
              const on = t >= START + i * STEP
              const done = typed >= v.length
              return (
                <div key={k} className="flex h-[2rem] items-baseline gap-2 font-[family-name:var(--font-cond)] text-[18px] font-semibold uppercase tracking-[0.1em]">
                  <span className={on ? 'text-ink-2' : 'text-ink-3/40'}>{k}</span>
                  <span aria-hidden className="mb-1 min-w-4 flex-1 self-end border-b border-dotted border-ink/30" />
                  <span className="text-ink">{on ? v.slice(0, typed) : ''}{on && !done && <span className="caret ml-px" />}</span>
                  <i className={`size-2 self-center ${done ? 'bg-ice' : 'bg-ink/15'}`} />
                </div>
              )
            })}
            {/* a ruler, like the one that sets a session's length, with a needle that goes across as the checks pass */}
            <div aria-hidden className="relative mt-2.5 h-7 border-t border-ink/20 pt-2">
              <div className="flex h-2.5 w-full items-end justify-between">{Array.from({ length: 21 }, (_, i) => <i key={i} className={`w-px bg-ink/45 ${i % 5 === 0 ? 'h-2.5' : 'h-1.5'}`} />)}</div>
              <div className="absolute top-1 w-[2px] bg-signal" style={{ left: `${needle}%`, height: 16, transform: 'translateX(-1px)' }} />
              <div className="absolute top-[18px] -translate-x-1/2 bg-signal px-1 font-[family-name:var(--font-cond)] text-[11px] font-bold leading-[14px] text-on-signal" style={{ left: `${Math.min(94, Math.max(6, needle))}%` }}>{Math.round(needle)}</div>
            </div>
          </div>
        </div>
      </div>
      {(t >= OPEN - 40 && t < OPEN + 90) && <Static />}
      {bursting && <Static />}
    </div>
  )
}
