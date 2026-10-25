import { useEffect } from 'react'
import { hasIdentity, identity, loadStanding, saveName, sendName } from './leaders'
import { notify } from './notify'
import { fx_say } from './actions'

const KEY = 'friction:board-seen'
interface Seen { n: number; listed: boolean; rank: number }
const read = (): Seen | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null } }

/** Compares where you stand on the leaderboard with the last time you looked, and says what changed. */
export async function checkBoard() {
  if (!hasIdentity()) return
  const me = await identity()
  const s = await loadStanding(me)
  // keep the public name on the board in step with the alias you chose
  if (s.listed && me.name && s.name !== me.name) {
    const r = await sendName(me, me.name)
    if (r === 'taken' || r === 'reserved' || r === 'invalid') {
      const old = me.name
      saveName(me, '')
      notify('board', `Your alias “${old}” is already taken on the leaderboard. Pick another one.`, 'Pick a new alias')
    }
  }
  if (s.listed && s.name && !me.name) saveName(me, s.name)
  const prev = read()
  if (prev) {
    if (s.n > prev.n) notify('board', `${s.n - prev.n} new recommend${s.n - prev.n === 1 ? '' : 's'} through your link. ${s.n} in total.`, 'Recommends')
    if (!prev.listed && s.listed) { notify('board', `You are on the leaderboard at number ${s.rank}.`, 'On the board'); fx_say({ title: 'You made the leaderboard', description: `Number ${s.rank}.`, variant: 'success' }) }
    else if (prev.listed && !s.listed) notify('board', `You were bumped off the leaderboard. ${s.min} recommends takes a place.`, 'Off the board')
    else if (prev.listed && s.listed && s.rank !== prev.rank) notify('board', s.rank < prev.rank ? `You moved up to number ${s.rank}.` : `You slipped to number ${s.rank}.`, 'Leaderboard')
  }
  try { localStorage.setItem(KEY, JSON.stringify({ n: s.n, listed: s.listed, rank: s.rank })) } catch { /* storage blocked */ }
}

export function useBoardWatch() {
  useEffect(() => {
    const run = () => { if (!document.hidden) void checkBoard().catch(() => undefined) }
    const first = setTimeout(run, 4000)
    const t = setInterval(run, 10 * 60e3)
    document.addEventListener('visibilitychange', run)
    return () => { clearTimeout(first); clearInterval(t); document.removeEventListener('visibilitychange', run) }
  }, [])
}
