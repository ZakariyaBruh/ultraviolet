import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export function useSize<T extends HTMLElement>(): [RefObject<T | null>, { w: number; h: number }] {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size]
}

/** How many fixed-size cards fit the box, so lists page instead of scroll. */
export function useGridFit(minW: number, minH: number, gap = 12, maxCols = 4) {
  const [ref, { w, h }] = useSize<HTMLDivElement>()
  const cols = Math.max(1, Math.min(maxCols, Math.floor((w + gap) / (minW + gap))))
  const rows = Math.max(1, Math.floor((h + gap) / (minH + gap)))
  return { ref, cols, rows, per: cols * rows }
}

export function useCoarse() {
  const [coarse, setCoarse] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches)
  useEffect(() => {
    const m = matchMedia('(pointer: coarse)')
    const f = () => setCoarse(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return coarse
}

export function useMedia(query: string) {
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query)
    const f = () => setM(mq.matches)
    f()
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [query])
  return m
}
