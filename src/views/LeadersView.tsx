import { Check, Copy, Share2, Trophy } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type FormEvent } from 'react'
import { LoadingBlock } from '@/components/app/LoadingBlock'
import { PageHeader, Panel } from '@/components/app/shared'
import { Scrubber, useSwipe } from '@/components/app/Scrubber'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { fx_say } from '@/lib/actions'
import { useGridFit } from '@/lib/hooks'
import { checkName, hasAlias, identity, loadBoard, nameProblem, loadStanding, saveName, sendName, shareUrl, type Me, type Row, type Standing } from '@/lib/leaders'
import { cn } from '@/lib/utils'

const medal = (rank: number) => (rank === 1 ? 'bg-signal text-on-signal' : 'border border-ink/30')

export function LeadersView() {
  const [me, setMe] = useState<Me | null>(null)
  const [st, setSt] = useState<Standing | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [min, setMin] = useState(0)
  const [err, setErr] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [page, setPage] = useState(1)
  const [name, setName] = useState('')
  const [copied, setCopied] = useState(false)
  const { ref, per } = useGridFit(260, 52, 6, 1)

  useEffect(() => {
    let dead = false
    setErr(false)
    identity().then(async (m) => {
      if (dead) return
      setMe(m); setName(m.name)
      const [b, s] = await Promise.all([loadBoard(), loadStanding(m)])
      if (dead) return
      setRows(b.rows); setMin(b.min); setSt(s)
      if (s.listed && m.name && s.name !== m.name) void sendName(m, m.name).then((r) => { if (r === 'taken' || r === 'reserved' || r === 'invalid') { saveName(m, ''); setMe({ ...m, name: '' }); setProblem(nameProblem(r)) } })
    }).catch(() => !dead && setErr(true))
    return () => { dead = true }
  }, [nonce])

  const link = me ? shareUrl(me.code) : ''
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { fx_say({ title: 'Copy it by hand', description: link }) }
  }
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'Friction', text: 'A focus app with no feed that never scrolls.', url: link }); return } catch { /* cancelled */ } }
    void copy()
  }
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
    setMe({ ...me, name: a }); setName(a)
  }
  const need = Math.max(1, min)
  const btn = 'inline-flex h-11 items-center justify-center gap-2 border border-ink/30 px-4 text-sm hover:bg-ink/10'

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader kicker="Recommend" title="Leaders" sub={min === 0 ? 'Send your link to people who would like Friction. Your first recommend puts you on the board.' : `The board is full. Reach ${min} recommends to take the lowest place.`} />
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
            <div className="flex items-end gap-4">
              <div>
                <p className="hud">Your recommends</p>
                <div className="dot text-[clamp(2.4rem,6vw,3.6rem)] font-bold leading-none"><AnimatedNumber value={n} /></div>
              </div>
              <p className="pb-1 text-sm text-ink-2">{st?.listed ? `You are number ${st.rank} on the board.` : min === 0 ? 'Your first recommend puts you on the board.' : `${Math.max(0, need - n)} more to take a place.`}</p>
            </div>
            <div className="flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={need} aria-valuenow={Math.min(n, need)} aria-label="Recommends needed to be on the board">
              {need <= 12 ? Array.from({ length: need }, (_, i) => <i key={i} className={cn('h-2 flex-1', i < n ? 'bg-signal' : 'bg-ink/15')} />) : <i className="h-2 flex-1 bg-ink/15"><i className="block h-full bg-signal" style={{ width: `${Math.min(100, (n / need) * 100)}%` }} /></i>}
            </div>
            <div>
              <label htmlFor="sharelink" className="hud mb-1 block">Your link</label>
              <input id="sharelink" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="h-11 w-full border border-ink/30 bg-transparent px-3 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-signal" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={copy} className={btn}>{copied ? <Check className="size-4 text-signal" /> : <Copy className="size-4" />}{copied ? 'Copied' : 'Copy link'}</button>
              <button onClick={share} className="inline-flex h-11 items-center gap-2 bg-signal px-5 text-sm font-semibold text-on-signal"><Share2 className="size-4" />Share</button>
            </div>
            {(
              <form onSubmit={save} className="flex gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} aria-label="Public alias" placeholder="Public alias" className="h-11 min-w-0 flex-1 border border-ink/30 bg-transparent px-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-signal" />
                <button type="submit" className={btn}>Save</button>
              </form>
            )}
            <p className="mt-auto text-[13px] leading-[18px] text-ink-3">A recommend counts when someone new opens your link and tunes in, once per browser. The board holds a random code, the name you choose and a count. When the space set aside for it fills up, the lowest score is replaced by anyone who beats it.</p>
          </Panel>

          <div className="flex min-h-0 min-w-0 flex-col gap-2">
            <div ref={ref} className="min-h-[52px] flex-1 overflow-hidden" {...swipe}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.ol key={safe} className="grid h-full content-start gap-1.5" style={{ gridAutoRows: '52px' }} exit={{ opacity: 0, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }}>
                  {slice.map((r, i) => (
                    <motion.li key={r.rank} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: Math.min(i, 8) * 0.025 }} className={cn('flex h-[52px] items-center gap-3 border px-3', st?.listed && st.rank === r.rank ? 'border-signal bg-signal/10' : 'border-ink/15 bg-ink/[0.03]')}>
                      <span className={cn('grid size-8 shrink-0 place-items-center text-[14px] font-bold', medal(r.rank))}>{r.rank === 1 ? <Trophy className="size-4" aria-label="First" /> : r.rank}</span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{r.name}{st?.listed && st.rank === r.rank && <span className="hud ml-2">You</span>}</span>
                      <span className="fig text-[15px]">{r.n}<span className="ml-1 text-[13px] text-ink-2">recommends</span></span>
                    </motion.li>
                  ))}
                  {list.length === 0 && <li className="border border-dashed border-ink/25 p-8 text-center text-sm text-ink-2">Nobody is on the board yet. Your first recommend puts you at the top.</li>}
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
