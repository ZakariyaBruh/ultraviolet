import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { EnterCode, MakeCode } from '@/components/app/Handoff'
import { Mark } from '@/components/app/Mark'
import { hasData } from '@/lib/transfer'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { cn } from '@/lib/utils'

type Platform = 'ios' | 'android' | null
const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent)
/** iPadOS asks for the desktop site by default, so an iPad looks like a Mac with a touch screen */
const ipad = () => typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
export const platform = (): Platform => (/iPhone|iPod|iPad/.test(ua()) || ipad() ? 'ios' : /Android/.test(ua()) ? 'android' : null)
export const standalone = () => {
  try { return matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true } catch { return false }
}

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let deferred: InstallEvent | null = null
let installed = false
if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent })
  addEventListener('appinstalled', () => { installed = true; deferred = null })
}
const HIDE = 'friction:install-hide'
const seen = () => { try { return sessionStorage.getItem(HIDE) === '1' } catch { return false } }
const hide = () => { try { sessionStorage.setItem(HIDE, '1') } catch { /* storage blocked */ } }

/* the little scenes: what the person will see on their own screen, drawn flat */
function Scene({ step, tablet, calm }: { step: number; tablet: boolean; calm: boolean }) {
  const loop = calm ? {} : { repeat: Infinity, repeatDelay: 0.8 }
  const pulse = calm ? {} : { scale: [1, 1.9], opacity: [0.9, 0], transition: { duration: 1.1, repeat: Infinity, ease: 'easeOut' as const } }
  const ring = (cx: number, cy: number) => <motion.circle cx={cx} cy={cy} r="11" fill="none" stroke="var(--signal)" strokeWidth="2.5" style={{ transformOrigin: `${cx}px ${cy}px` }} animate={pulse} />
  const share = (x: number, y: number, on: boolean) => (
    <g transform={`translate(${x} ${y})`} stroke={on ? 'var(--signal)' : 'currentColor'} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M-6 -1v8h12v-8" /><path d="M0 4v-13M-4 -5l4 -4 4 4" /></g>
  )
  return (
    <svg viewBox="0 0 280 150" className="h-[9.5rem] w-full text-ink" role="img" aria-hidden>
      <rect x="1" y="1" width="278" height="148" fill="none" stroke="currentColor" strokeOpacity=".25" />
      {step === 0 && (tablet ? (
        <g>
          <rect x="10" y="10" width="260" height="22" fill="currentColor" fillOpacity=".08" />
          <rect x="60" y="15" width="130" height="12" fill="currentColor" fillOpacity=".12" />
          {share(246, 21, true)}{ring(246, 21)}
          <rect x="20" y="50" width="240" height="8" fill="currentColor" fillOpacity=".1" /><rect x="20" y="66" width="190" height="8" fill="currentColor" fillOpacity=".1" />
        </g>
      ) : (
        <g>
          <rect x="20" y="10" width="240" height="90" fill="currentColor" fillOpacity=".06" />
          <rect x="30" y="22" width="150" height="8" fill="currentColor" fillOpacity=".12" /><rect x="30" y="38" width="190" height="8" fill="currentColor" fillOpacity=".12" />
          <rect x="10" y="112" width="260" height="28" fill="currentColor" fillOpacity=".08" />
          {[50, 95].map((x) => <rect key={x} x={x - 6} y="121" width="12" height="10" fill="currentColor" fillOpacity=".25" />)}
          {share(140, 126, true)}{ring(140, 126)}
          {[185, 230].map((x) => <rect key={x} x={x - 6} y="121" width="12" height="10" fill="currentColor" fillOpacity=".25" />)}
        </g>
      ))}
      {step === 1 && (
        <g>
          <rect x="40" y="8" width="200" height="134" fill="currentColor" fillOpacity=".06" stroke="currentColor" strokeOpacity=".3" />
          <motion.g animate={calm ? undefined : { y: [0, 0, -34, -34] }} transition={{ duration: 2.4, times: [0, 0.2, 0.6, 1], ease: 'easeInOut', ...loop }}>
            {['Copy', 'Add Bookmark', 'Find on Page'].map((t, i) => <g key={t}><rect x="52" y={18 + i * 26} width="176" height="20" fill="currentColor" fillOpacity=".08" /><text x="60" y={32 + i * 26} fontSize="10" fill="currentColor" fillOpacity=".7">{t}</text></g>)}
            <rect x="52" y="96" width="176" height="22" fill="var(--signal)" fillOpacity=".22" stroke="var(--signal)" strokeWidth="2" />
            <text x="60" y="111" fontSize="10.5" fontWeight="700" fill="var(--signal)">Add to Home Screen</text>
            <g transform="translate(212 107)" stroke="var(--signal)" strokeWidth="1.8" fill="none"><rect x="-6" y="-6" width="12" height="12" /><path d="M0 -3v6M-3 0h6" /></g>
          </motion.g>
        </g>
      )}
      {step === 2 && (
        <g>
          <rect x="50" y="10" width="180" height="130" fill="currentColor" fillOpacity=".06" stroke="currentColor" strokeOpacity=".3" />
          <text x="60" y="30" fontSize="10" fill="currentColor" fillOpacity=".6">Cancel</text>
          <rect x="176" y="17" width="44" height="18" fill="var(--signal)" /><text x="198" y="30" fontSize="10" fontWeight="700" textAnchor="middle" fill="#05070c">Add</text>
          {ring(198, 26)}
          <g transform="translate(62 50)"><rect width="38" height="38" fill="#05070c" stroke="currentColor" strokeOpacity=".4" /><circle cx="19" cy="19" r="10" fill="none" stroke="#f3f1ea" strokeWidth="2.2" /><rect x="24" y="6" width="8" height="8" fill="#ffd23f" /></g>
          <rect x="110" y="56" width="108" height="24" fill="currentColor" fillOpacity=".1" /><text x="118" y="72" fontSize="11" fill="currentColor">Friction</text>
          <rect x="62" y="104" width="156" height="6" fill="currentColor" fillOpacity=".12" /><rect x="62" y="116" width="110" height="6" fill="currentColor" fillOpacity=".12" />
        </g>
      )}
      {step === 3 && (
        <g>
          {Array.from({ length: 12 }, (_, i) => <rect key={i} x={30 + (i % 4) * 56} y={16 + Math.floor(i / 4) * 44} width="34" height="34" fill="currentColor" fillOpacity={i === 5 ? 0 : 0.1} />)}
          <motion.g initial={calm ? false : { scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 0.15 }} style={{ transformOrigin: '115px 77px' }}>
            <rect x="98" y="60" width="34" height="34" fill="#05070c" stroke="var(--signal)" strokeWidth="2" /><circle cx="115" cy="77" r="9" fill="none" stroke="#f3f1ea" strokeWidth="2" /><rect x="120" y="64" width="7" height="7" fill="#ffd23f" />
          </motion.g>
          {ring(115, 77)}
        </g>
      )}
    </svg>
  )
}

const IOS_STEPS = (tablet: boolean) => [
  { t: 'Tap Share', b: tablet ? 'The square with an arrow, at the top right of Safari.' : 'The square with an arrow, in the bar at the bottom of Safari.' },
  { t: 'Choose Add to Home Screen', b: 'Scroll the list a little if you do not see it at once.' },
  { t: 'Tap Add', b: 'Friction keeps its name. It is the one with the ring and the yellow square.' },
  { t: 'Open it from your Home Screen', b: 'It opens full screen, with no browser around it.' },
]

/**
 * Asks, whenever Friction is opened in a browser on a phone or tablet, to put it on the Home Screen. On Android the browser's own
 * install is offered; on iOS there is no such call, so the steps are shown, drawn as what the screen will look like. iOS keeps a Home
 * Screen app's storage apart from Safari's, so before adding it there is a way to carry the data along (see `Handoff`).
 */
export function InstallPrompt({ route }: { route: string }) {
  const plat = platform()
  const ready = useStore((s) => !!s.profile && s.seenIntro)
  const running = useStore((s) => !!s.session)
  const toured = useStore((s) => s.settings.toured)
  const calm = useStore((s) => s.settings.motion === 0) || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  const busy = useUI((s) => s.tourOpen || s.browserTour || s.onboardOpen || !!s.celebrate || !!s.itemTour)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(-1) // -1: the ask, 0..3: the walk-through (iOS), 4: finished
  const [code, setCode] = useState<string | null>(null)
  const [fresh, setFresh] = useState(false)
  const tablet = ipad() || /iPad/.test(ua())

  const should = !!plat && !standalone() && !installed && ready && toured && !running && !busy && route !== 'home' && !seen()
  useEffect(() => {
    if (!should) { if (!busy) setOpen(false); return }
    const t = setTimeout(() => { setFresh(hasData()); setOpen(true) }, 2800)
    return () => clearTimeout(t)
  }, [should, busy])

  const close = () => { hide(); setOpen(false) }
  const install = async () => {
    if (deferred) {
      await deferred.prompt()
      const c = await deferred.userChoice.catch(() => null)
      deferred = null
      if (c?.outcome === 'accepted') { installed = true; setStep(4); return }
    }
    setStep(0)
  }
  // the walk-through moves by itself, and waits when a finger is on the page
  useEffect(() => {
    if (!open || step < 0 || step > 2 || calm || plat !== 'ios') return
    const t = setTimeout(() => setStep((s) => (s >= 0 && s < 3 ? s + 1 : s)), 3200)
    return () => clearTimeout(t)
  }, [open, step, calm, plat])

  const steps = IOS_STEPS(tablet)
  const ease = [0.2, 0, 0, 1] as const
  let body: ReactNode
  if (step === -1) {
    body = (
      <>
        <div className="flex items-center gap-4">
          <motion.div initial={calm ? false : { scale: 0.5, rotate: -10, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.1 }} className="grid size-16 shrink-0 place-items-center border border-ink/40 bg-ground text-ink"><Mark size={44} /></motion.div>
          <div>
            <p className="hud text-signal">Install</p>
            <h2 className="dot text-[1.45rem] font-bold leading-[1.1]">Keep Friction on your {plat === 'ios' ? (tablet ? 'iPad' : 'iPhone') : 'phone'}</h2>
          </div>
        </div>
        <ul className="grid gap-1.5 text-[14px] leading-[1.4] text-ink-2">
          {['Opens full screen, like an app, with no browser bars', 'One tap from the Home Screen, with nothing to log in to', plat === 'ios' && fresh ? 'Your sessions can come with you: the Home Screen app starts empty on iOS, so we carry them over' : 'Your sessions and settings stay exactly as they are'].map((t, i) => (
            <motion.li key={t} initial={calm ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.08, duration: 0.25, ease }} className="flex gap-2"><span aria-hidden className="mt-[7px] size-1.5 shrink-0 bg-signal" />{t}</motion.li>
          ))}
        </ul>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button onClick={() => void install()} className="h-12 bg-signal px-4 text-[15px] font-semibold text-on-signal">{plat === 'ios' ? 'Show me how' : 'Install the app'}</button>
          <button onClick={close} className="h-12 px-4 text-sm text-ink-2 hover:text-ink">Not now</button>
        </div>
      </>
    )
  } else if (step <= 3) {
    body = (
      <>
        <div className="flex items-center justify-between gap-3"><p className="hud text-signal">{plat === 'ios' ? `Step ${step + 1} of 4` : 'Install'}</p><button onClick={close} className="h-11 px-2 text-sm text-ink-2 hover:text-ink">Close</button></div>
        {plat === 'ios' ? (
          <>
            <div className="grid gap-1">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={step} initial={calm ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }} transition={{ duration: 0.22, ease }}>
                  <Scene step={step} tablet={tablet} calm={calm} />
                  <h2 className="dot mt-2 text-[1.3rem] font-bold leading-[1.15]">{steps[step].t}</h2>
                  <p className="text-[14px] leading-[1.4] text-ink-2">{steps[step].b}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex gap-1.5" role="group" aria-label="Steps">{steps.map((s, i) => <button key={s.t} onClick={() => setStep(i)} aria-label={`Step ${i + 1}: ${s.t}`} aria-current={i === step} className="group h-11 flex-1"><span className="relative block h-1.5 w-full overflow-hidden bg-ink/20"><motion.span className="absolute inset-y-0 left-0 bg-signal" initial={false} animate={{ width: i < step ? '100%' : i === step ? (calm ? '100%' : '100%') : '0%' }} transition={{ duration: i === step && !calm ? 3.2 : 0.2, ease: i === step ? 'linear' : 'easeOut' }} key={`${i}-${step}`} /></span></button>)}</div>
            {fresh && <div className="grid gap-2 border-t border-ink/15 pt-3"><p className="text-[13px] leading-[1.4] text-ink-2"><strong className="text-ink">Taking your sessions along?</strong> iOS gives the Home Screen app its own empty storage. Make a code here, then type it in when the app first opens.</p><MakeCode onCode={setCode} compact={!!code} /></div>}
            <div className="flex justify-between gap-2">
              <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="h-11 px-3 text-sm text-ink-2 hover:text-ink disabled:opacity-30">Back</button>
              <button onClick={() => (step === 3 ? close() : setStep(step + 1))} className="h-11 bg-ink px-5 text-sm font-semibold text-ground">{step === 3 ? 'Done' : 'Next'}</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="dot text-[1.3rem] font-bold leading-[1.15]">Add it from the browser menu</h2>
            <ol className="grid gap-2 text-[14px] leading-[1.4] text-ink-2">
              <li><strong className="text-ink">1.</strong> Tap the menu (three dots) at the top right.</li>
              <li><strong className="text-ink">2.</strong> Choose <strong className="text-ink">Install app</strong> or <strong className="text-ink">Add to Home screen</strong>.</li>
              <li><strong className="text-ink">3.</strong> Tap <strong className="text-ink">Install</strong>. Your sessions stay: the app uses this browser's storage.</li>
            </ol>
            <button onClick={close} className="h-11 bg-ink px-5 text-sm font-semibold text-ground">Got it</button>
          </>
        )}
      </>
    )
  } else {
    body = (
      <>
        <motion.div initial={calm ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 16 }} className="grid size-16 place-items-center border border-signal text-ink"><Mark size={44} /></motion.div>
        <h2 className="dot text-[1.45rem] font-bold">Installed</h2>
        <p className="text-[14px] leading-[1.4] text-ink-2">Open it from your Home Screen. Everything you have made here is already in it.</p>
        <button onClick={close} className="h-11 bg-ink px-5 text-sm font-semibold text-ground">Done</button>
      </>
    )
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="install" className="fixed inset-0 z-[115] flex items-end justify-center bg-ground/60 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }} onClick={(e) => { if (e.target === e.currentTarget && step < 0) close() }}>
          <motion.div role="dialog" aria-modal="true" aria-label="Put Friction on your Home Screen" className={cn('glass grid w-[min(26rem,100%)] gap-3 p-4')} initial={calm ? false : { y: 60, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 40, opacity: 0, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }} transition={{ type: 'spring', stiffness: 360, damping: 30 }}>
            {body}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * The first time the Home Screen app opens on a device that keeps it apart from the browser (iOS), it is empty. This asks once
 * for the code made in Safari, before the welcome, and says plainly that starting fresh is fine too.
 */
export function FirstLaunch() {
  const fresh = useStore((s) => !s.profile && !s.seenIntro)
  const [skipped, setSkipped] = useState(() => { try { return localStorage.getItem('friction:xfer-skip') === '1' } catch { return false } })
  const show = fresh && !skipped && standalone() && platform() === 'ios'
  const skip = () => { try { localStorage.setItem('friction:xfer-skip', '1') } catch { /* storage blocked */ } setSkipped(true) }
  return (
    <AnimatePresence>
      {show && (
        <motion.div key="first" className="fixed inset-0 z-[130] grid place-items-center bg-ground px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }}>
          <motion.div role="dialog" aria-modal="true" aria-label="Bring your data" className="glass grid w-[min(26rem,100%)] gap-3 p-5" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 360, damping: 30 }}>
            <div className="flex items-center gap-3"><Mark size={36} /><p className="hud text-signal">Welcome to the app</p></div>
            <h2 className="dot text-[1.5rem] font-bold leading-[1.1]">Already use Friction in Safari?</h2>
            <p className="text-[14px] leading-[1.45] text-ink-2">The Home Screen app keeps its own storage, so it starts empty. In Safari open <strong className="text-ink">Settings → Data → Move my data</strong> and make a code, then type it here. If this is your first time, start fresh.</p>
            <EnterCode autoFocus />
            <button onClick={skip} className="h-11 text-sm text-ink-2 hover:text-ink">Start fresh</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
