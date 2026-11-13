import { useFx, type Notice } from './fx'
import { play } from './player'

export const fx_say = (n: Omit<Notice, 'id'>) => useFx.getState().say(n)

/**
 * Fetch a themed list, queue it, and start the top entry. The station and channel lists are fetched when they are first asked for:
 * this module is used on every screen (for `fx_say`), and the lists are about 50 KB that only Radio, TV and the quick picks need.
 */
export async function quickPlay(kind: 'radio' | 'tv', tag: string) {
  if (kind === 'radio') {
    const { searchStations, stationToMedia } = await import('./radio')
    const list = (await searchStations({ tag })).slice(0, 40).map(stationToMedia)
    if (!list.length) throw new Error('empty')
    play(list[0], list)
  } else {
    const { fetchCategory } = await import('./iptv')
    const list = (await fetchCategory(tag as import('./iptv').TvCategory)).slice(0, 60)
    if (!list.length) throw new Error('empty')
    play(list[0], list)
  }
}
