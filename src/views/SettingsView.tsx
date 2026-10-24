import { Download, FlaskConical, Upload } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PageHeader, Panel, Seg } from '@/components/app/shared'
import { useMedia } from '@/lib/hooks'
import { DragToConfirm } from '@/components/ui/drag-to-confirm'
import { LiquidToggle } from '@/components/ui/liquid-toggle'
import { SmoothAccordion } from '@/components/ui/smooth-accordion'
import { TorqueDial } from '@/components/ui/torque-dial'
import { fx_say } from '@/lib/actions'
import { useFx } from '@/lib/fx'
import { setVolume } from '@/lib/player'
import { snapshotData, useStore } from '@/lib/store'

const RULES = [
  { id: 'a', title: 'There is no feed', content: 'Nothing sits below the screen and nothing loads when you pull. Lists page, charts are tabs.' },
  { id: 'b', title: 'Every scroll attempt is counted', content: 'A wheel turn, a swipe or a scroll key is swallowed and logged as a blocked scroll. Fewer per focused hour is the goal.' },
  { id: 'c', title: 'Leaving is logged, not punished', content: 'If you switch away mid-session for longer than a few seconds, the timer waits and the absence is recorded as a wandering.' },
  { id: 'd', title: 'Your data stays here', content: 'History lives in this browser. Radio and TV requests go to their public directories; nothing else leaves your device.' },
]

function Row({ title, hint, children }: { title: string; hint: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-b border-[var(--border)] py-6 first:pt-0 last:border-b-0 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="text-base font-medium text-ink">{title}</h2>
        <p className="mt-1 text-sm text-ink-2">{hint}</p>
      </div>
      <Panel className="min-w-0 p-4">{children}</Panel>
    </section>
  )
}

export function SettingsView() {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const demo = useStore((s) => s.demo)
  const file = useRef<HTMLInputElement>(null)
  const [usage, setUsage] = useState('')
  const [tab, setTab] = useState<'session' | 'sound' | 'display' | 'data' | 'about'>('session')
  const wide = useMedia('(min-width: 768px)')

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage != null) setUsage(e.usage > 1e6 ? `${(e.usage / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(e.usage / 1e3))} KB`)
    }).catch(() => undefined)
  }, [demo])

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(snapshotData(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `anti-scroll-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  const importJson = async (f?: File | null) => {
    if (!f) return
    const ok = useStore.getState().importData(await f.text())
    fx_say(ok ? { title: 'History imported', variant: 'success' } : { title: 'That file could not be read', description: 'Choose a file exported from Anti-Scroll.', variant: 'danger' })
  }

  const reset = () => {
    const before = snapshotData()
    useStore.getState().resetAll()
    useFx.getState().say({
      title: 'All data erased',
      description: 'History, saved listings and settings are gone from this browser.',
      variant: 'danger',
      undo: () => useStore.getState().restore(before),
    })
  }

  const btn = 'inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--control)] bg-surface px-3 text-[13px] font-medium text-ink transition-colors hover:bg-raised'

  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader title="Settings" sub="Saved in this browser the moment you change them.">
        <Seg id="set" value={tab} onChange={(id) => setTab(id as typeof tab)} tabs={(wide ? [{ id: 'session', label: 'Session' }] : [{ id: 'session', label: 'Focus' }, { id: 'sound', label: 'Sound' }]).concat([{ id: 'display', label: 'Display' }, { id: 'data', label: 'Data' }, { id: 'about', label: 'About' }])} />
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-hidden">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}>
          {(tab === 'session' || tab === 'sound') && (<>
          {(wide || tab === 'session') && (
          <Row title="Focus" hint="Your default session and the daily total the score is measured against.">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div>
                <div className="mb-1.5 text-sm font-medium">Session length</div>
                <Seg id="sl" value={String(settings.sessionMin)} onChange={(id) => setSettings({ sessionMin: Number(id) })} tabs={[15, 25, 45, 60].map((m) => ({ id: String(m), label: `${m} min` }))} />
              </div>
              <div className="flex items-center gap-4">
                <TorqueDial value={settings.dailyGoalMin} min={15} max={240} step={15} unit="m" size={88} label="Daily goal" onChange={(v) => setSettings({ dailyGoalMin: v })} />
                <div className="text-sm text-ink-2">
                  <div className="font-medium text-ink">Daily goal</div>
                  About {Math.round(settings.dailyGoalMin / settings.sessionMin)} sessions of {settings.sessionMin} min.
                </div>
              </div>
            </div>
          </Row>
          )}

          {(wide || tab === 'sound') && (
          <Row title="Sound" hint="Applies to radio and TV alike.">
            <div className="flex items-center gap-4">
              <TorqueDial value={Math.round(settings.volume * 100)} min={0} max={100} step={5} unit="%" size={88} label="Volume" onChange={(v) => setVolume(v / 100)} />
              <div className="text-sm text-ink-2"><div className="font-medium text-ink">Volume</div>Turn the dial, or drag it.</div>
            </div>
          </Row>
          )}
          </>)}
          {tab === 'display' && (
          <Row title="Scroll guard and motion" hint="Block and count scroll gestures, and choose how much the screen moves. Your system's reduce-motion setting always wins.">
            <div className="grid gap-5">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm"><div className="font-medium text-ink">Block scroll gestures</div><div className="text-ink-2">Wheel, swipe and scroll keys are swallowed and counted.</div></div>
                <LiquidToggle value={settings.guard !== false} onChange={(v) => setSettings({ guard: v })} showLabels={false} width={48} height={28} offLabel="Scroll guard off" onLabel="Scroll guard on" accentColor="#141414" />
              </div>
              <div>
                <div className="mb-1.5 text-sm font-medium">Motion</div>
                <Seg id="mo" value={String(settings.motion)} onChange={(id) => setSettings({ motion: Number(id) as 0 | 1 | 2 })} tabs={[{ id: '0', label: 'Calm' }, { id: '1', label: 'Lively' }, { id: '2', label: 'Lots' }]} />
                <p className="mt-1.5 text-[13px] text-ink-2">Calm keeps only what answers a tap. Lively adds rolling figures and entrances. Lots adds the pointer-reactive dot field and a second orbit on the timer.</p>
              </div>
            </div>
          </Row>

          )}
          {tab === 'data' && (
          <Row title="Your data" hint={`Everything is stored on this device${usage ? `, ${usage} in use` : ''}. Export it, move it, or erase it.`}>
            <div className="flex flex-wrap gap-2">
              <button className={btn} onClick={exportJson}><Download className="size-3.5" />Export JSON</button>
              <button className={btn} onClick={() => file.current?.click()}><Upload className="size-3.5" />Import</button>
              <button className={btn} onClick={() => { useStore.getState().loadDemo(); fx_say({ title: 'Demo history loaded', description: 'Made-up data so the charts have something to show. Erase it any time.', variant: 'success' }) }}><FlaskConical className="size-3.5" />Load demo history</button>
              <input ref={file} type="file" accept="application/json" hidden onChange={(e) => { void importJson(e.target.files?.[0]); e.target.value = '' }} />
            </div>
            <div className="mt-4 max-w-sm">
              <div className="mb-1.5 text-sm"><span className="font-medium text-[#c4242a]">Erase all data</span> <span className="text-ink-2">Drag to confirm. You can undo for a few seconds.</span></div>
              <DragToConfirm label="Drag to erase everything" confirmedLabel="Erased" actionType="delete" onConfirm={reset} size="md" />
            </div>
          </Row>

          )}
          {tab === 'about' && (
          <Row title="How it works" hint="Four rules the screen keeps.">
            <SmoothAccordion items={RULES} defaultOpen={['b']} />
          </Row>
          )}
        </motion.div>
      </div>
    </section>
  )
}
