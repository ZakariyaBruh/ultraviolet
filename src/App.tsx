import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FitView } from '@/components/app/FitView'
import { ArcadeView } from '@/views/ArcadeView'
import { Landing } from '@/components/app/Landing'
import { Backdrop } from '@/components/app/Backdrop'
import { Shell } from '@/components/app/Shell'
import { StaticBurst } from '@/components/app/StaticBurst'
import { hrefFor, routeFromLocation, VIEWS, type Route, type View } from '@/lib/route'
import { WidgetsPicker } from '@/components/app/widgets/Layer'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SpotlightSearch } from '@/components/ui/spotlight-search'
import { UndoToast } from '@/components/ui/undo-toast'
import { fx_say, quickPlay } from '@/lib/actions'
import { buildSearchItems, PRESETS } from '@/lib/commands'
import { useSessionEngine } from '@/lib/engine'
import { useFx } from '@/lib/fx'
import { useTheme } from '@/lib/theme'
import { cycleTheme } from '@/lib/themeCycle'
import { usePlayer } from '@/lib/player'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { FocusView } from '@/views/FocusView'
import { DebriefView } from '@/views/DebriefView'
import { SettingsView } from '@/views/SettingsView'
import { InsightsView } from '@/views/InsightsView'
import { RadioView } from '@/views/RadioView'
import { TvView } from '@/views/TvView'
import { BooksView } from '@/views/BooksView'
import { LearnView } from '@/views/LearnView'
import { Celebration } from '@/components/app/Celebration'
import { captureRef, countRecommend } from '@/lib/leaders'
import { useMilestones, } from '@/lib/notify'
import { useBoardWatch } from '@/lib/watch'
import { pendingInvite, useTogether } from '@/lib/together'
import { Onboarding } from '@/components/app/Onboarding'
import { Mixer } from '@/components/app/shop/Mixer'
import { TogetherView } from '@/views/TogetherView'
import { LeadersView } from '@/views/LeadersView'
import { NewsView } from '@/views/NewsView'
import { PodcastsView } from '@/views/PodcastsView'

function Placeholder({ name }: { name: string }) {
  return <div className="grid h-full place-items-center text-ink-2">{name} is being rebuilt.</div>
}

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromLocation)
  const view = (route === 'home' ? 'focus' : route) as View
  const prev = useRef(0)
  const dir = useRef(1)
  const reduced = !!useReducedMotion()
  const level = useStore((s) => (reduced ? 0 : s.settings.motion))
  const notice = useFx((s) => s.notice)
  const ui = useUI()
  const profile = useStore((s) => s.profile)

  useSessionEngine()
  useMilestones()
  useBoardWatch()
  useTogether()
  // a drift: the whole screen gives a small, soft zoom, like it took the hit
  useEffect(() => {
    let last = useStore.getState().session?.lapses ?? 0
    return useStore.subscribe((s) => {
      const n = s.session?.lapses ?? 0
      if (n > last && !matchMedia('(prefers-reduced-motion: reduce)').matches && s.settings.motion > 0) {
        const el = document.getElementById('canvas')
        el?.classList.remove('ripple'); void el?.offsetWidth; el?.classList.add('ripple')
        setTimeout(() => el?.classList.remove('ripple'), 340)
      }
      last = n
    })
  }, [])
  useTheme()
  useEffect(() => { captureRef(); if (routeFromLocation() !== 'home') void countRecommend() }, [])

  const go = (r: Route) => {
    const i = VIEWS.indexOf(r as View)
    dir.current = i >= prev.current ? 1 : -1
    if (i >= 0) prev.current = i
    setRoute(r)
    if (location.pathname !== hrefFor(r)) history.pushState(null, '', hrefFor(r))
  }
  const change = (v: View) => go(v)

  useEffect(() => {
    const pop = () => { const r = routeFromLocation(); const i = VIEWS.indexOf(r as View); dir.current = i >= prev.current ? 1 : -1; if (i >= 0) prev.current = i; setRoute(r) }
    addEventListener('popstate', pop)
    return () => removeEventListener('popstate', pop)
  }, [])

  useEffect(() => {
    document.title = route === 'home' ? 'Friction' : `${route[0].toUpperCase()}${route.slice(1)} · Friction`
  }, [route])

  // ⌘K / Ctrl K opens search from anywhere
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey && !e.altKey && !(e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) cycleTheme()
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
      {route === 'home' ? <Landing onEnter={() => { void countRecommend(); go(pendingInvite() ? 'together' : 'focus') }} onGo={(v) => { void countRecommend(); go(v) }} /> : (<>
      <Backdrop reduced={reduced} />
      <Shell view={view} onChange={change} onHome={() => go('home')}>
        <AnimatePresence mode="wait" initial={false} custom={d}>
          <motion.div key={view} className="h-full" initial={{ opacity: 0, x: 24 * d, scale: 0.985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -14 * d, scale: 0.992, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}>
            <FitView watch={view}>
            {level >= 1 && <StaticBurst />}
            {view === 'focus' && <FocusView go={change} />}
            {view === 'radio' && <RadioView />}
            {view === 'tv' && <TvView />}
            {view === 'podcasts' && <PodcastsView />}
            {view === 'news' && <NewsView />}
            {view === 'learn' && <LearnView />}
            {view === 'together' && <TogetherView />}
            {view === 'leaders' && <LeadersView />}
            {view === 'books' && <BooksView />}
            {view === 'arcade' && <ArcadeView />}
            {view === 'insights' && <InsightsView />}
            {view === 'debrief' && <DebriefView />}
            {view === 'settings' && <SettingsView />}
            {!['focus', 'radio', 'tv', 'podcasts', 'news', 'learn', 'together', 'leaders', 'books', 'arcade', 'insights', 'debrief', 'settings'].includes(view) && <Placeholder name={view} />}
            </FitView>
          </motion.div>
        </AnimatePresence>
      </Shell>
      </>)}

      <SpotlightSearch open={ui.searchOpen} onOpenChange={(o) => ui.set({ searchOpen: o })} onClose={() => ui.set({ searchOpen: false })} items={items} placeholder="Search screens, stations, actions, components" />

      <Sheet open={ui.widgetsOpen} onOpenChange={(o) => ui.set({ widgetsOpen: o })}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Widgets</SheetTitle>
            <SheetDescription>Study windows for the Focus screen. Open as many as you like and move them where they suit you.</SheetDescription>
          </SheetHeader>
          <SheetBody><WidgetsPicker /></SheetBody>
        </SheetContent>
      </Sheet>
      <Sheet open={ui.soundOpen} onOpenChange={(o) => ui.set({ soundOpen: o })}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Sound machine</SheetTitle>
            <SheetDescription>Made here, out of noise. Nothing is downloaded.</SheetDescription>
          </SheetHeader>
          <SheetBody><Mixer /></SheetBody>
        </SheetContent>
      </Sheet>
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

      <Onboarding />
      <div className="retro-fx retro-warm" aria-hidden /><div className="retro-fx retro-grain" aria-hidden /><div className="retro-fx retro-scan" aria-hidden />
      <Celebration />
      <UndoToast
        key={notice?.id}
        open={!!notice}
        title={notice?.title}
        description={notice?.description}
        variant={notice?.variant === 'danger' ? 'error' : notice?.variant === 'warning' ? 'warning' : notice?.variant === 'success' ? 'success' : notice?.undo ? 'default' : 'info'}
        undoLabel={notice?.label ?? 'Undo'}
        position="top-center"
        duration={notice?.undo ? 7000 : 3800}
        showProgress
        onUndo={notice?.undo}
        onDismiss={() => useFx.getState().clearNotice()}
      />
    </MotionConfig>
  )
}
