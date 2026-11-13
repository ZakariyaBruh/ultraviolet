import { dprCap, everyFrame, settle, usePerf } from './perf'

/**
 * The one canvas behind the app. The contour field and the text solids used to be two full-screen canvases, each with its own
 * loop, so the browser pushed two screens of pixels up to 48 times a second. Now each is a layer that draws onto this one, in
 * order, in the same frame: one screen of pixels, once, and only as often as the slowest thing the layers ask for needs.
 *
 * A layer says how often it wants a fresh frame (`step`, in sixtieths of a second; 0 while it is still). When every layer is
 * still nothing runs at all, and a layer that changes for another reason (a panel moved, the theme changed) calls `redraw()`.
 */
export interface Layer {
  /** lower is further back */
  z: number
  /** sixtieths of a second between frames, 0 for a still layer */
  step: () => number
  /** called with the size in CSS pixels whenever the canvas changes size or sharpness */
  resize?: (w: number, h: number, dpr: number) => void
  /** draw onto a canvas that has just been cleared; the context is saved before and restored after, so set whatever you need */
  draw: (ctx: CanvasRenderingContext2D, now: number) => void
}

export class Stage {
  w = 0
  h = 0
  dpr = 1
  private cv: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private layers: Layer[] = []
  private off: (() => void) | null = null
  private ro: ResizeObserver | null = null
  private unsub: (() => void) | null = null
  private asked = 0
  private held = false

  /** give the stage its canvas (or take it away with null) */
  attach = (cv: HTMLCanvasElement | null) => {
    if (cv === this.cv) return
    this.ro?.disconnect(); this.unsub?.(); this.off?.()
    this.ro = null; this.unsub = null; this.off = null
    this.cv = cv
    this.ctx = cv?.getContext('2d') ?? null
    if (!cv || !this.ctx) return
    this.fit()
    this.ro = new ResizeObserver(() => { this.fit(); this.paint(performance.now()) })
    this.ro.observe(cv)
    // a change of level changes how sharp the canvas is and how often it is drawn
    this.unsub = usePerf.subscribe((s, p) => { if (s.tier !== p.tier) { this.fit(); this.sync(); this.redraw() } })
    this.sync()
    this.redraw()
  }

  /** be on the shared clock only while some layer is moving: a still backdrop costs nothing at all */
  private sync() {
    const moving = !!this.ctx && this.step() > 0
    if (moving && !this.off) this.off = everyFrame(this.paint, this.step)
    else if (!moving && this.off) { this.off(); this.off = null }
  }

  /** add a layer; returns the way to take it off again */
  add(layer: Layer): () => void {
    this.layers = [...this.layers, layer].sort((a, b) => a.z - b.z)
    if (this.w) layer.resize?.(this.w, this.h, this.dpr)
    this.sync(); this.redraw()
    return () => { this.layers = this.layers.filter((l) => l !== layer); this.sync(); this.redraw() }
  }

  /** stop drawing while something covers the whole screen (theatre mode, a game round); the last frame stays up */
  hold(on: boolean) {
    if (on === this.held) return
    this.held = on
    this.sync()
    if (!on) this.redraw()
  }

  /** one frame as soon as the browser is ready for it: for a still layer that has something new to show */
  redraw = () => {
    if (this.asked || !this.ctx) return
    this.asked = requestAnimationFrame((now) => { this.asked = 0; this.paint(now) })
  }

  private step = () => {
    if (this.held) return 0
    let n = 0
    for (const l of this.layers) { const s = l.step(); if (s > 0 && (n === 0 || s < n)) n = s }
    return n
  }

  private fit() {
    const cv = this.cv, ctx = this.ctx
    if (!cv || !ctx) return
    const dpr = Math.min(dprCap(), devicePixelRatio || 1)
    const w = cv.clientWidth, h = cv.clientHeight
    if (w === this.w && h === this.h && dpr === this.dpr) return
    this.w = w; this.h = h; this.dpr = dpr
    cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr))
    // a new size is honest work for a moment, not a slow device
    settle(1500)
    for (const l of this.layers) l.resize?.(w, h, dpr)
  }

  private paint = (now: number) => {
    const ctx = this.ctx
    if (!ctx || !this.w || !this.h) return
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.w, this.h)
    for (const l of this.layers) {
      ctx.save()
      l.draw(ctx, now)
      ctx.restore()
    }
  }
}
