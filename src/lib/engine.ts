import { useEffect, useRef } from 'react'
import { useFx } from './fx'
import { useStore } from './store'

const INTERACTIVE = 'input, textarea, select, [contenteditable="true"], [data-allow-scroll]'
const SCROLL_KEYS = new Set([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'End', 'Home'])

/**
 * The whole app is one screen. Anything that looks like an attempt to scroll
 * (wheel, swipe, scroll keys) is swallowed, counted, and celebrated.
 */
export function useScrollGuard() {
  useEffect(() => {
    let last = 0
    let startY = 0
    let startX = 0
    let swiped = false

    const urge = (x: number, y: number) => {
      const now = performance.now()
      if (now - last < 450) return
      last = now
      const s = useStore.getState()
      s.addUrge()
      useFx.getState().burst(x, y, (s.session?.urges ?? 0) + 1)
    }

    const wheel = (e: WheelEvent) => {
      if ((e.target as Element | null)?.closest?.(INTERACTIVE)) return
      if (Math.abs(e.deltaY) < 2) return
      e.preventDefault()
      urge(e.clientX, e.clientY)
    }
    const ts = (e: TouchEvent) => {
      startY = e.touches[0].clientY
      startX = e.touches[0].clientX
      swiped = false
    }
    const tm = (e: TouchEvent) => {
      if ((e.target as Element | null)?.closest?.(INTERACTIVE)) return
      const t = e.touches[0]
      const dy = t.clientY - startY
      if (Math.abs(dy) > 38 && Math.abs(dy) > Math.abs(t.clientX - startX) * 1.3 && !swiped) {
        swiped = true
        urge(t.clientX, t.clientY)
      }
      if (e.cancelable) e.preventDefault()
    }
    const key = (e: KeyboardEvent) => {
      if (!SCROLL_KEYS.has(e.key)) return
      const el = e.target as Element | null
      if (el?.closest?.(INTERACTIVE) || el?.closest?.('button, [role="slider"], [role="tab"]')) return
      e.preventDefault()
      urge(innerWidth / 2, innerHeight / 2)
    }

    addEventListener('wheel', wheel, { passive: false })
    addEventListener('touchstart', ts, { passive: true })
    addEventListener('touchmove', tm, { passive: false })
    addEventListener('keydown', key)
    return () => {
      removeEventListener('wheel', wheel)
      removeEventListener('touchstart', ts)
      removeEventListener('touchmove', tm)
      removeEventListener('keydown', key)
    }
  }, [])
}

/** Drives the focus timer and notices when you wander off to another tab. */
export function useSessionEngine() {
  const active = useStore((s) => !!s.session && !s.session.paused)
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return
    let prev = performance.now()
    const t = setInterval(() => {
      const now = performance.now()
      const dt = Math.min(5, (now - prev) / 1000)
      prev = now
      if (document.visibilityState === 'visible') useStore.getState().tick(dt)
    }, 1000)
    return () => clearInterval(t)
  }, [active])

  useEffect(() => {
    const onVis = () => {
      const s = useStore.getState().session
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = s && !s.paused ? Date.now() : null
        return
      }
      const at = hiddenAt.current
      hiddenAt.current = null
      if (!at || !useStore.getState().session) return
      const away = Math.round((Date.now() - at) / 1000)
      if (away >= 6) {
        useStore.getState().addLapse()
        useFx.getState().say({
          title: 'You wandered off',
          description: `${away}s away from your session. The timer waited for you.`,
          variant: 'warning',
        })
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
}
