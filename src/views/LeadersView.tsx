import { Star, Trophy } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type FormEvent } from 'react'
import { LoadingBlock } from '@/components/app/LoadingBlock'
import { PageHeader, Panel } from '@/components/app/shared'
import { Scrubber, useSwipe } from '@/components/app/Scrubber'
import { fx_say } from '@/lib/actions'
import { fmtMinutes } from '@/lib/dates'
import { useGridFit } from '@/lib/hooks'
import { checkName, hasAlias, identity, loadBoard, nameProblem, loadStanding, reportFocus, saveName, sendName, type Me, type Row, type Standing } from '@/lib/leaders'
import { cn } from '@/lib/utils'

const medal = (rank: number) => (rank === 1 ? 'bg-signal text-on-signal' : 'border border-ink/30')

export function LeadersView() {
  const [me, setMe] = useState<Me | null>(null)
  const [st, setSt] = useState<Standing | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [page, setPage] = useState(1)
  const [name, setName] = useState('')
  const { ref, per } = useGridFit(260, 52, 6, 1)

  useEffect(() => {
    let dead = false
    setErr(false)
    identity().then(async (m) => {
      if (dead) return
      setMe(m); setName(m.name)
      await reportFocus(m)
      if (dead) return
      const [b, s] = await Promise.all([loadBoard(), loadStanding(m)])
      if (dead) return
      setRows(b.rows); setSt(s)
      if (s.listed && m.name && s.name !== m.name) void sendName(m, m.name).then((r) => { if (r === 'taken' || r === 'reserved' || r === 'invalid') { saveName(m, ''); setMe({ ...m, name: '' }); setProblem(nameProblem(r)) } })
    }).catch(() => !dead && setErr(true))
    return () => { dead = true }
  }, [nonce])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!me) return
    const r = await sendName(me, name)
    if (r === 'ok') { saveName(me, name.trim()); setMe({ ...me, name: name.trim() }); setNonce((n) => n + 1); fx_say({ title: 'Alias saved', description: name.trim() ? 'It shows on the board.' : 'You show as a friend of Friction.' }) }
    else if (r === 'error') fx_say({ title: 'Could not save', variant: 'danger' })
    else fx_say({ title: nameProblem(r), variant: 'danger' })
  }

  const list = rows ?? []
  const pages = Math.max(1, Math.ceil(list.length / per))
  const safe = Math.min(page, pages)
  const slice = list.slice((safe - 1) * per, safe * per)
  const swipe = useSwipe(() => setPage(Math.max(1, safe - 1)), () => setPage(Math.min(pages, safe + 1)))
  const n = st?.n ?? 0
  const [alias, setAlias] = useState('')
  const [problem, setProblem] = useState('')
  const claim = async (e: FormEvent) => {
    e.preventDefault()
    const a = alias.trim().slice(0, 20)
    if (!me || !a) return
    const c = await checkName(a)
    if (c !== 'free' && c !== 'error') { setProblem(nameProblem(c)); return }
    const r = await sendName(me, a)
    if (r === 'taken' || r === 'reserved' || r === 'invalid') { setProblem(nameProblem(r)); return }
    setProblem('')
    saveName(me, a)
    const m2 = { ...me, name: a }
    setMe(m2); setName(a)
    void reportFocus(m2).then(() => setNonce((x) => x + 1))
  }
  const btn = 'inline-flex h-11 items-center justify-center gap-2 border border-ink/30 px-4 text-sm hover:bg-ink/10'

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader kicker="Time focused" title="Leaders" sub="Ranked by how long people have focused. Your time counts from the moment you join the board." />
      {err ? (
        <Panel className="grid justify-items-start gap-3 p-5"><p className="text-sm text-ink-2">The leaderboard did not answer. Check your connection.</p><button className="h-11 bg-signal px-5 text-sm font-semibold text-on-signal" onClick={() => setNonce((x) => x + 1)}>Try again</button></Panel>
      ) : !me || !rows ? (
        <LoadingBlock label="Loading the board" />
      ) : !hasAlias(me) ? (
        <Panel className="grid max-w-[520px] content-start gap-3 p-5">
          <Trophy className="size-6 text-signal" />
          <h2 className="text-lg font-semibold">Pick the name everyone will see</h2>
          <p className="text-[14px] text-ink-2">The leaderboard is public, so it uses its own alias. It is not the name your friends know you by in Together rooms, and it is never your account, because there is none.</p>
          <form onSubmit={claim} className="flex gap-2">
            <input value={alias} onChange={(e) => { setAlias(e.target.value); setProblem('') }} maxLength={20} aria-label="Public alias" placeholder="A public alias" className="h-11 min-w-0 flex-1 border border-ink/30 bg-transparent px-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-signal" />
            <button type="submit" disabled={!alias.trim()} className="h-11 bg-signal px-5 text-sm font-semibold text-on-signal disabled:opacity-40">Save alias</button>
          </form>
          {problem && <p role="alert" className="text-sm text-ink">{problem}</p>}
        </Panel>
      ) : (
        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,420px)_1fr] lg:grid-rows-[minmax(0,1fr)]">
          <Panel className="flex min-h-0 flex-col gap-3 p-5">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
              <div>
                <p className="hud">Your time on the board</p>
                <div className="dot whitespace-nowrap text-[clamp(1.6rem,3.4vw,2.4rem)] font-bold leading-none">{fmtMinutes(n)}</div>
              </div>
              <p className="pb-1 text-sm text-ink-2">{st?.listed ? `You are number ${st.rank} on the board.` : 'Focus for a minute and you are on the board.'}</p>
            </div>
            {(
              <form onSubmit={save} className="flex gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} aria-label="Public alias" placeholder="Public alias" className="h-11 min-w-0 flex-1 border border-ink/30 bg-transparent px-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-signal" />
                <button type="submit" className={btn}>Save</button>
              </form>
            )}
            <p className="mt-auto text-[13px] leading-[18px] text-ink-3">Only focus after you joined counts, and never faster than the clock runs, so a made-up number cannot climb. The board holds a random code, the name you choose and your minutes.</p>
          </Panel>

          <div className="flex min-h-0 min-w-0 flex-col gap-2">
            <div ref={ref} className="min-h-[52px] flex-1 overflow-hidden" {...swipe}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.ol key={safe} className="grid h-full content-start gap-1.5" style={{ gridAutoRows: '52px' }} exit={{ opacity: 0, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }}>
                  {slice.map((r, i) => (
                    <motion.li key={r.rank} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: Math.min(i, 8) * 0.025 }} className={cn('flex h-[52px] items-center gap-3 border px-3', st?.listed && st.rank === r.rank ? 'border-signal bg-signal/10' : 'border-ink/15 bg-ink/[0.03]')}>
                      <span className={cn('grid size-8 shrink-0 place-items-center text-[14px] font-bold', medal(r.rank))}>{r.rank === 1 ? <Trophy className="size-4" aria-label="First" /> : r.rank}</span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{r.name}{r.star && <Star className="ml-1.5 inline size-3.5 -translate-y-px fill-signal text-signal" aria-label="Friction supporter" />}{st?.listed && st.rank === r.rank && <span className="hud ml-2">You</span>}</span>
                      <span className="fig text-[15px]">{fmtMinutes(r.n)}</span>
                    </motion.li>
                  ))}
                  {list.length === 0 && <li className="border border-dashed border-ink/25 p-8 text-center text-sm text-ink-2">Nobody is on the board yet. Your first focused minute puts you at the top.</li>}
                </motion.ol>
              </AnimatePresence>
            </div>
            <Scrubber count={list.length} per={per} page={safe} onPage={setPage} labelAt={(i) => list[i]?.name ?? ''} />
          </div>
        </div>
      )}
    </section>
  )
}
