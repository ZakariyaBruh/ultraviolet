import { useEffect, useLayoutEffect, useState } from 'react'

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

/** Measures an element, even one that mounts late or comes and goes: it is a callback ref, so it re-attaches itself. */
export function useSize<T extends HTMLElement>(): [(node: T | null) => void, { w: number; h: number }] {
  const [el, setEl] = useState<T | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [setEl, size]
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
