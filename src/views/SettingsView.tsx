import { cn } from '@/lib/utils'
import { useState } from 'react'
import { PageHeader, Panel, Seg } from '@/components/app/shared'
import { AnimatedFileUpload } from '@/components/ui/animated-file-upload'
import { DragToConfirm } from '@/components/ui/drag-to-confirm'
import { DrawCheckbox } from '@/components/ui/draw-checkbox'
import { FAQ } from '@/components/ui/faq'
import { LengthBand } from '@/components/app/LengthBand'
import { fx_say } from '@/lib/actions'
import { useUI } from '@/lib/ui'
import { askOs, osState } from '@/lib/notify'
import { SlidePagination } from '@/components/ui/slide-pagination'
import { contrast } from '@/lib/theme'
import { THEMES, themeDef } from '@/lib/themes'
import { setVolume } from '@/lib/player'
import { DATA_KEYS, useStore, type AppState } from '@/lib/store'
import { useMedia } from '@/lib/hooks'

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
  const s = useStore((x) => x.settings)
  const set = useStore((x) => x.setSettings)
  return (
    <Panel className="grid content-start gap-6 rounded-3xl p-5">
      <div>
        <div className="mb-1 flex items-baseline justify-between"><h2 className="text-[15px] font-semibold">Daily goal</h2><span className="fig text-sm text-ink-2">{s.dailyGoalMin} min</span></div>
        <LengthBand value={s.dailyGoalMin} onChange={(v) => set({ dailyGoalMin: v })} min={30} max={240} step={15} label="Daily goal in minutes" ends={['30', '90', '150', '240 min']} className="max-w-none" />
      </div>
      <div>
        <div className="mb-1 flex items-baseline justify-between"><h2 className="text-[15px] font-semibold">Session length</h2><span className="fig text-sm text-ink-2">{s.sessionMin} min</span></div>
        <LengthBand value={s.sessionMin} onChange={(v) => set({ sessionMin: v })} min={10} max={90} step={5} className="max-w-none" />
      </div>
      <Row title="Lesson demos" hint="A new lesson asks Gemini (Google) to write a small interactive demo. Only the topic title is sent. It runs sealed in a frame with no network, is marked AI-made, and can be wrong. If it does not arrive, the lesson goes on without it.">
        <Seg id="set-aidemos" value={s.aiDemos ? 'on' : 'off'} onChange={(v) => set({ aiDemos: v === 'on' })} tabs={[{ id: 'on', label: 'AI' }, { id: 'off', label: 'Off' }]} />
      </Row>
    </Panel>
  )
}

function ThemePicker() {
  const id = useStore((x) => x.settings.theme)
  const set = useStore((x) => x.setSettings)
  return (
    <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-2">
      {THEMES.map((t) => (
        <button key={t.id} role="radio" aria-checked={id === t.id} aria-label={`${t.name}: ${t.note}`} onClick={() => set({ theme: t.id })} className={`group relative h-14 w-[4.5rem] overflow-hidden border text-left transition-transform active:scale-[0.97] ${id === t.id ? 'border-signal ring-2 ring-signal' : 'border-ink/30'}`} style={{ background: t.ground }}>
          <span className="absolute left-2 top-2 size-3" style={{ background: t.signal }} />
          <span className="absolute left-2 top-7 h-px w-8" style={{ background: t.ink }} />
          <span className="absolute left-2 top-9 h-px w-5" style={{ background: t.ice }} />
          <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-0.5 font-[family-name:var(--font-cond)] text-[13px] font-semibold uppercase leading-4 tracking-[0.08em] text-white">{t.name}</span>
        </button>
      ))}
    </div>
  )
}

function Colours() {
  const accent = useStore((x) => x.settings.accent)
  const bg = useStore((x) => x.settings.bg)
  const theme = useStore((x) => x.settings.theme)
  const set = useStore((x) => x.setSettings)
  const def = themeDef(theme)
  const a = accent || def.signal
  const b = bg || def.ground
  const ratio = contrast(a, b)
  const pick = (label: string, key: 'accent' | 'bg', value: string) => (
    <label className="flex min-h-11 items-center gap-2 text-[13px] text-ink-2">
      <input type="color" value={value} onChange={(e) => set({ [key]: e.target.value })} aria-label={label} className="size-11 cursor-pointer border border-ink/30 bg-transparent p-0.5" />
      {label}
    </label>
  )
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {pick('Accent', 'accent', a)}
      {pick('Background', 'bg', b)}
      {(accent || bg) && <button className="h-11 border border-ink/30 px-3 text-[13px] text-ink hover:bg-ink/10" onClick={() => set({ accent: '', bg: '' })}>Reset colours</button>}
      {ratio < 3 && <p role="status" className="basis-full text-[13px] text-ink">Accent and background are close ({ratio.toFixed(1)}:1). Controls may be hard to see.</p>}
    </div>
  )
}

const STOPS = [
  { name: 'Future', note: 'Clean and sharp. No scanlines, no grain, no pixels.' },
  { name: 'Afterglow', note: 'A faint scanline, a little grain, a warm tint around the clean lines.' },
  { name: 'Broadcast', note: 'Adds an on-screen display (channel and REC) and pixel kickers.' },
  { name: 'Arcade', note: 'Adds pixel titles, stepped corners, hard shadows, a pixel pointer, a marquee and sprites.' },
  { name: 'Tube TV', note: 'Every word turns to pixel type. Curved glass, a rolling bar and split colour on titles.' },
  { name: 'Full 8-bit', note: 'Press Start titles, dithered panels with hard borders, a bezel and a row of sprites.' },
]
function Era() {
  const era = useStore((x) => x.settings.era)
  const set = useStore((x) => x.setSettings)
  const stage = Math.round((100 - era) / 20)
  return (
    <div className="grid gap-2 border-t border-rule py-3">
      <h3 className="text-sm font-medium">Era</h3>
      <p className="text-[13px] text-ink-2">Six stops from the future back to the past. Each one adds to the last, so you can see how retro you want it as you go.</p>
      <div className="flex items-center gap-3">
        <span className="hud shrink-0">Past</span>
        <LengthBand value={era} onChange={(v) => set({ era: v })} min={0} max={100} step={20} label="Era, from the past to the future" ends={['', '', '']} format={(v) => STOPS[Math.round((100 - v) / 20)].name} className="max-w-none flex-1" />
        <span className="hud shrink-0">Future</span>
      </div>
      <div role="group" aria-label="Era stops" className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {STOPS.map((st, i) => (
          <button key={st.name} type="button" aria-pressed={stage === i} onClick={() => set({ era: 100 - i * 20 })} className={cn('min-h-11 border px-1.5 text-[13px] leading-tight', stage === i ? 'border-signal bg-signal text-on-signal' : 'border-rule text-ink-2 hover:text-ink')}>
            <span className="block">{st.name}</span>
            <span className="block text-[11px] opacity-70">{i * 20}% retro</span>
          </button>
        ))}
      </div>
      <p role="status" className="text-[13px] text-ink">{STOPS[stage].note}</p>
    </div>
  )
}

function Alerts() {
  const [state, setState] = useState(osState())
  return (
    <div className="grid gap-1 border-t border-rule py-3">
      <h3 className="text-sm font-medium">Notifications</h3>
      <p className="text-[13px] text-ink-2">The bell collects goals, streaks, lessons, leaderboard moves and messages from your rooms. With system notifications on, the ones that matter also reach you while this tab is in the background.</p>
      {state === 'unsupported' ? <p className="text-[13px] text-ink-3">This browser does not offer system notifications.</p> : state === 'granted' ? <p className="text-[13px] text-ink">System notifications are on.</p> : state === 'denied' ? <p className="text-[13px] text-ink-3">System notifications are blocked. Allow them in your browser's site settings.</p> : (
        <button className="h-11 w-fit border border-ink/30 px-4 text-sm hover:bg-ink/10" onClick={() => void askOs().then((r) => setState(r))}>Turn on system notifications</button>
      )}
    </div>
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
      <div className="grid gap-2 border-t border-rule py-3">
        <h3 className="text-sm font-medium">Theme</h3>
        <p className="text-[13px] text-ink-2">Press T anywhere to change theme.</p>
        <ThemePicker />
      </div>
      <div className="grid gap-1 border-t border-rule py-3">
        <h3 className="text-sm font-medium">Colours</h3>
        <p className="text-[13px] text-ink-2">Your own accent and background, on top of any theme.</p>
        <Colours />
      </div>
      <Era />
      <Alerts />
      <Row title="Volume"><input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => { const v = Number(e.target.value); set({ volume: v }); setVolume(v) }} aria-label="Volume" className="h-11 w-40 accent-[var(--signal)]" /></Row>
    </Panel>
  )
}

function Data() {
  const [confirmed, setConfirmed] = useState(false)
  const wide = useMedia('(min-width: 768px)')
  const download = () => {
    const json = JSON.stringify(snapshot(useStore.getState()), null, 2)
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: 'friction-backup.json' })
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  return (
    <div className="grid min-h-0 gap-4 md:grid-cols-2">
      <Panel className="flex flex-col gap-3 rounded-3xl p-4">
        <AnimatedFileUpload variant={wide ? 'standard' : 'compact'} accept={['.json']} multiple={false} maxFiles={1} dropTitle="Import a backup" dropSubtitle="or browse for a .json file" onFilesSelected={async (files) => {
          const ok = useStore.getState().importData(await files[0].text())
          fx_say({ title: ok ? 'Backup imported' : 'Could not read that file', description: ok ? undefined : 'It is not a Friction backup.', variant: ok ? 'success' : 'danger' })
        }} />
        <button className="h-11 border border-ink/30 text-sm text-ink hover:bg-ink/10" onClick={download}>Download backup</button>
      </Panel>
      <Panel className="flex flex-col justify-between gap-3 rounded-3xl p-4">
        <DrawCheckbox label="Everything stays in this browser" description="Nothing is sent anywhere. Clearing site data erases it." checked readOnly />
        <DragToConfirm label="Slide to erase everything" confirmedLabel="Erased" variant="danger" isConfirmed={confirmed} onConfirm={() => { const before = snapshot(useStore.getState()); useStore.getState().resetAll(); setConfirmed(true); fx_say({ title: 'All data erased', variant: 'danger', undo: () => { useStore.getState().restore(before as unknown as AppState); setConfirmed(false) } }) }} onReset={() => setConfirmed(false)} autoResetDelay={4000} />
      </Panel>
    </div>
  )
}

function Help() {
  const [page, setPage] = useState(1)
  const items = [
        { id: '1', question: 'What counts as a drift?', answer: 'Leaving this tab for six seconds or more while a session is running.' },
        { id: '2', question: 'Where is my data?', answer: 'Everything you make (sessions, shelf, hidden topics, layout) is in localStorage and IndexedDB in this browser. There is no account and no server. The site counts page visits with Google Analytics; that records visits, never your sessions or what you hide. On a server there is only the recommendation board and any Together room you join (chat is kept for a day): a random code, a name you choose and a count. When its space fills, the lowest score is dropped to make room.' },
        { id: '3', question: 'Does the site scroll?', answer: 'No. Every screen fits the display. You move with the tab deck at the bottom, by dragging, or with the keyboard.' },
        { id: '4', question: 'Can I move things around?', answer: 'Yes. Grab any panel (not a button or slider) and drag or throw it. It glides and stays where you leave it. Every panel moves on its own and can overlap another. The player and nav bar are eased off anything they cover unless you put them there yourself. Alt and the arrow keys move a panel from the keyboard, and the reset button in the top bar puts everything back.' },
      ]
  const per = 2
  const pages = Math.ceil(items.length / per)
  return (
    <Panel className="rounded-3xl p-4" data-allow-scroll>
      <FAQ key={page} variant="separated" items={items.slice((page - 1) * per, page * per)} />
      <div className="mt-3 flex justify-center"><SlidePagination pageCount={pages} page={page} onChange={setPage} /></div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="h-11 flex-1 border border-ink/30 text-sm text-ink hover:bg-ink/10" onClick={() => useUI.getState().set({ onboardOpen: true })}>Run the welcome again</button>
        <button className="h-11 flex-1 border border-ink/30 text-sm text-ink" onClick={() => { const before = snapshot(useStore.getState()); useStore.getState().loadDemo(); fx_say({ title: 'Demo data loaded', description: 'Your own history was replaced for now.', variant: 'success', undo: () => useStore.getState().restore(before as unknown as AppState) }) }}>Load demo data</button>
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
