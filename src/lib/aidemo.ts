import { useEffect, useState } from 'react'
import { del } from 'idb-keyval'
import { cached } from './cache'

/** One demo written for a lesson topic: plain text for the frame around it, and the demo's own markup and script. */
export interface AiDemo { title: string; task: string; note: string; html: string }

const KEY = (title: string) => `learn:demo:v1:${title.toLowerCase()}`
const MONTH = 30 * 24 * 3600e3

const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.length <= max ? v : null)

/** Asks the server for a demo. Anything that is not a well-formed demo is an error, never a partial one. */
async function fetchDemo(title: string, signal: AbortSignal): Promise<AiDemo> {
  const r = await fetch(`/api/demo?t=${encodeURIComponent(title)}`, { signal, headers: { accept: 'application/json' } })
  if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new Error('demo')
  const d = (await r.json()) as Record<string, unknown>
  const demo = { title: text(d.title, 80), task: text(d.task, 400), note: text(d.note, 500), html: text(d.html, 20000) }
  if (!demo.title || !demo.task || !demo.note || !demo.html) throw new Error('demo')
  return demo as AiDemo
}

/** forget a saved demo, so a broken one is written again next time instead of failing again */
export const forgetDemo = (title: string) => { void del(KEY(title)).catch(() => undefined) }

export type DemoState = { status: 'off' | 'pending' | 'failed' } | { status: 'ready'; demo: AiDemo }

/** one request per topic at a time, shared by whoever asks (the prefetch when a topic is tapped, and the lesson itself) */
const inflight = new Map<string, Promise<AiDemo>>()
/** a miss is remembered for a minute, so tapping a topic and then opening its lesson does not ask twice */
const missed = new Map<string, number>()
function getDemo(title: string): Promise<AiDemo> {
  const key = KEY(title)
  let p = inflight.get(key)
  if (!p) {
    if (Date.now() - (missed.get(key) ?? 0) < 60e3) return Promise.reject(new Error('demo'))
    p = cached(key, MONTH, () => fetchDemo(title, AbortSignal.timeout(70e3))).catch((e) => { missed.set(key, Date.now()); throw e }).finally(() => inflight.delete(key))
    inflight.set(key, p)
  }
  return p
}

/** start writing a topic's demo right away, before its lesson has even loaded */
export const prefetchDemo = (title: string) => { void getDemo(title).catch(() => undefined) }

/**
 * The demo for a lesson, written while the learner reads the first ideas. It never blocks and never throws: the lesson only
 * ever sees "pending", "ready" or "failed". A failure of any kind (no key, no network, a slow or refused answer) is just "failed".
 */
export function useAiDemo(title: string, enabled: boolean): DemoState & { fail: () => void } {
  const [state, setState] = useState<DemoState>({ status: enabled ? 'pending' : 'off' })
  useEffect(() => {
    if (!enabled) { setState({ status: 'off' }); return }
    setState({ status: 'pending' })
    let dead = false
    getDemo(title)
      .then((demo) => { if (!dead) setState({ status: 'ready', demo }) })
      .catch(() => { if (!dead) setState({ status: 'failed' }) })
    return () => { dead = true }
  }, [title, enabled])
  return { ...state, fail: () => { forgetDemo(title); setState({ status: 'failed' }) } }
}
