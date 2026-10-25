import { cached } from './cache'
import { dateKey } from './dates'
import { notify } from './notify'
import { useStore, type Flash, type Learn } from './store'

/* ───────── sources: Wikipedia (articles) and Open Trivia DB (questions). No key, no account, no AI. ───────── */

const WIKI = 'https://en.wikipedia.org/w/api.php'
const q = (o: Record<string, string>) => new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...o }).toString()
const strip = (h: string) => new DOMParser().parseFromString(h, 'text/html').body.textContent ?? ''

export const TOPICS = ['Black hole', 'Stoicism', 'Photosynthesis', 'Roman Empire', 'Cryptography', 'Evolution', 'Game theory', 'Neuroscience', 'Renaissance', 'Quantum mechanics', 'Ancient Egypt', 'Climate change', 'Probability', 'Music theory', 'Industrial Revolution', 'Immune system']

export interface Hit { title: string; about: string }

export async function searchTopics(term: string): Promise<Hit[]> {
  return cached(`learn:s:${term}`, 3600e3, async () => {
    const res = await fetch(`${WIKI}?${q({ action: 'query', list: 'search', srsearch: term, srlimit: '18', srnamespace: '0' })}`)
    if (!res.ok) throw new Error('search')
    const d = (await res.json()) as { query?: { search?: { title: string; snippet: string }[] } }
    return (d.query?.search ?? []).map((r) => ({ title: r.title, about: strip(r.snippet).replace(/\s+/g, ' ').trim() }))
  })
}

export async function randomTopic(): Promise<string> {
  const res = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary')
  if (!res.ok) throw new Error('random')
  return ((await res.json()) as { title: string }).title
}

/* ───────── turning an article into a lesson, by rules ───────── */

export interface Idea { heading: string; text: string }
export interface Lesson { title: string; url: string; thumb?: string; ideas: Idea[] }

const SKIP = /^(see also|references|external links|further reading|notes|bibliography|sources|citations|footnotes|gallery|explanatory notes|works cited)$/i
const clean = (t: string) => t.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/\s+([,.;:!?])/g, '$1').replace(/\s+/g, ' ').trim()
const ABBR = /(?:\b[A-Z]|\b(?:Mr|Mrs|Ms|Dr|St|vs|etc|ca|c|Jr|Sr|No|Inc|Ltd|Co|Prof|Mt|Fig)|\be\.g|\bi\.e|\bU\.S|\bU\.K)\.$/
export function sentences(t: string): string[] {
  const raw = t.split(/(?<=[.!?])\s+(?=[A-Z0-9"“‘'])/)
  const out: string[] = []
  for (const p of raw) {
    if (out.length && ABBR.test(out[out.length - 1])) out[out.length - 1] += ' ' + p
    else out.push(p)
  }
  return out
}
const brief = (para: string) => {
  const s = sentences(clean(para))
  let out = ''
  for (const x of s) {
    if ((out + ' ' + x).trim().length > 300 && out) break
    out = (out + ' ' + x).trim()
    if (out.length > 150) break
  }
  return out
}

export async function loadLesson(title: string): Promise<Lesson> {
  return cached(`learn:l:${title}`, 24 * 3600e3, async () => {
    const res = await fetch(`${WIKI}?${q({ action: 'query', prop: 'extracts|pageimages', explaintext: '1', exsectionformat: 'wiki', piprop: 'thumbnail', pithumbsize: '500', titles: title, redirects: '1' })}`)
    if (!res.ok) throw new Error('lesson')
    const d = (await res.json()) as { query?: { pages?: { title: string; extract?: string; thumbnail?: { source: string } }[] } }
    const page = d.query?.pages?.[0]
    if (!page?.extract) throw new Error('lesson')
    const chunks = page.extract.split(/\n\s*==+ *([^=\n]+?) *==+ *\n/)
    const ideas: Idea[] = []
    const paras = (s: string) => s.split(/\n+/).map((x) => x.trim()).filter((x) => x.length >= 90)
    paras(chunks[0]).slice(0, 3).forEach((p, i) => { const t = brief(p); if (t) ideas.push({ heading: i === 0 ? 'The short version' : 'Going further', text: t }) })
    for (let i = 1; i + 1 < chunks.length && ideas.length < 10; i += 2) {
      const heading = chunks[i].trim()
      if (SKIP.test(heading)) continue
      const p = paras(chunks[i + 1])[0]
      const t = p && brief(p)
      if (t && t.length > 70) ideas.push({ heading, text: t })
    }
    if (ideas.length < 2) throw new Error('lesson')
    return { title: page.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`, thumb: page.thumbnail?.source, ideas }
  })
}

/* ───────── questions, made from the lesson's own sentences ───────── */

export type Step =
  | { kind: 'idea'; i: number }
  | { kind: 'check'; prompt: string; options: string[]; answer: number; explain: string; idea: number }
  | { kind: 'order'; a: string; b: string; first: 0 | 1; explain: string }
  | { kind: 'end' }

const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }
const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const shuffle = <T,>(a: T[], r: () => number) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }

const YEAR = /\b(1[0-9]{3}|20[0-4][0-9]|[5-9][0-9]{2})\b/
const NAME = /(?<=[a-z,;] )((?:[A-Z][\p{L}'’-]+)(?: (?:of|the|de|von|van|and) [A-Z][\p{L}'’-]+| [A-Z][\p{L}'’-]+){0,2})/gu
const NOT = new Set(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'The', 'This', 'These', 'English', 'He', 'She', 'It', 'They'])
const names = (s: string) => (s.match(NAME) ?? []).filter((n) => !NOT.has(n) && n.length > 3)

export function buildSteps(lesson: Lesson): Step[] {
  const r = rng(hash(lesson.title))
  const sents = lesson.ideas.map((x) => sentences(x.text).filter((s) => s.length >= 50 && s.length <= 240))
  const pool = Array.from(new Set(sents.flat().flatMap(names)))
  const checks: (Step | null)[] = lesson.ideas.map((_, idea) => {
    for (const s of sents[idea]) {
      const y = s.match(YEAR)
      if (y) {
        const yr = Number(y[1])
        const wrong = Array.from(new Set([7, 13, 21, 34, 55].map((d) => (r() < 0.5 ? yr - d : yr + d)).filter((v) => v > 99 && v !== yr && v < 2050))).slice(0, 3)
        if (wrong.length === 3) {
          const options = shuffle([String(yr), ...wrong.map(String)], r)
          return { kind: 'check', prompt: s.replace(y[1], '_____'), options, answer: options.indexOf(String(yr)), explain: s, idea }
        }
      }
      for (const n of names(s)) {
        const wrong = shuffle(pool.filter((p) => p !== n && !s.includes(p) && !n.includes(p) && !p.includes(n)), r)
        const same = wrong.filter((p) => p.split(' ').length === n.split(' ').length)
        const pick = (same.length >= 3 ? same : wrong).slice(0, 3)
        if (pick.length === 3) {
          const options = shuffle([n, ...pick], r)
          return { kind: 'check', prompt: s.replace(n, '_____'), options, answer: options.indexOf(n), explain: s, idea }
        }
      }
    }
    return null
  })
  const steps: Step[] = []
  lesson.ideas.forEach((_, i) => {
    steps.push({ kind: 'idea', i })
    // a check after every second idea (and at the end), asking about one of the two just read
    if (i % 2 === 1 || i === lesson.ideas.length - 1) {
      const c = checks[i] ?? (i % 2 === 1 ? checks[i - 1] : null)
      if (c) steps.push(c)
    }
  })
  const dated = sents.map((ss, i) => { const s = ss.find((x) => YEAR.test(x)); return s ? { s, y: Number(s.match(YEAR)![1]), i } : null }).filter((x): x is { s: string; y: number; i: number } => !!x)
  for (let a = 0; a < dated.length; a++) for (let b = a + 1; b < dated.length; b++) {
    if (Math.abs(dated[a].y - dated[b].y) >= 8 && !steps.some((s) => s.kind === 'order')) {
      const flip = r() < 0.5
      const [A, B] = flip ? [dated[b], dated[a]] : [dated[a], dated[b]]
      steps.push({ kind: 'order', a: A.s, b: B.s, first: A.y < B.y ? 0 : 1, explain: `${A.y < B.y ? A.y : B.y} came before ${A.y < B.y ? B.y : A.y}.` })
    }
  }
  steps.push({ kind: 'end' })
  return steps
}

/* ───────── trivia ───────── */

export interface Trivia { prompt: string; options: string[]; answer: number; category: string; difficulty: string }
export async function triviaCategories(): Promise<{ id: number; name: string }[]> {
  return cached('learn:cats', 7 * 24 * 3600e3, async () => {
    const res = await fetch('https://opentdb.com/api_category.php')
    if (!res.ok) throw new Error('cats')
    return ((await res.json()) as { trivia_categories: { id: number; name: string }[] }).trivia_categories
  })
}
export async function fetchTrivia(cat: number | null, diff: string): Promise<Trivia[]> {
  const url = `https://opentdb.com/api.php?amount=10&type=multiple${cat ? `&category=${cat}` : ''}${diff !== 'any' ? `&difficulty=${diff}` : ''}`
  const res = await fetch(url)
  if (res.status === 429) throw new Error('slow')
  const d = (await res.json()) as { response_code: number; results: { question: string; correct_answer: string; incorrect_answers: string[]; category: string; difficulty: string }[] }
  if (d.response_code === 5) throw new Error('slow')
  if (!d.results?.length) throw new Error('none')
  const r = rng(Date.now())
  return d.results.map((x) => {
    const options = shuffle([x.correct_answer, ...x.incorrect_answers].map(strip), r)
    return { prompt: strip(x.question), options, answer: options.indexOf(strip(x.correct_answer)), category: strip(x.category), difficulty: x.difficulty }
  })
}

/* ───────── progress, kept in this browser ───────── */

const DAY = 86400e3
const BOX = [0, 1, 3, 7, 21].map((d) => d * DAY)
const norm = (l?: Partial<Learn>): Learn => ({ xp: Number(l?.xp) || 0, days: Array.isArray(l?.days) ? l!.days.filter((x) => typeof x === 'string') : [], done: l?.done && typeof l.done === 'object' ? l.done : {}, deck: Array.isArray(l?.deck) ? l!.deck.filter((c) => c && typeof c.id === 'string' && typeof c.front === 'string') : [] })
export const learnOf = (): Learn => norm(useStore.getState().learn)
const put = (fn: (l: Learn) => Learn) => useStore.getState().setLearn(fn(learnOf()))

const XP_MARKS = [100, 250, 500, 1000, 2500, 5000]
export const earn = (xp: number) => {
  const before = learnOf().xp
  put((l) => ({ ...l, xp: l.xp + xp, days: Array.from(new Set([...l.days, dateKey()])).slice(-400) }))
  const hit = XP_MARKS.find((m) => before < m && before + xp >= m)
  if (hit) notify('learn', `${hit} XP in Learn.`, 'Learning')
}
export const finishLesson = (title: string, score: number, total: number) => {
  notify('learn', `Finished “${title}”${total ? `: ${score} of ${total} checks right` : ''}.`, 'Lesson complete')
  finishLessonSave(title, score, total)
}
const finishLessonSave = (title: string, score: number, total: number) => put((l) => ({ ...l, done: { ...l.done, [title]: { at: Date.now(), score, total } } }))
export const addCards = (cards: { id: string; front: string; back: string }[]) => put((l) => {
  const have = new Set(l.deck.map((c) => c.id))
  return { ...l, deck: [...cards.filter((c) => !have.has(c.id)).map((c): Flash => ({ ...c, box: 0, due: Date.now() })), ...l.deck].slice(0, 300) }
})
export const gradeCard = (id: string, good: boolean) => put((l) => ({ ...l, deck: l.deck.map((c) => (c.id === id ? { ...c, box: good ? Math.min(4, c.box + 1) : 0, due: Date.now() + (good ? BOX[Math.min(4, c.box + 1)] : 10 * 60e3) } : c)) }))
export const dropCard = (id: string) => put((l) => ({ ...l, deck: l.deck.filter((c) => c.id !== id) }))

export function streakOf(days: string[]): number {
  const set = new Set(days)
  let n = 0
  const d = new Date()
  if (!set.has(dateKey(d))) d.setDate(d.getDate() - 1)
  while (set.has(dateKey(d))) { n++; d.setDate(d.getDate() - 1) }
  return n
}
