import { useEffect, useState } from 'react'

/** The Break kit: a breathing guide and a deck of small stretches, shown on the timer while you are on a break. */
const PHASES = [['Breathe in', 4], ['Hold', 4], ['Breathe out', 4], ['Hold', 4]] as const

export const STRETCHES = [
  'Look at something far away for twenty seconds.',
  'Roll your shoulders back, slowly, ten times.',
  'Tilt your head toward each shoulder. Do not force it.',
  'Open and close your hands, then circle your wrists.',
  'Stand up. Walk to a window, or to some water.',
  'Unclench your jaw and let your shoulders drop.',
  'Reach both arms up, then fold forward and hang.',
]

/** one second at a time round a four-count box: in, hold, out, hold */
export function useBreath() {
  const [t, setT] = useState(0)
  useEffect(() => { const id = setInterval(() => setT((x) => x + 1), 1000); return () => clearInterval(id) }, [])
  const k = t % 16
  const p = Math.floor(k / 4)
  return { label: PHASES[p][0], left: 4 - (k % 4), phase: p }
}

/** a card from the deck, a new one every so often and whenever you ask */
export function useStretch() {
  const [i, setI] = useState(0)
  useEffect(() => { const id = setInterval(() => setI((x) => (x + 1) % STRETCHES.length), 40e3); return () => clearInterval(id) }, [i])
  return { text: STRETCHES[i], next: () => setI((x) => (x + 1) % STRETCHES.length) }
}
