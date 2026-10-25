import { EyeOff, Newspaper, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader, Panel } from '@/components/app/shared'
import { Scrubber, useSwipe } from '@/components/app/Scrubber'
import { Skeleton } from '@/components/ui/skeleton'
import { fx_say } from '@/lib/actions'
import { CATEGORIES, FEEDS, type NewsCategory } from '@/lib/feeds'
import { useGridFit, useMedia } from '@/lib/hooks'
import { DURATIONS, loadCategory, matcher, normWord, remaining, topicsOf, type Story } from '@/lib/news'
import { useStore, type Mute } from '@/lib/store'
import { cn } from '@/lib/utils'

const ago = (t: number, now: number) => {
  if (!t) return ''
  const m = Math.max(0, Math.round((now - t) / 60000))
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`
}

/** Hide a word or name for a while, and take it back. Undo is on every change. */
function useMuting() {
  const mutes = useStore((s) => s.mutes)
  const set = useStore((s) => s.setMutes)
  const add = (word: string, ms: number, label: string) => {
    const w = normWord(word)
    if (!w) return
    const before = useStore.getState().mutes
    const next: Mute = { id: `${w}`, word: w, until: ms ? Date.now() + ms : 0 }
    set([next, ...before.filter((m) => m.id !== next.id)])
    fx_say({ title: `Hiding “${w}”`, description: ms ? `For ${label}. Undo if that was a slip.` : 'Until you lift it. Undo if that was a slip.', undo: () => set(before) })
  }
  const remove = (m: Mute) => {
    const before = useStore.getState().mutes
    set(before.filter((x) => x.id !== m.id))
    fx_say({ title: `“${m.word}” is back`, description: 'Stories with it will show again.', undo: () => set(before) })
  }
  return { mutes, add, remove }
}

function MutePanel({ picking, onDone, className }: { picking: Story | null; onDone: () => void; className?: string }) {
  const { mutes, add, remove } = useMuting()
  const [word, setWord] = useState('')
  const [dur, setDur] = useState('1d')
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])
  const d = DURATIONS.find((x) => x.id === dur) ?? DURATIONS[2]
  const live = mutes.filter((m) => !m.until || m.until > now).sort((a, b) => (a.until || Infinity) - (b.until || Infinity))
  const submit = (e: FormEvent) => { e.preventDefault(); add(word, d.ms, d.label.toLowerCase()); setWord(''); onDone() }
  const ideas = picking ? topicsOf(picking.title) : []
  return (
    <Panel className={cn('flex min-h-0 flex-col gap-3 p-4', className)}>
      <div>
        <h2 className="text-base font-semibold">Hide a topic</h2>
        <p className="text-[13px] text-ink-2">Stories with that word or name drop out of every feed for as long as you choose.</p>
      </div>
      {picking && (
        <div>
          <p className="hud mb-1">From “{picking.title.slice(0, 48)}{picking.title.length > 48 ? '…' : ''}”</p>
          <div className="flex flex-wrap gap-1.5">
            {ideas.map((w) => <button key={w} onClick={() => { add(w, d.ms, d.label.toLowerCase()); onDone() }} className="inline-flex h-11 items-center gap-1.5 bg-ink/[0.07] px-3 text-[13px] ring-1 ring-ink/12 hover:bg-ink/12 md:h-9"><EyeOff className="size-3.5" />{w}</button>)}
          </div>
        </div>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <input value={word} onChange={(e) => setWord(e.target.value)} aria-label="Word or name to hide" placeholder="A word or a name" maxLength={40} className="h-11 min-w-0 flex-1 border border-ink/30 bg-transparent px-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-signal" />
        <button type="submit" disabled={!normWord(word)} className="h-11 bg-signal px-4 text-sm font-semibold text-on-signal disabled:opacity-40">Hide</button>
      </form>
      <div role="radiogroup" aria-label="For how long" className="flex flex-wrap gap-1.5">
        {DURATIONS.map((x) => (
          <button key={x.id} role="radio" aria-checked={dur === x.id} onClick={() => setDur(x.id)} className={cn('h-11 px-3 text-[13px] transition-colors md:h-9', dur === x.id ? 'bg-ink text-ground' : 'bg-ink/[0.07] text-ink ring-1 ring-ink/12 hover:bg-ink/12')}>{x.label}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden border-t border-ink/15 pt-2">
        <div className="hud mb-1">Hidden now{live.length ? ` · ${live.length}` : ''}</div>
        {live.length === 0 ? <p className="text-[13px] text-ink-2">Nothing hidden. Every story shows.</p> : (
          <ul>
            {live.slice(0, 5).map((m) => (
              <li key={m.id} className="flex min-h-11 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.word}</span>
                <span className="fig shrink-0 text-[13px] text-ink-2">{remaining(m, now)}</span>
                <button onClick={() => remove(m)} aria-label={`Show “${m.word}” again`} className="grid size-11 shrink-0 place-items-center text-ink-2 hover:text-signal md:size-9"><X className="size-4" /></button>
              </li>
            ))}
            {live.length > 5 && <li className="text-[13px] text-ink-3">and {live.length - 5} more</li>}
          </ul>
        )}
      </div>
    </Panel>
  )
}

export function NewsView() {
  const wide = useMedia('(min-width: 1024px)')
  const mutes = useStore((s) => s.mutes)
  const [cat, setCat] = useState<NewsCategory>('World')
  const [all, setAll] = useState<Story[]>([])
  const [prog, setProg] = useState({ done: 0, total: FEEDS.filter((f) => f.category === 'World').length, ok: 0 })
  const [page, setPage] = useState(1)
  const [panel, setPanel] = useState(false)
  const [picking, setPicking] = useState<Story | null>(null)
  const [now, setNow] = useState(Date.now())
  const { ref, per } = useGridFit(260, 84, 8, 1)

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])
  useEffect(() => {
    let dead = false
    setAll([])
    setPage(1)
    setProg({ done: 0, total: FEEDS.filter((f) => f.category === cat).length, ok: 0 })
    void loadCategory(cat, (got, done, total) => {
      setAll((prev) => {
        const seen = new Set(prev.map((s) => s.title.toLowerCase()))
        return prev.concat(got.filter((g) => !seen.has(g.title.toLowerCase())))
      })
      setProg((p) => ({ done, total, ok: p.ok + (got.length ? 1 : 0) }))
    }, () => dead)
    return () => { dead = true }
  }, [cat])

  const { shown, hidden } = useMemo(() => {
    const hit = matcher(mutes, now)
    const sorted = all.slice().sort((a, b) => (b.date || 0) - (a.date || 0))
    const shown: Story[] = []
    let hidden = 0
    for (const s of sorted) (hit(s) ? hidden++ : shown.push(s))
    return { shown, hidden }
  }, [all, mutes, now])

  const pages = Math.max(1, Math.ceil(shown.length / per))
  const safe = Math.min(page, pages)
  const slice = shown.slice((safe - 1) * per, safe * per)
  const swipe = useSwipe(() => setPage(Math.max(1, safe - 1)), () => setPage(Math.min(pages, safe + 1)))
  const loading = prog.done < prog.total
  const activeMutes = mutes.filter((m) => !m.until || m.until > now).length
  const showPanel = wide || panel

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader kicker="News" title="News" sub={`${FEEDS.length} sources, read straight from their RSS feeds. Nothing is ranked for you.`}>
        {!wide && (
          <button onClick={() => setPanel((p) => !p)} aria-pressed={panel} className={cn('inline-flex h-11 items-center gap-2 border border-ink/30 px-3 text-sm', panel ? 'bg-ink text-ground' : 'hover:bg-ink/10')}>
            {panel ? <Newspaper className="size-4" /> : <EyeOff className="size-4" />}{panel ? 'Stories' : `Hidden topics${activeMutes ? ` · ${activeMutes}` : ''}`}
          </button>
        )}
      </PageHeader>

      <div className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-1" data-allow-scroll role="group" aria-label="Categories">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={cn('h-11 shrink-0 px-3.5 text-[13px] transition-colors md:h-9', cat === c ? 'bg-ink text-ground' : 'bg-ink/[0.07] text-ink ring-1 ring-ink/12 hover:bg-ink/12')}>{c}</button>
        ))}
      </div>

      <div className={cn('grid min-h-0 flex-1 gap-4', wide && 'grid-cols-[minmax(0,1fr)_340px]')}>
        {(wide || !panel) && (
          <div className="flex min-h-0 min-w-0 flex-col gap-2">
            <p className="hud shrink-0" role="status">
              {loading ? `Reading ${prog.done} of ${prog.total} sources…` : `${prog.ok} of ${prog.total} sources answered`}
              {hidden > 0 && ` · ${hidden} hidden by your topics`}
            </p>
            <div ref={ref} className="min-h-[84px] flex-1 overflow-hidden" {...swipe}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.ul key={`${cat}-${safe}`} className="grid h-full content-start gap-2" style={{ gridAutoRows: '84px' }} exit={{ opacity: 0, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }}>
                  {slice.map((s, i) => (
                    <motion.li key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: Math.min(i, 6) * 0.025 }} className="relative">
                      <a href={s.link} target="_blank" rel="noopener noreferrer" className="flex h-[84px] min-w-0 flex-col justify-center gap-0.5 border border-ink/15 bg-ink/[0.03] py-2 pl-3 pr-14 transition-colors hover:border-signal/60 hover:bg-ink/[0.06]">
                        <span className="line-clamp-2 text-[14px] font-semibold leading-[18px]">{s.title}</span>
                        <span className="hud truncate">{s.source}{s.date ? ` · ${ago(s.date, now)}` : ''}</span>
                      </a>
                      <button onClick={() => { setPicking(s); setPanel(true) }} aria-label={`Hide topics from “${s.title}”`} className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center text-ink-2 hover:text-signal"><EyeOff className="size-[18px]" /></button>
                    </motion.li>
                  ))}
                  {loading && slice.length === 0 && Array.from({ length: Math.min(per, 6) }, (_, i) => <li key={i} className="h-[84px] border border-ink/10 p-3" aria-hidden><Skeleton className="mb-2 h-3 w-3/4" /><Skeleton className="h-2.5 w-1/3" /></li>)}
                  {!loading && slice.length === 0 && (
                    <li className="border border-dashed border-ink/25 p-8 text-center text-sm text-ink-2">{all.length ? 'Every story here is hidden by your topics. Lift one to see them.' : 'None of these sources would open. Check your connection and try another category.'}</li>
                  )}
                </motion.ul>
              </AnimatePresence>
            </div>
            <Scrubber count={shown.length} per={per} page={safe} onPage={setPage} labelAt={(i) => shown[i]?.title ?? ''} />
          </div>
        )}
        {showPanel && <MutePanel picking={picking} onDone={() => { setPicking(null); if (!wide) setPanel(false) }} className={wide ? '' : 'h-full'} />}
      </div>
    </section>
  )
}
