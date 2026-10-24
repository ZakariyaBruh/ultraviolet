import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Backdrop } from '@/components/app/Backdrop'
import { Nav, type View } from '@/components/app/Nav'
import { UrgeLayer } from '@/components/app/UrgeLayer'
import { CursorFollower } from '@/components/ui/cursor-follower'
import { IntroLoader } from '@/components/ui/intro-loader'
import { UndoToast } from '@/components/ui/undo-toast'
import { useCoarse } from '@/lib/hooks'
import { useScrollGuard, useSessionEngine } from '@/lib/engine'
import { useFx } from '@/lib/fx'
import { usePlayer } from '@/lib/player'
import { useStore } from '@/lib/store'
import { FocusView } from '@/views/FocusView'
import { InsightsView } from '@/views/InsightsView'
import { PledgeView } from '@/views/PledgeView'
import { RadioView } from '@/views/RadioView'
import { TvView } from '@/views/TvView'

const GREETINGS = [
  { text: 'Look up.', lang: 'en' },
  { text: 'Breathe.', lang: 'en' },
  { text: 'Stay.', lang: 'en' },
  { text: 'No feed here.', lang: 'en' },
]

export default function App() {
  const [view, setView] = useState<View>('focus')
  const reduced = !!useReducedMotion()
  const coarse = useCoarse()
  const seenIntro = useStore((s) => s.seenIntro)
  const cursor = useStore((s) => s.settings.cursor && s.settings.motion > 0)
  const live = useStore((s) => !!s.session)
  const lastDone = useStore((s) => s.sessions[0])
  const notice = useFx((s) => s.notice)
  const [introDone, setIntroDone] = useState(seenIntro)

  useScrollGuard()
  useSessionEngine()

  // keep the running session's source in sync with what is actually playing
  const current = usePlayer((s) => s.current)
  useEffect(() => {
    if (useStore.getState().session) useStore.getState().setSessionSource(current?.kind ?? 'silent', current?.name ?? 'Silent focus')
  }, [current])

  // celebrate finished sessions
  useEffect(() => {
    if (lastDone?.completed && Date.now() - lastDone.end < 4000) {
      useFx.getState().say({ title: `Locked in for ${lastDone.goalMin} minutes`, description: `${lastDone.urges} scrolls resisted. That is real focus.`, variant: 'success' })
      useFx.getState().burst(innerWidth / 2, innerHeight / 2, lastDone.urges)
    }
  }, [lastDone?.id, lastDone?.completed, lastDone?.end])

  return (
    <div className="relative h-dvh w-screen overflow-hidden text-white">
      <Backdrop reduced={reduced} />
      <UrgeLayer />

      <main className="relative z-10 mx-auto h-full w-full max-w-[1200px] px-4 pb-[calc(6.4rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            className="h-full"
            initial={{ opacity: 0, y: 28, scale: 0.97, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -20, scale: 1.02, filter: 'blur(10px)' }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          >
            {view === 'focus' && <FocusView go={setView} />}
            {view === 'radio' && <RadioView />}
            {view === 'tv' && <TvView />}
            {view === 'insights' && <InsightsView />}
            {view === 'pledge' && <PledgeView />}
          </motion.div>
        </AnimatePresence>
      </main>

      <Nav view={view} onChange={setView} live={live} />

      {!coarse && cursor && !reduced && (
        <CursorFollower size={34} className="pointer-events-none z-[80] border border-lime-300/60 bg-lime-300/10 mix-blend-screen" />
      )}

      <UndoToast
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
        key={notice?.id}
      />

      {!introDone && (
        <IntroLoader
          greetings={GREETINGS}
          intervalMs={850}
          onComplete={() => {
            useStore.getState().markIntroSeen()
            setIntroDone(true)
          }}
        />
      )}
    </div>
  )
}
