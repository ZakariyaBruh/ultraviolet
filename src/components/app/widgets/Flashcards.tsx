import { ArrowLeft, Copy, Download, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { fx_say } from '@/lib/actions'
import { useStore } from '@/lib/store'
import { after, CARDS_MAX, DECKS_MAX, dueIn, exportCards, grade, makeCard, NAME_MAX, newId, nextDue, parseCards, queueOf, quizOf, SAMPLE, SIDE_MAX, total, type Deck, type Grade, type Question } from '@/lib/cards'
import { FitText } from '@/components/app/shared'
import { cn } from '@/lib/utils'
import { field, key } from './Window'

type View =
  | { at: 'decks' }
  | { at: 'deck'; id: string }
  | { at: 'paste'; id: string }
  | { at: 'study'; id: string; queue: string[]; done: number; flipped: boolean }
  | { at: 'quiz'; id: string; qs: Question[]; i: number; picked: number | null; right: number; reverse: boolean }

const GRADES: { g: Grade; label: string; k: string }[] = [{ g: 'again', label: 'Again', k: '1' }, { g: 'good', label: 'Good', k: '2' }, { g: 'easy', label: 'Easy', k: '3' }]
const plural = (n: number, w: string) => `${n.toLocaleString('en-US')} ${w}${n === 1 ? '' : 's'}`

/** Decks you write, learnt by spaced repetition: a card you know comes back less often, one you miss comes round again. See lib/cards.ts. */
export function Flashcards() {
  const decks = useStore((s) => s.widgets.decks) ?? []
  const setDecks = useStore((s) => s.setDecks)
  const [view, setView] = useState<View>({ at: 'decks' })
  // counts are worked out from the clock at each render; this only makes one every half minute, so a card that falls due shows up
  const [, tick] = useState(0)
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t) }, [])
  const now = Date.now()
  const deck = 'id' in view ? decks.find((d) => d.id === view.id) : undefined
  useEffect(() => { if ('id' in view && !deck) setView({ at: 'decks' }) }, [view, deck])
  const full = total(decks) >= CARDS_MAX
  const put = (d: Deck) => setDecks(decks.map((x) => (x.id === d.id ? d : x)))

  if (view.at === 'decks' || !deck) return <Decks decks={decks} now={now} full={full} open={(id) => setView({ at: 'deck', id })} setDecks={setDecks} />
  if (view.at === 'paste') return <Paste deck={deck} room={CARDS_MAX - total(decks)} back={() => setView({ at: 'deck', id: deck.id })} put={put} />
  if (view.at === 'study') return <Study deck={deck} view={view} setView={setView} put={put} />
  if (view.at === 'quiz') return <Quiz deck={deck} view={view} setView={setView} />
  return <DeckView deck={deck} now={now} full={full} setView={setView} put={put} remove={() => { setDecks(decks.filter((d) => d.id !== deck.id)); setView({ at: 'decks' }) }} />
}

function Decks({ decks, now, full, open, setDecks }: { decks: Deck[]; now: number; full: boolean; open: (id: string) => void; setDecks: (d: Deck[]) => void }) {
  const [name, setName] = useState('')
  const add = (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n || decks.length >= DECKS_MAX) return
    const d: Deck = { id: newId(), name: n.slice(0, NAME_MAX), cards: [] }
    setDecks([...decks, d]); setName(''); open(d.id)
  }
  const sample = () => {
    const t = Date.now()
    const d: Deck = { id: newId(), name: SAMPLE.name, cards: SAMPLE.cards.map(([f, b]) => makeCard(f, b, t)) }
    setDecks([...decks, d]); open(d.id)
  }
  const cards = total(decks)
  return (
    <div className="grid gap-2">
      <form onSubmit={add} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} aria-label="New deck name" placeholder={decks.length >= DECKS_MAX ? 'That is the most decks' : 'New deck, e.g. Biology 2'} disabled={decks.length >= DECKS_MAX} className={cn(field, 'flex-1')} />
        <button type="submit" disabled={!name.trim() || decks.length >= DECKS_MAX} className="h-11 shrink-0 bg-signal px-4 text-sm font-semibold text-on-signal disabled:opacity-40">Make</button>
      </form>
      {decks.length === 0 ? (
        <div className="grid justify-items-center gap-2 py-4 text-center">
          <p className="max-w-[30ch] text-[13px] leading-[1.45] text-ink-2">No decks yet. Make one, then add cards or paste a list from Quizlet or Anki.</p>
          <button onClick={sample} className={cn(key, 'h-11 px-4 text-[13px] md:h-9')}>Try a small deck of capitals</button>
        </div>
      ) : (
        <ul data-no-drag className="scroll-y grid max-h-56 content-start">
          {decks.map((d) => {
            const due = dueIn(d, now)
            return (
              <li key={d.id} className="border-b border-ink/10 last:border-b-0">
                <button onClick={() => open(d.id)} className="flex min-h-12 w-full items-center gap-3 text-left hover:bg-ink/5">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{d.name}</span>
                  <span className="fig shrink-0 text-[12px] text-ink-2">{plural(d.cards.length, 'card')}</span>
                  <span className={cn('fig shrink-0 px-1.5 text-[12px]', due ? 'bg-signal font-semibold text-on-signal' : 'text-ink-3')}>{due ? `${due} due` : 'none due'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {decks.length > 0 && <p className="fig text-[12px] text-ink-3">{full ? `${CARDS_MAX.toLocaleString('en-US')} cards is the most. ` : ''}{plural(cards, 'card')} in {plural(decks.length, 'deck')}. Kept in this browser.</p>}
    </div>
  )
}

function DeckView({ deck, now, full, setView, put, remove }: { deck: Deck; now: number; full: boolean; setView: (v: View) => void; put: (d: Deck) => void; remove: () => void }) {
  const [f, setF] = useState('')
  const [b, setB] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState(deck.name)
  const [sure, setSure] = useState(false)
  const timer = useRef(0)
  const front = useRef<HTMLInputElement>(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const due = dueIn(deck, now)
  const next = nextDue(deck, now)
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!f.trim() || !b.trim()) return
    if (editing) put({ ...deck, cards: deck.cards.map((c) => (c.id === editing ? { ...c, f: f.trim().slice(0, SIDE_MAX), b: b.trim().slice(0, SIDE_MAX) } : c)) })
    else if (!full) put({ ...deck, cards: [...deck.cards, makeCard(f, b, Date.now())] })
    setF(''); setB(''); setEditing(null); front.current?.focus()
  }
  const edit = (id: string) => { const c = deck.cards.find((x) => x.id === id); if (!c) return; setEditing(id); setF(c.f); setB(c.b); front.current?.focus() }
  const study = (all: boolean) => { const queue = queueOf(deck.cards, Date.now(), all); if (queue.length) setView({ at: 'study', id: deck.id, queue, done: 0, flipped: false }) }
  const canQuiz = new Set(deck.cards.map((c) => c.b.trim())).size >= 2
  const copy = () => { void navigator.clipboard?.writeText(exportCards(deck)).then(() => fx_say({ title: 'Deck copied', description: 'One card a line, a tab between the sides.', variant: 'success' }), () => fx_say({ title: 'Could not copy', variant: 'warning' })) }
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportCards(deck)], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${deck.name.replace(/[^\w -]+/g, '').trim() || 'deck'}.txt`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const del = () => {
    if (!sure) { setSure(true); timer.current = window.setTimeout(() => setSure(false), 3000); return }
    remove()
  }
  const rename = (e: FormEvent) => { e.preventDefault(); const n = name.trim(); if (n) put({ ...deck, name: n.slice(0, NAME_MAX) }); setNaming(false) }
  const icon = cn(key, 'size-11 shrink-0 md:size-9')

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1">
        <button onClick={() => setView({ at: 'decks' })} aria-label="All decks" className={icon}><ArrowLeft className="size-4" /></button>
        {naming ? (
          <form onSubmit={rename} className="flex min-w-0 flex-1 gap-1">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} aria-label="Deck name" className={cn(field, 'flex-1 md:h-9')} />
            <button type="submit" className={cn(key, 'h-11 px-3 text-[13px] md:h-9')}>Save</button>
          </form>
        ) : (
          <>
            <h3 className="min-w-0 flex-1 truncate pl-1 text-[16px] font-semibold text-ink">{deck.name}</h3>
            <button onClick={() => { setName(deck.name); setNaming(true) }} aria-label="Rename the deck" className={icon}><Pencil className="size-4" /></button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {due > 0 ? (
          <button onClick={() => study(false)} className="h-11 bg-signal px-4 text-sm font-semibold text-on-signal md:h-10">Study {due} due</button>
        ) : (
          <>
            <p className="text-[13px] text-ink-2">{deck.cards.length ? `Nothing due.${next ? ` Next one ${next}.` : ''}` : 'No cards yet.'}</p>
            {deck.cards.length > 0 && <button onClick={() => study(true)} className={cn(key, 'h-11 px-3 text-[13px] md:h-9')}>Go through all</button>}
          </>
        )}
        {canQuiz && <button onClick={() => setView(newQuiz(deck, false))} title="Multiple choice. It does not change when cards come back." className={cn(key, 'h-11 px-3 text-[13px] md:h-9')}>Quiz</button>}
      </div>

      <form onSubmit={save} className="grid gap-1.5 sm:grid-cols-[1fr_1fr_auto]">
        <input ref={front} value={f} onChange={(e) => setF(e.target.value)} maxLength={SIDE_MAX} aria-label="Front of the card" placeholder="Front: a question or word" className={field} disabled={full && !editing} />
        <input value={b} onChange={(e) => setB(e.target.value)} maxLength={SIDE_MAX} aria-label="Back of the card" placeholder="Back: the answer" className={field} disabled={full && !editing} />
        <div className="flex gap-1">
          <button type="submit" disabled={!f.trim() || !b.trim() || (full && !editing)} className="h-11 flex-1 bg-signal px-4 text-sm font-semibold text-on-signal disabled:opacity-40">{editing ? 'Save' : 'Add'}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setF(''); setB('') }} aria-label="Stop editing" className={icon}><X className="size-4" /></button>}
        </div>
      </form>

      {deck.cards.length > 0 && (
        <div data-no-drag tabIndex={0} role="region" aria-label={`Cards in ${deck.name}`} className="scroll-y max-h-40">
        <ul className="grid content-start">
          {deck.cards.map((c) => (
            <li key={c.id} className={cn('flex min-h-11 items-center gap-1 border-b border-ink/10 last:border-b-0', editing === c.id && 'bg-signal-soft')}>
              <span className="min-w-0 flex-1 py-1.5 text-[14px] leading-[1.3]"><span className="text-ink">{c.f}</span> <span className="text-ink-3">·</span> <span className="text-ink-2">{c.b}</span></span>
              <span className="fig shrink-0 text-[11px] text-ink-3" title={`Box ${c.box + 1} of 8`}>{c.box ? `B${c.box + 1}` : 'new'}</span>
              <button onClick={() => edit(c.id)} aria-label={`Edit “${c.f}”`} className="grid size-11 shrink-0 place-items-center text-ink-3 hover:text-ink md:size-9"><Pencil className="size-3.5" /></button>
              <button onClick={() => put({ ...deck, cards: deck.cards.filter((x) => x.id !== c.id) })} aria-label={`Delete “${c.f}”`} className="grid size-11 shrink-0 place-items-center text-ink-3 hover:text-ink md:size-9"><X className="size-4" /></button>
            </li>
          ))}
        </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1">
        <button onClick={() => setView({ at: 'paste', id: deck.id })} disabled={full} className={cn(key, 'h-11 px-3 text-[13px] disabled:opacity-40 md:h-9')}>Paste a list</button>
        <button onClick={copy} disabled={!deck.cards.length} aria-label="Copy the deck as text" title="Copy as text" className={cn(icon, 'disabled:opacity-40')}><Copy className="size-4" /></button>
        <button onClick={download} disabled={!deck.cards.length} aria-label="Save the deck as a text file" title="Save as a text file" className={cn(icon, 'disabled:opacity-40')}><Download className="size-4" /></button>
        <button onClick={del} aria-label={sure ? 'Press again to delete the deck' : 'Delete the deck'} className={cn(key, 'ml-auto h-11 px-3 text-[13px] md:h-9', sure && 'border-signal text-signal')}>{sure ? 'Sure?' : <Trash2 className="size-4" />}</button>
      </div>
    </div>
  )
}

function Paste({ deck, room, back, put }: { deck: Deck; room: number; back: () => void; put: (d: Deck) => void }) {
  const [text, setText] = useState('')
  const found = parseCards(text)
  const take = Math.min(found.length, room)
  const add = () => {
    const t = Date.now()
    put({ ...deck, cards: [...deck.cards, ...found.slice(0, take).map((c) => makeCard(c.f, c.b, t))] })
    fx_say({ title: `${plural(take, 'card')} added`, variant: 'success' })
    back()
  }
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1">
        <button onClick={back} aria-label={`Back to ${deck.name}`} className={cn(key, 'size-11 shrink-0 md:size-9')}><ArrowLeft className="size-4" /></button>
        <h3 className="min-w-0 flex-1 truncate pl-1 text-[16px] font-semibold text-ink">Paste into {deck.name}</h3>
      </div>
      <textarea
        autoFocus data-fill style={{ '--fill': '11rem' } as React.CSSProperties} value={text} onChange={(e) => setText(e.target.value.slice(0, 200_000))} spellCheck={false}
        aria-label="Cards, one a line" placeholder={'One card a line: the front, a tab or |, then the back.\nmitochondria | where the cell makes energy\nQuizlet and Anki exports work as they are.'}
        className="h-40 w-full resize-none border border-ink/25 bg-transparent p-2 text-[14px] leading-[1.45] text-ink placeholder:text-ink-3 focus:border-signal"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="fig text-[12px] text-ink-2" role="status">{text.trim() ? `${plural(found.length, 'card')} found${take < found.length ? `, room for ${take}` : ''}.` : ''}</p>
        <button onClick={add} disabled={!take} className="h-11 bg-signal px-4 text-sm font-semibold text-on-signal disabled:opacity-40 md:h-9">Add {take ? plural(take, 'card') : 'cards'}</button>
      </div>
    </div>
  )
}

function Study({ deck, view, setView, put }: { deck: Deck; view: Extract<View, { at: 'study' }>; setView: (v: View) => void; put: (d: Deck) => void }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { box.current?.focus({ preventScroll: true }) }, [])
  const card = deck.cards.find((c) => c.id === view.queue[0])
  const left = view.queue.length
  const flip = () => setView({ ...view, flipped: true })
  const mark = (g: Grade) => {
    if (!card) return
    const next = grade(card, g, Date.now())
    put({ ...deck, cards: deck.cards.map((c) => (c.id === card.id ? next : c)) })
    const rest = view.queue.slice(1)
    setView({ ...view, queue: g === 'again' ? [...rest, card.id] : rest, done: view.done + (g === 'again' ? 0 : 1), flipped: false })
  }
  const keys = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return // a focused button does its own thing
    if (e.key === 'Escape') { e.preventDefault(); setView({ at: 'deck', id: deck.id }); return }
    if (!view.flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); flip(); return }
    const g = view.flipped && GRADES.find((x) => x.k === e.key)
    if (g) { e.preventDefault(); mark(g.g) }
  }
  if (!card) {
    const next = nextDue(deck, Date.now())
    return (
      <div className="grid justify-items-center gap-3 py-6 text-center">
        <p className="hud">Done</p>
        <p className="text-[15px] text-ink">{plural(view.done, 'card')} through.{next ? ` The next one comes back ${next}.` : ''}</p>
        <button onClick={() => setView({ at: 'deck', id: deck.id })} className="h-11 bg-signal px-4 text-sm font-semibold text-on-signal">Back to {deck.name}</button>
      </div>
    )
  }
  return (
    <div ref={box} tabIndex={-1} onKeyDown={keys} className="grid gap-2 outline-none" aria-label={`Studying ${deck.name}`}>
      <div className="flex items-center gap-2">
        <button onClick={() => setView({ at: 'deck', id: deck.id })} aria-label={`Stop and go back to ${deck.name}`} className={cn(key, 'size-11 shrink-0 md:size-9')}><ArrowLeft className="size-4" /></button>
        <p className="fig min-w-0 flex-1 truncate text-[12px] text-ink-2" role="status">{deck.name} · {view.done} done · {left} to go</p>
      </div>
      <div className="h-1 bg-ink/10" aria-hidden><div className="h-full bg-signal" style={{ width: `${(view.done / (view.done + left)) * 100}%` }} /></div>
      {/* the card: a tap shows the answer (the Show answer button below does the same from the keyboard) */}
      <div
        data-fill style={{ '--fill': '9.5rem' } as React.CSSProperties} onClick={() => !view.flipped && flip()}
        className={cn('flex h-48 min-h-[8rem] w-full flex-col gap-2 border border-ink/25 p-3 text-center', !view.flipped && 'cursor-pointer')}
      >
        <div className="flex min-h-0 flex-1 flex-col"><FitText max={24} min={13} className="grid min-h-full place-content-center font-semibold break-words text-ink">{card.f}</FitText></div>
        {view.flipped && <div className="h-px shrink-0 bg-ink/20" />}
        <div className="flex min-h-0 flex-1 flex-col" aria-live="polite">
          {view.flipped
            ? <FitText max={20} min={13} className="grid min-h-full place-content-center break-words text-ice">{card.b}</FitText>
            : <p className="grid flex-1 place-content-center text-[12px] text-ink-3">Space or tap to see the answer</p>}
        </div>
      </div>
      {view.flipped ? (
        <div className="grid grid-cols-3 gap-1">
          {GRADES.map((x) => (
            <button key={x.g} onClick={() => mark(x.g)} className={cn('grid h-12 content-center justify-items-center leading-tight', x.g === 'good' ? 'bg-signal text-on-signal' : key)}>
              <span className="text-[14px] font-semibold">{x.label} <span className="fig text-[11px] opacity-70">{x.k}</span></span>
              <span className="fig text-[11px] opacity-80">{after(card, x.g)}</span>
            </button>
          ))}
        </div>
      ) : (
        <button onClick={flip} className="h-12 bg-signal text-sm font-semibold text-on-signal">Show answer</button>
      )}
    </div>
  )
}

const newQuiz = (deck: Deck, reverse: boolean): View => ({ at: 'quiz', id: deck.id, qs: quizOf(deck.cards, 10, reverse), i: 0, picked: null, right: 0, reverse })

/** a practice round: four answers to choose from, the score at the end, and no card moved between boxes */
function Quiz({ deck, view, setView }: { deck: Deck; view: Extract<View, { at: 'quiz' }>; setView: (v: View) => void }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { box.current?.focus({ preventScroll: true }) }, [view.i])
  const q = view.qs[view.i]
  const back = () => setView({ at: 'deck', id: deck.id })
  const pick = (n: number) => { if (view.picked === null && q) setView({ ...view, picked: n, right: view.right + (n === q.answer ? 1 : 0) }) }
  const next = () => setView({ ...view, i: view.i + 1, picked: null })
  const keys = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return
    if (e.key === 'Escape') { e.preventDefault(); back(); return }
    if (!q) return
    if (view.picked === null) { const n = Number(e.key) - 1; if (Number.isInteger(n) && n >= 0 && n < q.choices.length) { e.preventDefault(); pick(n) } }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next() }
  }
  if (!q) {
    const all = view.qs.length
    return (
      <div className="grid justify-items-center gap-3 py-6 text-center">
        <p className="hud">Score</p>
        <p className="text-[15px] text-ink"><b className="fig text-[22px]">{view.right}</b> of {all} right.{view.right === all ? ' Clean sheet.' : ''}</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          <button onClick={() => setView(newQuiz(deck, view.reverse))} className="h-11 bg-signal px-4 text-sm font-semibold text-on-signal">Another round</button>
          <button onClick={back} className={cn(key, 'h-11 px-3 text-[13px]')}>Back to {deck.name}</button>
        </div>
      </div>
    )
  }
  const answered = view.picked !== null
  return (
    <div ref={box} tabIndex={-1} onKeyDown={keys} className="grid gap-2 outline-none" aria-label={`Quiz on ${deck.name}`}>
      <div className="flex items-center gap-2">
        <button onClick={back} aria-label={`Stop and go back to ${deck.name}`} className={cn(key, 'size-11 shrink-0 md:size-9')}><ArrowLeft className="size-4" /></button>
        <p className="fig min-w-0 flex-1 truncate text-[12px] text-ink-2" role="status">{view.i + 1} of {view.qs.length} · {view.right} right</p>
        <button onClick={() => setView(newQuiz(deck, !view.reverse))} title="Start again with the sides swapped" className={cn(key, 'h-11 shrink-0 px-2.5 text-[12px] md:h-9')}>{view.reverse ? 'Front to back' : 'Back to front'}</button>
      </div>
      <div className="h-1 bg-ink/10" aria-hidden><div className="h-full bg-signal" style={{ width: `${(view.i / view.qs.length) * 100}%` }} /></div>
      <div className="flex h-28 min-h-[5rem] flex-col border border-ink/25 p-3 text-center">
        <FitText max={22} min={13} className="grid min-h-full place-content-center font-semibold break-words text-ink">{q.q}</FitText>
      </div>
      <div className="grid gap-1" role="group" aria-label="Answers">
        {q.choices.map((c, n) => {
          const right = answered && n === q.answer
          const wrong = answered && n === view.picked && n !== q.answer
          return (
            <button key={n} onClick={() => pick(n)} aria-disabled={answered} className={cn('flex min-h-11 items-center gap-2 border px-2.5 py-1.5 text-left text-[14px] leading-snug', right ? 'border-ok text-ok' : wrong ? 'border-danger text-danger line-through' : answered ? 'border-ink/15 text-ink-3' : 'border-ink/25 text-ink hover:bg-ink/10')}>
              <span className="fig w-4 shrink-0 text-[11px] text-ink-3">{n + 1}</span>
              <span className="min-w-0 flex-1 break-words">{c}</span>
              {right && <span className="shrink-0 text-[11px] font-semibold">Right</span>}
            </button>
          )
        })}
      </div>
      {answered && <p className="sr-only" aria-live="assertive">{view.picked === q.answer ? 'Right.' : `Wrong. It was ${q.choices[q.answer]}.`}</p>}
      {answered && <button onClick={next} className="h-11 bg-signal text-sm font-semibold text-on-signal">{view.i + 1 < view.qs.length ? 'Next' : 'See the score'}</button>}
    </div>
  )
}
