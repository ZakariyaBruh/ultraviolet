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

/** the shop: fixed prices, no chance involved */
export const SHOP = {
  break: { name: 'Break', price: 25, blurb: `${BREAK_MIN} minutes off, in the middle of a lock-in. The timer waits, leaving the tab is not a drift, and it is recorded as a break.` },
  brick: { name: 'The Golden Brick', price: 5000, blurb: 'It does nothing. You will know it is there.' },
} as const

/** what one restart after a game over costs */
export const CONTINUE_COST = 2
