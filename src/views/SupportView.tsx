import { Check, Heart } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PageHeader, Panel, Seg } from '@/components/app/shared'
import { useMedia } from '@/lib/hooks'
import { isSupporter, markSupporter, SUPPORT_PLAN } from '@/lib/supporter'

const SRC = 'https://cdn.whop.com/elements/amber/elements.js'
interface Handle { create: (kind: string) => { mount: (el: HTMLElement | string) => void; destroy?: () => void }; destroy?: () => void }
type WhopFn = () => { checkout: { create: (o: Record<string, unknown>) => Handle } }
declare global { interface Window { WhopElements?: WhopFn } }

function load(): Promise<void> {
  if (window.WhopElements) return Promise.resolve()
  return new Promise((ok, no) => {
    const s = document.createElement('script')
    s.src = SRC; s.async = true; s.setAttribute('data-whop-elements', '')
    s.onload = () => ok(); s.onerror = () => no(new Error('whop'))
    document.head.appendChild(s)
  })
}

const PERKS: [string, string][] = [
  ['Year view', 'Every day of the last 52 weeks in one grid in Insights, brighter the more you held.'],
  ['Export your sessions', 'A CSV file of your own sessions from Settings, Data. Made in your browser, sent nowhere.'],
  ['A supporter mark', 'A small square on your avatar.'],
  ['Friction stays free', 'Credits are never sold and the shop is never given away, so what you earn stays earned.'],
]

/** The embedded Whop checkout. Whop takes the payment; Friction never sees card details and keeps no record of who paid. */
function Checkout({ onDone }: { onDone: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let dead = false
    let h: Handle | undefined
    load().then(() => {
      if (dead || !box.current || !window.WhopElements) return
      h = window.WhopElements().checkout.create({
        plan: SUPPORT_PLAN,
        returnUrl: `${location.origin}/thanks`,
        appearance: { theme: { appearance: 'dark', accentColor: 'yellow' } },
        onComplete: (r: { paymentId?: string }) => { if (r?.paymentId) { markSupporter(); onDone() } },
      })
      h.create('checkout').mount(box.current)
    }).catch(() => setFailed(true))
    return () => { dead = true; try { h?.destroy?.() } catch { /* already gone */ } }
  }, [onDone])
  return (
    <>
      <div ref={box} data-no-drag className="min-h-[420px]" />
      {failed && <p className="text-sm text-ink-2">The checkout did not load. <a className="underline" href={`https://whop.com/checkout/${SUPPORT_PLAN}/?redirect_url=${encodeURIComponent(`${location.origin}/thanks`)}`} target="_blank" rel="noopener noreferrer">Pay on Whop instead</a>.</p>}
    </>
  )
}

export function SupportView() {
  const wide = useMedia('(min-width: 1024px)')
  const [tab, setTab] = useState('get')
  const [done, setDone] = useState(false)
  const on = done || isSupporter()

  const perks = (
    <Panel className="grid content-start gap-3 p-5">
      <p className="hud">What you get</p>
      <ul className="grid gap-3">
        {PERKS.map(([t, d]) => (
          <li key={t} className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden /><span className="text-[14px] leading-[1.4]"><b className="font-semibold text-ink">{t}.</b> <span className="text-ink-2">{d}</span></span></li>
        ))}
      </ul>
      <p className="text-[13px] leading-[1.4] text-ink-3">Whop is the seller: it takes the card details and handles receipts, taxes and refunds. Friction keeps no record of who paid. Cancel any time and what you unlocked stays. See the <a className="underline" href="/terms" target="_blank" rel="noopener">Terms</a> and <a className="underline" href="/privacy" target="_blank" rel="noopener">Privacy</a> pages.</p>
    </Panel>
  )
  const pay = (
    <Panel className="flex min-h-0 flex-col gap-2 p-4">
      <p className="hud">$2 a month</p>
      {on ? (
        <div className="grid content-start gap-2 p-2">
          <Heart className="size-6 text-signal" aria-hidden />
          <h2 className="text-lg font-semibold">Thank you. You are keeping Friction free.</h2>
          <p className="text-[14px] text-ink-2">The Year view is in Insights, the CSV export is in Settings, Data, and your avatar has its mark. Manage or cancel from your Whop receipt.</p>
        </div>
      ) : (
        <div className="scroll-y min-h-0 flex-1" data-no-drag><Checkout onDone={() => setDone(true)} /></div>
      )}
    </Panel>
  )

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader kicker="Keep it free" title="Support" sub="Friction has no account and no feed, and stays free. Supporting it pays for the domain and the hosting.">
        {!wide && <Seg id="sup" value={tab} onChange={setTab} tabs={[{ id: 'get', label: 'What you get' }, { id: 'pay', label: 'Subscribe' }]} />}
      </PageHeader>
      {wide ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,520px)] gap-4">{perks}{pay}</div>
      ) : (
        <div className="min-h-0 flex-1 [&>*]:h-full">{tab === 'get' ? perks : pay}</div>
      )}
    </section>
  )
}
