import { clear } from 'idb-keyval'
import { useLayout } from './layout'
import { eraseMe } from './leaders'
import { leaveRoom } from './together'

/**
 * Everything that is not the main store, gone with "Erase everything": your seat in any room, your place on the leaderboard
 * (the server forgets the board entry, the alias and the seats), the saved layout, every small note the app keeps, and the
 * cached lessons and demos, and what pages opened through the relay stored (`wipeRelay`). Resolves to whether the server confirmed; if it could not be reached the request is kept and
 * repeated the next time the app opens (see `retryErase`).
 */
const RELAY = 'https://friction-relay.vercel.app'

/** pages opened through the relay keep logins and cookies on the relay's own address, which only a frame from there can clear */
function wipeRelay(): Promise<void> {
  return new Promise((done) => {
    const f = Object.assign(document.createElement('iframe'), { src: `${RELAY}/wipe.html`, hidden: true, title: 'Clearing relay data' })
    const end = () => { removeEventListener('message', hear); f.remove(); done() }
    const hear = (e: MessageEvent) => { if (e.origin === RELAY) end() }
    addEventListener('message', hear)
    setTimeout(end, 6000)
    document.body.appendChild(f)
  })
}

export async function eraseTheRest(): Promise<boolean> {
  let relayed = false
  try { relayed = localStorage.getItem('friction:relay') === '1' } catch { /* storage blocked */ }
  if (relayed) await wipeRelay()
  await leaveRoom().catch(() => undefined)
  const server = await eraseMe()
  useLayout.getState().reset()
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('friction:') && k !== 'friction:erase') localStorage.removeItem(k)
  } catch { /* storage blocked */ }
  await clear().catch(() => undefined)
  return server
}
