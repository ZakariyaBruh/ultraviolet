import { itemsOf, useStore } from './store'

/**
 * Supporters (Whop: https://whop.com, product "Support Friction"): a small way to keep Friction free. Whop takes the payment and sends the
 * buyer to /thanks?k=<code> (scripts/legal.mjs), which keeps one flag in this browser (`friction:supporter`). Nothing about the buyer
 * reaches Friction. A supporter gets, free, every unlock in the credit shop and a mark by their name; credits are never sold, and nothing
 * is needed to use the app. The flag is an honour-system pass: it unlocks only cosmetic and convenience items, so it is not worth defending harder.
 */
const KEY = 'friction:supporter'
export const SUPPORT_ONCE = 'https://whop.com/checkout/ch_Hh0666T0uv2kvZq/'
export const SUPPORT_MONTHLY = 'https://whop.com/checkout/ch_p0r3GYyFXF8jqKR/'
/** the shop's unlocks (not the Golden Brick, which is a joke that should be earned) */
export const SUPPORTER_UNLOCKS = ['sound', 'automusic', 'kit', 'solids', 'spinner', 'confetti']

export const isSupporter = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
export const forgetSupporter = () => { try { localStorage.removeItem(KEY) } catch { /* storage blocked */ } }

/** gives a supporter every unlock they do not already have; safe to run on every start */
export function applySupporter() {
  if (!isSupporter()) return
  const have = itemsOf(useStore.getState().credits)
  const owned = Array.from(new Set([...have.owned, ...SUPPORTER_UNLOCKS]))
  if (owned.length === have.owned.length) return
  useStore.setState((s) => ({ credits: { ...s.credits, items: { ...itemsOf(s.credits), owned } } }))
}
