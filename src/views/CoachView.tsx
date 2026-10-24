import { useMemo, useState } from 'react'
import { PageHeader, Panel, Seg } from '@/components/app/shared'
import { AIAgentActivity, type AgentActivityItemData } from '@/components/ui/ai-agent-activity'
import { Chat, type ChatMessageItem } from '@/components/ui/chat'
import { useMedia } from '@/lib/hooks'
import { attentionScore, blockedPerHour, dayTotal, streak, totals } from '@/lib/stats'
import { dateKey } from '@/lib/dates'
import { useStore, type AppState } from '@/lib/store'

type Facts = ReturnType<typeof gather>

function gather(s: AppState) {
  const today = dateKey()
  const focus = dayTotal(s.focusLog, today)
  const blocked = dayTotal(s.urgeLog, today)
  const t = totals(s)
  const hours = Array.from({ length: 24 }, (_, h) => Object.values(s.urgeLog).reduce((a, r) => a + (r[h] ?? 0), 0))
  const worst = hours.indexOf(Math.max(...hours))
  const best = Array.from({ length: 24 }, (_, h) => Object.values(s.focusLog).reduce((a, r) => a + (r[h] ?? 0), 0))
  const bestH = best.indexOf(Math.max(...best))
  return { focus, blocked, t, hours, worst, best, bestH, run: streak(s.focusLog), score: attentionScore(s), goal: s.settings.dailyGoalMin, per: blockedPerHour(focus, blocked) }
}

const hr = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`

/** Plain rules over the numbers in this browser. No model, no network. */
function reply(q: string, f: Facts): { text: string; looked: string[] } {
  const k = q.toLowerCase()
  const empty = f.t.focus === 0
  if (empty) return { text: 'There is nothing to read yet. Lock in for a session, even 15 minutes, and I can say something true about your day. Or load the demo data from Settings.', looked: ['focus log'] }
  if (/hour|when|time|worst|urge/.test(k) && f.hours[f.worst] > 0)
    return { text: `Your scroll urges peak around ${hr(f.worst)} (${f.hours[f.worst]} blocked in total). Put a session on that hour and the urge has less room to start.`, looked: ['urge log by hour'] }
  if (/best|strong|good|focus/.test(k) && f.best[f.bestH] > 0)
    return { text: `Your longest focus lands around ${hr(f.bestH)}. Protect that hour first, and do the hard thing there.`, looked: ['focus log by hour'] }
  if (/streak|day|run/.test(k))
    return { text: f.run > 0 ? `You are on a ${f.run}-day run of 10+ focused minutes. Today's ${f.focus} min ${f.focus >= 10 ? 'keeps it alive' : 'is short of the 10 that keeps it alive'}.` : 'No run yet. One day of 10+ focused minutes starts it.', looked: ['focus log by day'] }
  if (/goal|plan|today|next/.test(k)) {
    const left = Math.max(0, f.goal - f.focus)
    return { text: left === 0 ? `Goal met: ${f.focus} of ${f.goal} min. Anything more is a bonus, stop when it stops being easy.` : `${left} min to your goal of ${f.goal}. One ${Math.min(45, Math.max(15, left))}-minute block does it. Start it now, before the next urge.`, looked: ['daily goal', 'focus today'] }
  }
  const p = f.per
  return {
    text: `Score ${f.score}/100. Today: ${f.focus} min focused, ${f.blocked} scrolls blocked${p !== null ? ` (${p} per hour)` : ''}. ${f.run ? `Run: ${f.run} days.` : ''} Ask about your worst hour, best hour, streak or plan.`,
    looked: ['focus log', 'urge log', 'streak'],
  }
}

let id = 0
const msg = (role: ChatMessageItem['role'], content: string): ChatMessageItem => ({ id: String(++id), role, content, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'sent' })

export function CoachView() {
  const wide = useMedia('(min-width: 1024px)')
  const [tab, setTab] = useState('chat')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessageItem[]>(() => [msg('assistant', 'I read the numbers saved in this browser and say what they show. Try: “When do I scroll most?”, “What is my best hour?” or “Plan my day”.')])
  const [looked, setLooked] = useState<string[][]>([])

  const send = (text: string) => {
    setMessages((m) => [...m, msg('user', text)])
    setBusy(true)
    const f = gather(useStore.getState())
    const r = reply(text, f)
    setTimeout(() => {
      setMessages((m) => [...m, msg('assistant', r.text)])
      setLooked((l) => [...l, r.looked])
      setBusy(false)
    }, 450)
  }

  const activities = useMemo<AgentActivityItemData[]>(
    () =>
      looked.flatMap((set, qi) =>
        set.map((name, i) => ({ id: `${qi}-${i}`, type: 'database_query' as const, title: `Read ${name}`, description: 'Local, from this browser', status: 'success' as const, duration: '<1ms' })),
      ),
    [looked],
  )

  const chat = (
    <Panel className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
      <Chat messages={messages} onSendMessage={send} isGenerating={busy} onClearChat={() => { setMessages([msg('assistant', 'Cleared. Ask again.')]); setLooked([]) }} className="h-full" />
    </Panel>
  )
  const trail = (
    <Panel className="h-full min-h-0 overflow-hidden rounded-3xl p-3" data-allow-scroll>
      {activities.length ? <AIAgentActivity activities={activities} isRunning={busy} title="What I read" agentName="Local rules" /> : <p className="grid h-full place-items-center px-6 text-center text-sm text-ink-2">Ask something and the records I read show up here.</p>}
    </Panel>
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader kicker="Coach" title="Ask your numbers" sub="Local rules over your own data. No AI model, nothing leaves this browser.">
        {!wide && <Seg id="coach-tabs" value={tab} onChange={setTab} tabs={[{ id: 'chat', label: 'Chat' }, { id: 'read', label: 'Read', badge: activities.length || undefined }]} />}
      </PageHeader>
      <div className={wide ? 'grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] gap-4' : 'min-h-0 flex-1'}>
        {wide ? <>{chat}{trail}</> : tab === 'chat' ? chat : trail}
      </div>
    </div>
  )
}
