import { Check, Copy, LogOut, Radio, Send, Share2, Users, Webhook } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PageHeader, Panel, Seg } from '@/components/app/shared'
import { useMedia } from '@/lib/hooks'
import { fx_say } from '@/lib/actions'
import { fmtClock } from '@/lib/dates'
import { usePlayer } from '@/lib/player'
import { useStore } from '@/lib/store'
import { clearUnread, createRoom, friendName, inviteLink, joinLock, joinRoom, leaveRoom, lockTogether, pendingInvite, sendChat, setFollow, setHook, shareNow, stopSharing, tuneTo, useRoom, type Member } from '@/lib/together'
import { cn } from '@/lib/utils'

const btn = 'inline-flex h-11 items-center justify-center gap-2 border border-ink/30 px-4 text-sm hover:bg-ink/10 disabled:opacity-40'
const primary = 'inline-flex h-11 items-center justify-center gap-2 bg-signal px-5 text-sm font-semibold text-on-signal disabled:opacity-40'
const field = 'h-11 min-w-0 border border-ink/30 bg-transparent px-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-signal'

function Lobby() {
  const { busy, err } = useRoom()
  const profile = useStore((s) => s.profile)
  const setProfile = useStore((s) => s.setProfile)
  const [name, setName] = useState(profile?.name ?? '')
  const [code, setCode] = useState(pendingInvite() ?? '')
  const ready = (profile?.name ?? '').trim().length > 0
  useEffect(() => { const inv = pendingInvite(); if (inv && ready) void joinRoom(inv) }, [ready])
  const save = (e: FormEvent) => { e.preventDefault(); if (name.trim()) setProfile({ name: name.trim().slice(0, 20), since: profile?.since ?? Date.now() }) }
  return (
    <Panel className="grid max-w-[560px] content-start gap-4 p-5">
      <div className="flex items-center gap-3"><Users className="size-6 text-signal" /><h2 className="text-lg font-semibold">Lock in with friends</h2></div>
      <p className="text-[14px] text-ink-2">Make a room, send the code, and lock in at the same time. You can chat, share a station or channel to listen or watch together, and connect a Discord or Slack channel. Rooms close after a day of quiet.</p>
      {!ready ? (
        <form onSubmit={save} className="grid gap-2">
          <label htmlFor="fname" className="hud">What should your friends call you?</label>
          <div className="flex gap-2"><input id="fname" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Your name" className={cn(field, 'flex-1')} /><button className={primary} disabled={!name.trim()}>Save</button></div>
          <p className="text-[13px] text-ink-3">Only you and the people in your rooms see this. The leaderboard has its own public alias.</p>
        </form>
      ) : (
        <>
          <p className="text-sm">You are <strong>{profile?.name}</strong> to your friends.</p>
          <div className="flex flex-wrap gap-2">
            <button className={primary} disabled={busy} onClick={() => void createRoom()}><Users className="size-4" />Make a room</button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void joinRoom(code) }} className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} aria-label="Room code" placeholder="ROOM CODE" className={cn(field, 'w-40 uppercase tracking-[0.2em]')} />
            <button className={btn} disabled={busy || code.length !== 6}>Join</button>
          </form>
        </>
      )}
      {err && <p role="alert" className="text-sm text-ink">{err}</p>}
    </Panel>
  )
}

const stateOf = (m: Member) => (m.away ? 'Away' : m.status === 'locked' ? `Locked in · ${fmtClock(m.left)} left` : m.status === 'done' ? 'Finished' : 'Here')

export function TogetherView() {
  const { code, room, msgs, err, follow } = useRoom()
  const current = usePlayer((s) => s.current)
  const sessionMin = useStore((s) => s.settings.sessionMin)
  const locked = useStore((s) => !!s.session)
  const [mins, setMins] = useState(sessionMin)
  const [text, setText] = useState('')
  const [hook, setHookText] = useState('')
  const [copied, setCopied] = useState(false)
  const [, tick] = useState(0)
  const wide = useMedia('(min-width: 1024px)')
  const [tab, setTab] = useState('room')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { clearUnread() }, [])
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }) }, [msgs.length])

  if (!code || !room) return (<section className="flex h-full min-h-0 flex-col gap-3"><PageHeader kicker="Together" title="Together" sub="Lock in with friends, in the same room." /><Lobby />{useRoom.getState().busy && <p className="hud">Opening the room…</p>}</section>)

  const link = inviteLink(code)
  const copy = async (what: string) => { try { await navigator.clipboard.writeText(what); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { fx_say({ title: 'Copy it by hand', description: what }) } }
  const share = async () => { if (navigator.share) { try { await navigator.share({ title: 'Lock in with me on Friction', text: `Room ${code}`, url: link }); return } catch { /* cancelled */ } } void copy(link) }
  const act = (p: Promise<unknown>) => p.catch((e: Error) => fx_say({ title: 'That did not go through', description: e.message, variant: 'danger' }))
  const sess = room.sess && room.sess.start + room.sess.min * 60e3 > Date.now() ? room.sess : null
  const sessLeft = sess ? Math.max(0, Math.round((sess.start + sess.min * 60e3 - Date.now()) / 1000)) : 0
  const m = room.media
  const mine = m?.by === friendName()
  const send = (e: FormEvent) => { e.preventDefault(); const t = text.trim(); if (!t) return; setText(''); void act(sendChat(t)) }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader kicker="Together" title={`Room ${code}`} sub={`${room.members.length} here · host ${room.host}${err ? ' · reconnecting…' : ''}`}>
        <button className={btn} onClick={() => void copy(code)}>{copied ? <Check className="size-4 text-signal" /> : <Copy className="size-4" />}{copied ? 'Copied' : 'Copy code'}</button>
        <button className={btn} onClick={() => void share()}><Share2 className="size-4" />Invite</button>
        <button className={btn} onClick={() => void leaveRoom()}><LogOut className="size-4" />Leave</button>
      </PageHeader>

      {!wide && <Seg id="tog" value={tab} onChange={setTab} tabs={[{ id: 'room', label: 'Room' }, { id: 'chat', label: 'Chat' }]} />}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]">
        <div className={cn('grid min-h-0 content-start gap-4', !wide && tab !== 'room' && 'hidden')}>
          <Panel className="grid gap-2 p-4">
            <h2 className="text-base font-semibold">Who is here</h2>
            <ul className="grid gap-1">
              {room.members.map((x) => (
                <li key={x.name + x.me} className={cn('flex min-h-11 items-center justify-between gap-3 border px-3', x.status === 'locked' && !x.away ? 'border-signal bg-signal/10' : 'border-ink/15')}>
                  <span className="truncate font-semibold">{x.name}{x.me && <span className="hud ml-2">You</span>}</span>
                  <span className="fig shrink-0 text-[13px] text-ink-2">{stateOf(x)}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="grid gap-3 p-4">
            <h2 className="text-base font-semibold">Lock in together</h2>
            {sess && <div role="status" className="border border-signal bg-signal/10 p-3 text-sm"><strong>{sess.by}</strong> locked in for {sess.min} minutes. <span className="fig">{fmtClock(sessLeft)}</span> left.{!locked && <button className={cn(primary, 'ml-3 h-9')} onClick={joinLock}>Join them</button>}</div>}
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Minutes">
              {[15, 25, 45, 60].map((n) => <button key={n} onClick={() => setMins(n)} aria-pressed={mins === n} className={cn('h-11 px-3.5 text-[13px] md:h-9', mins === n ? 'bg-ink text-ground' : 'bg-ink/[0.07] text-ink ring-1 ring-ink/12 hover:bg-ink/12')}>{n} min</button>)}
              <button className={primary} disabled={locked} onClick={() => void act(lockTogether(mins))}>Lock in together</button>
            </div>
            <p className="text-[13px] text-ink-3">Everyone in the room is told, and can join with one press. Finishing is announced to the room.</p>
          </Panel>

          <Panel className="grid gap-3 p-4">
            <h2 className="text-base font-semibold">Listen or watch together</h2>
            {m ? (
              <div className="flex items-center gap-3 border border-ink/15 p-3">
                <Radio className="size-5 shrink-0 text-signal" />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{m.name}</div><div className="truncate text-[13px] text-ink-2">{m.by} is {m.kind === 'tv' ? 'watching' : 'listening'}</div></div>
                <button className={btn} onClick={() => tuneTo(m)}>Tune in</button>
              </div>
            ) : <p className="text-[13px] text-ink-2">Nothing shared yet. Play a station or channel, then share it.</p>}
            <div className="flex flex-wrap items-center gap-2">
              <button className={primary} disabled={!current || current.id.startsWith('pod:')} onClick={() => void act(shareNow())}>{current ? `Share ${current.name.slice(0, 22)}` : 'Share what I am playing'}</button>
              {m && mine && <button className={btn} onClick={() => void act(stopSharing())}>Stop sharing</button>}
              <label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="size-4 accent-[var(--signal)]" />Follow what others share</label>
            </div>
          </Panel>
        </div>

        <Panel className={cn('flex min-h-0 flex-col gap-3 p-4', !wide && tab !== 'chat' && 'hidden')}>
          <h2 className="text-base font-semibold">Chat</h2>
          <div className="relative min-h-0 flex-1 overflow-hidden" aria-live="polite" aria-label="Messages">
            <div className="absolute inset-x-0 bottom-0 grid gap-1.5">
              {msgs.slice(-14).map((x) => x.sys ? <p key={x.id} className="text-[13px] italic text-ink-3">{x.text}</p> : (
                <p key={x.id} className="text-[14px] leading-[19px]"><strong className={x.who === friendName() ? 'text-signal' : ''}>{x.who}</strong> <span className="break-words">{x.text}</span></p>
              ))}
              <div ref={end} />
            </div>
          </div>
          <form onSubmit={send} className="flex gap-2"><input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} aria-label="Message" placeholder="Say something" className={cn(field, 'flex-1')} /><button className={primary} aria-label="Send" disabled={!text.trim()}><Send className="size-4" /></button></form>
          {room.isHost && (
            <details className="border-t border-ink/15 pt-2 text-sm">
              <summary className="flex min-h-11 cursor-pointer items-center gap-2"><Webhook className="size-4" />Connect Discord or Slack{room.hasHook ? ' (connected)' : ''}</summary>
              <form onSubmit={(e) => { e.preventDefault(); void act(setHook(hook)).then(() => { setHookText(''); fx_say({ title: hook.trim() ? 'Connected' : 'Disconnected' }) }) }} className="mt-2 grid gap-2">
                <input value={hook} onChange={(e) => setHookText(e.target.value)} aria-label="Incoming webhook address" placeholder="https://discord.com/api/webhooks/…" className={field} />
                <div className="flex gap-2"><button className={btn}>{hook.trim() ? 'Connect' : 'Disconnect'}</button></div>
                <p className="text-[13px] text-ink-3">Joins, lock-ins, finishes, shared shows and chat are posted to that channel. The address is kept on the server and never sent back to browsers.</p>
              </form>
            </details>
          )}
        </Panel>
      </div>
    </section>
  )
}
