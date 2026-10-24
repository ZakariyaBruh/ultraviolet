import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Shell, NAV, type View } from '@/components/app/Shell'
import { UrgeLayer } from '@/components/app/UrgeLayer'
import { DotField } from '@/components/ui/dot-field'
import { UndoToast } from '@/components/ui/undo-toast'
import { useScrollGuard, useSessionEngine } from '@/lib/engine'
import { useFx } from '@/lib/fx'
import { usePlayer } from '@/lib/player'
import { useStore } from '@/lib/store'
import { FocusView } from '@/views/FocusView'
import { InsightsView } from '@/views/InsightsView'
import { RadioView } from '@/views/RadioView'
import { SettingsView } from '@/views/SettingsView'
import { TvView } from '@/views/TvView'

export default function App() {
  const [view, setView] = useState<View>('focus')
  const prev = useRef(0)
  const dir = useRef(1)
  const reduced = !!useReducedMotion()
  const level = useStore((s) => (reduced ? 0 : s.settings.motion))
  const lastDone = useStore((s) => s.sessions[0])
  const notice = useFx((s) => s.notice)
  const seen = useRef(useStore.getState().sessions[0]?.id)

  useScrollGuard()
  useSessionEngine()

  const change = (v: View) => {
    const i = NAV.findIndex((n) => n.id === v)
    dir.current = i >= prev.current ? 1 : -1
    prev.current = i
    setView(v)
  }

  // keep the running session's source in sync with what is actually playing
  const current = usePlayer((s) => s.current)
  useEffect(() => {
    if (useStore.getState().session) useStore.getState().setSessionSource(current?.kind ?? 'silent', current?.name ?? 'Silent focus')
  }, [current])

  // a finished session says so, once
  useEffect(() => {
    if (lastDone && lastDone.id !== seen.current && lastDone.completed && Date.now() - lastDone.end < 5000) {
      seen.current = lastDone.id
      useFx.getState().say({
        title: `${lastDone.goalMin} minutes held`,
        description: `${lastDone.urges} scroll${lastDone.urges === 1 ? '' : 's'} blocked, ${lastDone.lapses} wandering${lastDone.lapses === 1 ? '' : 's'}.`,
        variant: 'success',
      })
    }
  }, [lastDone?.id, lastDone?.completed, lastDone?.end])

  const d = dir.current
  return (
    <MotionConfig reducedMotion={level === 0 ? 'always' : 'user'}>
      <div className={level === 0 ? 'motion-calm' : ''}>
        {level >= 2 && (
          <div aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-60">
            <DotField dotRadius={1.1} dotSpacing={20} gradientFrom="rgba(10,10,10,0.16)" gradientTo="rgba(29,95,191,0.28)" />
          </div>
        )}
        <div className="relative z-10">
          <Shell view={view} onChange={change}>
            <AnimatePresence mode="wait" initial={false} custom={d}>
              <motion.div
                key={view}
                className="h-full"
                initial={{ opacity: 0, x: 14 * d }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 * d, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              >
                {view === 'focus' && <FocusView go={change} />}
                {view === 'radio' && <RadioView />}
                {view === 'tv' && <TvView />}
                {view === 'insights' && <InsightsView />}
                {view === 'settings' && <SettingsView />}
              </motion.div>
            </AnimatePresence>
          </Shell>
        </div>
        <UrgeLayer />
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
      </div>
    </MotionConfig>
  )
}
