import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FitView } from '@/components/app/FitView'
import { Landing } from '@/components/app/Landing'
import { Backdrop } from '@/components/app/Backdrop'
import { NAV, Shell, type View } from '@/components/app/Shell'
import { UrgeLayer } from '@/components/app/UrgeLayer'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SpotlightSearch } from '@/components/ui/spotlight-search'
import { UndoToast } from '@/components/ui/undo-toast'
import { fx_say, quickPlay } from '@/lib/actions'
import { buildSearchItems, PRESETS } from '@/lib/commands'
import { useScrollGuard, useSessionEngine } from '@/lib/engine'
import { useFx } from '@/lib/fx'
import { useTheme } from '@/lib/theme'
import { usePlayer } from '@/lib/player'
import { useStore } from '@/lib/store'
import { FlaskConical, ClipboardList, Settings as Cog } from 'lucide-react'
import { useUI } from '@/lib/ui'
import { FocusView } from '@/views/FocusView'
import { DebriefView } from '@/views/DebriefView'
import { SettingsView } from '@/views/SettingsView'
import { InsightsView } from '@/views/InsightsView'
import { RadioView } from '@/views/RadioView'
import { TvView } from '@/views/TvView'
import { Lab } from '@/lab/Lab'

function Placeholder({ name }: { name: string }) {
  return <div className="grid h-full place-items-center text-ink-2">{name} is being rebuilt.</div>
}

export default function App() {
  const fromHash = () => { const h = location.hash.slice(1) as View; return NAV.some((n) => n.id === h) ? h : 'focus' }
  const [view, setView] = useState<View>(fromHash)
  const prev = useRef(0)
  const dir = useRef(1)
  const reduced = !!useReducedMotion()
  const level = useStore((s) => (reduced ? 0 : s.settings.motion))
  const notice = useFx((s) => s.notice)
  const ui = useUI()
  const profile = useStore((s) => s.profile)
  const seen = useStore((s) => s.seenIntro)
  const landing = useUI((s) => s.landing)

  useScrollGuard()
  useSessionEngine()
  useTheme()

  const change = (v: View) => {
    const i = NAV.findIndex((n) => n.id === v)
    dir.current = i >= prev.current ? 1 : -1
    prev.current = i
    setView(v)
    if (location.hash !== `#${v}`) history.pushState(null, '', `#${v}`)
  }

  useEffect(() => {
    const pop = () => { const v = fromHash(); const i = NAV.findIndex((n) => n.id === v); dir.current = i >= prev.current ? 1 : -1; prev.current = i; setView(v) }
    addEventListener('popstate', pop)
    return () => removeEventListener('popstate', pop)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ⌘K / Ctrl K opens search from anywhere
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useUI.getState().theatre) useUI.getState().set({ theatre: false })
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useUI.getState().set({ searchOpen: !useUI.getState().searchOpen })
      }
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [])

  // keep the running session's source in sync with what is actually playing
  const current = usePlayer((s) => s.current)
  useEffect(() => {
    if (useStore.getState().session) useStore.getState().setSessionSource(current?.kind ?? 'silent', current?.name ?? 'Silent focus')
  }, [current])

  const items = useMemo(() => (ui.searchOpen ? buildSearchItems(change) : []), [ui.searchOpen]) // eslint-disable-line react-hooks/exhaustive-deps
  const d = dir.current

  return (
    <MotionConfig reducedMotion={level === 0 ? 'always' : 'user'}>
      <AnimatePresence>{(!seen || landing) && <Landing key="landing" onEnter={() => { useStore.getState().markIntroSeen(); ui.set({ landing: false }) }} />}</AnimatePresence>
      <Backdrop reduced={reduced} />
      <Shell view={view} onChange={change}>
        <AnimatePresence mode="wait" initial={false} custom={d}>
          <motion.div key={view} className="h-full" initial={{ opacity: 0, x: 18 * d, filter: 'blur(6px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, x: -12 * d, filter: 'blur(4px)', transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }} transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}>
            <FitView watch={view}>
            {view === 'focus' && <FocusView go={change} />}
            {view === 'radio' && <RadioView />}
            {view === 'tv' && <TvView />}
            {view === 'insights' && <InsightsView />}
            {view === 'debrief' && <DebriefView />}
            {view === 'settings' && <SettingsView />}
            {view === 'lab' && <Lab />}
            {!['focus', 'radio', 'tv', 'insights', 'debrief', 'settings', 'lab'].includes(view) && <Placeholder name={view} />}
            </FitView>
          </motion.div>
        </AnimatePresence>
      </Shell>

      <UrgeLayer />

      <SpotlightSearch open={ui.searchOpen} onOpenChange={(o) => ui.set({ searchOpen: o })} onClose={() => ui.set({ searchOpen: false })} items={items} placeholder="Search screens, stations, actions, components" />

      <Sheet open={ui.tuneOpen} onOpenChange={(o) => ui.set({ tuneOpen: o })}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Tune in</SheetTitle>
            <SheetDescription>Pick something to stay with, then lock in.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <ul>
              {PRESETS.map((p) => (
                <li key={p.label}>
                  <button onClick={() => { ui.set({ tuneOpen: false }); void quickPlay(p.kind, p.tag).catch(() => fx_say({ title: 'Could not reach the directory', description: 'Check your connection and try again.', variant: 'danger' })) }} className="flex h-12 w-full items-center justify-between border-b border-ink/10 text-left text-[15px] text-ink last:border-b-0">
                    <span>{p.label}</span>
                    <span className="hud">{p.kind === 'radio' ? 'Radio' : 'TV'}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <button className="h-11 flex-1 rounded-full border border-ink/15 text-sm text-ink" onClick={() => { ui.set({ tuneOpen: false }); change('radio') }}>Browse radio</button>
              <button className="h-11 flex-1 rounded-full border border-ink/15 text-sm text-ink" onClick={() => { ui.set({ tuneOpen: false }); change('tv') }}>Browse TV</button>
            </div>
          </SheetBody>
        </SheetContent>
      </Sheet>

      <Sheet open={ui.moreOpen} onOpenChange={(o) => ui.set({ moreOpen: o })}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
            <SheetDescription>Everything else in Friction.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <ul>
              {([['debrief', 'Debrief', <ClipboardList key="c" className="size-5" />], ['lab', 'Lab', <FlaskConical key="l" className="size-5" />], ['settings', 'Settings', <Cog key="s" className="size-5" />]] as const).map(([id, label, icon]) => (
                <li key={id}>
                  <button onClick={() => { ui.set({ moreOpen: false }); change(id) }} className="flex h-12 w-full items-center gap-3 border-b border-ink/10 text-left text-[15px] text-ink last:border-b-0">{icon}{label}</button>
                </li>
              ))}
            </ul>
          </SheetBody>
        </SheetContent>
      </Sheet>

      <Sheet open={ui.profileOpen} onOpenChange={(o) => ui.set({ profileOpen: o })}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>You</SheetTitle>
            <SheetDescription>Stored only in this browser.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <label className="hud mb-1 block" htmlFor="pname">Name</label>
            <input id="pname" defaultValue={profile?.name ?? ''} placeholder="Your name" onChange={(e) => useStore.getState().setProfile({ name: e.target.value, since: profile?.since ?? Date.now() })} className="h-11 w-full rounded-xl bg-ink/[0.06] px-3 text-[15px] text-ink ring-1 ring-ink/15 focus:outline-none focus:ring-2 focus:ring-signal" />
            <p className="mt-3 text-xs text-ink-3">Here since {new Date(profile?.since ?? Date.now()).toLocaleDateString()}</p>
          </SheetBody>
        </SheetContent>
      </Sheet>

      <UndoToast
        key={notice?.id}
        open={!!notice}
        title={notice?.title}
        description={notice?.description}
        variant={notice?.variant === 'danger' ? 'error' : notice?.variant === 'warning' ? 'warning' : notice?.variant === 'success' ? 'success' : 'default'}
        undoLabel="Undo"
        position="top-center"
        duration={notice?.undo ? 7000 : 3800}
        showProgress
        onUndo={notice?.undo}
        onDismiss={() => useFx.getState().clearNotice()}
      />
    </MotionConfig>
  )
}
