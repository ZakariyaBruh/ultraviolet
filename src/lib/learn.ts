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
  | { kind: 'tf'; statement: string; truth: boolean; explain: string; idea: number }
  | { kind: 'type'; prompt: string; answer: string; explain: string; idea: number }
  | { kind: 'estimate'; prompt: string; value: number; unit: string; year: boolean; lo: number; hi: number; log: boolean; tol: number; explain: string; idea: number }
  | { kind: 'sequence'; items: { text: string; year: number }[]; explain: string }
  | { kind: 'match'; pairs: { left: string; right: string }[]; explain: string }
  | { kind: 'build'; chunks: string[]; explain: string }
  | { kind: 'timeline'; events: { year: number; text: string }[] }
  | { kind: 'demo'; id: string }
  | { kind: 'end' }

/** the kinds that are marked right or wrong (the rest are things to play with) */
export const SCORED = new Set<Step['kind']>(['check', 'tf', 'type', 'estimate', 'sequence', 'match', 'build'])

/** a sentence with its year hidden, so ordering it takes knowing the history, not reading the date */
export const hideYear = (t: string) => t.replace(YEAR, '____')
export const yearIn = (t: string) => Number(t.match(YEAR)?.[1])

const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }
const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const shuffle = <T,>(a: T[], r: () => number) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }

const YEAR = /\b(1[0-9]{3}|20[0-4][0-9]|[5-9][0-9]{2})\b(?!\s?(?:BC|BCE|years|percent|%))/
const NAME = /(?<=[a-z,;] )((?:[A-Z][\p{L}'’-]+)(?: (?:of|the|de|von|van|and) [A-Z][\p{L}'’-]+| [A-Z][\p{L}'’-]+){0,2})/gu
const NOT = new Set(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'The', 'This', 'These', 'That', 'Those', 'There', 'Their', 'Some', 'Many', 'Most', 'However', 'English', 'European', 'American', 'British', 'French', 'German', 'Greek', 'Latin', 'Roman', 'Chinese', 'Indian', 'Arabic', 'Christian', 'Islamic', 'Western', 'Eastern', 'Northern', 'Southern', 'Common', 'Modern', 'Early', 'Late'])
const names = (s: string) => (s.match(NAME) ?? []).filter((n) => !NOT.has(n) && n.length > 3)

/** numbers with a unit or a comma group: the ones worth guessing */
const NUM = /\b(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?![\d,]|\s?(?:BC|BCE)\b)(?:\s?(million|billion|trillion|thousand|percent|per cent|%|kilometres|kilometers|km|miles|metres|meters|tonnes|years|days|degrees))?/gi
interface Num { raw: string; n: number; unit: string; year: boolean }
const numbers = (s: string): Num[] => {
  const out: Num[] = []
  for (const m of s.matchAll(NUM)) {
    const n = Number(m[1].replace(/,/g, ''))
    const unit = (m[2] ?? '').toLowerCase().replace('per cent', 'percent').replace('%', 'percent').replace('kilometres', 'km').replace('kilometers', 'km').replace('meters', 'metres')
    if (!isFinite(n)) continue
    const year = !unit && Number.isInteger(n) && n >= 500 && n <= 2049
    if (!year && !unit && n < 1000) continue
    if (!year && n < 2) continue
    out.push({ raw: m[0], n, unit, year })
  }
  return out
}
const niceMax = (v: number) => { const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p }

const normAns = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
const lev = (a: string, b: string) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length] }
/** is what was typed close enough: the whole answer, its last word, or one slip away */
export function sameAnswer(typed: string, answer: string) {
  const t = normAns(typed), a = normAns(answer)
  if (!t) return false
  if (t === a) return true
  const last = a.split(' ').pop() ?? ''
  if (last.length >= 4 && t === last) return true
  return a.length >= 6 && lev(t, a) <= 1
}

export function buildSteps(lesson: Lesson, demo?: string | null): Step[] {
  const r = rng(hash(lesson.title))
  const sents = lesson.ideas.map((x) => sentences(x.text).filter((s) => s.length >= 50 && s.length <= 240))
  const pool = Array.from(new Set(sents.flat().flatMap(names)))
  const yearsPool = Array.from(new Set(sents.flat().map((s) => s.match(YEAR)?.[1]).filter((y): y is string => !!y))).map(Number)

  const fillGap = (idea: number): Step | null => {
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
  }
  const trueFalse = (idea: number): Step | null => {
    for (const s of sents[idea]) {
      const lie = r() < 0.5
      if (!lie) return { kind: 'tf', statement: s, truth: true, explain: s, idea }
      const y = s.match(YEAR)
      if (y) { const yr = Number(y[1]); const alt = shuffle(yearsPool.filter((v) => Math.abs(v - yr) >= 6), r)[0] ?? yr + 23; return { kind: 'tf', statement: s.replace(y[1], String(alt)), truth: false, explain: `${s}`, idea } }
      for (const n of names(s)) { const alt = shuffle(pool.filter((p) => p !== n && !s.includes(p) && !p.includes(n) && !n.includes(p)), r)[0]; if (alt) return { kind: 'tf', statement: s.replace(n, alt), truth: false, explain: s, idea } }
      const nm = numbers(s).find((x) => !x.year)
      if (nm) { const alt = nm.raw.replace(/[\d,.]+/, (d) => { const v = Number(d.replace(/,/g, '')); const f = r() < 0.5 ? 2.5 : 0.4; const w = Math.max(1, Math.round(v * f)); return w === v ? String(w + 3) : w.toLocaleString('en-US') }); return { kind: 'tf', statement: s.replace(nm.raw, alt), truth: false, explain: s, idea } }
      return { kind: 'tf', statement: s, truth: true, explain: s, idea }
    }
    return null
  }
  const typeIt = (idea: number): Step | null => {
    for (const s of sents[idea]) {
      const n = names(s).find((x) => x.split(' ').length <= 2 && x.length <= 20)
      if (n && s.split(' ').length >= 8) return { kind: 'type', prompt: s.replace(n, '_____'), answer: n, explain: s, idea }
    }
    return null
  }
  const estimate = (idea: number): Step | null => {
    for (const s of sents[idea]) {
      const nm = numbers(s).sort((a, b) => Number(!!b.unit) - Number(!!a.unit))[0]
      if (!nm) continue
      const prompt = s.replace(nm.raw, nm.year ? '_____' : nm.unit && nm.unit !== 'percent' ? `_____ ${nm.unit}` : '_____' + (nm.unit === 'percent' ? ' percent' : ''))
      if (nm.year) return { kind: 'estimate', prompt, value: nm.n, unit: '', year: true, lo: nm.n - 150, hi: nm.n + 150, log: false, tol: 10, explain: s, idea }
      if (nm.unit === 'percent') return { kind: 'estimate', prompt, value: nm.n, unit: 'percent', year: false, lo: 0, hi: 100, log: false, tol: 8, explain: s, idea }
      if (nm.n >= 1000) return { kind: 'estimate', prompt, value: nm.n, unit: nm.unit, year: false, lo: nm.n / 30, hi: nm.n * 30, log: true, tol: 0.25, explain: s, idea }
      return { kind: 'estimate', prompt, value: nm.n, unit: nm.unit, year: false, lo: 0, hi: niceMax(nm.n * 2), log: false, tol: nm.n * 0.2, explain: s, idea }
    }
    return null
  }

  // one check after every second idea, rotating the format, falling back to what the sentences allow
  const ROT = ['check', 'tf', 'type', 'estimate'] as const
  const makers = { check: fillGap, tf: trueFalse, type: typeIt, estimate } as const
  let turn = 0
  const steps: Step[] = []
  let demoAt = -1
  lesson.ideas.forEach((_, i) => {
    steps.push({ kind: 'idea', i })
    if (demo && demoAt < 0 && i === 1) { steps.push({ kind: 'demo', id: demo }); demoAt = steps.length - 1 }
    if (i % 2 === 1 || i === lesson.ideas.length - 1) {
      for (let k = 0; k < ROT.length; k++) {
        const want = ROT[(turn + k) % ROT.length]
        const c = makers[want](i) ?? (i % 2 === 1 ? makers[want](i - 1) : null)
        if (c) { steps.push(c); turn += k + 1; break }
      }
    }
  })
  // things built from the whole lesson
  const dated = sents.map((ss, i) => { const s = ss.filter((x) => YEAR.test(x) && x.length <= 210).sort((a, b) => a.length - b.length)[0]; return s ? { s, y: Number(s.match(YEAR)![1]), i } : null }).filter((x): x is { s: string; y: number; i: number } => !!x)
  const spread = dated.filter((d, i) => dated.findIndex((e) => Math.abs(e.y - d.y) < 8) === i)
  if (spread.length >= 3) {
    const keep = spread.length > 7 ? Array.from({ length: 7 }, (_, k) => [...spread].sort((a, b) => a.y - b.y)[Math.round((k * (spread.length - 1)) / 6)]) : [...spread].sort((a, b) => a.y - b.y)
    steps.push({ kind: 'timeline', events: keep.map((d) => ({ year: d.y, text: d.s })) })
  }
  if (spread.length >= 2) {
    const picks = shuffle(spread, r).slice(0, 4).sort((a, b) => a.y - b.y)
    steps.push({ kind: 'sequence', items: picks.map((d) => ({ text: d.s, year: d.y })), explain: picks.map((d) => d.y).join(', then ') + '.' })
  }
  const blank = (text: string, heading: string) => { const words = heading.split(/[\s-]+/).filter((w) => w.length >= 5).map((w) => w.replace(/[^\p{L}]/gu, '')); return words.length ? text.replace(new RegExp(`\\b(${words.join('|')})\\w*`, 'gi'), '_____') : text }
  const heads = lesson.ideas.map((x, i) => ({ left: x.heading, right: blank(sentences(x.text)[0] ?? x.text, x.heading), i })).filter((x) => x.left !== 'The short version' && x.left !== 'Going further' && x.right.length >= 40)
  const uniq = heads.filter((h, i) => heads.findIndex((o) => o.left === h.left) === i)
  if (uniq.length >= 4) { const pick = shuffle(uniq, r).slice(0, 4); steps.push({ kind: 'match', pairs: pick.map((p) => ({ left: p.left, right: p.right.length > 110 ? p.right.slice(0, 107).replace(/\s+\S*$/, '') + '…' : p.right })), explain: 'Each section starts with the sentence it was matched to.' }) }
  const short = shuffle(sents.flat().filter((s) => { const w = s.split(' ').length; return w >= 8 && w <= 16 }), r)[0]
  if (short) {
    const words = short.replace(/[.!?]+$/, '').split(' ')
    const size = words.length > 12 ? 3 : 2
    const chunks: string[] = []
    for (let i = 0; i < words.length; i += size) chunks.push(words.slice(i, i + size).join(' '))
    if (chunks.length >= 4 && chunks.length <= 8) steps.push({ kind: 'build', chunks, explain: short })
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
