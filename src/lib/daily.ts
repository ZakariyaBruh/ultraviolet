/**
 * The daily challenge, client side. Which game is on today, and its questions, come from the day number alone (a small seeded
 * generator), so everyone gets the same ones. Everything here is a pure function and is tested against known answers.
 */
import { dayNumber, gameOn, type GameId } from './dailyshared'
export { dayNumber, gameOn, type GameId }

export function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))

export const INFO: Record<GameId, { name: string; line: string; rules: string }> = {
  sums: { name: 'Mental maths', line: 'Ten sums, sixty seconds.', rules: 'Type the answer and press Enter. Right answers score 100, and finishing early adds a bonus.' },
  reflex: { name: 'Reaction', line: 'Five taps, as fast as you can.', rules: 'Wait for the screen to change, then tap. Tapping early costs the round. The sooner you tap, the more it scores.' },
  rare: { name: 'Nobody else', line: 'Name five, thirty seconds.', rules: 'Everyone gets the same category. An answer scores 100 divided by the number of players who gave it, so the one nobody else thinks of is worth the most.' },
  memory: { name: 'Recall', line: 'Remember the digits, in order.', rules: 'Digits flash one at a time. Type them back. Each round adds one. The first slip ends it.' },
  guess: { name: 'Ballpark', line: 'Five estimates.', rules: 'Guess each number or year. The nearer you are, the more it scores.' },
}

// ---- sums
export interface Sum { q: string; a: number }
export function sumsOn(day: number): Sum[] {
  const r = rng(day * 11 + 1)
  const out: Sum[] = []
  for (let i = 0; i < 10; i++) {
    const k = pick(r, 0, 3)
    if (k === 0) { const a = pick(r, 12, 98), b = pick(r, 12, 98); out.push({ q: `${a} + ${b}`, a: a + b }) }
    else if (k === 1) { const a = pick(r, 40, 99), b = pick(r, 11, a - 1); out.push({ q: `${a} − ${b}`, a: a - b }) }
    else if (k === 2) { const a = pick(r, 3, 12), b = pick(r, 6, 19); out.push({ q: `${a} × ${b}`, a: a * b }) }
    else { const b = pick(r, 3, 12), a = b * pick(r, 4, 15); out.push({ q: `${a} ÷ ${b}`, a: a / b }) }
  }
  return out
}
export const SUMS_SECONDS = 60
export const scoreSums = (correct: number, answeredAll: boolean, secondsLeft: number) => correct * 100 + (answeredAll ? Math.min(120, Math.max(0, Math.floor(secondsLeft * 2))) : 0)

// ---- reflex
export const reflexDelays = (day: number) => { const r = rng(day * 13 + 2); return [0, 1, 2, 3, 4].map(() => 1200 + Math.floor(r() * 2800)) }
/** 160 points for an instant tap, none at 600 ms or more; a tap before the signal is the full 600 ms */
export const scoreReflex = (ms: number[]) => ms.reduce((t, m) => t + Math.round((Math.max(0, 600 - m) / 600) * 160), 0)

// ---- digit span
export const MEMORY_MAX = 15
export function digitsOn(day: number): number[] { const r = rng(day * 17 + 3); return Array.from({ length: MEMORY_MAX }, () => pick(r, 0, 9)) }
export const scoreMemory = (longest: number) => Math.min(MEMORY_MAX, Math.max(0, longest)) * 60

// ---- estimates
export interface Fact { q: string; a: number; kind: 'num' | 'year'; unit?: string }
const NUMS: Fact[] = [
  { q: 'How many bones are in an adult human body?', a: 206, kind: 'num' },
  { q: 'How many keys does a standard piano have?', a: 88, kind: 'num' },
  { q: 'How fast does light travel in a vacuum, in kilometres a second?', a: 299792, kind: 'num', unit: 'km/s' },
  { q: "How long is the Earth's circumference at the equator, in kilometres?", a: 40075, kind: 'num', unit: 'km' },
  { q: 'How tall is Mount Everest, in metres?', a: 8849, kind: 'num', unit: 'm' },
  { q: 'How far is the Moon from Earth on average, in thousands of kilometres?', a: 384, kind: 'num', unit: 'thousand km' },
  { q: 'How many member states does the United Nations have?', a: 193, kind: 'num' },
  { q: 'How many elements are on the periodic table?', a: 118, kind: 'num' },
  { q: 'At what temperature does water boil at sea level, in degrees Fahrenheit?', a: 212, kind: 'num', unit: '°F' },
  { q: 'How many teeth does a typical adult human have?', a: 32, kind: 'num' },
  { q: 'How many Earth days does Mars take to orbit the Sun?', a: 687, kind: 'num', unit: 'days' },
  { q: 'How long is a marathon, in metres?', a: 42195, kind: 'num', unit: 'm' },
  { q: 'How many chromosomes does a human cell have?', a: 46, kind: 'num' },
]
const YEARS: Fact[] = [
  { q: 'In what year did the Titanic sink?', a: 1912, kind: 'year' },
  { q: 'In what year did the Berlin Wall fall?', a: 1989, kind: 'year' },
  { q: 'In what year did humans first land on the Moon?', a: 1969, kind: 'year' },
  { q: 'In what year did the French Revolution begin?', a: 1789, kind: 'year' },
  { q: 'In what year was the first iPhone released?', a: 2007, kind: 'year' },
  { q: 'In what year did the Second World War end?', a: 1945, kind: 'year' },
  { q: 'In what year was the Great Fire of London?', a: 1666, kind: 'year' },
  { q: "In what year did Columbus first sail west across the Atlantic?", a: 1492, kind: 'year' },
]
export function factsOn(day: number): Fact[] {
  const r = rng(day * 19 + 4)
  const take = <T,>(src: T[], n: number) => { const a = [...src]; const out: T[] = []; while (out.length < n) out.push(a.splice(Math.floor(r() * a.length), 1)[0]); return out }
  const n = take(NUMS, 3), y = take(YEARS, 2)
  return [n[0], y[0], n[1], y[1], n[2]]
}
/** 200 for the right answer; a number loses it as the guess is off by a factor (none at four times too big or small), a year loses it over fifty years */
export function scoreGuess(f: Fact, guess: number): number {
  if (!Number.isFinite(guess) || guess <= 0) return 0
  const off = f.kind === 'year' ? Math.abs(guess - f.a) / 50 : Math.abs(Math.log(guess / f.a)) / Math.log(4)
  return Math.round(200 * Math.max(0, 1 - off))
}

// ---- what this browser has played
const KEY = 'friction:daily'
export interface Played { day: number; score?: number; rank?: number; of?: number }
export const playedToday = (): Played | null => { try { const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Played | null; return p && p.day === dayNumber() ? p : null } catch { return null } }
export const markPlayed = (p: Played) => { try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* storage blocked */ } }
