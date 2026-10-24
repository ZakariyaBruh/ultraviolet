import { useState } from 'react'
import { PageHeader, Panel, Seg } from '@/components/app/shared'
import { AnimatedFileUpload } from '@/components/ui/animated-file-upload'
import { CodeSnippetDeck } from '@/components/ui/code-snippet-deck'
import { DragToConfirm } from '@/components/ui/drag-to-confirm'
import { DrawCheckbox } from '@/components/ui/draw-checkbox'
import { FAQ } from '@/components/ui/faq'
import { LiquidToggle } from '@/components/ui/liquid-toggle'
import { TorqueDial } from '@/components/ui/torque-dial'
import { fx_say } from '@/lib/actions'
import { DATA_KEYS, useStore, type AppState } from '@/lib/store'
import { useMedia } from '@/lib/hooks'
import { useUI } from '@/lib/ui'

const snapshot = (s: AppState) => {
  const o: Record<string, unknown> = {}
  for (const k of DATA_KEYS) o[k] = s[k]
  return o
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-b border-ink/10 py-2 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[15px] text-ink">{title}</div>
        {hint && <div className="text-xs text-ink-3">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Focus() {
  const wide = useMedia('(min-width: 640px)')
  const s = useStore((x) => x.settings)
  const set = useStore((x) => x.setSettings)
  return (
    <Panel className="rounded-3xl p-5">
      <div className="grid grid-cols-2 gap-2 sm:gap-6">
        <div className="flex flex-col items-center gap-1">
          <TorqueDial label="Daily goal" value={s.dailyGoalMin} min={15} max={480} step={15} unit="min" onChange={(v) => set({ dailyGoalMin: v })} size={wide ? 150 : 112} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <TorqueDial label="Session length" value={s.sessionMin} min={10} max={90} step={5} unit="min" onChange={(v) => set({ sessionMin: v })} size={wide ? 150 : 112} />
        </div>
      </div>
      <Row title="Scroll guard" hint="Swallow and count scroll gestures while the app is open"><LiquidToggle accentColor="#ff5a1f" offLabel="Scroll guard off" onLabel="Scroll guard on" value={s.guard} onChange={(v) => set({ guard: v })} /></Row>
    </Panel>
  )
}

function Look() {
  const s = useStore((x) => x.settings)
  const set = useStore((x) => x.setSettings)
  return (
    <Panel className="rounded-3xl p-5">
      <Row title="Motion" hint="Calm is still. Lots turns on every effect.">
        <Seg id="set-motion" value={String(s.motion)} onChange={(v) => set({ motion: Number(v) as 0 | 1 | 2 })} tabs={[{ id: '0', label: 'Calm' }, { id: '1', label: 'Lively' }, { id: '2', label: 'Lots' }]} />
      </Row>
      <Row title="Theme" hint="Dark is the default">
        <Seg id="set-theme" value={s.theme} onChange={(v) => set({ theme: v as typeof s.theme })} tabs={[{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }]} />
      </Row>
      <Row title="Volume"><input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => set({ volume: Number(e.target.value) })} aria-label="Volume" className="h-11 w-40 accent-[var(--signal)]" /></Row>
    </Panel>
  )
}

function Data() {
  const [confirmed, setConfirmed] = useState(false)
  const json = JSON.stringify(snapshot(useStore.getState()), null, 2)
  return (
    <div className="grid min-h-0 gap-4 md:grid-cols-2">
      <Panel className="rounded-3xl p-4">
        <AnimatedFileUpload accept={['.json']} multiple={false} maxFiles={1} dropTitle="Import a backup" dropSubtitle="or browse for a .json file" onFilesSelected={async (files) => {
          const ok = useStore.getState().importData(await files[0].text())
          fx_say({ title: ok ? 'Backup imported' : 'Could not read that file', variant: ok ? 'success' : 'danger' })
        }} />
      </Panel>
      <Panel className="flex flex-col gap-3 rounded-3xl p-4">
        <CodeSnippetDeck snippets={[{ language: 'json', label: 'Export', filename: 'anti-scroll.json', code: json.slice(0, 600) + (json.length > 600 ? '\n…' : '') }]} />
        <button className="h-11 rounded-full border border-ink/15 text-sm text-ink" onClick={() => {
          const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: 'anti-scroll.json' })
          a.click()
        }}>Download backup</button>
        <DrawCheckbox label="Everything stays in this browser" description="Nothing is sent anywhere. Clearing site data erases it." checked readOnly />
        <DragToConfirm label="Slide to erase everything" confirmedLabel="Erased" variant="danger" isConfirmed={confirmed} onConfirm={() => { const before = snapshot(useStore.getState()); useStore.getState().resetAll(); setConfirmed(true); fx_say({ title: 'All data erased', variant: 'danger', undo: () => { useStore.getState().restore(before as unknown as AppState); setConfirmed(false) } }) }} onReset={() => setConfirmed(false)} autoResetDelay={4000} />
      </Panel>
    </div>
  )
}

function Help() {
  return (
    <Panel className="rounded-3xl p-4" data-allow-scroll>
      <FAQ variant="separated" items={[
        { id: '1', question: 'What counts as a blocked scroll?', answer: 'A wheel turn, vertical swipe or scroll key the app swallowed while the guard was on.' },
        { id: '2', question: 'Where is my data?', answer: 'In localStorage and IndexedDB in this browser. There is no account and no server.' },
        { id: '3', question: 'Why does a lapse happen?', answer: 'Leaving the tab for six seconds or more during a session is logged as a lapse.' },
      ]} />
      <div className="mt-3 flex gap-2">
        <button className="h-11 flex-1 rounded-full border border-ink/15 text-sm text-ink" onClick={() => useUI.getState().set({ tourOpen: true })}>Replay tour</button>
        <button className="h-11 flex-1 rounded-full border border-ink/15 text-sm text-ink" onClick={() => { useStore.getState().loadDemo(); fx_say({ title: 'Demo data loaded', variant: 'success' }) }}>Load demo data</button>
      </div>
    </Panel>
  )
}

export function SettingsView() {
  const [tab, setTab] = useState('focus')
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader kicker="Settings" title="Make it yours">
        <Seg id="set-tabs" value={tab} onChange={setTab} tabs={[{ id: 'focus', label: 'Settings' }, { id: 'data', label: 'Data' }, { id: 'help', label: 'Help' }]} />
      </PageHeader>
      <div className="min-h-0 flex-1">
        {tab === 'focus' && <div className="grid gap-4 lg:grid-cols-2"><Focus /><Look /></div>}
        {tab === 'data' && <Data />}
        {tab === 'help' && <Help />}
      </div>
    </div>
  )
}
