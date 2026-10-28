import { RotateCcw } from 'lucide-react'
import { useEffect } from 'react'
import { useLayout, type Offset } from '@/lib/layout'
import { useStore } from '@/lib/store'

const SEL = '[data-movable]'
const SKIP = 'input, textarea, select, [role="slider"], [data-no-drag], canvas, iframe, video'
const EDGE = 6 // px a panel keeps from the screen edge
const GAP = 14 // px of air left when a panel is nudged clear of another
const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches

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
  const area = el.dataset.movable?.startsWith('widget-') ? el.parentElement?.getBoundingClientRect() : undefined
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

/**
 * Every [data-movable] panel can be picked up anywhere that is not a control and thrown: it follows the pointer,
 * leans into the motion, glides on after release and settles. Positions persist per screen.
 * Keyboard: Alt + arrow keys inside a panel move it (Shift for bigger steps).
 */
export function ArrangeLayer({ scope }: { scope: string }) {
  const offsets = useLayout((s) => s.offsets[scope])
  const shell = useLayout((s) => s.offsets.shell)

  // apply saved offsets whenever panels mount or change, then tidy anything the player or nav now sits on
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
      const cands = all.filter(({ id }) => !id.startsWith('shell-') && !offsets?.[id])
      for (const { el, id } of cands) {
        if (el.dataset.dragging || el.dataset.gliding) continue
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
        if (el.dataset.dragging || el.dataset.gliding) continue
        const o = (id.startsWith('shell-') ? shell : offsets)?.[id]
        if (!o) { if (id.startsWith('shell-') && el.dataset.moved) paint(el, { x: 0, y: 0 }); continue }
        const r = range(el)
        paint(el, { x: Math.round(clampTo(o.x, r.minX, r.maxX)), y: Math.round(clampTo(o.y, r.minY, r.maxY)) })
      }
      tidy()
    }
    const queue = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(apply); clearTimeout(t1); t1 = setTimeout(apply, 420) }
    queue()
    const mo = new MutationObserver(queue)
    mo.observe(document.body, { childList: true, subtree: true })
    addEventListener('resize', queue)
    return () => { mo.disconnect(); removeEventListener('resize', queue); cancelAnimationFrame(raf); clearTimeout(t1) }
  }, [offsets, shell, scope])

  useEffect(() => {
    type Drag = { el: HTMLElement; id: string; pid: number; x0: number; y0: number; o0: Offset; k: number; r: ReturnType<typeof range>; began: boolean; lx: number; ly: number; lt: number; vx: number; vy: number; rot: number }
    let d: Drag | null = null
    let swallow = false
    let z = 10
    const flair = () => !REDUCED() && useStore.getState().settings.motion > 0

    const hits = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    /** Whatever the dropped panel now overlaps was put there on purpose: remember it, and forget pairs it has left. */
    const remember = (el: HTMLElement, id: string) => {
      const mine = el.getBoundingClientRect()
      const old = (useLayout.getState().keep[scope] ?? []).filter((p) => !p.split('|').includes(id))
      const now = scan().filter((o) => o.el !== el && hits(mine, o.el.getBoundingClientRect())).map((o) => [id, o.id].sort().join('|'))
      useLayout.getState().setKeep(scope, Array.from(new Set([...old, ...now])))
    }
    const save = (el: HTMLElement, id: string) => { useLayout.getState().move(scopeOf(id, scope), id, live(el)); remember(el, id) }

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
      if (!el || t.closest(SKIP)) return
      const hit = scan().find((p) => p.el === el)
      if (!hit) return
      delete el.dataset.gliding
      const r = range(el)
      d = { el, id: hit.id, pid: e.pointerId, x0: e.clientX, y0: e.clientY, o0: live(el), k: r.k, r, began: false, lx: e.clientX, ly: e.clientY, lt: e.timeStamp, vx: 0, vy: 0, rot: 0 }
    }
    const move = (e: PointerEvent) => {
      if (!d || e.pointerId !== d.pid) return
      const dx = e.clientX - d.x0
      const dy = e.clientY - d.y0
      if (!d.began) {
        if (Math.hypot(dx, dy) < 7) return
        d.began = true
        d.el.setPointerCapture?.(d.pid)
        d.el.dataset.dragging = 'true'
        d.el.style.zIndex = String(10 + (z = (z % 18) + 1)) // the one you hold comes to the front
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
      d = null
      if (!cur.began) return
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
      if (!e.altKey) return
      const el = (document.activeElement as Element | null)?.closest<HTMLElement>(SEL)
      if (!el) return
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
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointermove', move, true)
    document.addEventListener('pointerup', up, true)
    document.addEventListener('pointercancel', up, true)
    document.addEventListener('click', click, true)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointermove', move, true)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointercancel', up, true)
      document.removeEventListener('click', click, true)
      document.removeEventListener('keydown', key)
    }
  }, [scope])

  return null
}

/** Shows only once something has been moved: one press puts this screen's panels back. */
export function ArrangeButtons({ scope }: { scope: string }) {
  const reset = useLayout((s) => s.reset)
  const moved = useLayout((s) => Object.keys(s.offsets[scope] ?? {}).length + Object.keys(s.offsets.shell ?? {}).length > 0)
  if (!moved) return null
  return (
    <button onClick={() => { reset(scope); reset('shell') }} aria-label="Put the panels back where they started" className="grid size-11 place-items-center text-ink-2 hover:bg-ink/10 hover:text-ink md:size-10">
      <RotateCcw className="size-4" />
    </button>
  )
}
