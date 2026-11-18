/**
 * Flashcards: decks you write, learnt by spaced repetition in boxes (Leitner). A card you know moves up a box and comes back later
 * (1, 2, 4, 8, 16, 32, then 64 days); one you miss goes back to the first box and comes round again in this sitting. Pure functions,
 * so the schedule can be tested against known answers. Kept in `store.widgets.decks`, erased with everything else.
 */
export interface Card { id: string; f: string; b: string; box: number; due: number; seen?: number }
export interface Deck { id: string; name: string; cards: Card[] }
export type Grade = 'again' | 'good' | 'easy'

export const DECKS_MAX = 24
export const CARDS_MAX = 1000 // across all decks
export const SIDE_MAX = 400
export const NAME_MAX = 40
/** days until a card in each box comes back */
export const GAPS = [0, 1, 2, 4, 8, 16, 32, 64]
const AGAIN_MS = 60_000

/** local midnight `days` after the day of `now` (DST-safe: built from the calendar, not by adding hours) */
export function dayAfter(now: number, days: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

export function grade(c: Card, g: Grade, now: number): Card {
  const seen = (c.seen ?? 0) + 1
  if (g === 'again') return { ...c, box: 0, due: now + AGAIN_MS, seen }
  const box = Math.min(GAPS.length - 1, Math.max(1, c.box + (g === 'easy' ? 2 : 1)))
  return { ...c, box, due: dayAfter(now, GAPS[box]), seen }
}

/** what a grade would do, in words for the button ("1 min", "2 days") */
export function after(c: Card, g: Grade): string {
  if (g === 'again') return '1 min'
  const box = Math.min(GAPS.length - 1, Math.max(1, c.box + (g === 'easy' ? 2 : 1)))
  const d = GAPS[box]
  return d === 1 ? '1 day' : `${d} days`
}

export const isDue = (c: Card, now: number) => c.due <= now
export const dueIn = (d: Deck, now: number) => d.cards.filter((c) => isDue(c, now)).length

/** the cards to go through now: missed and new ones first, then by when they fell due */
export function queueOf(cards: Card[], now: number, all = false): string[] {
  return cards.filter((c) => all || isDue(c, now)).sort((a, b) => a.box - b.box || a.due - b.due).slice(0, 200).map((c) => c.id)
}

/** when the next card in a deck comes back, in plain words */
export function nextDue(d: Deck, now: number): string {
  const later = d.cards.filter((c) => !isDue(c, now)).map((c) => c.due)
  if (!later.length) return ''
  const t = Math.min(...later)
  const days = Math.round((dayAfter(t, 0) - dayAfter(now, 0)) / 864e5)
  if (days <= 0) return `at ${new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  return days === 1 ? 'tomorrow' : `in ${days} days`
}

/** One card a line: front, then a tab (Quizlet and Anki export this way), " | ", " :: ", " - ", ";" or ",", then back. */
export function parseCards(text: string): { f: string; b: string }[] {
  const out: { f: string; b: string }[] = []
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim()
    if (!l) continue
    for (const sep of ['\t', ' | ', ' :: ', ' - ', ' – ', ';', ',']) {
      const i = l.indexOf(sep)
      if (i > 0) {
        const f = l.slice(0, i).trim().slice(0, SIDE_MAX), b = l.slice(i + sep.length).trim().slice(0, SIDE_MAX)
        if (f && b) out.push({ f, b })
        break
      }
    }
  }
  return out
}
export const exportCards = (d: Deck) => d.cards.map((c) => `${c.f.replace(/[\t\n]+/g, ' ')}\t${c.b.replace(/[\t\n]+/g, ' ')}`).join('\n') + '\n'

let n = 0
export const newId = () => `${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`
/**
 * A practice round of multiple choice: a card's front, with its back among up to three other backs from the same deck (or the
 * other way round). It moves no card between boxes: the boxes are for Study.
 */
export interface Question { id: string; q: string; choices: string[]; answer: number }
const shuffle = <T,>(a: T[], rand: () => number) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
export function quizOf(cards: Card[], n = 10, reverse = false, rand: () => number = Math.random): Question[] {
  const ask = (c: Card) => (reverse ? c.b : c.f).trim()
  const ans = (c: Card) => (reverse ? c.f : c.b).trim()
  const pool = [...new Set(cards.map(ans))]
  if (pool.length < 2) return []
  return shuffle(cards.slice(), rand).slice(0, n).map((c) => {
    const right = ans(c)
    // another card with the same question would make its answer right as well, so it is never offered as a wrong one
    const alsoRight = new Set(cards.filter((o) => ask(o) === ask(c)).map(ans))
    const choices = shuffle([right, ...shuffle(pool.filter((x) => !alsoRight.has(x)), rand).slice(0, 3)], rand)
    return { id: c.id, q: ask(c), choices, answer: choices.indexOf(right) }
  })
}
export const total = (decks: Deck[]) => decks.reduce((s, d) => s + d.cards.length, 0)
export const makeCard = (f: string, b: string, now: number): Card => ({ id: newId(), f: f.trim().slice(0, SIDE_MAX), b: b.trim().slice(0, SIDE_MAX), box: 0, due: now })

/** a saved list read back safely: right shapes, sane lengths, the limits kept */
export function sanitizeDecks(v: unknown): Deck[] | undefined {
  if (!Array.isArray(v)) return undefined
  let left = CARDS_MAX
  const decks: Deck[] = []
  for (const d of v.slice(0, DECKS_MAX)) {
    if (!d || typeof d !== 'object') continue
    const o = d as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.name !== 'string' || !Array.isArray(o.cards)) continue
    const cards: Card[] = []
    for (const c of o.cards) {
      if (left <= 0) break
      if (!c || typeof c !== 'object') continue
      const x = c as Record<string, unknown>
      if (typeof x.id !== 'string' || typeof x.f !== 'string' || typeof x.b !== 'string') continue
      const box = typeof x.box === 'number' && isFinite(x.box) ? Math.max(0, Math.min(GAPS.length - 1, Math.round(x.box))) : 0
      const due = typeof x.due === 'number' && isFinite(x.due) ? x.due : 0
      cards.push({ id: x.id.slice(0, 24), f: x.f.slice(0, SIDE_MAX), b: x.b.slice(0, SIDE_MAX), box, due, ...(typeof x.seen === 'number' && isFinite(x.seen) ? { seen: Math.max(0, Math.round(x.seen)) } : {}) })
      left--
    }
    decks.push({ id: o.id.slice(0, 24), name: o.name.slice(0, NAME_MAX) || 'Deck', cards })
  }
  return decks
}

/** a small deck to try it with: true facts, nothing made up */
export const SAMPLE: { name: string; cards: [string, string][] } = {
  name: 'Capitals',
  cards: [['France', 'Paris'], ['Japan', 'Tokyo'], ['Kenya', 'Nairobi'], ['Canada', 'Ottawa'], ['Australia', 'Canberra'], ['Brazil', 'Brasília'], ['Egypt', 'Cairo'], ['Norway', 'Oslo']],
}
