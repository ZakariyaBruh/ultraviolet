import { Component, lazy, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { LoadingBlock } from '@/components/app/LoadingBlock'

/**
 * The app is sent in parts: the screen you are on, then the others while nothing else is happening, and the heavy extras (the stream
 * library, the Browser window, the tour) only when they are first used. This file is the plumbing for that.
 *
 * `part(load)` makes a component from a file that is fetched on demand. `preload()` fetches it ahead of time, and a part that is
 * already here is drawn at once with no loading state. A part that cannot be fetched (offline, or the app was updated while this
 * tab was open and the old file is gone) throws a `LoadError`, which `PartBoundary` turns into a plain message instead of a crash.
 */
export class LoadError extends Error {
  constructor(cause: unknown) {
    super('A part of Friction could not be fetched')
    this.name = 'LoadError'
    this.cause = cause
  }
}

/** `preload` fetches the part ahead of time and settles when it is here (or when it could not be fetched: it never rejects) */
export interface Part<P> { (props: P): ReactNode; preload: () => Promise<void> }

export function part<P extends object>(load: () => Promise<ComponentType<P>>): Part<P> {
  let Ready: ComponentType<P> | null = null
  let going: Promise<ComponentType<P>> | null = null
  const make = () => lazy(() => fetchIt().then((c) => ({ default: c })))
  let Lazy = make()
  // a failed fetch is forgotten, so the next mount (Try again, or coming back online) asks again instead of failing for good
  const fetchIt = (): Promise<ComponentType<P>> => (going ??= load().then((c) => (Ready = c), (e) => { going = null; Lazy = make(); throw new LoadError(e) }))
  function Piece(props: P) {
    // the choice is made once for each mount, so a part that arrives later never swaps the component under a mounted screen
    const [Now] = useState<ComponentType<P>>(() => Ready ?? Lazy)
    return <Now {...props} />
  }
  return Object.assign(Piece, { preload: () => fetchIt().then(() => undefined, () => undefined) })
}

/** Shown where a part is still on its way. It stays invisible for a quarter of a second, so a part that arrives quickly never flashes a loader. */
export function Waiting({ label = 'Loading', small = false }: { label?: string; small?: boolean }) {
  return <div className={small ? 'part-wait' : 'part-wait h-full'}><LoadingBlock label={label} size={small ? 40 : 72} className={small ? 'min-h-[96px]' : undefined} /></div>
}

function Failed({ again, small }: { again: () => void; small?: boolean }) {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false)
  // back online: ask again without being told to
  useEffect(() => {
    const on = () => { setOnline(true); again() }
    const off = () => setOnline(false)
    addEventListener('online', on); addEventListener('offline', off)
    return () => { removeEventListener('online', on); removeEventListener('offline', off) }
  }, [again])
  const btn = 'h-11 px-5 text-sm font-semibold'
  return (
    <div role="alert" className={`grid place-content-center justify-items-center gap-3 p-4 text-center ${small ? 'min-h-[96px]' : 'h-full min-h-[160px]'}`}>
      <p className="hud">{online ? 'Not loaded' : 'You are offline'}</p>
      <p className="max-w-[38ch] text-sm leading-[1.45] text-ink-2">
        {online
          ? 'This part of Friction could not be fetched. If you were offline just now, or the app was updated while this tab was open, reloading fixes it. Everything you have made stays in this browser.'
          : 'This part of Friction has not been fetched yet, so it cannot open until you are back online. What is already open keeps working.'}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {online && <button onClick={() => location.reload()} className={`${btn} bg-signal text-on-signal`}>Reload</button>}
        <button onClick={again} className={`${btn} border border-ink/30 text-ink hover:bg-ink/10`}>Try again</button>
      </div>
    </div>
  )
}

/**
 * Catches a part that could not be fetched and says so in place. Any other fault is passed up to the page's own boundary.
 * `quiet` is for parts with no place of their own (search, the celebration card): nothing is drawn and `onFail` is told, and the
 * part is asked for again the next time `resetKey` changes (the next time it is opened).
 */
export class PartBoundary extends Component<{ children: ReactNode; small?: boolean; quiet?: boolean; onFail?: () => void; resetKey?: unknown }, { err: unknown }> {
  state: { err: unknown } = { err: null }
  static getDerivedStateFromError(err: unknown) {
    return { err }
  }
  componentDidCatch(err: unknown) {
    if (err instanceof LoadError) this.props.onFail?.()
  }
  componentDidUpdate(prev: { resetKey?: unknown }) {
    if (this.state.err && prev.resetKey !== this.props.resetKey) this.setState({ err: null })
  }
  again = () => this.setState({ err: null })
  render() {
    const { err } = this.state
    if (!err) return this.props.children
    if (!(err instanceof LoadError)) throw err
    return this.props.quiet ? null : <Failed again={this.again} small={this.props.small} />
  }
}

/** Run `task` once the browser has nothing better to do (or after a short wait where it cannot say). */
export const whenIdle = (task: () => void, wait = 1500) => {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  if (ric) ric(task, { timeout: wait + 3000 })
  else setTimeout(task, wait)
}

/** Someone who has asked their browser to save data, or is on a very slow link, gets parts only when they ask for them. */
export const frugal = () => {
  const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  return !!c && (c.saveData === true || c.effectiveType === 'slow-2g' || c.effectiveType === '2g')
}
