/**
 * What the Browser window will not open: games, and short-form social media. The same list runs in the window (so a link says
 * why it is refused straight away) and on the server (`api/browse.ts`), which re-checks every address and every redirect, so
 * the window cannot be used to get round it. Full-length YouTube is allowed because study videos matter; Shorts are not.
 */
export type Why = 'games' | 'short-form social media' | 'not a web page'

const GAME_HOSTS = [
  'roblox.com', 'poki.com', 'crazygames.com', 'miniclip.com', 'y8.com', 'kongregate.com', 'armorgames.com', 'newgrounds.com', 'addictinggames.com',
  'coolmathgames.com', 'friv.com', 'kizi.com', 'agame.com', 'games.com', 'gamesgames.com', 'itch.io', 'gamejolt.com', 'steampowered.com', 'steamcommunity.com',
  'epicgames.com', 'minecraft.net', 'fortnite.com', 'twitch.tv', 'chess.com', 'lichess.org', 'geoguessr.com', 'now.gg', 'xbox.com', 'playstation.com',
  'ea.com', 'ubisoft.com', 'blizzard.com', 'battle.net', 'leagueoflegends.com', 'riotgames.com', 'valorant.com', 'supercell.com', 'nintendo.com',
  'ign.com', 'gamespot.com', 'polygon.com', 'kotaku.com', 'pcgamer.com', 'eurogamer.net', 'gamesradar.com', 'rockpapershotgun.com', 'gog.com', 'humblebundle.com',
  'krunker.io', 'slither.io', 'agar.io', 'diep.io', 'surviv.io', 'shellshock.io', 'bloxd.io', '1v1.lol', 'wordle.com', 'neal.fun', 'scratch.mit.edu',
]
const SHORT_HOSTS = [
  'tiktok.com', 'instagram.com', 'snapchat.com', 'facebook.com', 'fb.com', 'fb.watch', 'x.com', 'twitter.com', 'threads.net', 'threads.com', 'bsky.app',
  'vine.co', 'likee.video', 'kwai.com', 'triller.co', 'byte.co', 'tumblr.com', 'pinterest.com',
]
const hostIs = (h: string, list: string[]) => list.some((d) => h === d || h.endsWith(`.${d}`))

/** Is this address allowed? A refusal says why, in a few words. */
export function verdict(raw: string): { ok: true; url: URL } | { ok: false; why: Why } {
  let u: URL
  try { u = new URL(raw) } catch { return { ok: false, why: 'not a web page' } }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, why: 'not a web page' }
  const h = u.hostname.toLowerCase().replace(/^www\./, '')
  const path = u.pathname.toLowerCase()
  if (hostIs(h, SHORT_HOSTS)) return { ok: false, why: 'short-form social media' }
  if (hostIs(h, ['youtube.com', 'youtu.be', 'youtube-nocookie.com']) && (/^\/(shorts|reel)(\/|$)/.test(path) || u.searchParams.get('v')?.startsWith('shorts'))) return { ok: false, why: 'short-form social media' }
  if (hostIs(h, ['youtube.com']) && /^\/(feed\/shorts|hashtag\/shorts)/.test(path)) return { ok: false, why: 'short-form social media' }
  if (hostIs(h, ['facebook.com', 'fb.watch'])) return { ok: false, why: 'short-form social media' }
  if (hostIs(h, GAME_HOSTS)) return { ok: false, why: 'games' }
  // a game portal by its name, or a games section on a news site
  if (/(^|[.-])(unblocked|arcade|gaming|games|gamez)([.-]|$)/.test(h) || /^\/(games?|arcade)(\/|$)/.test(path)) return { ok: false, why: 'games' }
  return { ok: true, url: u }
}

/** the video id of a full-length YouTube address, for the embedded player; Shorts never get here */
export function youtubeId(u: URL): string | null {
  const h = u.hostname.toLowerCase().replace(/^www\.|^m\./, '')
  let id: string | null = null
  if (h === 'youtu.be') id = u.pathname.slice(1)
  else if (h === 'youtube.com' || h === 'music.youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v')
    else if (/^\/(embed|live|v)\//.test(u.pathname)) id = u.pathname.split('/')[2]
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null
}
