import { clear } from 'idb-keyval'
import { useLayout } from './layout'
import { eraseMe } from './leaders'
import { leaveRoom } from './together'

/**
 * Everything that is not the main store, gone with "Erase everything": your seat in any room, your place on the leaderboard
 * (the server forgets the board entry, the alias and the seats), the saved layout, every small note the app keeps, and the
 * cached lessons and demos. Resolves to whether the server confirmed; if it could not be reached the request is kept and
 * repeated the next time the app opens (see `retryErase`).
 */
export async function eraseTheRest(): Promise<boolean> {
  await leaveRoom().catch(() => undefined)
  const server = await eraseMe()
  useLayout.getState().reset()
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('friction:') && k !== 'friction:erase') localStorage.removeItem(k)
  } catch { /* storage blocked */ }
  await clear().catch(() => undefined)
  return server
}
