import { useEffect, useState, type ReactNode } from 'react'
import { analyticsConsent, analyticsEvent, setAnalyticsConsent, type AnalyticsConsent } from '@/lib/analytics'

const BARS = ['#f3f1ea', '#ffd23f', '#3ee0ff', '#4ade80', '#ff5d8f', '#ff3b3b', '#3b5bff']

function useAnalyticsConsent(): AnalyticsConsent {
  const [v, setV] = useState<AnalyticsConsent>(analyticsConsent)
  useEffect(() => {
    const fn = () => setV(analyticsConsent())
    addEventListener(analyticsEvent, fn)
    return () => removeEventListener(analyticsEvent, fn)
  }, [])
  return v
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-ground text-ink">
      <div className="flex h-2.5" aria-hidden>{BARS.map((c) => <i key={c} className="flex-1" style={{ background: c }} />)}</div>
      <div className="mx-auto w-full max-w-xl px-5 py-8 pb-16">{children}</div>
    </div>
  )
}

function Choice() {
  const choice = useAnalyticsConsent()
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" aria-pressed={choice === 'granted'} onClick={() => setAnalyticsConsent('granted')} className="h-11 bg-signal px-4 text-sm font-semibold text-on-signal">Allow</button>
      <button type="button" aria-pressed={choice === 'denied'} onClick={() => setAnalyticsConsent('denied')} className="h-11 border border-ink/30 px-4 text-sm">Don&apos;t count visits</button>
    </div>
  )
}

/** A short account of what stays on the device and when a page visit is counted. */
export function PrivacyPage() {
  return (
    <Frame>
      <p className="hud">Friction</p>
      <h1 className="dot mt-2 text-[clamp(2rem,6vw,3rem)] uppercase">Privacy</h1>
      <p className="mt-4 text-[16px] leading-6">Friction has no account. The timer, your sessions and your settings stay in this browser, except for the few things named here.</p>
      <h2 className="mt-8 font-[family-name:var(--font-cond)] text-lg font-semibold uppercase tracking-[0.08em]">In this browser</h2>
      <p className="mt-2 text-[16px] leading-6 text-ink-2">Sessions, settings, notes, layout and credits are stored on this device. Settings, under Data, has Erase everything.</p>
      <h2 className="mt-8 font-[family-name:var(--font-cond)] text-lg font-semibold uppercase tracking-[0.08em]">A server, for these only</h2>
      <p className="mt-2 text-[16px] leading-6 text-ink-2">A Together room keeps the name you show friends, the chat and a shared station while someone is in it. The leaderboard keeps a public alias and a count. Moving your data to another browser parks an encrypted copy for ten minutes. The server cannot read that copy.</p>
      <h2 className="mt-8 font-[family-name:var(--font-cond)] text-lg font-semibold uppercase tracking-[0.08em]">Page visits</h2>
      <p className="mt-2 text-[16px] leading-6 text-ink-2">Google Analytics is off until you allow it. If you allow it, Google receives the page address and sets its own cookie. It does not receive your sessions, notes or the stations you play. You can refuse, and you can turn it off later, including after you had allowed it.</p>
      <Choice />
      <p className="mt-8 text-[16px] leading-6 text-ink-2">The optional AI features and the cloud browser run only when you open them, and those screens say who they talk to.</p>
      <p className="mt-8"><a href="/" className="inline-flex h-11 items-center bg-signal px-4 text-sm font-semibold text-on-signal">Front page</a></p>
    </Frame>
  )
}

/** Shown for an address that is not a screen. */
export function NotFoundPage() {
  return (
    <Frame>
      <p className="hud text-signal">404</p>
      <h1 className="dot mt-2 text-[clamp(2rem,6vw,3rem)] uppercase">Page not found</h1>
      <p className="mt-4 max-w-[40ch] text-[16px] leading-6">That address is not a screen on Friction.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <a href="/" className="inline-flex h-11 items-center bg-signal px-4 text-sm font-semibold text-on-signal">Front page</a>
        <a href="/focus" className="inline-flex h-11 items-center border border-ink/30 px-4 text-sm">Focus</a>
      </div>
    </Frame>
  )
}

/** The one ask, before any analytics script. It stays out of the way of the hold button and the header tools. */
export function Consent({ route }: { route: string }) {
  const choice = useAnalyticsConsent()
  if (choice !== 'unknown' || route === 'privacy') return null
  const place = route === 'home'
    ? 'fixed left-3 top-16 z-[140] w-[min(22rem,calc(100%-1.5rem))]'
    : route === 'missing'
      ? 'fixed right-3 bottom-4 z-[140] w-[min(22rem,calc(100%-1.5rem))]'
      : 'fixed right-3 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-[140] w-[min(22rem,calc(100%-1.5rem))] md:bottom-32'
  return (
    <div className={`${place} border border-ink/30 bg-ground p-3 text-ink`}>
      <p className="text-[15px] leading-5">Count page visits with Google Analytics? It records the page address, not your sessions.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setAnalyticsConsent('granted')} className="h-11 bg-signal px-4 text-sm font-semibold text-on-signal">Allow</button>
        <button type="button" onClick={() => setAnalyticsConsent('denied')} className="h-11 border border-ink/30 px-4 text-sm">No thanks</button>
        <a href="/privacy" className="inline-flex h-11 items-center px-2 text-sm text-ink-2 hover:text-signal">Privacy</a>
      </div>
    </div>
  )
}
