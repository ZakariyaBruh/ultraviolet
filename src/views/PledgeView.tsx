import { Download, FlaskConical, Trash2, Upload } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useMedia } from '@/lib/hooks'
import { Badge } from '@/components/ui/badge'
import { MagneticButton } from '@/components/ui/magnetic-button'
import { ScrollVelocityText } from '@/components/ui/scrollvelocitytext'
import { TorqueDial } from '@/components/ui/torque-dial'
import { Panel, Seg, ViewHeader } from '@/components/app/shared'
import { fx_say } from '@/lib/actions'
import { setVolume } from '@/lib/player'
import { snapshotData, useStore } from '@/lib/store'
import { useFx } from '@/lib/fx'

const RULES = [
  ['No feed.', 'There is nothing below this screen. Nothing loads when you pull.'],
  ['One thing at a time.', 'A timer, a sound or a channel — never a stack of tabs.'],
  ['Every urge counts.', 'Wheel, swipe or key: the site swallows it and logs it as a win.'],
  ['Wander, and it tells you.', 'Leave mid-session and you will see how long you were gone.'],
  ['Your data stays here.', 'History lives in this browser. No account, no server.'],
]

export function PledgeView() {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const demo = useStore((s) => s.demo)
  const file = useRef<HTMLInputElement>(null)
  const [usage, setUsage] = useState<string>('')
  const wide = useMedia('(min-width: 768px)')
  const [part, setPart] = useState<'rules' | 'tuning' | 'data'>('rules')
  const show = (p: typeof part) => wide || part === p

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
    fx_say(ok ? { title: 'History imported', variant: 'success' } : { title: 'That file didn’t look right', variant: 'danger' })
  }

  const reset = () => {
    const before = snapshotData()
    useStore.getState().resetAll()
    useFx.getState().say({
      title: 'Everything wiped',
      description: 'History, favorites and settings are gone from this browser.',
      variant: 'danger',
      undo: () => useStore.getState().restore(before),
    })
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <ViewHeader kicker="The deal" title="Pledge">
        <Badge tone="success" dot pulse>stored in this browser</Badge>
      </ViewHeader>

      {!wide && (
        <Seg id="pledge-part" value={part} onChange={(id) => setPart(id as typeof part)} tabs={[{ id: 'rules', label: 'Rules' }, { id: 'tuning', label: 'Tuning' }, { id: 'data', label: 'Data' }]} />
      )}
      <div className="grid min-h-0 flex-1 content-start gap-3 md:grid-cols-2">
        {show('rules') && (
        <Panel className="flex min-h-0 flex-col gap-2 overflow-hidden p-4">
          <ScrollVelocityText text="NO. MORE. SCROLL." as="h2" className="font-display text-[clamp(1.2rem,3.4vw,1.9rem)] font-black text-white" />
          <ol className="grid gap-2">
            {RULES.map(([t, d], i) => (
              <motion.li
                key={t}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.09, type: 'spring', stiffness: 240, damping: 22 }}
                className="flex gap-3 rounded-xl bg-white/[0.04] px-3 py-2"
              >
                <span className="font-display text-lg font-black text-lime-300">{i + 1}</span>
                <span className="text-sm text-white/70"><b className="text-white">{t}</b> {d}</span>
              </motion.li>
            ))}
          </ol>
        </Panel>
        )}

        <div className="grid min-h-0 content-start gap-3">
          {show('tuning') && (
          <Panel className="p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-200/70">Tuning</div>
            <div className="flex flex-wrap items-center justify-around gap-4">
              <TorqueDial value={settings.dailyGoalMin} min={15} max={240} step={15} unit="m" size={96} label="Daily goal" onChange={(v) => setSettings({ dailyGoalMin: v })} />
              <TorqueDial value={Math.round(settings.volume * 100)} min={0} max={100} step={5} unit="%" size={96} label="Volume" onChange={(v) => setVolume(v / 100)} />
              <div className="grid gap-2">
                <div className="text-center text-xs text-white/50">Motion</div>
                <Seg id="motion" value={String(settings.motion)} onChange={(id) => setSettings({ motion: Number(id) as 0 | 1 | 2 })} tabs={[{ id: '0', label: 'Calm' }, { id: '1', label: 'Lively' }, { id: '2', label: 'LOTS' }]} />
                <button onClick={() => setSettings({ cursor: !settings.cursor })} aria-pressed={settings.cursor} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10">
                  Cursor trail: {settings.cursor ? 'on' : 'off'}
                </button>
              </div>
            </div>
          </Panel>
          )}

          {show('data') && (
          <Panel className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-200/70">Your data</div>
              {usage && <span className="text-xs text-white/40">{usage} in localStorage + IndexedDB</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <MagneticButton size="sm" variant="secondary" onClick={exportJson}><Download className="mr-1.5 h-3.5 w-3.5" />Export</MagneticButton>
              <MagneticButton size="sm" variant="secondary" onClick={() => file.current?.click()}><Upload className="mr-1.5 h-3.5 w-3.5" />Import</MagneticButton>
              <MagneticButton size="sm" variant="outline" onClick={() => { useStore.getState().loadDemo(); fx_say({ title: 'Demo history loaded', description: 'Fake data, clearly marked. Reset removes it.', variant: 'success' }) }}><FlaskConical className="mr-1.5 h-3.5 w-3.5" />Load demo history</MagneticButton>
              <MagneticButton size="sm" variant="ghost" onClick={reset}><Trash2 className="mr-1.5 h-3.5 w-3.5 text-red-300" />Reset</MagneticButton>
              <input ref={file} type="file" accept="application/json" hidden onChange={(e) => { void importJson(e.target.files?.[0]); e.target.value = '' }} />
            </div>
          </Panel>
          )}
        </div>
      </div>
    </section>
  )
}
