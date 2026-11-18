/**
 * What the app and api/lb.ts agree on for the daily challenge: which game is on which day, the most each can score, the countries
 * that count in the rarity game and how an answer is scored. `scripts/sync-api.mjs` copies this file to `api/_daily.ts`; edit this one.
 * Days are UTC day numbers, so everyone on Earth plays the same challenge, and the server decides which day it is.
 */
import { LISTS, type Category } from './rarelists'
export type { Category }
export const dayNumber = (t = Date.now()) => Math.floor(t / 86_400_000)
export const GAMES = ['sums', 'reflex', 'rare', 'memory', 'guess'] as const
export type GameId = (typeof GAMES)[number]
export const gameOn = (day: number): GameId => GAMES[((day % GAMES.length) + GAMES.length) % GAMES.length]
/** the most a game can honestly give; the server refuses anything above it */
export const MAXSCORE: Record<GameId, number> = { sums: 1120, reflex: 800, rare: 500, memory: 900, guess: 1000 }
export const RARE_MAX = 5

export const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/** each country with the other names people write for it */
const C: string[][] = [
  ['Afghanistan'], ['Albania'], ['Algeria'], ['Andorra'], ['Angola'], ['Antigua and Barbuda'], ['Argentina'], ['Armenia'], ['Australia'], ['Austria'], ['Azerbaijan'],
  ['Bahamas', 'The Bahamas'], ['Bahrain'], ['Bangladesh'], ['Barbados'], ['Belarus'], ['Belgium'], ['Belize'], ['Benin'], ['Bhutan'], ['Bolivia'], ['Bosnia and Herzegovina', 'Bosnia'], ['Botswana'], ['Brazil'], ['Brunei'], ['Bulgaria'], ['Burkina Faso'], ['Burundi'],
  ['Cabo Verde', 'Cape Verde'], ['Cambodia'], ['Cameroon'], ['Canada'], ['Central African Republic'], ['Chad'], ['Chile'], ['China'], ['Colombia'], ['Comoros'], ['Congo', 'Republic of the Congo'], ['Costa Rica'], ['Croatia'], ['Cuba'], ['Cyprus'], ['Czechia', 'Czech Republic'],
  ['Denmark'], ['Djibouti'], ['Dominica'], ['Dominican Republic'], ['Ecuador'], ['Egypt'], ['El Salvador'], ['Equatorial Guinea'], ['Eritrea'], ['Estonia'], ['Eswatini', 'Swaziland'], ['Ethiopia'],
  ['Fiji'], ['Finland'], ['France'], ['Gabon'], ['Gambia', 'The Gambia'], ['Georgia'], ['Germany'], ['Ghana'], ['Greece'], ['Grenada'], ['Guatemala'], ['Guinea'], ['Guinea-Bissau'], ['Guyana'],
  ['Haiti'], ['Honduras'], ['Hungary'], ['Iceland'], ['India'], ['Indonesia'], ['Iran'], ['Iraq'], ['Ireland'], ['Israel'], ['Italy'], ['Ivory Coast', "Cote d'Ivoire"],
  ['Jamaica'], ['Japan'], ['Jordan'], ['Kazakhstan'], ['Kenya'], ['Kiribati'], ['Kosovo'], ['Kuwait'], ['Kyrgyzstan'],
  ['Laos'], ['Latvia'], ['Lebanon'], ['Lesotho'], ['Liberia'], ['Libya'], ['Liechtenstein'], ['Lithuania'], ['Luxembourg'],
  ['Madagascar'], ['Malawi'], ['Malaysia'], ['Maldives'], ['Mali'], ['Malta'], ['Marshall Islands'], ['Mauritania'], ['Mauritius'], ['Mexico'], ['Micronesia'], ['Moldova'], ['Monaco'], ['Mongolia'], ['Montenegro'], ['Morocco'], ['Mozambique'], ['Myanmar', 'Burma'],
  ['Namibia'], ['Nauru'], ['Nepal'], ['Netherlands', 'Holland'], ['New Zealand'], ['Nicaragua'], ['Niger'], ['Nigeria'], ['North Korea'], ['North Macedonia', 'Macedonia'], ['Norway'], ['Oman'],
  ['Pakistan'], ['Palau'], ['Palestine'], ['Panama'], ['Papua New Guinea'], ['Paraguay'], ['Peru'], ['Philippines'], ['Poland'], ['Portugal'], ['Qatar'], ['Romania'], ['Russia'], ['Rwanda'],
  ['Saint Kitts and Nevis', 'St Kitts and Nevis'], ['Saint Lucia', 'St Lucia'], ['Saint Vincent and the Grenadines', 'St Vincent and the Grenadines'], ['Samoa'], ['San Marino'], ['Sao Tome and Principe'], ['Saudi Arabia'], ['Senegal'], ['Serbia'], ['Seychelles'], ['Sierra Leone'], ['Singapore'], ['Slovakia'], ['Slovenia'], ['Solomon Islands'], ['Somalia'], ['South Africa'], ['South Korea'], ['South Sudan'], ['Spain'], ['Sri Lanka'], ['Sudan'], ['Suriname'], ['Sweden'], ['Switzerland'], ['Syria'],
  ['Taiwan'], ['Tajikistan'], ['Tanzania'], ['Thailand'], ['Timor-Leste', 'East Timor'], ['Togo'], ['Tonga'], ['Trinidad and Tobago'], ['Tunisia'], ['Turkey', 'Turkiye'], ['Turkmenistan'], ['Tuvalu'],
  ['Uganda'], ['Ukraine'], ['United Arab Emirates', 'UAE'], ['United Kingdom', 'UK', 'Britain', 'Great Britain'], ['United States', 'USA', 'United States of America', 'America'], ['Uruguay'], ['Uzbekistan'],
  ['Vanuatu'], ['Vatican City', 'Vatican'], ['Venezuela'], ['Vietnam'], ['Yemen'], ['Zambia'], ['Zimbabwe'],
]
const COUNTRIES = C.map((a) => a.join('|')).join(';')
/** every category, the countries first from the list above; `items` is what counts as an answer */
export const CATEGORIES: Category[] = LISTS.map((c) => (c.id === 'countries' ? { ...c, items: COUNTRIES } : c))
/** the category a day asks about: each time the rarity game comes round (every fifth day) it is the next one in a fixed shuffle, so nothing repeats until all have been asked */
const ORDER = (() => {
  const idx = CATEGORIES.map((_, i) => i)
  let a = 0x9e3779b9
  const next = () => { a = (Math.imul(a ^ (a >>> 15), 0x2c1b3c6d) + 0x7f4a7c15) >>> 0; return a / 4294967296 }
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]] }
  return idx
})()
export const categoryOn = (day: number): Category => CATEGORIES[ORDER[((Math.floor(day / GAMES.length) % ORDER.length) + ORDER.length) % ORDER.length]]
/** like fold, but C++, C# and F# stay different from C and F */
const keyOf = (s: string) => fold(s.replace(/\+\+/g, 'pp').replace(/#/g, 'sharp').replace(/\+/g, 'plus'))
const INDEX = new Map<string, Map<string, string>>()
function indexOf(cat: string): Map<string, string> {
  let m = INDEX.get(cat)
  if (m) return m
  m = new Map()
  for (const entry of CATEGORIES.find((c) => c.id === cat)?.items.split(';') ?? []) {
    const [name, ...alias] = entry.split('|')
    for (const n of [name, ...alias]) { m.set(keyOf(n), name); if (/[a-z]s$/i.test(n)) m.set(keyOf(n) + 'es', name); m.set(keyOf(n) + 's', name) }
  }
  INDEX.set(cat, m)
  return m
}
/** the proper name a typed answer means in this category, or null */
export const answerIn = (cat: string, typed: string): string | null => {
  const m = indexOf(cat)
  const f = keyOf(typed.replace(/^(the|a|an)\s+/i, ''))
  return m.get(f) ?? m.get(f.replace(/s$/, '')) ?? null
}
/** the points one answer is worth: shared with n players, 100 / n, so a name nobody else gave is worth the most */
export const rarePoints = (sharedWith: number) => Math.round(100 / Math.max(1, sharedWith))
/** the proper names a list of typed answers comes to: valid for the category, distinct, at most RARE_MAX */
export function rareAnswers(typed: unknown, cat: string): string[] {
  if (!Array.isArray(typed)) return []
  const out: string[] = []
  for (const t of typed.slice(0, 12)) {
    const c = typeof t === 'string' ? answerIn(cat, t.slice(0, 40)) : null
    if (c && !out.includes(c)) out.push(c)
    if (out.length === RARE_MAX) break
  }
  return out
}
