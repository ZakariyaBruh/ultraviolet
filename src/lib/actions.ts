import { useFx, type Notice } from './fx'
import { fetchCategory, type TvCategory } from './iptv'
import { play } from './player'
import { searchStations, stationToMedia } from './radio'

export const fx_say = (n: Omit<Notice, 'id'>) => useFx.getState().say(n)

/** Fetch a themed list, queue it, and start the top entry. */
export async function quickPlay(kind: 'radio' | 'tv', tag: string) {
  if (kind === 'radio') {
    const list = (await searchStations({ tag })).slice(0, 40).map(stationToMedia)
    if (!list.length) throw new Error('empty')
    play(list[0], list)
  } else {
    const list = (await fetchCategory(tag as TvCategory)).slice(0, 60)
    if (!list.length) throw new Error('empty')
    play(list[0], list)
  }
}
