import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Check, ExternalLink, Flame, Layers, Shuffle, Sparkles, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FitText, PageHeader, Panel, Seg } from '@/components/app/shared'
import { Scrubber, useSwipe } from '@/components/app/Scrubber'
import { Demo, demoFor } from '@/components/app/demos'
import { AiDemoFrame, DemoWaiting } from '@/components/app/demos/AiDemo'
import { useAiDemo } from '@/lib/aidemo'
import { Build, Estimate, Match, Sequence, Timeline, TrueFalse, TypeIt } from '@/components/app/LessonSteps'
import { IOSSearchBar } from '@/components/ui/ios-search-bar'
import { LoadingBlock } from '@/components/app/LoadingBlock'
import { useGridFit } from '@/lib/hooks'
import { lessonCredits, triviaCredits } from '@/lib/credits'
import { addCards, buildSteps, dropCard, earn, fetchTrivia, finishLesson, gradeCard, hideYear, learnOf, loadLesson, randomTopic, SCORED, searchTopics, streakOf, TOPICS, triviaCategories, type Hit, type Lesson, type Step, type Trivia } from '@/lib/learn'
import { dateKey } from '@/lib/dates'
import { notify } from '@/lib/notify'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'
import { cn } from '@/lib/utils'

const ease = [0.2, 0, 0, 1] as const
/** trivia can be played all day, but it pays credits for three rounds a day */
const TRIVIA_PAID_PER_DAY = 3

/** One multiple-choice question. Right and wrong are shown by icon and word as well as colour. */
function Choices({ options, answer, picked, onPick }: { options: string[]; answer: number; picked: number | null; onPick: (i: number) => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { const n = Number(e.key); if (picked === null && n >= 1 && n <= options.length && !(e.target as Element).closest('input,textarea')) onPick(n - 1) }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [picked, options.length, onPick])
  return (
    <div role="group" aria-label="Answers" className="grid gap-2 sm:grid-cols-2">
      {options.map((o, i) => {
        const right = picked !== null && i === answer
        const wrong = picked === i && i !== answer
        return (
          <button key={o + i} disabled={picked !== null} onClick={() => onPick(i)} className={cn('flex min-h-[52px] items-center gap-3 border px-3 py-2 text-left text-[15px] transition-colors disabled:cursor-default', right ? 'border-signal bg-signal/15' : wrong ? 'border-ink/60 bg-ink/10 line-through decoration-1' : 'border-ink/25 hover:border-signal/70 hover:bg-ink/[0.06] disabled:opacity-60')}>
            <span className={cn('grid size-7 shrink-0 place-items-center border text-[13px] font-semibold', right ? 'border-signal bg-signal text-on-signal' : 'border-ink/30')}>{right ? <Check className="size-4" /> : wrong ? <X className="size-4" /> : i + 1}</span>
            <span className="min-w-0">{o}{right && <span className="sr-only"> (correct)</span>}{wrong && <span className="sr-only"> (your answer, not correct)</span>}</span>
          </button>
        )
      })}
    </div>
  )
}

const Bar = ({ at, total }: { at: number; total: number }) => (
  <div className="flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={at} aria-label="Progress through the lesson">
    {Array.from({ length: total }, (_, i) => <i key={i} className={cn('h-1.5 flex-1 transition-colors', i < at ? 'bg-signal' : i === at ? 'bg-ink/60' : 'bg-ink/15')} />)}
  </div>
)

const XP: Partial<Record<Step['kind'], number>> = { check: 10, tf: 8, type: 14, estimate: 12, sequence: 16, match: 18, build: 14 }

/** what a miss leaves in the review deck; formats that are practice rather than facts leave nothing */
const cardFor = (title: string, step: Step, i: number): { id: string; front: string; back: string } | null => {
  const id = `c:${title}:${i}`
  if (step.kind === 'check') return { id, front: step.prompt, back: `${step.options[step.answer]}. ${step.explain}` }
  if (step.kind === 'tf') return { id, front: `True or false? ${step.statement}`, back: `${step.truth ? 'True.' : 'False.'} ${step.explain}` }
  if (step.kind === 'type') return { id, front: step.prompt, back: `${step.answer}. ${step.explain}` }
  if (step.kind === 'estimate') return { id, front: step.prompt, back: step.explain }
  if (step.kind === 'sequence') return { id, front: `Which came first? ${step.items.map((it) => hideYear(it.text)).join(' / ')}`, back: `${step.items.map((it) => `${it.year}: ${it.text}`).join(' ')}` }
  return null
}

function LessonPlayer({ lesson, onExit }: { lesson: Lesson; onExit: (review?: boolean) => void }) {
  // a demo is written for each lesson while the first ideas are read; the built-in one for the topic (if any) covers a miss
  const aiOn = useStore((s) => s.settings.aiDemos !== false)
  const curated = useMemo(() => demoFor(lesson.title), [lesson.title])
  const ai = useAiDemo(lesson.title, aiOn)
  const steps = useMemo(() => buildSteps(lesson, aiOn ? 'ai' : curated), [lesson, aiOn, curated])
  const [at, setAt] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [res, setRes] = useState<boolean | null>(null)
  const [score, setScore] = useState({ ok: 0, n: 0, added: 0 })
  const [xp, setXp] = useState(0)
  const [credit, setCredit] = useState<number | null>(null)
  const playedAt = useRef(-1)
  const step: Step = steps[at]
  const saved = useStore((s) => s.learn?.deck?.some((c) => c.id === `i:${lesson.title}:${step.kind === 'idea' ? step.i : -1}`))
  const swipe = useSwipe(() => at < steps.length - 1 && step.kind === 'idea' && go(), () => at > 0 && step.kind === 'idea' && back())
  const scored = SCORED.has(step.kind)
  // when the demo never came and there is no built-in one, its place in the lesson is simply skipped
  const gone = ai.status === 'failed' && !curated
  const skip = (i: number) => gone && steps[i].kind === 'demo' && steps[i].id === 'ai'
  const nextAt = (from: number) => { let j = from + 1; while (j < steps.length - 1 && skip(j)) j++; return Math.min(j, steps.length - 1) }
  const prevAt = (from: number) => { let j = from - 1; while (j > 0 && skip(j)) j--; return Math.max(j, 0) }
  const live = steps.map((_, i) => i).filter((i) => !skip(i))
  const canBack = at > 0 && step.kind !== 'end' && !scored && !SCORED.has(steps[prevAt(at)].kind)

  const go = () => { setPicked(null); setRes(null); setAt(nextAt(at)) }
  const back = () => { if (canBack) { setPicked(null); setRes(null); setAt(prevAt(at)) } }
  useEffect(() => { if (skip(at)) go() }) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as Element).closest('input,textarea')) return
      if (e.key === 'ArrowRight' && step.kind === 'idea') go()
      if (e.key === 'ArrowLeft' && step.kind === 'idea') back()
      if (e.key === 'Escape') onExit()
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  })

  /** one answer to one scored step: marks it, pays XP, and keeps a miss for review */
  const record = (ok: boolean) => {
    if (res !== null || !SCORED.has(step.kind)) return
    setRes(ok)
    const card = ok ? null : cardFor(lesson.title, step, at)
    if (card) addCards([card])
    setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), n: s.n + 1, added: s.added + (card ? 1 : 0) }))
    const gain = XP[step.kind] ?? 0
    if (ok && gain) { earn(gain); setXp((x) => x + gain) }
  }
  const answer = (i: number) => { if (picked !== null || step.kind !== 'check') return; setPicked(i); record(i === step.answer) }
  const played = () => { if (playedAt.current === at) return; playedAt.current = at; earn(5); setXp((x) => x + 5) }

  useEffect(() => {
    if (step.kind === 'idea') { earn(2); setXp((x) => x + 2) }
    else if (step.kind === 'end') {
      const prev = useStore.getState().learn.done[lesson.title]?.at
      const fresh = !prev || Date.now() - prev > 864e5
      const c = lessonCredits(score.ok, score.n)
      if (fresh) useStore.getState().earnCredits(c, `Lesson: ${lesson.title}`)
      setCredit(fresh ? c : 0)
      finishLesson(lesson.title, score.ok, score.n)
      useUI.getState().set({ celebrate: { title: 'Lesson complete', detail: `${lesson.title}: ${lesson.ideas.length} ideas${score.n ? `, ${score.ok} of ${score.n} checks right` : ''}${fresh ? `. +${c} credits` : ''}.` } })
    }
  }, [at]) // eslint-disable-line react-hooks/exhaustive-deps

  const idea = step.kind === 'idea' ? lesson.ideas[step.i] : null
  const keep = () => idea && step.kind === 'idea' && (saved ? dropCard(`i:${lesson.title}:${step.i}`) : addCards([{ id: `i:${lesson.title}:${step.i}`, front: `${lesson.title}: ${idea.heading}`, back: idea.text }]))

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-3">
        <button onClick={() => onExit()} aria-label="Leave the lesson" className="grid size-11 shrink-0 place-items-center border border-ink/30 hover:bg-ink/10"><X className="size-5" /></button>
        <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-semibold">{lesson.title}</div><Bar at={live.filter((i) => i < at).length} total={live.length - 1} /></div>
        <span className="fig hud shrink-0">+{xp} XP</span>
      </div>
      <Panel className="relative min-h-0 flex-1 overflow-hidden p-4 md:p-6" {...swipe}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={at} className="flex h-full min-h-0 flex-col justify-between gap-3 md:gap-4" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }} transition={{ duration: 0.22, ease }}>
            {idea && step.kind === 'idea' && (
              <>
                <div className="flex min-h-0 flex-1 gap-4">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <p className="hud mb-2 shrink-0">Idea {step.i + 1} of {lesson.ideas.length} · {idea.heading}</p>
                    <FitText max={26} className="max-w-[44ch] font-medium leading-[1.4]">{idea.text}</FitText>
                  </div>
                  {step.i === 0 && lesson.thumb && <img src={lesson.thumb} alt="" className="hidden max-h-[220px] w-[200px] object-cover md:block" />}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={keep} aria-pressed={!!saved} className="inline-flex h-11 items-center gap-2 border border-ink/30 px-3 text-sm hover:bg-ink/10">{saved ? <BookmarkCheck className="size-4 text-signal" /> : <Bookmark className="size-4" />}{saved ? 'In your review deck' : 'Keep for review'}</button>
                  <a href={lesson.url} target="_blank" rel="noopener noreferrer" className="hud inline-flex min-h-11 items-center gap-1.5 hover:text-ink">Full article <ExternalLink className="size-3.5" /></a>
                </div>
              </>
            )}
            {step.kind === 'check' && (
              <>
                <div className="flex min-h-0 flex-1 flex-col"><p className="hud mb-2 shrink-0">Check · fill the gap</p><FitText max={22} className="max-w-[52ch] leading-[1.45]">{step.prompt}</FitText></div>
                <Choices options={step.options} answer={step.answer} picked={picked} onPick={answer} />
                {picked !== null && <p role="status" className="shrink-0 text-[14px] text-ink-2"><strong className="text-ink">{picked === step.answer ? 'Right. ' : 'Not quite. '}</strong>{step.explain}{picked !== step.answer && ' It is in your review deck now.'}</p>}
              </>
            )}
            {step.kind === 'tf' && <TrueFalse step={step} result={res} onResult={record} />}
            {step.kind === 'type' && <TypeIt step={step} result={res} onResult={record} />}
            {step.kind === 'estimate' && <Estimate step={step} result={res} onResult={record} />}
            {step.kind === 'sequence' && <Sequence step={step} result={res} onResult={record} />}
            {step.kind === 'match' && <Match step={step} result={res} onResult={record} />}
            {step.kind === 'build' && <Build step={step} result={res} onResult={record} />}
            {step.kind === 'timeline' && <Timeline step={step} />}
            {step.kind === 'demo' && (step.id !== 'ai' ? <Demo id={step.id} played={played} /> : ai.status === 'ready' ? <AiDemoFrame demo={ai.demo} played={played} onFail={ai.fail} /> : ai.status === 'pending' ? <DemoWaiting title={lesson.title} /> : curated ? <Demo id={curated} played={played} /> : null)}
            {step.kind === 'end' && (
              <div className="grid h-full content-center justify-items-start gap-3">
                <p className="hud">Lesson complete</p>
                <h2 className="dot text-[clamp(1.6rem,4vw,2.6rem)] font-bold leading-[1.4]">{score.n ? `${score.ok} of ${score.n} right` : 'Done'}</h2>
                <p className="max-w-[48ch] text-[15px] text-ink-2">{lesson.ideas.length} ideas read, +{xp} XP{score.added ? `, ${score.added} gap${score.added === 1 ? '' : 's'} added to your review deck` : ''}. Come back to the deck tomorrow and it will ask again.</p>
                {credit !== null && <p className="fig max-w-[48ch] text-[15px]" role="status">{credit > 0 ? <><strong>+{credit} credits</strong><span className="text-ink-2"> · 3 for finishing{score.ok ? `, ${score.ok} for right answers` : ''}{score.n > 0 && score.ok === score.n ? ', 4 for a clean sheet' : ''}</span></> : <span className="text-ink-2">Credits for this lesson were paid in the last day. Come back tomorrow to earn them again.</span>}</p>}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onExit()} className="h-11 bg-signal px-5 text-sm font-semibold text-on-signal">Another topic</button>
                  <button onClick={() => onExit(true)} className="h-11 border border-ink/30 px-5 text-sm hover:bg-ink/10">Review deck</button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </Panel>
      {step.kind !== 'end' && (
        <div className="flex shrink-0 items-center justify-between gap-2">
          <button onClick={back} disabled={!canBack} className="inline-flex h-11 items-center gap-2 border border-ink/30 px-4 text-sm hover:bg-ink/10 disabled:opacity-40"><ArrowLeft className="size-4" />Back</button>
          <button onClick={go} disabled={scored && res === null} className="inline-flex h-11 min-w-32 items-center justify-center gap-2 bg-signal px-5 text-sm font-semibold text-on-signal disabled:opacity-40">{nextAt(at) === steps.length - 1 ? 'Finish' : 'Continue'}<ArrowRight className="size-4" /></button>
        </div>
      )}
    </div>
  )
}

function Explore({ onOpen, done }: { onOpen: (title: string) => void; done: Record<string, unknown> }) {
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [page, setPage] = useState(1)
  const { ref, per, cols } = useGridFit(280, 84, 8, 3)
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 380); return () => clearTimeout(t) }, [q])
  useEffect(() => {
    if (!dq) { setState('idle'); setHits([]); return }
    let dead = false
    setState('loading'); setPage(1)
    searchTopics(dq).then((r) => { if (!dead) { setHits(r); setState('ready') } }).catch(() => { if (!dead) setState('error') })
    return () => { dead = true }
  }, [dq])
  const [busy, setBusy] = useState(false)
  const surprise = async () => { setBusy(true); try { onOpen(await randomTopic()) } catch { setState('error') } finally { setBusy(false) } }
  const list = dq ? hits : TOPICS.map((t) => ({ title: t, about: '' }))
  const pages = Math.max(1, Math.ceil(list.length / per))
  const safe = Math.min(page, pages)
  const slice = list.slice((safe - 1) * per, safe * per)
  const swipe = useSwipe(() => setPage(Math.max(1, safe - 1)), () => setPage(Math.min(pages, safe + 1)))
  return (
    <>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1"><IOSSearchBar value={q} onChange={setQ} onClear={() => setQ('')} placeholder="Learn about anything" collapsedWidth="100%" expandedWidth="100%" className="max-w-full" /></div>
        <button onClick={surprise} disabled={busy} className="inline-flex h-11 shrink-0 items-center gap-2 border border-ink/30 px-3 text-sm hover:bg-ink/10 disabled:opacity-50"><Shuffle className="size-4" /><span className="max-sm:sr-only">Surprise me</span></button>
      </div>
      <p className="hud shrink-0" role="status">{dq ? (state === 'loading' ? 'Searching…' : state === 'error' ? 'Could not reach the library' : `${hits.length} topics`) : 'Start with one of these, or search for anything'}</p>
      <div ref={ref} className="min-h-[84px] flex-1 overflow-hidden" {...swipe}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={`${dq}-${safe}-${state}`} className="grid h-full content-start gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: '84px' }} exit={{ opacity: 0, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }}>
            {state === 'loading' ? <div className="col-span-full" style={{ gridRow: 'span 4' }}><LoadingBlock label="Searching" /></div> : slice.map((h, i) => (
              <motion.button key={h.title} onClick={() => onOpen(h.title)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease, delay: Math.min(i, 8) * 0.025 }} className="flex h-[84px] min-w-0 flex-col justify-center gap-0.5 border border-ink/15 bg-ink/[0.03] px-3 text-left transition-colors hover:border-signal/60 hover:bg-ink/[0.06]">
                <span className="flex items-center gap-2 text-[15px] font-semibold"><span className="truncate">{h.title}</span>{done[h.title] != null && <Check className="size-4 shrink-0 text-signal" aria-label="Completed" />}</span>
                {h.about && <span className="line-clamp-2 text-[13px] leading-[17px] text-ink-2">{h.about}</span>}
              </motion.button>
            ))}
            {state === 'error' && <div className="col-span-full border border-dashed border-ink/25 p-6 text-sm text-ink-2">Wikipedia did not answer. Check your connection and try again.</div>}
          </motion.div>
        </AnimatePresence>
      </div>
      <Scrubber count={list.length} per={per} page={safe} onPage={setPage} labelAt={(i) => list[i]?.title ?? ''} />
    </>
  )
}

function TriviaGame() {
  const [cats, setCats] = useState<{ id: number; name: string }[]>([])
  const [cat, setCat] = useState<number | null>(null)
  const [diff, setDiff] = useState('any')
  const [qs, setQs] = useState<Trivia[] | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'slow' | 'error'>('idle')
  const [at, setAt] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [ok, setOk] = useState(0)
  const [paid, setPaid] = useState<number | null>(null)
  useEffect(() => { triviaCategories().then(setCats).catch(() => undefined) }, [])
  const start = async () => {
    setState('loading')
    try { setQs(await fetchTrivia(cat, diff)); setAt(0); setPicked(null); setOk(0); setPaid(null); setState('idle') } catch (e) { setState((e as Error).message === 'slow' ? 'slow' : 'error') }
  }
  const pick = (i: number) => {
    if (picked !== null || !qs) return
    setPicked(i)
    const right = i === qs[at].answer
    if (right) { setOk((n) => n + 1); earn(5) }
    if (at === qs.length - 1) {
      const total = ok + (right ? 1 : 0)
      notify('learn', `Trivia round: ${total} of ${qs.length} right.`, 'Trivia')
      const c = triviaCredits(total, qs.length)
      const today = dateKey()
      const paidToday = useStore.getState().credits.log.filter((e) => e.why === 'Trivia round' && dateKey(new Date(e.t)) === today).length
      if (c > 0 && paidToday < TRIVIA_PAID_PER_DAY) { useStore.getState().earnCredits(c, 'Trivia round'); setPaid(c) } else setPaid(c > 0 ? 0 : null)
      if (total >= 8) useUI.getState().set({ celebrate: { title: 'Sharp round', detail: `${total} of ${qs.length} right${c > 0 && paidToday < TRIVIA_PAID_PER_DAY ? `. +${c} credits` : ''}.` } })
    }
  }
  const q = qs?.[at]
  const finished = qs && at >= qs.length
  if (!qs || finished) {
    return (
      <Panel className="grid min-h-0 content-start gap-4 p-5">
        {finished && <div><p className="hud">Round over</p><h2 className="dot text-[clamp(1.6rem,4vw,2.4rem)] font-bold">{ok} of {qs.length}</h2><p className="text-sm text-ink-2">+{ok * 5} XP{paid ? `, +${paid} credits` : ''}. {paid === 0 ? `Credits are paid for ${TRIVIA_PAID_PER_DAY} rounds a day. ` : ''}Another round?</p></div>}
        {!finished && <div><h2 className="text-base font-semibold">Ten questions, any subject</h2><p className="text-[13px] text-ink-2">From the Open Trivia Database. Each right answer is 5 XP.</p></div>}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" data-allow-scroll role="group" aria-label="Subject">
          {[{ id: 0, name: 'Anything' }, ...cats].map((c) => <button key={c.id} onClick={() => setCat(c.id || null)} aria-pressed={(cat ?? 0) === c.id} className={cn('h-11 shrink-0 px-3.5 text-[13px] md:h-9', (cat ?? 0) === c.id ? 'bg-ink text-ground' : 'bg-ink/[0.07] text-ink ring-1 ring-ink/12 hover:bg-ink/12')}>{c.name.replace('Entertainment: ', '').replace('Science: ', '')}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Seg id="trivia-diff" value={diff} onChange={setDiff} tabs={[{ id: 'any', label: 'Any' }, { id: 'easy', label: 'Easy' }, { id: 'medium', label: 'Medium' }, { id: 'hard', label: 'Hard' }]} />
          <button onClick={start} disabled={state === 'loading'} className="h-11 bg-signal px-6 text-sm font-semibold text-on-signal disabled:opacity-50">{finished ? 'Play again' : 'Start'}</button>
        </div>
        {state === 'loading' && <LoadingBlock label="Shuffling questions" className="min-h-[120px]" size={56} />}
        {state === 'slow' && <p role="status" className="text-sm text-ink-2">The question bank allows one request every few seconds. Wait a moment and press start again.</p>}
        {state === 'error' && <p role="status" className="text-sm text-ink-2">Could not load questions. Check your connection and try again.</p>}
      </Panel>
    )
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Bar at={at} total={qs.length} />
      <Panel className="flex min-h-0 flex-1 flex-col justify-between gap-4 p-5 md:p-8">
        <div className="flex min-h-0 flex-1 flex-col"><p className="hud mb-2 shrink-0">{q!.category} · {q!.difficulty} · {at + 1} of {qs.length}</p><FitText max={24} className="max-w-[56ch] leading-[1.4]">{q!.prompt}</FitText></div>
        <Choices options={q!.options} answer={q!.answer} picked={picked} onPick={pick} />
        <div className="flex items-center justify-between gap-3">
          <p role="status" className="text-[14px] text-ink-2">{picked === null ? 'Press 1 to 4 or tap an answer.' : picked === q!.answer ? 'Right.' : `Not quite. It was “${q!.options[q!.answer]}”.`}</p>
          <button onClick={() => { setPicked(null); setAt(at + 1) }} disabled={picked === null} className="inline-flex h-11 items-center gap-2 bg-signal px-5 text-sm font-semibold text-on-signal disabled:opacity-40">{at === qs.length - 1 ? 'Finish' : 'Next'}<ArrowRight className="size-4" /></button>
        </div>
      </Panel>
    </div>
  )
}

function Review() {
  const deck = useStore((s) => s.learn?.deck ?? [])
  const [now] = useState(Date.now())
  const due = useMemo(() => deck.filter((c) => c.due <= now).sort((a, b) => a.due - b.due), [deck, now])
  const [queue, setQueue] = useState<string[]>(() => due.map((c) => c.id))
  const [flip, setFlip] = useState(false)
  const card = deck.find((c) => c.id === queue[0])
  const grade = (good: boolean) => {
    if (!card) return
    gradeCard(card.id, good)
    if (good) earn(3)
    setFlip(false)
    setQueue((q) => (good ? q.slice(1) : [...q.slice(1), card.id].slice(0, 40)))
  }
  if (!card) {
    const next = deck.filter((c) => c.due > now).sort((a, b) => a.due - b.due)[0]
    return (
      <Panel className="grid content-start gap-2 p-6">
        <Layers className="size-6 text-signal" />
        <h2 className="text-base font-semibold">{deck.length ? 'Nothing due right now' : 'Your deck is empty'}</h2>
        <p className="max-w-[52ch] text-sm text-ink-2">{deck.length ? `${deck.length} card${deck.length === 1 ? '' : 's'} saved. ${next ? `The next one is due ${new Date(next.due).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.` : ''}` : 'Gaps you miss in a lesson, and ideas you keep, land here. Cards come back after a day, three days, a week, then three weeks, as long as you know them.'}</p>
      </Panel>
    )
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="hud" role="status">{queue.length} to go · box {card.box + 1} of 5</p>
      <Panel className="flex min-h-0 flex-1 flex-col justify-between gap-4 p-5 md:p-8">
        <div className="flex min-h-0 flex-1 flex-col"><p className="hud mb-2 shrink-0">{flip ? 'Answer' : 'Remember this'}</p><FitText max={24} className="max-w-[52ch] leading-[1.45]">{flip ? card.back : card.front}</FitText></div>
        <div className="flex flex-wrap gap-2">
          {!flip ? <button onClick={() => setFlip(true)} className="h-11 bg-signal px-6 text-sm font-semibold text-on-signal">Show answer</button> : (
            <>
              <button onClick={() => grade(false)} className="h-11 border border-ink/30 px-5 text-sm hover:bg-ink/10">Again soon</button>
              <button onClick={() => grade(true)} className="h-11 bg-signal px-6 text-sm font-semibold text-on-signal">I knew it</button>
            </>
          )}
        </div>
      </Panel>
    </div>
  )
}

export function LearnView() {
  const learn = useStore((s) => s.learn)
  const aiDemos = useStore((s) => s.settings.aiDemos !== false)
  const [tab, setTab] = useState<'lessons' | 'trivia' | 'review'>('lessons')
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const xp = learn?.xp ?? 0
  const streak = streakOf(learn?.days ?? [])
  const dueN = (learn?.deck ?? []).filter((c) => c.due <= Date.now()).length

  const open = async (title: string) => {
    setLoading(title); setErr('')
    try { setLesson(await loadLesson(title)) } catch { setErr(`“${title}” has too little to teach from. Try a broader topic.`) } finally { setLoading(null) }
  }
  const stats = learnOf()

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      {lesson ? <h1 className="sr-only">Learn: {lesson.title}</h1> : (
        <PageHeader kicker="Learn" title="Learn" sub={`Short lessons from Wikipedia, checks written from the text itself, ${aiDemos ? 'an AI-written demo for each lesson, ' : ''}trivia, and a review deck. No account.`}>
          <div className="flex items-center gap-4 text-sm" aria-label="Your progress">
            <span className="inline-flex items-center gap-1.5"><Sparkles className="size-4 text-signal" /><span className="fig font-semibold">{xp}</span> XP</span>
            <span className="inline-flex items-center gap-1.5"><Flame className="size-4 text-signal" /><span className="fig font-semibold">{streak}</span> day{streak === 1 ? '' : 's'}</span>
          </div>
        </PageHeader>
      )}
      {lesson ? (
        <div className="min-h-0 flex-1"><LessonPlayer lesson={lesson} onExit={(review) => { setLesson(null); if (review) setTab('review') }} /></div>
      ) : (
        <>
          <Seg id="tabs-learn" value={tab} onChange={(id) => setTab(id as typeof tab)} tabs={[{ id: 'lessons', label: 'Lessons' }, { id: 'trivia', label: 'Trivia' }, { id: 'review', label: 'Review', badge: dueN || undefined }]} />
          {err && <p className="text-sm text-ink-2" role="alert">{err}</p>}
          {loading && <div className="min-h-0 flex-1"><LoadingBlock label={`Writing a lesson on ${loading}`} size={96} /></div>}
          {tab === 'lessons' && !loading && <Explore onOpen={open} done={stats.done} />}
          {tab === 'trivia' && !loading && <TriviaGame />}
          {tab === 'review' && !loading && <Review />}
        </>
      )}
    </section>
  )
}
