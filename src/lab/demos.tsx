import { Bell, ChartBar, Home, Pause, Play, Radio, Search, Settings, Tv } from 'lucide-react'
import { useState, type ReactNode } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */
type M = Record<string, any>
export type Demo = (m: M) => ReactNode

const noop = () => undefined
const ico = 'size-4'

const SAMPLE_SESSIONS = [
  { id: 's1', title: 'Ambient radio', held: 25, goal: 25, blocked: 4, result: 'Completed' },
  { id: 's2', title: 'Documentary channel', held: 16, goal: 45, blocked: 7, result: 'Ended early' },
  { id: 's3', title: 'Silent focus', held: 25, goal: 25, blocked: 1, result: 'Completed' },
  { id: 's4', title: 'Lo-fi radio', held: 45, goal: 45, blocked: 3, result: 'Completed' },
  { id: 's5', title: 'Science TV', held: 12, goal: 25, blocked: 9, result: 'Ended early' },
]

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const HELD = [42, 65, 30, 88, 51, 20, 74]
const BLOCKED = [12, 9, 14, 6, 8, 15, 5]

/** Small stateful helpers so controlled components can be played with. */
function Stateful<T>({ init, children }: { init: T; children: (v: T, set: (n: T) => void) => ReactNode }) {
  const [v, set] = useState(init)
  return <>{children(v, set)}</>
}

const Btn = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
  <button onClick={onClick} className="glass-clear h-10 px-4 text-sm text-ink [--r:12px]">
    {children}
  </button>
)

export const DEMOS: Record<string, Demo> = {
  'activity-feed': (m) => (
    <m.ActivityFeed
      enableFilters={false}
      enableSearch={false}
      maxEntries={4}
      events={[
        { id: 'e1', type: 'security', status: 'warning', title: 'Scroll blocked', timestamp: '2m ago', description: 'During Ambient radio' },
        { id: 'e2', type: 'deploy', status: 'success', title: 'Session completed', timestamp: '26m ago', description: '25 of 25 min held' },
        { id: 'e3', type: 'api', status: 'info', title: 'Tuned to Lo-fi', timestamp: '1h ago' },
        { id: 'e4', type: 'error', status: 'error', title: 'You wandered off', timestamp: '3h ago', description: '23 s away' },
      ]}
    />
  ),
  'advanced-data-table': (m) => (
    <div className="w-full max-w-[640px]">
      <m.AdvancedDataTable
        defaultPageSize={4}
        data={SAMPLE_SESSIONS}
        columns={[
          { id: 'title', header: 'Session', accessorKey: 'title', sortable: true },
          { id: 'held', header: 'Held', accessorKey: 'held', sortable: true, align: 'right' },
          { id: 'blocked', header: 'Blocked', accessorKey: 'blocked', sortable: true, align: 'right' },
          { id: 'result', header: 'Result', accessorKey: 'result' },
        ]}
      />
    </div>
  ),
  'ai-agent-activity': (m) => (
    <div className="w-full max-w-[520px]">
      <m.AIAgentActivity
        title="Demo agent"
        agentName="Rules engine"
        activities={[
          { id: 'a1', type: 'database_query', title: 'Read your logs', status: 'success', duration: '4 ms', description: 'localStorage, last 14 days' },
          { id: 'a2', type: 'code_execution', title: 'Compute blocked per hour', status: 'success', duration: '1 ms' },
          { id: 'a3', type: 'writing', title: 'Write the answer', status: 'success', duration: '2 ms' },
        ]}
      />
    </div>
  ),
  'animated-number': (m) => (
    <Stateful init={1280}>
      {(n, set) => (
        <div className="grid justify-items-center gap-3">
          <div className="fig text-5xl text-ink">
            <m.AnimatedNumber value={n} />
          </div>
          <Btn onClick={() => set(n + Math.round(Math.random() * 900))}>Add minutes</Btn>
        </div>
      )}
    </Stateful>
  ),
  'animated-tabs': (m) => (
    <m.AnimatedTabs
      variant="glass"
      tabs={[
        { id: 'a', label: 'Radio', content: <p className="text-sm text-ink-2">Stations ranked by listeners.</p> },
        { id: 'b', label: 'TV', content: <p className="text-sm text-ink-2">Public channels, live.</p> },
        { id: 'c', label: 'Silent', content: <p className="text-sm text-ink-2">Just the timer.</p> },
      ]}
    />
  ),
  'avatar-stack': (m) => <m.AvatarStack avatars={['Ada', 'Ben', 'Cy', 'Dee', 'Eli'].map((n, i) => ({ id: i, name: n, fallback: n[0] }))} />,
  'bar-chart': (m) => (
    <div className="w-full max-w-[520px]">
      <m.BarChart data={DAYS.map((d, i) => ({ label: d, held: HELD[i], blocked: BLOCKED[i] }))} series={[{ key: 'held', label: 'Minutes held', color: '#6ee7ff' }, { key: 'blocked', label: 'Blocked', color: '#a78bfa' }]} height={190} />
    </div>
  ),
  'batch-gesture-tray': (m) => (
    <div className="w-full max-w-[420px]">
      <m.BatchGestureTray
        items={SAMPLE_SESSIONS.slice(0, 4).map((s) => ({ id: s.id, title: s.title, subtitle: `${s.held} min` }))}
        actions={[{ id: 'del', label: 'Remove', color: 'danger', action: noop }, { id: 'keep', label: 'Keep', color: 'success', action: noop }]}
      />
    </div>
  ),
  'breadcrumb': (m) => <m.Breadcrumb items={[{ label: 'Friction', href: '#' }, { label: 'Insights', href: '#' }, { label: 'Trends' }]} />,
  'chat': (m) => (
    <Stateful init={[{ id: '1', role: 'assistant', content: 'Static demo of the chat component. There is no model behind it.', author: 'Demo', timestamp: 'now' }] as any[]}>
      {(msgs, set) => (
        <div className="h-[300px] w-full max-w-[560px]">
          <m.Chat
            messages={msgs}
            onSendMessage={(c: string) => set([...msgs, { id: String(msgs.length + 1), role: 'user', content: c, author: 'You' }, { id: String(msgs.length + 2), role: 'assistant', content: 'This is only the component. Friction has no chat and no AI.', author: 'Demo' }])}
          />
        </div>
      )}
    </Stateful>
  ),
  'code-snippet-deck': (m) => (
    <div className="w-full max-w-[520px]">
      <m.CodeSnippetDeck
        snippets={[
          { language: 'json', label: 'Export', filename: 'anti-scroll.json', code: '{\n  "sessions": 18,\n  "blocked": 31,\n  "streak": 2\n}' },
          { language: 'bash', label: 'Import', code: 'curl -X POST /import < anti-scroll.json' },
        ]}
      />
    </div>
  ),
  'combobox': (m) => <m.Combobox options={[{ value: 'lofi', label: 'Lo-fi' }, { value: 'ambient', label: 'Ambient' }, { value: 'jazz', label: 'Jazz' }, { value: 'classical', label: 'Classical' }]} placeholder="Pick a genre" />,
  'command-menu': (m) => (
    <Stateful init={false}>
      {(open, set) => (
        <>
          <Btn onClick={() => set(true)}>Open command menu</Btn>
          <m.CommandMenu isOpen={open} onClose={() => set(false)} />
        </>
      )}
    </Stateful>
  ),
  'density-lens': (m) => (
    <m.DensityLens className="h-[220px] w-full max-w-[420px]">
      <div className="grid grid-cols-10 gap-1.5 p-3">{Array.from({ length: 80 }, (_, i) => <span key={i} className="size-4 rounded-sm bg-ink/20" />)}</div>
    </m.DensityLens>
  ),
  'dependency-trace': (m) => (
    <m.DependencyTrace
      nodes={[{ id: 'src', label: 'Source', type: 'client' }, { id: 'hold', label: 'Held', type: 'service' }, { id: 'end', label: 'Ended early', type: 'api' }, { id: 'log', label: 'Log', type: 'database' }]}
      connections={[{ from: 'src', to: 'hold', label: '72%' }, { from: 'src', to: 'end', label: '28%' }, { from: 'hold', to: 'log' }, { from: 'end', to: 'log' }]}
    />
  ),
  'depth-corridor': (m) => (
    <div className="h-[260px] w-full max-w-[520px]">
      <m.DepthCorridor layers={[{ id: '1', title: 'Today', subtitle: '91 min', content: <div className="text-ink">Held 91 min</div> }, { id: '2', title: 'This week', subtitle: '412 min', content: <div className="text-ink">Held 412 min</div> }, { id: '3', title: 'This month', subtitle: '1.7 h/day', content: <div className="text-ink">Avg 1.7 h/day</div> }]} />
    </div>
  ),
  'directional-tooltip': (m) => (
    <m.DirectionalTooltip content="Blocked scrolls this hour" side="top" forceOpen>
      <Btn>Hover me</Btn>
    </m.DirectionalTooltip>
  ),
  'donut-chart': (m) => <m.DonutChart data={[{ label: 'Radio', value: 46, color: '#6ee7ff' }, { label: 'TV', value: 31, color: '#a78bfa' }, { label: 'Silent', value: 23, color: '#f0abfc' }]} size={190} thickness={14} centerLabel="Minutes" />,
  'faq': (m) => (
    <div className="w-full max-w-[520px]">
      <m.FAQ items={[{ id: '1', question: 'Why can’t I scroll?', answer: 'That is the point. Nothing sits below the screen.' }, { id: '2', question: 'Where is my data?', answer: 'In this browser only.' }, { id: '3', question: 'What counts as a block?', answer: 'A wheel turn, swipe, or scroll key.' }]} />
    </div>
  ),
  'floating-action-dock': (m) => <m.FloatingActionDock activeId="focus" items={[{ id: 'focus', label: 'Focus', icon: <Home className={ico} /> }, { id: 'radio', label: 'Radio', icon: <Radio className={ico} /> }, { id: 'tv', label: 'TV', icon: <Tv className={ico} /> }, { id: 'ins', label: 'Insights', icon: <ChartBar className={ico} /> }]} />,
  'funnel-chart': (m) => <div className="w-full max-w-[460px]"><m.FunnelChart stages={[{ label: 'Started', value: 100 }, { label: 'Held 10 min', value: 82 }, { label: 'Held 25 min', value: 64 }, { label: 'Completed', value: 58 }]} /></div>,
  'glitch-text': (m) => <m.GlitchText text="ANTI-SCROLL" as="h3" className="text-3xl font-black text-ink" />,
  'hamburger-menu': (m) => <Stateful init={false}>{(o, set) => <m.HamburgerMenu isOpen={o} onChange={set} label="Menu" />}</Stateful>,
  'interactive-timeline': (m) => (
    <div className="w-full max-w-[520px]">
      <m.InteractiveTimeline items={SAMPLE_SESSIONS.slice(0, 4).map((s, i) => ({ id: s.id, title: s.title, timestamp: `${9 + i * 3}:00`, status: s.result === 'Completed' ? 'completed' : 'failed', description: `${s.held} of ${s.goal} min, ${s.blocked} blocked`, metrics: [{ label: 'Held', value: `${s.held}m` }, { label: 'Blocked', value: String(s.blocked) }] }))} />
    </div>
  ),
  'ios-search-bar': (m) => <Stateful init="">{(v, set) => <m.IOSSearchBar value={v} onChange={set} placeholder="Search stations" />}</Stateful>,
  'magnetic-button': (m) => <m.MagneticButton>Lock in</m.MagneticButton>,
  'metric-hud': (m) => (
    <div className="w-full max-w-[560px]">
      <m.MetricHUD
        timeRanges={['7d', '30d']}
        defaultTimeRange="7d"
        metrics={[
          { id: 'held', label: 'Held', value: '412', unit: 'min', delta: { value: '+12%', trend: 'up', isPositiveGood: true }, timeSeries: { '7d': HELD, '30d': [...HELD, ...HELD.map((v) => v + 8)] } },
          { id: 'blocked', label: 'Blocked', value: '69', delta: { value: '-9%', trend: 'down', isPositiveGood: false }, timeSeries: { '7d': BLOCKED, '30d': [...BLOCKED, ...BLOCKED] } },
        ]}
      />
    </div>
  ),
  'morphing-dialog': (m) => (
    <m.MorphingDialog title="Lo-fi Radio" subtitle="Germany · MP3 192k" trigger={(open: () => void) => <Btn onClick={open}>Open station</Btn>}>
      <p className="text-sm text-ink-2">A small dialog that grows out of the button that opened it.</p>
    </m.MorphingDialog>
  ),
  'morphing-icon': (m) => <Stateful init={false}>{(a, set) => <button onClick={() => set(!a)} className="glass-clear grid size-12 place-items-center [--r:14px]"><m.MorphingIcon active={a} size={22} from={<Play className="size-5" />} to={<Pause className="size-5" />} /></button>}</Stateful>,
  'notification-bell': (m) => (
    <Stateful init={[{ id: '1', message: 'Scroll blocked during Ambient radio', timestamp: new Date(), read: false }, { id: '2', message: '25 minutes held', timestamp: new Date(Date.now() - 3600e3), read: false }, { id: '3', message: 'Streak: 2 days', timestamp: new Date(Date.now() - 86400e3), read: true }] as any[]}>
      {(n, set) => <m.NotificationBell notifications={n} onMarkAsRead={(id: string) => set(n.map((x: any) => (x.id === id ? { ...x, read: true } : x)))} onMarkAllAsRead={() => set(n.map((x: any) => ({ ...x, read: true })))} />}
    </Stateful>
  ),
  'peek-card': (m) => <m.PeekCard data={{ title: 'Lo-fi Radio', subtitle: 'Germany', status: 'Live', metadata: [{ label: 'Codec', value: 'MP3 192k' }, { label: 'Votes', value: '1,204' }] }}><span className="text-sm text-ink underline decoration-dotted">Hover for a peek</span></m.PeekCard>,
  'product-tour': (m) => (
    <Stateful init={false}>
      {(open, set) => (
        <>
          <Btn onClick={() => set(true)}>Start tour</Btn>
          <m.ProductTour open={open} onClose={() => set(false)} steps={[{ title: 'Welcome', body: 'A quick look at the screen.' }, { title: 'Lock in', body: 'Starts a session and swallows scrolls.' }]} />
        </>
      )}
    </Stateful>
  ),
  'recovery-ledger': (m) => (
    <div className="w-full max-w-[520px]">
      <m.RecoveryLedger entries={[{ id: '1', timestamp: new Date(), action: 'Imported history', description: '18 sessions', restorable: true }, { id: '2', timestamp: new Date(Date.now() - 86400e3), action: 'Erased data', description: 'Undone within 7 s', restorable: true }]} />
    </div>
  ),
  'reveal-card': (m) => <m.RevealCard revealContent={<div className="p-4 text-sm text-ink">31 blocked today</div>}><div className="grid h-40 w-64 place-items-center text-ink">Hover to reveal</div></m.RevealCard>,
  'scrollvelocitytext': (m) => <m.ScrollVelocityText text="NO FEED" as="h3" className="text-3xl font-black text-ink" />,
  'selection-basket': (m) => <m.SelectionBasket selectedCount={3} totalCount={12} mode="inline" actions={[{ id: 'k', label: 'Save', variant: 'primary' }, { id: 'd', label: 'Remove', variant: 'danger' }]} />,
  'settle-modal': (m) => (
    <Stateful init={false}>
      {(open, set) => (
        <>
          <Btn onClick={() => set(true)}>Open modal</Btn>
          <m.SettleModal open={open} onClose={() => set(false)} title="End session early?" description="You have held 12 of 25 minutes.">
            <p className="text-sm text-ink-2">Your progress is saved either way.</p>
          </m.SettleModal>
        </>
      )}
    </Stateful>
  ),
  'sheet': (m) => (
    <Stateful init={false}>
      {(open, set) => (
        <>
          <Btn onClick={() => set(true)}>Open sheet</Btn>
          <m.Sheet open={open} onOpenChange={set}>
            <m.SheetContent side="bottom">
              <m.SheetHeader><m.SheetTitle>Tune in</m.SheetTitle></m.SheetHeader>
              <m.SheetBody><p className="text-sm text-ink-2">Pick something to stay with.</p></m.SheetBody>
            </m.SheetContent>
          </m.Sheet>
        </>
      )}
    </Stateful>
  ),
  'sidebar': (m) => (
    <Stateful init="focus">
      {(a, set) => (
        <div className="h-[260px] w-full max-w-[300px] overflow-hidden rounded-xl">
          <m.Sidebar activeId={a} onActiveChange={set} header={<span className="text-sm font-semibold text-ink">Friction</span>} sections={[{ items: [{ id: 'focus', label: 'Focus', icon: <Home className={ico} /> }, { id: 'radio', label: 'Radio', icon: <Radio className={ico} /> }, { id: 'tv', label: 'TV', icon: <Tv className={ico} /> }] }]} />
        </div>
      )}
    </Stateful>
  ),
  'slide-pagination': (m) => <Stateful init={3}>{(p, set) => <m.SlidePagination pageCount={9} page={p} onChange={set} />}</Stateful>,
  'small-floating-dock': (m) => <div className="relative h-[120px] w-full"><m.SmallFloatingDock position="bottom-center" variant="icon-label" activeId="a" items={[{ id: 'a', label: 'Focus', icon: <Home className={ico} />, action: noop }, { id: 'b', label: 'Search', icon: <Search className={ico} />, action: noop }, { id: 'c', label: 'Alerts', icon: <Bell className={ico} />, action: noop, badge: 3 }, { id: 'd', label: 'Settings', icon: <Settings className={ico} />, action: noop }]} /></div>,
  'smart-comparison': (m) => (
    <div className="max-h-[300px] w-full max-w-[640px] overflow-hidden">
      <m.SmartComparison
        plans={[{ id: 'sprint', name: 'Sprint', tagline: '15 min', price: '15', billingPeriod: 'min' }, { id: 'flow', name: 'Flow', tagline: '25 min', price: '25', billingPeriod: 'min', featured: true, badge: 'Default' }, { id: 'deep', name: 'Deep', tagline: '60 min', price: '60', billingPeriod: 'min' }]}
        categories={[{ id: 'c', title: 'What you get', features: [{ id: 'f1', name: 'Blocked scroll count', values: { sprint: true, flow: true, deep: true } }, { id: 'f2', name: 'Streak credit', values: { sprint: false, flow: true, deep: true } }, { id: 'f3', name: 'Daily goal share', values: { sprint: '17%', flow: '28%', deep: '67%' } }] }]}
      />
    </div>
  ),
  'smooth-accordion': (m) => <div className="w-full max-w-[460px]"><m.SmoothAccordion defaultOpen={['a']} items={[{ id: 'a', title: 'There is no feed', content: 'Nothing sits below the screen.' }, { id: 'b', title: 'Your data stays here', content: 'History lives in this browser.' }]} /></div>,
  'split-button': (m) => <m.SplitButton label="Lock in · 25 min" variant="primary" options={[{ value: '15', label: '15 minutes' }, { value: '25', label: '25 minutes' }, { value: '45', label: '45 minutes' }]} />,
  'spotlight-card': (m) => <m.SpotlightCard className="w-64 p-6"><div className="text-sm text-ink">Move the pointer over me</div></m.SpotlightCard>,
  'spring-select': (m) => <div className="w-56"><m.SpringSelect label="Source" options={[{ value: 'radio', label: 'Radio' }, { value: 'tv', label: 'TV' }, { value: 'silent', label: 'Silent' }]} /></div>,
  'stack-unfold-panel': (m) => <div className="w-full max-w-[420px]"><m.StackUnfoldPanel cards={[{ id: '1', title: 'Up next', subtitle: 'Lo-fi', content: <p className="text-sm text-ink-2">Chillhop Radio</p> }, { id: '2', title: 'Then', subtitle: 'Ambient', content: <p className="text-sm text-ink-2">Drone Zone</p> }]} /></div>,
  'stat-card': (m) => <div className="w-64"><m.StatCard label="Minutes held" value={412} trend={HELD} period="vs last week" /></div>,
  'stepper': (m) => <Stateful init={1}>{(c, set) => <div className="w-full max-w-[520px]"><m.Stepper current={c} onStepChange={set} steps={[{ title: 'Choose', description: 'a length' }, { title: 'Tune', description: 'a station' }, { title: 'Lock in', description: 'and stay' }]} /></div>}</Stateful>,
  'text-scramble-decoder': (m) => <m.TextScrambleDecoder text="TUNING 98.4 FM" className="text-lg text-ink" />,
  'torque-dial': (m) => <Stateful init={60}>{(v, set) => <m.TorqueDial value={v} onChange={set} unit="%" label="Volume" size={110} />}</Stateful>,
  'typewriter-button': (m) => <m.TypewriterButton>Start a session</m.TypewriterButton>,
  'unfold-accordion': (m) => <div className="w-full max-w-[460px]"><m.UnfoldAccordion defaultOpen={['a']} items={[{ id: 'a', title: 'Calm', content: 'Only what answers a tap moves.' }, { id: 'b', title: 'Lots', content: 'Everything that can move, moves.' }]} /></div>,
  'velocity-toast': (m) => (
    <Stateful init={false}>
      {(open, set) => (
        <>
          <Btn onClick={() => set(true)}>Show toast</Btn>
          <m.VelocityToast open={open} onDismiss={() => set(false)} title="Scroll blocked" description="Number 12 today" position="bottom-center" />
        </>
      )}
    </Stateful>
  ),
}

/** Stage size hints for components that need room. */
export const STAGE_H: Record<string, string> = {
  'chat': 'h-[360px]', 'advanced-data-table': 'h-[420px]', 'smart-comparison': 'h-[340px]', 'login': 'h-[520px]', 'sign-up': 'h-[560px]',
  'pricing': 'h-[460px]', 'sidebar': 'h-[300px]', 'depth-corridor': 'h-[300px]', 'activity-feed': 'h-[380px]', 'ai-response': 'h-[360px]',
}
