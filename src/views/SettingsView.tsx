import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import about from '@/lib/about.json'
import { useState } from 'react'
import { PageHeader, Panel, Seg } from '@/components/app/shared'
import { DragToConfirm } from '@/components/ui/drag-to-confirm'
import { DrawCheckbox } from '@/components/ui/draw-checkbox'
import { FAQ } from '@/components/ui/faq'
import { LengthBand } from '@/components/app/LengthBand'
import { EnterCode, MakeCode } from '@/components/app/Handoff'
import { fx_say } from '@/lib/actions'
import { eraseTheRest } from '@/lib/erase'
import { MusicControls } from '@/components/app/MusicControls'
import { useConsent } from '@/lib/consent'
import { BackupPanel, RestoreBackup } from '@/components/app/BackupPanel'
import { downloadCsv, downloadIcs } from '@/lib/exports'
import { isSupporter, openSupport, useSupporter } from '@/lib/supporter'
import { useUI } from '@/lib/ui'
import { askOs, osState } from '@/lib/notify'
import { SlidePagination } from '@/components/ui/slide-pagination'
import { contrast } from '@/lib/theme'
import { THEMES, themeDef, type ThemeDef } from '@/lib/themes'
import { startPreview, stopPreview } from '@/lib/themeCycle'
import { useThemeId } from '@/lib/theme'
import { setVolume } from '@/lib/player'
import { DATA_KEYS, useStore, type AppState } from '@/lib/store'
import { relearn, usePerf } from '@/lib/perf'

const snapshot = (s: AppState) => {
  const o: Record<string, unknown> = {}
  for (const k of DATA_KEYS) o[k] = s[k]
  return o
}

function Row({ title, hint, children, wrap }: { title: string; hint?: string; children: React.ReactNode; wrap?: boolean }) {
  return (
    <div className={cn('flex min-h-14 items-center justify-between gap-x-4 gap-y-2 border-b border-ink/10 py-2 last:border-b-0', wrap && 'flex-wrap')}>
      <div className={cn('min-w-0', wrap && 'min-w-[12rem] flex-1')}>
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
      <Row title="Lesson demos" hint="Sixteen core topics have built-in demos. Any other lesson asks Gemini (Google) to write one; only the topic title is sent. It runs sealed in a frame with no network, is marked AI generated, and can be wrong. If it does not arrive, the lesson goes on without it.">
        <Seg id="set-aidemos" value={s.aiDemos ? 'on' : 'off'} onChange={(v) => set({ aiDemos: v === 'on' })} tabs={[{ id: 'on', label: 'AI' }, { id: 'off', label: 'Off' }]} />
      </Row>
      <Row title="Cloud browser" hint="Very new and prone to errors, with no uptime guarantee. When a site will not open in the Browser, Friction can open it in the cloud browser: 30 minutes a day for each person, from one shared pool that can run out. Off means it never opens by itself and no time is used.">
        <Seg id="set-cloud" value={s.cloudOff ? 'off' : 'on'} onChange={(v) => set({ cloudOff: v === 'off' })} tabs={[{ id: 'on', label: 'On' }, { id: 'off', label: 'Off' }]} />
      </Row>
    </Panel>
  )
}

function ThemePicker() {
  const set = useStore((x) => x.setSettings)
  const supporter = useSupporter()
  const shown = useThemeId()
  const preview = useUI((x) => x.previewTheme)
  const pick = (t: ThemeDef) => {
    if (t.premium && !supporter) { startPreview(t.id); return }
    stopPreview()
    set({ theme: t.id })
  }
  const swatch = (t: ThemeDef) => {
    const locked = !!t.premium && !supporter
    return (
      <button key={t.id} role="radio" aria-checked={shown === t.id} aria-label={`${t.name}: ${t.note}${locked ? '. Supporter theme: tap to preview' : ''}`} onClick={() => pick(t)} className={`group relative h-14 w-[5.75rem] overflow-hidden border text-left transition-transform active:scale-[0.97] ${shown === t.id ? 'border-signal ring-2 ring-signal' : 'border-ink/30'}`} style={{ background: t.ground }}>
        <span className="absolute left-2 top-2 size-3" style={{ background: t.signal }} />
        <span className="absolute left-2 top-7 h-px w-8" style={{ background: t.ink }} />
        <span className="absolute left-2 top-9 h-px w-5" style={{ background: t.ice }} />
        {locked && <Lock className="absolute right-1.5 top-1.5 size-3" style={{ color: t.ink }} aria-hidden />}
        <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-0.5 font-[family-name:'Barlow_Condensed',sans-serif] text-[13px] font-semibold uppercase leading-4 tracking-[0.08em] text-white">{t.name}</span>
      </button>
    )
  }
  return (
    <div className="grid gap-3">
      <div role="radiogroup" aria-label="Themes" className="flex flex-wrap gap-2">{THEMES.filter((t) => !t.premium).map(swatch)}</div>
      <div className="grid gap-1.5">
        <p className="hud">Supporter themes{supporter ? '' : ' · tap one to try it'}</p>
        <div role="radiogroup" aria-label="Supporter themes" className="flex flex-wrap gap-2">{THEMES.filter((t) => t.premium).map(swatch)}</div>
      </div>
      {preview && (
        <div role="status" className="flex flex-wrap items-center gap-2 border border-signal bg-signal/10 p-3 text-[13px] text-ink">
          <span className="min-w-0 flex-1 basis-56">Trying {themeDef(preview).name}. Supporters keep it; for everyone else it goes back to normal in two minutes.</span>
          <button className="h-11 bg-signal px-4 text-sm font-semibold text-on-signal" onClick={openSupport}>See Support, $2 a month</button>
          <button className="h-11 border border-ink/30 px-4 text-sm text-ink hover:bg-ink/10" onClick={stopPreview}>Stop trying it</button>
        </div>
      )}
    </div>
  )
}

function Colours() {
  const accent = useStore((x) => x.settings.accent)
  const bg = useStore((x) => x.settings.bg)
  const theme = useThemeId()
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

/** a six-stop dial with a ruler, six buttons (from a tablet up) and a line saying what the stop does */
function Dial({ title, hint, value, onChange, stops, labelOf, ends, label, flip }: { title: string; hint: string; value: number; onChange: (v: number) => void; stops: { name: string; note: string }[]; labelOf: string; ends: [string, string]; label: string; flip?: boolean }) {
  const stage = flip ? Math.round((100 - value) / 20) : Math.round(value / 20)
  const set = (i: number) => onChange(flip ? 100 - i * 20 : i * 20)
  return (
    <div className="grid gap-2">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-[13px] text-ink-2">{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="hud shrink-0">{ends[0]}</span>
        <LengthBand value={value} onChange={onChange} min={0} max={100} step={20} label={label} ends={['', '', '']} format={(v) => stops[flip ? Math.round((100 - v) / 20) : Math.round(v / 20)].name} className="max-w-none flex-1" />
        <span className="hud shrink-0">{ends[1]}</span>
      </div>
      <div role="group" aria-label={labelOf} className="hidden grid-cols-6 gap-1.5 sm:grid">
        {stops.map((st, i) => (
          <button key={st.name} type="button" aria-pressed={stage === i} onClick={() => set(i)} className={cn('min-h-11 border px-1.5 text-[13px] leading-tight', stage === i ? 'border-signal bg-signal text-on-signal' : 'border-rule text-ink hover:bg-ink/10')}>{st.name}</button>
        ))}
      </div>
      <p role="status" className="text-[13px] text-ink">{stops[stage].note}</p>
    </div>
  )
}

/** the retro dial: how old the screen and its type look. It does not change how many solids there are. */
const RETRO = [
  { name: 'Future', note: 'Clean and sharp. No filters and no pixel type.' },
  { name: 'Afterglow', note: 'A faint scanline, a little grain and a warm tint.' },
  { name: 'Broadcast', note: 'Pixel kickers on the labels. This is as far as the screen filters go.' },
  { name: 'Arcade', note: 'Pixel titles and labels, and hard offset shadows.' },
  { name: 'Terminal', note: 'Dashed panel outlines and a prompt before each page title.' },
  { name: 'Full retro', note: 'Square panels and heavier dashes. Words stay easy to read.' },
]
/** the ASCII dial: how much of the page is solids drawn in text, and how far they roam. It does not change how retro the screen is. */
const ASCII = [
  { name: 'Off', note: 'No solids behind the page or beside the titles. The timer keeps its small turning solid.' },
  { name: 'Drift', note: 'One solid drifts slowly around the screen.' },
  { name: 'A few', note: 'Three solids roam the screen, and one turns beside each page title.' },
  { name: 'Orbit', note: 'Five solids circle the middle of the screen, each on a loop of its own. Two turn beside each title.' },
  { name: 'Stars', note: 'Seven solids, text stars twinkling, and a floor of text lines that runs to the horizon.' },
  { name: 'World', note: 'A whole text world: a sun on the horizon, nine solids circling it, falling stars and the floor, all moving, with three beside each title.' },
]

function Screen() {
  const era = useStore((x) => x.settings.era)
  const ascii = useStore((x) => x.settings.ascii)
  const set = useStore((x) => x.setSettings)
  return (
    <Panel className="grid content-start gap-3 rounded-3xl p-4 sm:gap-5 sm:p-5">
      <Dial title="Retro" hint="How old the screen and its type look. Each stop adds to the last." value={era} onChange={(v) => set({ era: v })} stops={RETRO} labelOf="Retro stops" ends={['Past', 'Future']} label="Retro, from the past to the future" flip />
      <div className="border-t border-rule" />
      <Dial title="ASCII" hint="How many 3D solids are drawn in text, and how far they roam. Apart from the retro look, so mix them as you like." value={ascii} onChange={(v) => set({ ascii: v })} stops={ASCII} labelOf="ASCII stops" ends={['Off', 'World']} label="ASCII, from off to a whole text world" />
      <div className="border-t border-rule"><Detail /></div>
    </Panel>
  )
}

function Alerts() {
  const [state, setState] = useState(osState())
  return (
    <div className="grid gap-1 pb-3">
      <h3 className="text-sm font-medium">Notifications</h3>
      <p className="text-[13px] text-ink-2">The bell collects goals, streaks, lessons, leaderboard moves and messages from your rooms. With system notifications on, the ones that matter also reach you while this tab is in the background.</p>
      {state === 'unsupported' ? <p className="text-[13px] text-ink-3">This browser does not offer system notifications.</p> : state === 'granted' ? <p className="text-[13px] text-ink">System notifications are on.</p> : state === 'denied' ? <p className="text-[13px] text-ink-3">System notifications are blocked. Allow them in your browser's site settings.</p> : (
        <button className="h-11 w-fit border border-ink/30 px-4 text-sm hover:bg-ink/10" onClick={() => void askOs().then((r) => setState(r))}>Turn on system notifications</button>
      )}
    </div>
  )
}

/**
 * How much the moving background may cost this device (lib/perf.ts). Auto is the default and looks after itself; the line under it
 * says what it has done, in words, and offers the way back when it has lightened things.
 */
function Detail() {
  const mode = useStore((x) => x.settings.perf)
  const set = useStore((x) => x.setSettings)
  const auto = usePerf((p) => p.auto)
  const hint = mode === 'full' ? 'Always drawn in full, even if this device struggles.'
    : mode === 'lite' ? 'Drawn half as often and less sharp. Easier on a slow device and on the battery.'
    : auto === 2 ? 'Drawn in full. If this device cannot keep up, Auto lightens it and tells you.'
    : auto === 1 ? 'Auto has lightened it, because this device was not keeping up.'
    : 'Auto is holding it still, because this device was not keeping up.'
  return (
    <Row title="Background" hint={hint} wrap>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {mode === 'auto' && auto < 2 && <button onClick={relearn} className="h-11 px-2 text-sm text-ink-2 underline underline-offset-4 hover:text-ink">Try full again</button>}
        <Seg id="set-perf" value={mode} onChange={(v) => set({ perf: v as 'auto' | 'full' | 'lite' })} tabs={[{ id: 'auto', label: 'Auto' }, { id: 'full', label: 'Full' }, { id: 'lite', label: 'Lite' }]} />
      </div>
    </Row>
  )
}

/** how it looks: motion, the theme, your own colours */
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
    </Panel>
  )
}

/** notifications and volume */
function Sound() {
  const s = useStore((x) => x.settings)
  const set = useStore((x) => x.setSettings)
  return (
    <Panel className="content-start rounded-3xl p-5">
      <Alerts />
      <div className="border-t border-rule pt-1">
        <Row title="Volume"><input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => { const v = Number(e.target.value); set({ volume: v }); setVolume(v) }} aria-label="Volume" className="h-11 w-40 accent-[var(--signal)]" /></Row>
      </div>
      <div className="grid gap-2 border-t border-rule pt-3">
        <h3 className="text-sm font-medium">Music</h3>
        <MusicControls compact />
        <p className="text-[13px] leading-[1.4] text-ink-2">Want real songs? Open the Music screen: whole tracks from five free services, filtered to the age you choose there. Auto music above is a Shop item.</p>
      </div>
    </Panel>
  )
}

function Data() {
  const [confirmed, setConfirmed] = useState(false)
  return (
    <div className="grid min-h-0 content-start gap-4 lg:grid-cols-2">
      <Panel className="grid gap-3 p-4 md:grid-cols-2 md:gap-6 lg:col-span-2">
        <div className="grid content-start gap-2">
          <p className="hud">Move my data</p>
          <p className="text-[13px] leading-[1.4] text-ink-2">Use Friction somewhere else, like the Home Screen app on an iPhone or iPad, which keeps its data apart from Safari. Make a code here and type it there. It works once, for ten minutes, and the data is sealed on the way: the server cannot read it.</p>
          <MakeCode />
        </div>
        <div className="grid content-start gap-2">
          <p className="hud">Bring data here</p>
          <p className="text-[13px] leading-[1.4] text-ink-2">Type a code made in another browser. This replaces what is saved in this one, so use it on a fresh install.</p>
          <EnterCode />
          <div className="mt-2 border-t border-ink/10 pt-3"><RestoreBackup /></div>
        </div>
      </Panel>
      {isSupporter() && <BackupPanel />}
      <Panel className="grid content-start gap-3 p-4">
        <p className="hud">Take your sessions with you</p>
        <p className="max-w-prose text-[13px] leading-[1.4] text-ink-2">A CSV file for a spreadsheet, or a calendar file for Google, Apple or Outlook Calendar. Both are built in this browser and sent nowhere.</p>
        <div className="flex flex-wrap gap-2">
          <button className="h-11 border border-ink/30 px-4 text-sm text-ink hover:bg-ink/10" onClick={downloadCsv}>Download CSV</button>
          <button className="h-11 border border-ink/30 px-4 text-sm text-ink hover:bg-ink/10" onClick={downloadIcs}>Download calendar (.ics)</button>
        </div>
      </Panel>
      <Panel className="flex flex-col justify-between gap-3 rounded-3xl p-4 lg:col-span-2">
        <DrawCheckbox label="Everything stays in this browser" description="Erasing also removes your place on the leaderboard and your seat in any room. No file can be imported, so nothing uploaded can take someone else's place. Moving your data to your own other browser takes a one-time code you make yourself." checked readOnly />
        <DragToConfirm className="slide-end slide-danger" label="Slide to erase everything" confirmedLabel="Erased" variant="danger" isConfirmed={confirmed} onConfirm={async () => { const before = snapshot(useStore.getState()); useStore.getState().resetAll(); setConfirmed(true); const onServer = await eraseTheRest(); fx_say({ title: 'All data erased', description: onServer ? 'You are off the leaderboard and out of every room. Undo brings your data back here, not your place on the board.' : 'You are offline, so the leaderboard place will be removed the next time the app can reach the server.', variant: 'danger', undo: () => { useStore.getState().restore(before as unknown as AppState); setConfirmed(false) } }) }} onReset={() => setConfirmed(false)} autoResetDelay={4000} />
      </Panel>
    </div>
  )
}

function Help() {
  const [page, setPage] = useState(1)
  const items = [
        { id: 'a0', question: about.heading, answer: about.intro },
        ...about.items.map((i, n) => ({ id: `a${n + 1}`, question: i.title, answer: i.text })),
        { id: '1', question: 'What counts as a drift?', answer: 'Leaving this tab for six seconds or more while a session is running. On a phone or tablet the screen is kept awake while you are locked in, so it does not lock by itself and count as one.' },
        { id: '2', question: 'Where is my data?', answer: 'Everything you make (sessions, shelf, hidden topics, layout) is in localStorage and IndexedDB in this browser. There is no account. The site counts page visits with Google Analytics, only if you accept cookies; that records visits, never your sessions or what you hide. On a server there is only the leaderboard (a random code, a name you choose and the minutes you have focused since joining), any Together room you join (chat is kept for a day) and, if you are a supporter and turn it on, an encrypted backup that only your key can open.' },
        { id: '3', question: 'Does the site scroll?', answer: 'Not at normal sizes: every screen fits the display, and you move with the tab deck at the bottom, by dragging, or with the keyboard. In a very small window, a screen that cannot fit scrolls inside its own area, between the top bar and the tabs.' },
        { id: '4', question: 'Can I move things around, or make them bigger?', answer: 'Yes. Grab any panel (not a button or slider) and drag or throw it. It glides and stays where you leave it. Every panel moves on its own and can overlap another. To resize one, drag an edge or a corner: the grip in the bottom right shows when you point at a panel (on a touch screen, touch the panel first), double-click a grip to put the size back, and Escape while dragging cancels. What no longer fits scrolls inside the panel, and the study windows keep their title bar still. The player and nav bar are eased off anything they cover unless you put them there yourself. From the keyboard, Alt and the arrow keys move a panel and Ctrl, Alt and the arrow keys resize it (Shift for bigger steps). The reset button in the top bar puts everything back, sizes included.' },
        { id: '5', question: 'What is written by an AI, and what is not?', answer: 'Lessons are made from Wikipedia text by fixed rules, and so are their questions and answers. No AI writes them. Two optional things use AI, and both say so. A lesson’s demo is AI generated when there is no built-in demo for that topic (only the topic title is sent). And the Ask AI window, which only runs when you open it and type, sends your questions to free AI services (Pollinations, with LLM7 as a backup) through Friction’s server; nothing is saved, and it can be wrong. Everything else in the app, including the Debrief, is plain code.' },
        { id: '6', question: 'What happens when I erase everything?', answer: 'Your sessions, shelf, notes, layout and cached lessons are removed from this browser. Your place on the leaderboard goes too, with your alias, so the name is free again, and you leave any Together room. Each person holds at most one row on the server in each place, so there is little to remove.' },
        { id: '7', question: 'Where do the songs come from?', answer: 'The Music screen searches five free services at once, none needing an account or a key: Audius (independent artists), Openverse (openly licensed music, mostly from Jamendo), Wikimedia Commons (freely licensed recordings, a lot of classical), the Library of Congress (early records, 1900 to 1925) and the Internet Archive (public domain and openly licensed recordings). Only the words you search for are sent. None of them rates its music, so you choose an age (Everyone, Teens or Adults) and Friction filters by the explicit flags and words they give. That is a guide, not a guarantee. Songs play in the same player as radio. Auto music, made in your browser, is a separate Shop item and steps aside while a song plays.' },
        { id: '9', question: 'Does it work without a connection?', answer: 'After your first visit, yes. Friction keeps a copy of its own files in this browser, so it opens with no connection and starts faster every time after. The timer, the study windows and everything you have saved work offline. Radio, TV, songs, podcasts, news, lessons, rooms and the leaderboard need a connection, and say so.' },
        { id: '10', question: 'Why did the background get simpler?', answer: 'The moving background (the flowing lines, the solids drawn in text and the rush of stars while you are locked in) is the most demanding thing Friction draws. If your device cannot keep up, Friction draws it less often, and if that is not enough it holds it still. It tells you when it does, and nothing else changes. Under Look, Background lets you choose Full or Lite yourself.' },
        { id: '11', question: 'What can I do from the keyboard?', answer: 'Ctrl K (or Command K) opens search from anywhere, and T changes the theme. With a tab in the deck focused, the arrow keys, Home and End move between screens. Alt with the arrow keys moves the focused panel, and Ctrl Alt with the arrow keys resizes it (hold Shift for bigger steps). Escape closes what is open, cancels a drag and leaves the tour.' },
        { id: '8', question: 'Who owns the radio and TV streams?', answer: 'Their broadcasters do. Friction hosts, records and re-streams nothing: the radio and TV lists are hand-picked (public-service and international broadcasters and independents that publish free streams, found through radio-browser.info and github.com/iptv-org/iptv), and your own browser connects straight to each station or channel. Some streams are down or limited to certain countries. If you are the rights holder and want something taken off our list, the Contact page says how; to remove it from the web it has to come down at the source.' },
      ]
  const per = 2
  const pages = Math.ceil(items.length / per)
  return (
    <Panel className="rounded-3xl p-4" data-allow-scroll>
      <FAQ key={page} variant="separated" items={items.slice((page - 1) * per, page * per)} />
      <div className="mt-3 flex justify-center"><SlidePagination pageCount={pages} page={page} onChange={setPage} /></div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="h-11 flex-1 border border-ink/30 text-sm text-ink hover:bg-ink/10" onClick={() => useUI.getState().set({ tourOpen: true })}>Take the tour</button>
        <button className="h-11 flex-1 border border-ink/30 text-sm text-ink hover:bg-ink/10" onClick={() => useUI.getState().set({ onboardOpen: true })}>Run the welcome again</button>
        <button className="h-11 flex-1 border border-ink/30 text-sm text-ink" onClick={() => { const before = snapshot(useStore.getState()); useStore.getState().loadDemo(); fx_say({ title: 'Demo data loaded', description: 'Your own history was replaced for now.', variant: 'success', undo: () => useStore.getState().restore(before as unknown as AppState) }) }}>Load demo data</button>
      </div>
      <div className="mt-3 border-t border-ink/10 pt-3">
        <p className="text-[13px] leading-[1.4] text-ink-2">{isSupporter() ? 'Thank you for supporting Friction. The five extra themes (under Look), the cloud backup (under Data) and a star by your alias are yours.' : 'Friction is free and stays free. If you like it, you can support it for $2 a month: five more themes, an encrypted cloud backup and a star on the board. Everything that is free now stays free, and nothing in the shop is given away.'}</p>
        {!isSupporter() && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={openSupport} className="inline-flex h-11 flex-1 items-center justify-center bg-signal px-3 text-sm font-semibold text-on-signal">See Support, $2 a month</button>
          </div>
        )}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-3">
        {[['/about', 'About'], ['/contact', 'Contact'], ['/privacy', 'Privacy'], ['/cookies', 'Cookies'], ['/terms', 'Terms'], ['/disclaimer', 'Disclaimer']].map(([h, t]) => (
          <a key={h} href={h} target="_blank" rel="noopener" className="inline-flex min-h-8 items-center underline-offset-2 hover:text-signal hover:underline">{t}</a>
        ))}
        <button type="button" onClick={() => useConsent.getState().reopen()} className="inline-flex min-h-8 items-center underline-offset-2 hover:text-signal hover:underline">Cookie choice</button>
      </p>
    </Panel>
  )
}

export function SettingsView() {
  const [tab, setTab] = useState('focus')
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader kicker="Settings" title="Make it yours">
        <Seg id="set-tabs" value={tab} onChange={setTab} tabs={[{ id: 'focus', label: 'Settings' }, { id: 'look', label: 'Look' }, { id: 'data', label: 'Data' }, { id: 'help', label: 'Help' }]} />
      </PageHeader>
      <div className="min-h-0 flex-1">
        {tab === 'focus' && <div className="grid content-start gap-4 md:grid-cols-2"><Focus /><Sound /></div>}
        {tab === 'look' && <div className="grid content-start gap-4 md:grid-cols-2"><Look /><Screen /></div>}
        {tab === 'data' && <Data />}
        {tab === 'help' && <Help />}
      </div>
    </div>
  )
}
