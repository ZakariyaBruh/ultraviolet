import { RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLayout, type Offset, type Size } from '@/lib/layout'
import { useStore } from '@/lib/store'
import { raiseWidget } from '@/components/app/widgets/Window'

const SEL = '[data-movable]'
const SKIP = 'input, textarea, select, [role="slider"], [data-no-drag], canvas, iframe, video'
const EDGE = 6 // px a panel keeps from the screen edge
const GAP = 14 // px of air left when a panel is nudged clear of another
const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches
/** panels inside a page that scrolls (Insights) stay where the page puts them: a finger that lands on a panel that can be carried off cannot scroll */
const FLOW = '[data-flow]'
const inFlow = (el: Element) => !!el.closest(FLOW)

/** Chrome (player, nav) keeps one position everywhere; panels are remembered per screen. */
const scopeOf = (id: string, scope: string) => (id.startsWith('shell-') ? 'shell' : scope)

function scan(): { el: HTMLElement; id: string }[] {
  let n = 0
  return Array.from(document.querySelectorAll<HTMLElement>(SEL)).map((el) => {
    const named = el.dataset.movable
    if (named && named !== 'true') return { el, id: named }
    // unnamed panels are told apart by their order and their heading, so each one keeps its own place
    const h = el.querySelector('h1,h2,h3')?.textContent?.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 18) ?? ''
    return { el, id: `p${n++}${h ? `-${h}` : ''}` }
  })
}

/**
 * Whatever you touch comes to the top. Screen panels share one stack (11 to 28, under the header and the nav at 40); the study windows are a
 * layer of their own at 35, ordered inside it. So touching a window lifts the layer over the panels, and touching a panel that overlaps a
 * window drops the layer under the panels, which is the only way a panel can be both over one window and under another.
 */
const LAYER = '[data-widget-layer]'
const setLayer = (above: boolean) => document.querySelectorAll<HTMLElement>(LAYER).forEach((l) => { l.style.zIndex = above ? '35' : '5' })
const isPanel = (el: HTMLElement) => { const id = el.dataset.movable ?? ''; return !id.startsWith('widget-') && !id.startsWith('shell-') }
function raise(el: HTMLElement) {
  const z = (p: HTMLElement) => Number(p.style.zIndex) || 0
  const others = Array.from(document.querySelectorAll<HTMLElement>(SEL)).filter((p) => p !== el && isPanel(p) && z(p) > 0)
  const top = Math.max(10, ...others.map(z))
  if (top < 28) { el.style.zIndex = String(top + 1); return }
  // the top of the stack is reached: keep everyone's order and number them again from the bottom
  others.sort((a, b) => z(a) - z(b)).forEach((p, i) => { p.style.zIndex = String(11 + Math.min(i, 16)) })
  el.style.zIndex = '28'
}
const hits = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
function lift(el: HTMLElement) {
  const id = el.dataset.movable ?? ''
  if (id.startsWith('shell-')) return
  if (id.startsWith('widget-')) { setLayer(true); raiseWidget(el); return }
  raise(el)
  const r = el.getBoundingClientRect()
  if (Array.from(document.querySelectorAll<HTMLElement>('[data-movable^="widget-"]')).some((w) => hits(r, w.getBoundingClientRect()))) setLayer(false)
}

/** brings a panel over the study windows and the other panels, as a tap on it would */
export const bringToFront = (el: HTMLElement | null) => { if (el) lift(el) }

const live = (el: HTMLElement): Offset => ({ x: Number(el.dataset.ox) || 0, y: Number(el.dataset.oy) || 0 })

function paint(el: HTMLElement, o: Offset, rot = 0) {
  el.dataset.ox = String(o.x)
  el.dataset.oy = String(o.y)
  if (o.x || o.y) { el.style.translate = `${o.x}px ${o.y}px`; el.dataset.moved = 'true' }
  else { el.style.removeProperty('translate'); delete el.dataset.moved }
  if (rot) el.style.rotate = `${rot.toFixed(2)}deg`
  else el.style.removeProperty('rotate')
}

/** The screen-px scale a FitView puts on the panel (1 when none). */
const scaleOf = (el: HTMLElement) => (el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1) || 1

/**
 * Allowed offsets (in the panel's own px) that keep the whole panel on screen. A study window floats over the page area, which is
 * the part of the screen between the header and the player and nav, so it is kept inside that: below it the window would hang
 * past the page, trip the small-window scroll and be cut off there.
 */
function range(el: HTMLElement) {
  const k = scaleOf(el)
  const r = el.getBoundingClientRect()
  const o = live(el)
  const left = r.left - o.x * k
  const top = r.top - o.y * k
  const area = el.dataset.movable?.startsWith('widget-') || el.dataset.movable === 'shell-layers' ? el.parentElement?.getBoundingClientRect() : undefined
  const x0 = area?.left ?? 0, x1 = area?.right ?? innerWidth, y0 = area?.top ?? 0, y1 = area?.bottom ?? innerHeight
  const minX = (x0 + EDGE - left) / k
  const minY = (y0 + EDGE - top) / k
  return {
    k,
    minX, maxX: Math.max(minX, (x1 - EDGE - r.width - left) / k),
    minY, maxY: Math.max(minY, (y1 - EDGE - r.height - top) / k),
  }
}
const clampTo = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ───────── size ─────────
 * A panel the person has resized gets `data-sized` and four custom properties (`--rz-w`, `--rz-h` and the two margins that give back the room
 * it used to take); the rule for them is in index.css. Nothing else in the layout moves: like a moved panel, a resized one floats over the page.
 * Sizes are in the panel's own px (before any FitView scale) and are fitted to the room there is each time they are applied, so a window made
 * smaller later still holds them without losing what was chosen. */
const NOSIZE = new Set(['timer'])
/** the player, the nav and the layer tray keep one shape; so does the dial. A page that scrolls (Insights) lays its panels out itself. */
const canSize = (el: HTMLElement) => { const id = el.dataset.movable ?? ''; return !id.startsWith('shell-') && !NOSIZE.has(id) && !inFlow(el) }
/** study windows keep one size on every screen; panels are remembered per screen */
const sizeScopeOf = (id: string, scope: string) => (id.startsWith('shell-') || id.startsWith('widget-') ? 'shell' : scope)
const isWindow = (el: HTMLElement) => !!el.dataset.movable?.startsWith('widget-')
const minOf = (el: HTMLElement): Size => (isWindow(el) ? { w: 220, h: 130 } : { w: 150, h: 90 })
/** the room a panel may grow into: the page area, or the layer a study window floats in */
function areaOf(el: HTMLElement): DOMRect {
  if (isWindow(el) && el.parentElement) {
    // a window keeps the same small margin from the layer's edge that moving it does (range)
    const r = el.parentElement.getBoundingClientRect()
    return new DOMRect(r.x + EDGE, r.y + EDGE, Math.max(0, r.width - 2 * EDGE), Math.max(0, r.height - 2 * EDGE))
  }
  return (document.querySelector('#canvas > div') ?? document.body).getBoundingClientRect()
}
/** what the layout gives a panel when nobody has resized it (measured with the size taken off, then cached until the window changes shape) */
let gen = 0
const NAT = new WeakMap<HTMLElement, Size & { g: number }>()
function naturalOf(el: HTMLElement, fresh = false): Size {
  const hit = NAT.get(el)
  if (hit && hit.g === gen && !fresh) return hit
  const on = el.hasAttribute('data-sized')
  if (on) el.removeAttribute('data-sized')
  const n = { w: el.offsetWidth, h: el.offsetHeight, g: gen }
  if (on) el.setAttribute('data-sized', '')
  NAT.set(el, n)
  return n
}
function setSize(el: HTMLElement, s: Size, nat: Size = naturalOf(el)) {
  const st = el.style
  st.setProperty('--rz-w', `${s.w}px`)
  st.setProperty('--rz-h', `${s.h}px`)
  st.setProperty('--rz-mr', `${nat.w - s.w}px`)
  st.setProperty('--rz-mb', `${nat.h - s.h}px`)
  if (!el.hasAttribute('data-sized')) el.setAttribute('data-sized', '')
}
/** a panel that has been made small scrolls; one with nothing to press in it is given the keyboard focus so that it can still be scrolled without a mouse */
function reachable(el: HTMLElement) {
  const box = (isWindow(el) && el.querySelector<HTMLElement>('[data-win-body]')) || el
  const sized = el.hasAttribute('data-sized')
  const scrolls = box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1
  const holds = !!box.querySelector('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')
  if (sized && scrolls && !holds && !box.hasAttribute('tabindex')) {
    box.tabIndex = 0
    box.setAttribute('role', 'region')
    box.setAttribute('aria-label', el.querySelector('h1,h2,h3')?.textContent?.trim() || 'Panel')
    box.dataset.rzTab = ''
  } else if (box.dataset.rzTab !== undefined && !(sized && scrolls && !holds)) {
    box.removeAttribute('tabindex')
    box.removeAttribute('role')
    box.removeAttribute('aria-label')
    delete box.dataset.rzTab
  }
}
function clearSize(el: HTMLElement) {
  for (const p of ['--rz-w', '--rz-h', '--rz-mr', '--rz-mb']) el.style.removeProperty(p)
  el.removeAttribute('data-sized')
  NAT.delete(el)
  reachable(el)
}
/** a saved size, held to the room there is now and to the smallest a panel may be */
function fitSize(el: HTMLElement, s: Size) {
  const k = scaleOf(el)
  const a = areaOf(el)
  const m = minOf(el)
  setSize(el, { w: Math.round(clampTo(s.w, m.w, Math.max(m.w, a.width / k))), h: Math.round(clampTo(s.h, m.h, Math.max(m.h, a.height / k))) })
}

/**
 * A size that was chosen in a taller or wider window must not push the panel off the page in a smaller one (which would start the small-window
 * scroll): where the panel's own layout size would have fitted, what it is given is cut to the room that is left below and to the right of it.
 * The size that was chosen stays saved, so the panel opens out again when the window does.
 */
function contain(el: HTMLElement) {
  const a = areaOf(el)
  const r = el.getBoundingClientRect()
  const k = scaleOf(el)
  const nat = naturalOf(el)
  const m = minOf(el)
  let w = el.offsetWidth
  let h = el.offsetHeight
  if (r.right > a.right + 1 && r.left + nat.w * k <= a.right + 1) w = Math.max(m.w, (a.right - r.left) / k)
  if (r.bottom > a.bottom + 1 && r.top + nat.h * k <= a.bottom + 1) h = Math.max(m.h, (a.bottom - r.top) / k)
  if (Math.abs(w - el.offsetWidth) > 0.5 || Math.abs(h - el.offsetHeight) > 0.5) setSize(el, { w: Math.round(w), h: Math.round(h) }, nat)
}

/** Whatever the dropped panel now overlaps was put there on purpose: remember it, and forget pairs it has left. */
function rememberAt(scope: string, el: HTMLElement, id: string) {
  const mine = el.getBoundingClientRect()
  const old = (useLayout.getState().keep[scope] ?? []).filter((p) => !p.split('|').includes(id))
  const now = scan().filter((o) => o.el !== el && hits(mine, o.el.getBoundingClientRect())).map((o) => [id, o.id].sort().join('|'))
  useLayout.getState().setKeep(scope, Array.from(new Set([...old, ...now])))
}

/** keep a size (or, when it is the layout's own, forget it) and the place the panel ended up in */
function commit(scope: string, el: HTMLElement, id: string, size: Size, was: Offset) {
  const L = useLayout.getState()
  const nat = naturalOf(el)
  const s = sizeScopeOf(id, scope)
  if (Math.abs(size.w - nat.w) < 3 && Math.abs(size.h - nat.h) < 3) { clearSize(el); L.unsize(s, id) } else L.resize(s, id, size)
  const o = live(el)
  paint(el, { x: Math.round(o.x), y: Math.round(o.y) })
  if (Math.round(o.x) !== was.x || Math.round(o.y) !== was.y) L.move(scopeOf(id, scope), id, live(el))
  rememberAt(scope, el, id)
  reachable(el)
}

type Dir = 'n' | 'e' | 's' | 'w' | 'nw' | 'ne' | 'sw' | 'se'
const DIRS: Dir[] = ['n', 'e', 's', 'w', 'nw', 'ne', 'sw', 'se']
type Grab = { el: HTMLElement; id: string; dir: Dir; pid: number; x0: number; y0: number; k: number; r0: DOMRect; s0: Size; end: Size; nat: Size; area: DOMRect; prev?: Size; o0: Offset }

/**
 * The handles for resizing. They are drawn over the panel under the pointer, in a layer of their own, and not inside the panel: a panel that
 * has been made small scrolls its content, and handles inside it would scroll away with the text. A mouse sees them on hover (edges and
 * corners, with a grip in the bottom right); a finger sees the corner grip on the panel it last touched, with a target that reaches mostly
 * outwards so it never covers a button inside. Drag to resize, double-click to put the size back, Escape while dragging to cancel, and
 * Ctrl + Alt + arrow keys from the keyboard (Shift for bigger steps).
 */
function Resizers({ scope }: { scope: string }) {
  const frame = useRef<HTMLDivElement>(null)
  const tip = useRef<HTMLDivElement>(null)
  const grab = useRef<Grab | null>(null)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [coarse, setCoarse] = useState(false)
  const [busy, setBusy] = useState(false)

  // which panel the handles belong to: the one under the mouse, the one a finger last touched, the one with the keyboard focus
  useEffect(() => {
    let raf = 0
    let px = 0
    let py = 0
    const ok = (p: HTMLElement | null): p is HTMLElement => !!p && canSize(p) && !p.dataset.ghost && !p.dataset.min && !p.hasAttribute('inert')
    const pick = () => {
      raf = 0
      if (grab.current || document.documentElement.dataset.dragging) return
      const top = document.elementsFromPoint(px, py)[0]
      if (!top || top.closest('[data-rz-overlay]')) return // on a handle: keep the panel it belongs to
      const p = top.closest<HTMLElement>(SEL) ?? null
      setTarget(ok(p) ? p : null)
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      setCoarse(false)
      px = e.clientX
      py = e.clientY
      if (!raf) raf = requestAnimationFrame(pick)
    }
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      setCoarse(true)
      const t = e.target as Element
      if (t.closest('[data-rz-overlay]')) return
      const p = t.closest<HTMLElement>(SEL) ?? null
      setTarget(ok(p) ? p : null)
    }
    const focus = (e: FocusEvent) => {
      if (grab.current) return
      const p = (e.target as Element | null)?.closest?.<HTMLElement>(SEL) ?? null
      if (ok(p)) setTarget(p)
    }
    document.addEventListener('pointermove', move, { capture: true, passive: true })
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('focusin', focus)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointermove', move, true)
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('focusin', focus)
    }
  }, [])

  // the frame follows its panel (which may be rising in, being thrown or sitting on a page that scrolls)
  useEffect(() => {
    const f = frame.current
    if (!target || !f) return
    let raf = 0
    let last = ''
    const track = () => {
      if (!target.isConnected) { setTarget(null); return }
      const r = target.getBoundingClientRect()
      const hide = !!target.dataset.dragging || !!target.dataset.gliding || r.width < 2 || r.height < 2
      const now = `${hide}|${r.left}|${r.top}|${r.width}|${r.height}`
      if (now !== last) {
        last = now
        f.style.visibility = hide ? 'hidden' : 'visible'
        f.style.transform = `translate(${r.left}px, ${r.top}px)`
        f.style.width = `${r.width}px`
        f.style.height = `${r.height}px`
      }
      raf = requestAnimationFrame(track)
    }
    track()
    return () => cancelAnimationFrame(raf)
  }, [target])

  // Escape while dragging puts everything back as it was
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      const g = grab.current
      if (e.key !== 'Escape' || !g) return
      e.preventDefault()
      e.stopPropagation()
      grab.current = null
      delete g.el.dataset.resizing
      delete document.documentElement.dataset.dragging
      if (g.prev) fitSize(g.el, g.prev); else clearSize(g.el)
      paint(g.el, g.o0)
      setBusy(false)
    }
    document.addEventListener('keydown', esc, true)
    return () => document.removeEventListener('keydown', esc, true)
  }, [])

  // from the keyboard: Ctrl + Alt + arrows grow and shrink the panel that has the focus (right and down grow; Shift takes bigger steps)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.altKey || e.metaKey) return
      const v = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[] | undefined>)[e.key]
      const el = (document.activeElement as Element | null)?.closest?.<HTMLElement>(SEL)
      const hit = el && canSize(el) ? scan().find((p) => p.el === el) : undefined
      if (!v || !el || !hit) return
      e.preventDefault()
      const step = e.shiftKey ? 64 : 16
      const m = minOf(el)
      const a = areaOf(el)
      const k = scaleOf(el)
      const r = el.getBoundingClientRect()
      const was = live(el)
      const w = clampTo(el.offsetWidth + v[0] * step, m.w, Math.max(m.w, (Math.max(a.right, r.right) - r.left) / k))
      const h = clampTo(el.offsetHeight + v[1] * step, m.h, Math.max(m.h, (Math.max(a.bottom, r.bottom) - r.top) / k))
      setSize(el, { w, h })
      commit(scope, el, hit.id, { w, h }, was)
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [scope])

  const begin = (dir: Dir) => (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = target
    const hit = el ? scan().find((p) => p.el === el) : undefined
    if (!el || !hit || e.button !== 0 || !e.isPrimary || grab.current) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    lift(el)
    const nat = naturalOf(el, true)
    const s0 = { w: el.offsetWidth, h: el.offsetHeight }
    grab.current = { el, id: hit.id, dir, pid: e.pointerId, x0: e.clientX, y0: e.clientY, k: scaleOf(el), r0: el.getBoundingClientRect(), s0, end: s0, nat, area: areaOf(el), prev: useLayout.getState().sizes[sizeScopeOf(hit.id, scope)]?.[hit.id], o0: live(el) }
    el.dataset.resizing = 'true'
    document.documentElement.dataset.dragging = 'true'
    setBusy(true)
  }
  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = grab.current
    if (!g || e.pointerId !== g.pid) return
    const dx = (e.clientX - g.x0) / g.k
    const dy = (e.clientY - g.y0) / g.k
    const m = minOf(g.el)
    const d = g.dir
    // each edge may travel out to the edge of the room there is, and never less than where it already is
    const east = (Math.max(g.area.right, g.r0.right) - g.r0.left) / g.k
    const west = (g.r0.right - Math.min(g.area.left, g.r0.left)) / g.k
    const south = (Math.max(g.area.bottom, g.r0.bottom) - g.r0.top) / g.k
    const north = (g.r0.bottom - Math.min(g.area.top, g.r0.top)) / g.k
    let { w, h } = g.s0
    if (d.includes('e')) w = clampTo(g.s0.w + dx, m.w, Math.max(m.w, east))
    if (d.includes('w')) w = clampTo(g.s0.w - dx, m.w, Math.max(m.w, west))
    if (d.includes('s')) h = clampTo(g.s0.h + dy, m.h, Math.max(m.h, south))
    if (d.includes('n')) h = clampTo(g.s0.h - dy, m.h, Math.max(m.h, north))
    setSize(g.el, { w, h }, g.nat)
    // the panel grows out of the edge that was not grabbed: that edge stays where it was on the screen
    const r = g.el.getBoundingClientRect()
    const o = live(g.el)
    const wantL = d.includes('w') ? g.r0.right - r.width : g.r0.left
    const wantT = d.includes('n') ? g.r0.bottom - r.height : g.r0.top
    paint(g.el, { x: o.x + (wantL - r.left) / g.k, y: o.y + (wantT - r.top) / g.k })
    g.end = { w, h }
    if (tip.current) tip.current.textContent = `${Math.round(w)} × ${Math.round(h)}`
  }
  const finish = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = grab.current
    if (!g || e.pointerId !== g.pid) return
    grab.current = null
    delete g.el.dataset.resizing
    delete document.documentElement.dataset.dragging
    setBusy(false)
    commit(scope, g.el, g.id, g.end, g.o0)
  }
  const reset = () => {
    const el = target
    const hit = el ? scan().find((p) => p.el === el) : undefined
    if (!el || !hit) return
    clearSize(el)
    useLayout.getState().unsize(sizeScopeOf(hit.id, scope), hit.id)
  }

  return createPortal(
    target ? (
      <div ref={frame} data-rz-overlay data-coarse={coarse || undefined} data-active={busy || undefined} className="rz-frame" aria-hidden>
        {DIRS.map((d) => (
          <div key={d} data-rz={d} className={`rz rz-${d}`} title={d === 'se' ? 'Drag to resize. Double-click to put it back.' : undefined} onPointerDown={begin(d)} onPointerMove={drag} onPointerUp={finish} onPointerCancel={finish} onDoubleClick={reset} />
        ))}
        <svg className="rz-glyph" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square"><path d="M11 1 1 11M11 6 6 11" /></svg>
        {busy && <div ref={tip} className="rz-tip hud" />}
      </div>
    ) : null,
    document.body,
  )
}

/**
 * Every [data-movable] panel can be picked up anywhere that is not a control and thrown: it follows the pointer,
 * leans into the motion, glides on after release and settles. Positions persist per screen.
 * Keyboard: Alt + arrow keys inside a panel move it (Shift for bigger steps).
 */
export function ArrangeLayer({ scope }: { scope: string }) {
  // a tap anywhere on a panel or a window brings it to the top, drag or no drag; so does a tap inside a page frame (it takes the focus, and its own taps never reach us)
  useEffect(() => {
    const down = (e: PointerEvent) => { const el = (e.target as Element | null)?.closest?.<HTMLElement>(SEL); if (el) lift(el) }
    const blur = () => setTimeout(() => { const a = document.activeElement; if (a instanceof HTMLIFrameElement) { const el = a.closest<HTMLElement>(SEL); if (el) lift(el) } }, 0)
    document.addEventListener('pointerdown', down, true)
    addEventListener('blur', blur)
    return () => { document.removeEventListener('pointerdown', down, true); removeEventListener('blur', blur) }
  }, [])
  const offsets = useLayout((s) => s.offsets[scope])
  const shell = useLayout((s) => s.offsets.shell)
  const sizes = useLayout((s) => s.sizes[scope])
  const shellSizes = useLayout((s) => s.sizes.shell)

  // apply saved sizes and offsets whenever panels mount or change, then tidy anything the player or nav now sits on
  useEffect(() => {
    let raf = 0
    let t1: ReturnType<typeof setTimeout> | undefined
    const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    /**
     * The player and nav keep their place on every screen, so on a screen where they were never put over something
     * on purpose, anything they would cover is eased aside. Overlaps the user made themselves are left exactly as made.
     */
    const tidy = () => {
      const all = scan()
      const keep = useLayout.getState().keep[scope] ?? []
      // eased-aside panels stay inside the page's own area, never up over the header or down over the nav
      const area = document.querySelector('#canvas > div')?.getBoundingClientRect()
      if (!area) return
      const shells = all.filter(({ el, id }) => id.startsWith('shell-') && el.dataset.moved && !el.dataset.dragging && !el.dataset.gliding)
      // only free-standing panels are eased aside; page text and lists stay where the layout put them
      const cands = all.filter(({ el, id }) => !id.startsWith('shell-') && !offsets?.[id] && !inFlow(el))
      for (const { el, id } of cands) {
        if (el.dataset.dragging || el.dataset.gliding || el.dataset.resizing) continue
        const k = scaleOf(el)
        const cur = live(el)
        const r = el.getBoundingClientRect()
        const base = new DOMRect(r.left - cur.x * k, r.top - cur.y * k, r.width, r.height)
        let dx = 0
        let dy = 0
        if (shells.length && base.width * base.height < innerWidth * innerHeight * 0.5) {
          for (let pass = 0; pass < 3; pass++) {
            const box = new DOMRect(base.x + dx * k, base.y + dy * k, base.width, base.height)
            const sh = shells.find((x) => !keep.includes([id, x.id].sort().join('|')) && hit(box, x.el.getBoundingClientRect()))
            if (!sh) break
            const S = sh.el.getBoundingClientRect()
            const opts: [number, number][] = [[S.right + GAP - box.left, 0], [S.left - GAP - box.right, 0], [0, S.bottom + GAP - box.top], [0, S.top - GAP - box.bottom]]
            const fit = opts
              .filter(([x, y]) => box.left + x >= area.left && box.right + x <= area.right && box.top + y >= area.top && box.bottom + y <= area.bottom)
              .sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]))[0]
            if (!fit) break
            dx += fit[0] / k
            dy += fit[1] / k
          }
        }
        if (Math.round(dx) !== cur.x || Math.round(dy) !== cur.y) paint(el, { x: Math.round(dx), y: Math.round(dy) })
      }
    }
    const apply = () => {
      for (const { el, id } of scan()) {
        if (el.dataset.dragging || el.dataset.gliding || el.dataset.resizing) continue
        if (inFlow(el)) { if (el.dataset.moved) paint(el, { x: 0, y: 0 }); continue }
        // the size first, so that the limits for the offset below are those of the panel as it is now
        const z = (sizeScopeOf(id, scope) === 'shell' ? shellSizes : sizes)?.[id]
        if (z && canSize(el)) { fitSize(el, z); reachable(el) }
        else if (el.hasAttribute('data-sized')) clearSize(el)
        const o = (id.startsWith('shell-') ? shell : offsets)?.[id]
        if (!o) { if (id.startsWith('shell-') && el.dataset.moved) paint(el, { x: 0, y: 0 }); if (el.hasAttribute('data-sized')) contain(el); continue }
        const r = range(el)
        paint(el, { x: Math.round(clampTo(o.x, r.minX, r.maxX)), y: Math.round(clampTo(o.y, r.minY, r.maxY)) })
        if (el.hasAttribute('data-sized')) contain(el)
      }
      tidy()
    }
    const queue = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(apply); clearTimeout(t1); t1 = setTimeout(apply, 420) }
    queue()
    const mo = new MutationObserver(queue)
    mo.observe(document.body, { childList: true, subtree: true })
    // a window that changes shape changes what the layout gives each panel, so what was measured is measured again
    const reshaped = () => { gen++; queue() }
    addEventListener('resize', reshaped)
    return () => { mo.disconnect(); removeEventListener('resize', reshaped); cancelAnimationFrame(raf); clearTimeout(t1) }
  }, [offsets, shell, sizes, shellSizes, scope])

  useEffect(() => {
    type Drag = { el: HTMLElement; id: string; pid: number; x0: number; y0: number; o0: Offset; k: number; r: ReturnType<typeof range>; began: boolean; lx: number; ly: number; lt: number; vx: number; vy: number; rot: number }
    let d: Drag | null = null
    let swallow = false
    /*
     * In a window so small that the page scrolls (`#canvas[data-scroll]`), a panel lets a finger pan the page (`touch-action: pan-y`), so a vertical
     * swipe could never carry it: the page moved instead. There, a finger picks a panel up by holding still on it for a moment (it lifts, and a tap of
     * buzz where the device has one); from then on the page is held still (touchmove is cancelled) and the panel follows. A quick swipe still scrolls.
     */
    const HOLD_MS = 260
    let hold = 0
    let carrying = false
    const freeze = (e: TouchEvent) => { if (carrying && e.cancelable) e.preventDefault() }
    const drop = () => { clearTimeout(hold); hold = 0; carrying = false }
    const flair = () => !REDUCED() && useStore.getState().settings.motion > 0

    const save = (el: HTMLElement, id: string) => { useLayout.getState().move(scopeOf(id, scope), id, live(el)); rememberAt(scope, el, id) }

    const glide = (el: HTMLElement, id: string, vx: number, vy: number, rot: number, r: ReturnType<typeof range>) => {
      vx = clampTo(vx, -2.5, 2.5)
      vy = clampTo(vy, -2.5, 2.5)
      let { x, y } = live(el)
      let last = performance.now()
      el.dataset.gliding = 'true'
      const tick = (now: number) => {
        const dt = Math.min(32, now - last)
        last = now
        const f = Math.pow(0.9, dt / 16)
        x += vx * dt; y += vy * dt; vx *= f; vy *= f; rot *= Math.pow(0.8, dt / 16)
        if (x < r.minX || x > r.maxX) { x = clampTo(x, r.minX, r.maxX); vx *= -0.12 }
        if (y < r.minY || y > r.maxY) { y = clampTo(y, r.minY, r.maxY); vy *= -0.12 }
        paint(el, { x, y }, Math.abs(rot) > 0.05 ? rot : 0)
        if (Math.hypot(vx, vy) > 0.02 || Math.abs(rot) > 0.05) requestAnimationFrame(tick)
        else { delete el.dataset.gliding; paint(el, { x: Math.round(x), y: Math.round(y) }); save(el, id) }
      }
      requestAnimationFrame(tick)
    }

    const down = (e: PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary || d) return
      const t = e.target as Element
      const el = t.closest<HTMLElement>(SEL)
      if (!el || t.closest(SKIP) || inFlow(el)) return
      const hit = scan().find((p) => p.el === el)
      if (!hit) return
      delete el.dataset.gliding
      const r = range(el)
      const cur: Drag = { el, id: hit.id, pid: e.pointerId, x0: e.clientX, y0: e.clientY, o0: live(el), k: r.k, r, began: false, lx: e.clientX, ly: e.clientY, lt: e.timeStamp, vx: 0, vy: 0, rot: 0 }
      d = cur
      if (e.pointerType === 'touch' && getComputedStyle(el).touchAction !== 'none') {
        // the page can scroll under this finger: wait for a hold before it is a drag
        hold = window.setTimeout(() => {
          if (d !== cur || cur.began) return
          carrying = true
          cur.o0 = live(el); cur.x0 = cur.lx; cur.y0 = cur.ly
          el.dataset.dragging = 'true'
          lift(el)
          document.documentElement.dataset.dragging = 'true'
          navigator.vibrate?.(8)
        }, HOLD_MS)
      }
    }
    const move = (e: PointerEvent) => {
      if (!d || e.pointerId !== d.pid) return
      const dx = e.clientX - d.x0
      const dy = e.clientY - d.y0
      if (hold && !carrying) {
        if (Math.hypot(dx, dy) > 7) { drop(); d = null } // a swipe: it is the page's
        else { d.lx = e.clientX; d.ly = e.clientY }
        return
      }
      if (!d.began) {
        if (Math.hypot(dx, dy) < 7) return
        d.began = true
        d.el.setPointerCapture?.(d.pid)
        d.el.dataset.dragging = 'true'
        lift(d.el) // the one you hold comes to the front
        document.documentElement.dataset.dragging = 'true'
      }
      // a little resistance past the edges, so it feels like cloth, not a wall
      const rub = (v: number, lo: number, hi: number) => (v < lo ? lo + (v - lo) * 0.25 : v > hi ? hi + (v - hi) * 0.25 : v)
      const x = rub(d.o0.x + dx / d.k, d.r.minX, d.r.maxX)
      const y = rub(d.o0.y + dy / d.k, d.r.minY, d.r.maxY)
      const dt = Math.max(1, e.timeStamp - d.lt)
      d.vx = d.vx * 0.6 + ((e.clientX - d.lx) / d.k / dt) * 0.4
      d.vy = d.vy * 0.6 + ((e.clientY - d.ly) / d.k / dt) * 0.4
      d.lx = e.clientX; d.ly = e.clientY; d.lt = e.timeStamp
      d.rot = flair() ? clampTo(d.vx * 6, -4, 4) : 0
      paint(d.el, { x, y }, d.rot)
    }
    const up = (e: PointerEvent) => {
      if (!d || e.pointerId !== d.pid) return
      const cur = d
      const wasCarrying = carrying
      d = null
      drop()
      if (!cur.began) {
        if (wasCarrying) { delete cur.el.dataset.dragging; delete document.documentElement.dataset.dragging }
        return
      }
      swallow = true
      setTimeout(() => { swallow = false }, 0)
      delete cur.el.dataset.dragging
      delete document.documentElement.dataset.dragging
      const idle = e.timeStamp - cur.lt > 90
      if (flair() && !idle) glide(cur.el, cur.id, cur.vx, cur.vy, cur.rot, cur.r)
      else {
        const r = cur.r // measured before the panel leaned, so its tilt cannot skew the limits
        const o = live(cur.el)
        paint(cur.el, { x: Math.round(clampTo(o.x, r.minX, r.maxX)), y: Math.round(clampTo(o.y, r.minY, r.maxY)) })
        save(cur.el, cur.id)
      }
    }
    const click = (e: Event) => { if (swallow) { e.preventDefault(); e.stopPropagation() } }
    const key = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return // Ctrl + Alt + arrows resize (Resizers)
      const el = (document.activeElement as Element | null)?.closest<HTMLElement>(SEL)
      if (!el || inFlow(el)) return
      const s = e.shiftKey ? 48 : 12
      const v = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key]
      const hit = scan().find((p) => p.el === el)
      if (!v || !hit) return
      e.preventDefault()
      const r = range(el)
      const o = live(el)
      paint(el, { x: clampTo(o.x + v[0], r.minX, r.maxX), y: clampTo(o.y + v[1], r.minY, r.maxY) })
      save(el, hit.id)
    }
    document.addEventListener('touchmove', freeze, { passive: false })
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointermove', move, true)
    document.addEventListener('pointerup', up, true)
    document.addEventListener('pointercancel', up, true)
    document.addEventListener('click', click, true)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('touchmove', freeze)
      drop()
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointermove', move, true)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointercancel', up, true)
      document.removeEventListener('click', click, true)
      document.removeEventListener('keydown', key)
    }
  }, [scope])

  return <Resizers scope={scope} />
}

/** Shows only once something has been moved or resized: one press puts this screen's panels (and the study windows) back. */
export function ArrangeButtons({ scope }: { scope: string }) {
  const reset = useLayout((s) => s.reset)
  const moved = useLayout((s) => Object.keys(s.offsets[scope] ?? {}).length + Object.keys(s.offsets.shell ?? {}).length + Object.keys(s.sizes[scope] ?? {}).length + Object.keys(s.sizes.shell ?? {}).length > 0)
  if (!moved) return null
  return (
    <button onClick={() => { reset(scope); reset('shell') }} aria-label="Put the panels back where they started, at their own size" className="grid size-11 place-items-center text-ink-2 hover:bg-ink/10 hover:text-ink md:size-10">
      <RotateCcw className="size-4" />
    </button>
  )
}
