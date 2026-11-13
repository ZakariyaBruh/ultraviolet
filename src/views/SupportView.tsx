import { Check, Heart, Lock } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { PageHeader, Panel, Seg } from '@/components/app/shared'
import { useMedia } from '@/lib/hooks'
import { useStore } from '@/lib/store'
import { goTo, isSupporter, markSupporter, SUPPORT_PLAN, useSupporter } from '@/lib/supporter'
import { useThemeId } from '@/lib/theme'
import { goalFor } from '@/lib/goals'
import { supporterFonts } from '@/lib/fonts'
import { startPreview, stopPreview } from '@/lib/themeCycle'
import { THEMES, themeDef, type ThemeDef, type ThemeId } from '@/lib/themes'
import { useUI } from '@/lib/ui'

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

interface Perk { title: string; text: string; open?: { label: string; go: () => void } }
const PERKS: Perk[] = [
  { title: 'Encrypted cloud backup', text: 'A sealed copy of everything, saved every few minutes: lose a phone, restore in a minute. Only you hold the key. It costs a server to keep, so it is not free.', open: { label: 'Open Settings', go: () => goTo('/settings') } },
  { title: 'A star on the board', text: 'A star by your alias on the leaderboard and a small mark on your avatar. They change nothing about your rank.' },
]

/** how each supporter theme is drawn on its tile: its own display face and a hint of its frame, so the tile says what the theme does to a panel (colours come from the theme's own entry in themes.ts) */
const mix = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`
const FACE: Record<string, { font: string; title?: CSSProperties; frame: (t: ThemeDef) => CSSProperties }> = {
  library: { font: "'Fraunces Variable', Georgia, serif", title: { fontSize: 21, fontWeight: 560, letterSpacing: '0.1em', textTransform: 'uppercase' }, frame: (t) => ({ boxShadow: `inset 8px 0 0 ${t.signal}, inset 0 0 0 1px ${mix(t.ink, 40)}` }) },
  observatory: { font: "'Cormorant Variable', Georgia, serif", title: { fontSize: 16, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase' }, frame: (t) => ({ boxShadow: `inset 0 0 0 1px ${mix(t.ice, 50)}`, backgroundImage: `repeating-linear-gradient(90deg, ${mix(t.ice, 60)} 0 1px, transparent 1px 8px)`, backgroundSize: '100% 5px', backgroundRepeat: 'no-repeat' }) },
  mono: { font: "'Archivo Variable', system-ui, sans-serif", title: { fontSize: 25, fontWeight: 900, fontStretch: '68%', textTransform: 'uppercase' }, frame: (t) => ({ boxShadow: `inset 0 0 0 1px ${t.ink}` }) },
  receipt: { font: "'IBM Plex Mono', ui-monospace, monospace", title: { fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', background: 'linear-gradient(transparent 52%, #ffe95c 52% 90%, transparent 90%)', padding: '0 0.12em', marginLeft: '-0.12em' }, frame: (t) => ({ outline: `1px dashed ${mix(t.ink, 45)}`, outlineOffset: -4 }) },
  chalkboard: { font: "'Patrick Hand', 'Bradley Hand', 'Segoe Print', system-ui, sans-serif", title: { fontSize: 24, fontWeight: 400, letterSpacing: '0.04em', textTransform: 'uppercase' }, frame: (t) => ({ outline: `2px solid ${mix(t.ink, 55)}`, outlineOffset: -5, borderRadius: 5 }) },
}

/** The five supporter themes as tiles: anyone can tap one to see the whole app in it once a day for two minutes, a supporter keeps it. */
function ThemeTiles() {
  const supporter = useSupporter()
  const shown = useThemeId()
  const preview = useUI((x) => x.previewTheme)
  const setSettings = useStore((x) => x.setSettings)
  const pick = (t: ThemeDef) => { if (supporter) { stopPreview(); setSettings({ theme: t.id }) } else startPreview(t.id) }
  return (
    <div className="grid gap-2">
      <div role="radiogroup" aria-label="Supporter themes" className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
        {THEMES.filter((t) => t.premium).map((t) => {
          const f = FACE[t.id as ThemeId]
          const on = shown === t.id
          return (
            <button key={t.id} role="radio" aria-checked={on} onClick={() => pick(t)} aria-label={`${t.name}: ${t.note}. ${supporter ? (on ? 'In use' : 'Tap to use it') : 'Tap to try it for two minutes'}`}
              className={`relative grid min-h-[5.5rem] content-between gap-2 p-3 text-left ${on ? 'ring-2 ring-signal ring-offset-2 ring-offset-surface' : ''}`} style={{ background: t.ground, color: t.ink, ...f.frame(t) }}>
              <span className="leading-[1.1]" style={{ fontFamily: f.font, ...f.title }}>{t.name}</span>
              <span className="pr-4 text-[12.5px] leading-[1.3]" style={{ color: t.ink }}>{t.note}</span>
              {!supporter ? <Lock className="absolute bottom-2.5 right-2.5 size-3.5" style={{ color: t.ink }} aria-hidden /> : <span className="absolute bottom-3 right-3 size-3" style={{ background: t.signal }} aria-hidden />}
            </button>
          )
        })}
      </div>
      {preview && !supporter && (
        <div role="status" className="flex flex-wrap items-center gap-2 border border-signal/60 bg-signal/10 p-2.5 text-[13px] text-ink">
          <span className="min-w-0 flex-1 basis-48">Trying {themeDef(preview).name} for two minutes, then it goes back. Look around: nothing plays and nothing locks in meanwhile.</span>
          <button className="h-11 border border-ink/30 px-4 text-sm text-ink hover:bg-ink/10" onClick={stopPreview}>Stop trying it</button>
        </div>
      )}
    </div>
  )
}

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
    // Whop's frame arrives with no title, so a screen reader hears only "frame": name it when it appears
    const name = () => box.current?.querySelectorAll('iframe:not([title])').forEach((f) => f.setAttribute('title', 'Whop checkout: support Friction for $2 a month'))
    const seen = new MutationObserver(name)
    if (box.current) seen.observe(box.current, { childList: true, subtree: true })
    return () => { dead = true; seen.disconnect(); try { h?.destroy?.() } catch { /* already gone */ } }
  }, [onDone])
  return (
    <>
      <div className="bg-black p-2 text-white [color-scheme:dark]"><div ref={box} data-no-drag className="min-h-[420px]" /></div>
      {failed && <p className="text-sm text-ink-2">The checkout did not load. <a className="underline" href={`https://whop.com/checkout/${SUPPORT_PLAN}/?redirect_url=${encodeURIComponent(`${location.origin}/thanks`)}`} target="_blank" rel="noopener noreferrer">Pay on Whop instead</a>.</p>}
    </>
  )
}

/** The goal bar: the next supporter goal, how far along it is, and what it is for, said honestly. The count is set by hand (api/goal.ts). */
function GoalBar() {
  const [n, setN] = useState<number | null>(null)
  useEffect(() => { fetch('/api/goal').then((r) => (r.ok ? r.json() : null)).then((j) => setN(typeof j?.n === 'number' ? j.n : null)).catch(() => setN(null)) }, [])
  if (n === null) return null
  const { goal } = goalFor(n)
  const pct = Math.min(100, Math.round((n / goal) * 100))
  return (
    <section className="grid gap-2" aria-label="Supporter goal">
      <h2 className="text-[15px] font-semibold text-ink">{n === 0 ? 'No supporters yet. Be the first.' : `${n} supporter${n === 1 ? '' : 's'} so far`}</h2>
      <div className="flex items-center justify-between gap-3 text-[13px] text-ink-2"><span>Current goal: {goal} supporter{goal === 1 ? '' : 's'}</span><span className="fig">{n} / {goal}</span></div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={n} aria-label={`${n} of ${goal} supporters`} className="h-3 border border-ink/30 bg-ink/[0.04]"><div className="h-full bg-signal" style={{ width: `${pct}%` }} /></div>
      <p className="text-[14px] leading-[1.45] text-ink-2">Each goal is a little bigger than the one before. As more people support Friction we can pay for more of it, such as longer use of the cloud browser. That takes time and these are not promises of a date: we will build what the money allows, one step at a time, and say so here when something ships. Thank you either way.</p>
    </section>
  )
}

export function SupportView() {
  // side by side only where both halves have room: on an iPad (1024 to 1194 wide on its side) the checkout took 520px and left what
  // you get in a 390px strip, so there the two are tabs, as on a phone, and each gets the whole width
  const wide = useMedia('(min-width: 1280px)')
  const [tab, setTab] = useState('get')
  const [done, setDone] = useState(false)
  const on = done || isSupporter()
  // each theme tile is drawn in that theme's own face, so this screen asks for all five
  useEffect(() => { supporterFonts() }, [])

  const perks = (
    <Panel className="flex min-h-[22rem] flex-col gap-3 p-5">
      <p className="hud">What you get for $2 a month</p>
      <p className="text-[14px] leading-[1.45] text-ink-2">$2 a month is cheaper than a cup of coffee, and it keeps Friction free for everyone else.</p>
      <div className="scroll-y grid min-h-0 flex-1 content-start gap-4" data-no-drag tabIndex={0} aria-label="What you get">
        <GoalBar />
        <section className="grid gap-2" aria-label="Five more themes">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><Check className="size-4 shrink-0 text-signal" aria-hidden />Five more themes</h2>
          <p className="text-[14px] leading-[1.45] text-ink-2">Library, Observatory, Mono, Receipt and Chalkboard. Each one changes more than the colours: its own type, its own frame round every panel and its own picture behind them. Tap one to try it for two minutes, free: the whole app changes while you look around.</p>
          <ThemeTiles />
        </section>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3">
          {PERKS.map((p) => (
            <li key={p.title} className="grid content-start gap-1.5 border border-ink/15 bg-ink/[0.03] p-4">
              <span className="flex items-center gap-2"><Check className="size-4 shrink-0 text-signal" aria-hidden /><b className="text-[15px] font-semibold text-ink">{p.title}</b></span>
              <span className="text-[14px] leading-[1.45] text-ink-2">{p.text}</span>
              {on && p.open && <button className="mt-1 h-11 justify-self-start border border-signal/60 px-4 text-sm font-semibold text-ink hover:bg-signal/10" onClick={p.open.go}>{p.open.label}</button>}
            </li>
          ))}
        </ul>
        <p className="border-l-2 border-signal/60 pl-3 text-[14px] leading-[1.5] text-ink-2"><b className="font-semibold text-ink">Still free, for everyone.</b> The timer, radio, TV, music, lessons, games and widgets. All of Insights, and the Week review, Projects, Coach, Year and Records. Project labels, CSV and calendar exports, the five original themes and the leaderboard. Credits are never sold and the shop is never given away. Nothing that was free has been moved behind this.</p>
      </div>
      {!wide && !on && <button className="h-11 shrink-0 bg-signal px-5 text-sm font-semibold text-on-signal" onClick={() => setTab('pay')}>Subscribe, $2 a month</button>}
      <p className="text-[13px] leading-[1.4] text-ink-3">Whop is the seller: it takes the card details and handles receipts, taxes and refunds. Friction keeps no record of who paid. Cancel any time and what you unlocked stays. See the <a className="underline" href="/terms" target="_blank" rel="noopener">Terms</a> and <a className="underline" href="/privacy" target="_blank" rel="noopener">Privacy</a> pages.</p>
    </Panel>
  )
  const pay = (
    <Panel className="flex min-h-[24rem] flex-col gap-2 p-4">
      <p className="hud">$2 a month</p>
      {on ? (
        <div className="grid content-start gap-2 p-2">
          <Heart className="size-6 text-signal" aria-hidden />
          <h2 className="text-lg font-semibold">Thank you. You are keeping Friction free.</h2>
          <p className="text-[14px] text-ink-2">Pick any of the five themes on the left, or in Settings under Look. The backup is in Settings under Data. Your avatar has its mark, and your alias has a star. Manage or cancel from your Whop receipt.</p>
        </div>
      ) : (
        <div className="scroll-y min-h-0 flex-1" data-no-drag tabIndex={0} role="region" aria-label="Checkout"><Checkout onDone={() => setDone(true)} /></div>
      )}
    </Panel>
  )

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader kicker="Keep it free" title="Support" sub="Friction has no account and no feed, and stays free. Supporting it pays for the domain and the hosting.">
        {!wide && <Seg id="sup" value={tab} onChange={setTab} tabs={[{ id: 'get', label: 'What you get' }, { id: 'pay', label: 'Subscribe' }]} />}
      </PageHeader>
      {wide ? (
        <div className={`grid min-h-0 flex-1 gap-4 ${on ? 'grid-cols-[minmax(0,1fr)_minmax(0,340px)]' : 'grid-cols-[minmax(0,1fr)_minmax(0,520px)]'}`}>{perks}{pay}</div>
      ) : (
        <div className="min-h-0 flex-1 [&>*]:h-full">{tab === 'get' ? perks : pay}</div>
      )}
    </section>
  )
}
