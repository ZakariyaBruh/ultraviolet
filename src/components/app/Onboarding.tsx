import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type FormEvent } from 'react'
import { Glass } from '@/components/app/glass'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { cn } from '@/lib/utils'

const SKIP = 'friction:onboard-skip'
const skipped = () => { try { return sessionStorage.getItem(SKIP) === '1' } catch { return false } }

/**
 * First run, two short steps. The name is private: it is what friends in a Together room see.
 * The leaderboard asks for its own public alias, so nobody ends up listed as "You".
 */
export function Onboarding() {
  const profile = useStore((s) => s.profile)
  const setProfile = useStore((s) => s.setProfile)
  const goal = useStore((s) => s.settings.dailyGoalMin)
  const setSettings = useStore((s) => s.setSettings)
  const [hidden, setHidden] = useState(skipped)
  const [step, setStep] = useState(0)
  const [name, setName] = useState(profile?.name ?? '')
  const forced = useUI((s) => s.onboardOpen)
  const close = () => { setStep(0); useUI.getState().set({ onboardOpen: false }) }
  // opened again from Settings: start from the top with the saved name filled in
  useEffect(() => { if (forced) { setStep(0); setName(useStore.getState().profile?.name ?? '') } }, [forced])
  const visible = step === 1 || (step === 0 && (forced || (!profile && !hidden)))

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setProfile({ name: name.trim().slice(0, 20), since: profile?.since ?? Date.now() })
    setStep(1)
  }
  const later = () => { if (forced) { close(); return } try { sessionStorage.setItem(SKIP, '1') } catch { /* storage blocked */ } setHidden(true) }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div key="onboard" className="fixed inset-0 z-[120] grid place-items-center bg-ground/70 px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }} transition={{ duration: 0.2 }}>
          <Glass role="dialog" aria-modal="true" aria-label="Welcome to Friction" className="w-[min(440px,100%)] p-6">
            {step === 0 ? (
              <form onSubmit={save} className="grid gap-3">
                <p className="hud">Welcome</p>
                <h2 className="dot text-[1.7rem] font-bold">What should your friends call you?</h2>
                <p className="text-sm text-ink-2">This name is only for you and the friends you lock in with. It is never shown on the leaderboard, which asks for its own public alias.</p>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={20} aria-label="Your name" placeholder="Your name" className="h-12 border border-ink/30 bg-transparent px-3 text-[16px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-signal" />
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={later} className="h-11 px-3 text-sm text-ink-2 hover:text-ink">Not now</button>
                  <button type="submit" disabled={!name.trim()} className="h-11 bg-signal px-6 text-sm font-semibold text-on-signal disabled:opacity-40">Continue</button>
                </div>
              </form>
            ) : (
              <div className="grid gap-3">
                <p className="hud">Hi {profile?.name}</p>
                <h2 className="dot text-[1.7rem] font-bold">How much a day?</h2>
                <p className="text-sm text-ink-2">Your daily focus goal. You can change it any time in Settings.</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Daily goal">
                  {[30, 60, 90, 120].map((m) => <button key={m} onClick={() => setSettings({ dailyGoalMin: m })} aria-pressed={goal === m} className={cn('h-11 px-4 text-sm', goal === m ? 'bg-ink text-ground' : 'bg-ink/[0.07] ring-1 ring-ink/12 hover:bg-ink/12')}>{m} min</button>)}
                </div>
                <button onClick={() => { useStore.getState().markIntroSeen(); close() }} className="mt-1 h-11 bg-signal px-6 text-sm font-semibold text-on-signal">Let’s go</button>
              </div>
            )}
          </Glass>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
