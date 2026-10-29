import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { View } from '@/lib/route'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * The guided tour. A step either points at one specific part of the screen (a hole is cut in the dim around exactly that part, the
 * rest of its panel is outlined faintly so you can see where the part sits), or it is a title card that cuts between chapters.
 * A step can ask you to do the thing (`done` is checked ten times a second and the tour moves on by itself when it is true).
 * Steps know which screen they belong to and take you there. Calm motion and reduced motion swap the moves for fades.
 */
export type GTarget = string | (() => HTMLElement | null)
export interface GCtx { go: (v: View) => void; onClose: (undo: () => void) => void }
export interface GStep {
  id: string
  /** a title card: black bars close over the screen, the card is read, the bars open on the next screen */
  card?: { kicker: string; title: string; lines?: string[] }
  view?: View
  /** the part to point at */
  target?: GTarget
  /** the panel or area it belongs to, outlined faintly */
  scope?: GTarget
  title?: string
  body?: string
  place?: 'top' | 'bottom' | 'left' | 'right'
  pad?: number
  /** what to do, in a few words; with `done` the step waits for it */
  task?: string
  done?: () => boolean
  /** runs once when the step starts, after its screen is up */
  setup?: (c: GCtx) => void
}

const find = (t?: GTarget): HTMLElement | null => {
  if (!t) return null
  try {
    const el = typeof t === 'string' ? document.querySelector<HTMLElement>(t) : t()
    if (!el) return null
    const r = el.getBoundingClientRect()
    return r.width > 2 && r.height > 2 ? el : null
  } catch { return null }
}
const ease = [0.2, 0, 0, 1] as const

export function Guide({ steps, open, onClose, view, go, label }: { steps: GStep[]; open: boolean; onClose: (why: 'done' | 'skip') => void; view: View; go: (v: View) => void; label: string }) {
  const calm = useStore((s) => s.settings.motion === 0) || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [i, setI] = useState(0)
  const [hole, setHole] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [scope, setScope] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [won, setWon] = useState(false)
  const [late, setLate] = useState(false)
  const [readyFor, setReadyFor] = useState('')
  const [cover, setCover] = useState<'in' | 'hold' | 'out' | null>(null)
  const [size, setSize] = useState({ w: 340, h: 200 })
  const [vp, setVp] = useState({ w: innerWidth, h: innerHeight })
  const undo = useRef<(() => void)[]>([])
  const started = useRef(-1)
  const card = useRef<HTMLDivElement>(null)
  const step = steps[Math.min(i, steps.length - 1)]
  const chapters = steps.filter((s) => s.card).length
  const chapterNo = steps.slice(0, i + 1).filter((s) => s.card).length

  // the spotlight, as springs, so it travels from one part to the next
  const hx = useMotionValue(0), hy = useMotionValue(0), hw = useMotionValue(0), hh = useMotionValue(0)
  const sp = calm ? { stiffness: 4000, damping: 250, mass: 1 } : { stiffness: 240, damping: 30, mass: 0.9 }
  const x = useSpring(hx, sp), y = useSpring(hy, sp)
  const w = useSpring(hw, sp), h = useSpring(hh, sp)
  const nw = useTransform(w, (v) => -v)
  const d = useMotionTemplate`M0 0H${vp.w}V${vp.h}H0Z M${x} ${y}h${w}v${h}h${nw}Z`

  const close = useCallback((why: 'done' | 'skip') => {
    undo.current.splice(0).reverse().forEach((f) => { try { f() } catch { /* already gone */ } })
    onClose(why)
  }, [onClose])

  // start from the top each time it opens
  useEffect(() => { if (open) { setI(0); started.current = -1; setHole(null); setCover(null) } }, [open])
  useEffect(() => { const f = () => setVp({ w: innerWidth, h: innerHeight }); addEventListener('resize', f); return () => removeEventListener('resize', f) }, [])
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close('skip') }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [open, close])

  const next = () => { setWon(false); setLate(false); if (i >= steps.length - 1) close('done'); else setI(i + 1) }
  const back = () => { setWon(false); setLate(false); setI((n) => { let m = n - 1; while (m > 0 && steps[m].card) m--; return Math.max(0, m) }) }

  // entering a step: cut to its screen (behind a card when it is one), then run its setup
  useEffect(() => {
    if (!open || started.current === i) return
    started.current = i
    const ctx: GCtx = { go, onClose: (f) => undo.current.push(f) }
    setWon(false); setLate(false)
    if (step.card) {
      setCover('in'); setHole(null); setScope(null)
      const cut = setTimeout(() => { if (step.view) go(step.view) }, calm ? 120 : 260)
      const t = setTimeout(() => setCover('hold'), calm ? 160 : 320)
      return () => { clearTimeout(cut); clearTimeout(t) }
    }
    setCover(null)
    if (step.view && step.view !== view) go(step.view)
    const t = setTimeout(() => { step.setup?.(ctx); setReadyFor(step.id) }, step.view && step.view !== view ? 450 : 60)
    return () => clearTimeout(t)
  }, [open, i]) // eslint-disable-line react-hooks/exhaustive-deps

  // a title card is read, then the bars open; a tap or a key moves it on
  useEffect(() => {
    if (cover !== 'hold') return
    const lines = step.card?.lines?.length ?? 0
    const t = setTimeout(() => setCover('out'), calm ? 1400 : 1500 + lines * 450)
    return () => clearTimeout(t)
  }, [cover, step.card, calm])
  useEffect(() => {
    if (cover !== 'out') return
    const t = setTimeout(() => { setCover(null); next() }, calm ? 140 : 320)
    return () => clearTimeout(t)
  }, [cover]) // eslint-disable-line react-hooks/exhaustive-deps

  // follow the target while the step is up, and watch for the thing being done
  useEffect(() => {
    if (!open || step.card) return
    const born = Date.now()
    const tick = () => {
      const el = find(step.target)
      const sc = find(step.scope)
      const r = el?.getBoundingClientRect()
      const pad = step.pad ?? 8
      if (!step.target || (!r && Date.now() - born > 2500)) setHole(null)
      else if (r) {
        const n = { x: Math.max(0, r.left - pad), y: Math.max(0, r.top - pad), w: Math.min(innerWidth, r.width + pad * 2), h: Math.min(innerHeight, r.height + pad * 2) }
        setHole((p) => (p && Math.abs(p.x - n.x) < 0.6 && Math.abs(p.y - n.y) < 0.6 && Math.abs(p.w - n.w) < 0.6 && Math.abs(p.h - n.h) < 0.6 ? p : n))
      }
      const q = sc?.getBoundingClientRect()
      setScope(q && sc !== el ? { x: q.left - 4, y: q.top - 4, w: q.width + 8, h: q.height + 8 } : null)
      if (step.done && readyFor === step.id && !won) { try { if (step.done()) setWon(true) } catch { /* not ready */ } }
      if (step.done && Date.now() - born > 9000) setLate(true)
    }
    tick()
    const t = setInterval(tick, 100)
    return () => clearInterval(t)
  }, [open, step, won, readyFor])
  useEffect(() => {
    if (hole) { hx.set(hole.x); hy.set(hole.y); hw.set(hole.w); hh.set(hole.h) }
    else { hw.set(0); hh.set(0) }
  }, [hole]) // eslint-disable-line react-hooks/exhaustive-deps
  // finished the task: a beat to see it land, then on
  useEffect(() => { if (!won) return; const t = setTimeout(next, calm ? 350 : 800); return () => clearTimeout(t) }, [won]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!card.current) return
    const r = card.current.getBoundingClientRect()
    setSize((s) => (Math.abs(s.w - r.width) > 1 || Math.abs(s.h - r.height) > 1 ? { w: r.width, h: r.height } : s))
  })

  if (!open) return null
  const narrow = vp.w < 640
  const cw = Math.min(narrow ? vp.w - 24 : 344, vp.w - 24)
  // where the card sits: beside the part where there is room, otherwise above or below it; on a phone it docks to the far end
  let cx = (vp.w - cw) / 2, cy = (vp.h - size.h) / 2
  if (hole) {
    const gap = 16
    const below = vp.h - (hole.y + hole.h)
    const above = hole.y
    if (narrow) { cy = hole.y + hole.h / 2 > vp.h / 2 ? 12 : vp.h - size.h - 12 }
    else {
      const want = step.place
      const fitsRight = vp.w - (hole.x + hole.w) > cw + gap + 8
      const fitsLeft = hole.x > cw + gap + 8
      const side = want === 'right' && fitsRight ? 'right' : want === 'left' && fitsLeft ? 'left' : want === 'bottom' && below > size.h + gap ? 'bottom' : want === 'top' && above > size.h + gap ? 'top' : below > size.h + gap ? 'bottom' : above > size.h + gap ? 'top' : fitsRight ? 'right' : fitsLeft ? 'left' : 'center'
      if (side === 'bottom') { cy = hole.y + hole.h + gap; cx = hole.x + hole.w / 2 - cw / 2 }
      else if (side === 'top') { cy = hole.y - size.h - gap; cx = hole.x + hole.w / 2 - cw / 2 }
      else if (side === 'right') { cx = hole.x + hole.w + gap; cy = hole.y + hole.h / 2 - size.h / 2 }
      else if (side === 'left') { cx = hole.x - cw - gap; cy = hole.y + hole.h / 2 - size.h / 2 }
      else { cx = vp.w - cw - 16; cy = vp.h - size.h - 16 }
    }
  }
  cx = Math.min(Math.max(12, cx), vp.w - cw - 12)
  cy = Math.min(Math.max(12, cy), vp.h - size.h - 12)

  const interactive = !!step.done
  const lastInChapter = !steps[i + 1] || !!steps[i + 1].card
  const inChapter = (() => { let a = i; while (a > 0 && !steps[a].card) a--; let b = i; while (b < steps.length - 1 && !steps[b + 1].card) b++; return { n: i - a, of: b - a } })()
  const chapterName = (() => { let a = i; while (a > 0 && !steps[a].card) a--; return steps[a].card?.kicker ?? label })()

  return (
    <div className="pointer-events-none fixed inset-0 z-[140]" role="presentation" data-guide>
      {/* the dim, with a hole where the part is; clicks fall through the hole and stop everywhere else */}
      {!step.card && (
        <svg className="pointer-events-none absolute inset-0 size-full" width={vp.w} height={vp.h} aria-hidden>
          <motion.path d={d} fillRule="evenodd" className="fill-ground" fillOpacity={0.72} initial={false} animate={{ fillOpacity: hole ? 0.72 : 0.62 }} transition={{ duration: 0.25 }} style={{ pointerEvents: 'auto' }} />
        </svg>
      )}
      {!step.card && scope && <motion.div aria-hidden initial={false} animate={{ left: scope.x, top: scope.y, width: scope.w, height: scope.h }} transition={calm ? { duration: 0 } : { type: 'spring', ...sp }} className="pointer-events-none absolute border border-dashed border-ink/50" />}
      {!step.card && hole && (
        <motion.div aria-hidden style={{ x, y, width: w, height: h }} className="pointer-events-none absolute left-0 top-0">
          <div className={cn('absolute inset-0 border-2 transition-colors duration-200', won ? 'border-ok' : 'border-signal')} />
          {!calm && !won && <div className="tour-ping absolute inset-0 border-2 border-signal" />}
          <span className="absolute -left-px -top-px size-2.5 border-l-2 border-t-2 border-signal" /><span className="absolute -right-px -top-px size-2.5 border-r-2 border-t-2 border-signal" />
          <span className="absolute -bottom-px -left-px size-2.5 border-b-2 border-l-2 border-signal" /><span className="absolute -bottom-px -right-px size-2.5 border-b-2 border-r-2 border-signal" />
        </motion.div>
      )}

      {/* the step's card */}
      {!step.card && (
        <motion.div ref={card} role="dialog" aria-label={`${label}: ${step.title}`} aria-live="polite" initial={calm ? false : { opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, x: cx, y: cy, scale: 1 }} transition={calm ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30, opacity: { duration: 0.18 } }} style={{ width: cw }} className="glass pointer-events-auto absolute left-0 top-0 grid min-w-0 gap-2 overflow-hidden p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="hud text-signal">{chapterName}{inChapter.of > 1 ? ` · ${inChapter.n} of ${inChapter.of}` : ''}</p>
            <button onClick={() => close('skip')} className="h-11 -my-2 px-2 text-[13px] text-ink-2 hover:text-ink">Skip tour</button>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step.id} initial={calm ? false : { opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }} transition={{ duration: 0.2, ease }} className="grid gap-1.5">
              <h2 className="dot text-[1.25rem] font-bold leading-[1.15]">{step.title}</h2>
              <p className="text-[14px] leading-[1.45] text-ink-2">{step.body}</p>
              {step.task && (
                <p className={cn('mt-0.5 flex items-center gap-2 border px-2.5 py-2 text-[13px] font-semibold', won ? 'border-ok text-ok' : 'border-signal text-signal')} role="status">
                  {won ? <Check className="size-4 shrink-0" aria-hidden /> : <span aria-hidden className="size-2 shrink-0 bg-signal [animation:tour-blink_1s_steps(2)_infinite] motion-reduce:[animation:none]" />}
                  {won ? 'Got it' : step.task}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="mt-1 flex items-center justify-between gap-3">
            <button onClick={back} disabled={i === 0} className="h-11 shrink-0 whitespace-nowrap px-2 text-sm text-ink-2 hover:text-ink disabled:opacity-30">Back</button>
            <div className="flex min-w-0 flex-1 gap-[3px]" aria-hidden>{Array.from({ length: Math.max(0, inChapter.of) + 1 }, (_, k) => <span key={k} className={cn('h-1 min-w-0 flex-1 transition-colors', k <= inChapter.n ? 'bg-signal' : 'bg-ink/25')} />)}</div>
            {interactive && !won ? (
              <button onClick={next} className={cn('h-11 shrink-0 whitespace-nowrap px-3 text-sm', late ? 'bg-ink font-semibold text-ground' : 'text-ink-3 hover:text-ink')}>Skip step</button>
            ) : (
              <button autoFocus={!interactive} onClick={next} className="h-11 shrink-0 whitespace-nowrap bg-signal px-5 text-sm font-semibold text-on-signal">{lastInChapter && i >= steps.length - 2 ? 'Finish' : 'Next'}</button>
            )}
          </div>
        </motion.div>
      )}

      {/* the cut between chapters: bars close over the screen, the card is read, the bars open on the next one */}
      <AnimatePresence>
        {step.card && cover && (
          <motion.div key={`cut-${step.id}`} className="pointer-events-auto absolute inset-0 grid place-items-center" onClick={() => cover === 'hold' && setCover('out')} initial={false} animate={{}} exit={{}}>
            <motion.div aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-ground" style={{ transformOrigin: 'top' }} initial={calm ? { opacity: 0 } : { scaleY: 0 }} animate={cover === 'out' ? (calm ? { opacity: 0 } : { scaleY: 0 }) : (calm ? { opacity: 1 } : { scaleY: 1 })} transition={cover === 'out' ? { duration: calm ? 0.14 : 0.3, ease: [0.4, 0, 1, 1] } : { duration: calm ? 0.14 : 0.26, ease }} />
            <motion.div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-ground" style={{ transformOrigin: 'bottom' }} initial={calm ? { opacity: 0 } : { scaleY: 0 }} animate={cover === 'out' ? (calm ? { opacity: 0 } : { scaleY: 0 }) : (calm ? { opacity: 1 } : { scaleY: 1 })} transition={cover === 'out' ? { duration: calm ? 0.14 : 0.3, ease: [0.4, 0, 1, 1] } : { duration: calm ? 0.14 : 0.26, ease }} />
            {cover !== 'in' && (
              <motion.div role="dialog" aria-label={`${step.card.kicker}: ${step.card.title}`} className="relative grid max-w-[34rem] gap-3 px-6 text-center" animate={{ opacity: cover === 'out' ? 0 : 1 }} transition={{ duration: 0.18 }}>
                <motion.p initial={calm ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.3, ease }} className="hud text-signal">{chapterNo > 0 && chapters > 1 ? `${String(chapterNo).padStart(2, '0')} · ` : ''}{step.card.kicker}</motion.p>
                <h2 className="dot overflow-hidden text-[clamp(2rem,6vw,3.6rem)] font-bold uppercase leading-[1.05]">
                  {step.card.title.split(' ').map((word, k) => <span key={k}>{k > 0 && ' '}<motion.span className="inline-block" initial={calm ? false : { y: '110%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 + k * 0.07, duration: 0.34, ease }}>{word}</motion.span></span>)}
                </h2>
                {step.card.lines?.map((l, k) => <motion.p key={l} initial={calm ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + k * 0.45, duration: 0.3, ease }} className="text-[clamp(0.95rem,2.2vw,1.15rem)] leading-[1.4] text-ink-2">{l}</motion.p>)}
                <p className="hud mt-2 !text-[11px] text-ink-3">Tap to continue</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
