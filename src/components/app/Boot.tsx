import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useStore } from '@/lib/store'

/**
 * A small terminal boots when the site opens, once for each visit: a few lines that are all true (nothing here is made up to look busy), then it
 * clears. It is skipped under calm motion and reduced motion, and any key or tap cuts it short. It is a label, so it uses the mono face the
 * station's other readouts use, not body text.
 */
const LINES: [string, string][] = [
  ['storage', 'this browser'],
  ['account', 'not needed'],
  ['feed', 'none'],
  ['scrolling', 'off'],
  ['ai', 'minimal, labelled'],
  ['clock', 'counts only when you are here'],
]
const STEP = 190
const KEY = 'friction:booted'

export function Boot() {
  const reduced = !!useReducedMotion()
  const level = useStore((s) => s.settings.motion)
  const [shown, setShown] = useState(() => {
    try { return sessionStorage.getItem(KEY) !== '1' } catch { return true }
  })
  const [n, setN] = useState(0)
  const [out, setOut] = useState(false)
  const skip = reduced || level === 0

  const finish = () => {
    setOut(true)
    try { sessionStorage.setItem(KEY, '1') } catch { /* storage blocked */ }
    setTimeout(() => setShown(false), 220)
  }

  useEffect(() => {
    if (!shown) return
    if (skip) { try { sessionStorage.setItem(KEY, '1') } catch { /* storage blocked */ } setShown(false); return }
    const t = setInterval(() => setN((v) => v + 1), STEP)
    return () => clearInterval(t)
  }, [shown, skip])
  useEffect(() => { if (shown && !skip && n === LINES.length + 3) finish() }, [n]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!shown || skip) return
    const k = () => finish()
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [shown, skip]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!shown || skip) return null
  const done = n > LINES.length
  return (
    <div role="status" aria-label="Friction is starting" onPointerDown={finish} className="fixed inset-0 z-[200] grid place-items-center bg-ground p-4 transition-opacity duration-200 ease-in" style={{ opacity: out ? 0 : 1 }}>
      <div className="w-full max-w-[26rem] border border-rule bg-ground p-4 text-left text-[13px] leading-[1.7] text-ink" style={{ fontFamily: 'var(--font-mono)' }} aria-live="off">
        <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-signal">Friction · boot</p>
        {LINES.slice(0, n).map(([k, v]) => (
          <p key={k} className="flex gap-2 whitespace-nowrap"><span className="text-ink-3">&gt;</span><span className="w-[5.6rem] shrink-0 text-ink-2">{k}</span><span className="truncate">{v}</span></p>
        ))}
        {n < LINES.length && <p className="text-signal"><span className="inline-block h-[1em] w-[0.55em] translate-y-[0.15em] bg-signal" /></p>}
        {done && <p className="mt-1 text-signal">&gt; ready</p>}
      </div>
    </div>
  )
}
