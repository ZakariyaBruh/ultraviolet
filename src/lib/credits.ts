/**
 * How credits are earned. A minute of focus pays 1 credit; the longer you stay clean (no drifts, no wandering off) the
 * more each minute pays, and a drift sends you back to the first tier. The totals stay honest: this only reads what the
 * focus engine already counted.
 */
export const TIERS: { from: number; rate: number }[] = [
  { from: 0, rate: 1 },
  { from: 10 * 60, rate: 1.5 },
  { from: 20 * 60, rate: 2 },
  { from: 35 * 60, rate: 3 },
  { from: 60 * 60, rate: 4 },
]

/** credits per minute after `cleanSec` seconds without a drift */
export const rateAt = (cleanSec: number) => [...TIERS].reverse().find((t) => cleanSec >= t.from)!.rate

/** the next tier up and how long until it, or null at the top */
export const nextTier = (cleanSec: number) => {
  const n = TIERS.find((t) => t.from > cleanSec)
  return n ? { rate: n.rate, inSec: n.from - cleanSec } : null
}

/** a finished session pays 5, and 5 more if you never drifted */
export const finishBonus = (lapses: number) => 5 + (lapses === 0 ? 5 : 0)

/** a lesson pays for finishing it and for every check you got right, with a bonus for a clean sheet */
export const lessonCredits = (right: number, checks: number) => 3 + right + (checks > 0 && right === checks ? 4 : 0)

/** trivia pays for each answer past the fourth, with a bonus for a perfect round */
export const triviaCredits = (right: number, total: number) => Math.max(0, right - 4) + (total > 0 && right === total ? 3 : 0)

/** a paid break pauses the session this long */
export const BREAK_MIN = 5
export const LONG_BREAK_MIN = 12
export const LIFELINES_PER_PACK = 5
export const CAPSULE_MAX = 240

export type ItemId = 'break' | 'longbreak' | 'shield' | 'lifeline' | 'capsule' | 'sound' | 'automusic' | 'kit' | 'solids' | 'spinner' | 'confetti' | 'brick'
export interface ShopItem {
  id: ItemId
  name: string
  price: number
  /** `use` items are spent as you go; `unlock` items are bought once and kept */
  kind: 'use' | 'unlock'
  tag: string
  blurb: string
}

/** the shop: fixed prices, no chance involved */
export const SHOP: Record<ItemId, ShopItem> = {
  break: { id: 'break', name: 'Break', price: 25, kind: 'use', tag: 'Focus', blurb: `${BREAK_MIN} minutes off, mid lock-in. The timer waits and leaving the tab is not a drift.` },
  longbreak: { id: 'longbreak', name: 'Long break', price: 45, kind: 'use', tag: 'Focus', blurb: `Like a break, but ${LONG_BREAK_MIN} minutes. For when you really need to walk away.` },
  shield: { id: 'shield', name: 'Streak shield', price: 40, kind: 'use', tag: 'Focus', blurb: 'Your next drift keeps your clean streak alive. It is still counted as a drift.' },
  lifeline: { id: 'lifeline', name: '50:50 lifelines', price: 20, kind: 'use', tag: 'Learn', blurb: `A pack of ${LIFELINES_PER_PACK}. In a lesson check or trivia question, remove two wrong answers.` },
  capsule: { id: 'capsule', name: 'Time capsule', price: 20, kind: 'use', tag: 'Focus', blurb: 'Write a note to yourself. It opens after your next finished session.' },
  sound: { id: 'sound', name: 'Sound machine', price: 120, kind: 'unlock', tag: 'Focus', blurb: 'Rain, wind, fire, waves and a low hum, made on the spot and mixed by you.' },
  automusic: { id: 'automusic', name: 'Auto music', price: 80, kind: 'unlock', tag: 'Focus', blurb: 'Music made on the spot: Calm, Focus, Night or Retro, different every session, quiet while a song or station plays.' },
  kit: { id: 'kit', name: 'Break kit', price: 60, kind: 'unlock', tag: 'Focus', blurb: 'A breathing guide and a deck of stretches on the timer during a break.' },
  solids: { id: 'solids', name: 'Solids pack', price: 90, kind: 'unlock', tag: 'Look', blurb: 'Choose what turns in the timer: globe, cube, knot, helix or pyramid.' },
  spinner: { id: 'spinner', name: 'Fidget spinner', price: 30, kind: 'unlock', tag: 'Toy', blurb: 'Flick it and watch it go. It counts every turn, forever.' },
  confetti: { id: 'confetti', name: 'Confetti cannon', price: 12, kind: 'unlock', tag: 'Toy', blurb: 'A rocket and a lot of confetti, on demand. No reason needed.' },
  brick: { id: 'brick', name: 'The Golden Brick', price: 5000, kind: 'unlock', tag: 'Toy', blurb: 'It does nothing. You will know it is there.' },
}
export const SHOP_ORDER: ItemId[] = ['break', 'longbreak', 'shield', 'lifeline', 'capsule', 'sound', 'automusic', 'kit', 'solids', 'spinner', 'confetti', 'brick']

/** what one restart after a game over costs */
export const CONTINUE_COST = 2
