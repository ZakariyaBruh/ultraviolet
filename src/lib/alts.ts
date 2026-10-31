/**
 * Friction's own versions of sites that do not run in the Browser at all (they are script apps, or they turn programs away). When
 * an address belongs to one, the window says so and offers the version made here or the cloud browser. A site that already reads
 * fine in the Browser gets no version: that is the rule, and the reason the first pile of stand-ins was removed.
 * Each version uses a free service that needs no key and is called from the browser; only the words typed are sent.
 */
export type AltId = 'maps' | 'translate' | 'scholar' | 'stack' | 'search' | 'youtube' | 'ask'
/** the versions that have a screen of their own in the window */
export type MadeId = 'maps' | 'translate' | 'scholar' | 'stack'
export interface Alt { id: AltId; name: string; short: string; blurb: string }

export const ALT: Record<AltId, Alt> = {
  maps: { id: 'maps', name: 'Friction Maps', short: 'Maps', blurb: 'search places and get driving directions, on OpenStreetMap' },
  translate: { id: 'translate', name: 'Friction Translate', short: 'Translate', blurb: 'translate between about 40 languages and listen to the result' },
  scholar: { id: 'scholar', name: 'Friction Scholar', short: 'Scholar', blurb: 'search papers and articles, with abstracts and how often each is cited' },
  stack: { id: 'stack', name: 'Friction Stack', short: 'Stack Overflow', blurb: 'search questions and read the answers, without the clutter' },
  search: { id: 'search', name: 'FrictionX search', short: 'FrictionX', blurb: 'search the web from a plain page' },
  youtube: { id: 'youtube', name: 'Friction YouTube', short: 'YouTube', blurb: 'search videos and play them in the privacy-friendly player' },
  ask: { id: 'ask', name: 'Friction Ask AI', short: 'Ask AI', blurb: 'a study helper you can type to (AI generated)' },
}
/** the ones with a start-page entry, in order */
export const MADE: MadeId[] = ['maps', 'translate', 'scholar', 'stack']

export interface AltHit {
  alt: Alt
  /** the site that was asked for, for the sentence that explains */
  site: string
  /** whether the site surely does not run here, so the window offers the version before trying the site */
  sure: boolean
  /** what the address already says: a search, a pair of places, a text to translate, a question */
  q?: string
  from?: string
  to?: string
  sl?: string
  tl?: string
  question?: number
  stack?: string
}

const dec = (s: string) => { try { return decodeURIComponent(s.replace(/\+/g, ' ')).trim() } catch { return s.trim() } }
const CHAT: Record<string, string> = { 'chatgpt.com': 'ChatGPT', 'chat.openai.com': 'ChatGPT', 'openai.com': 'ChatGPT', 'claude.ai': 'Claude', 'gemini.google.com': 'Gemini', 'copilot.microsoft.com': 'Copilot', 'perplexity.ai': 'Perplexity', 'character.ai': 'Character.AI', 'poe.com': 'Poe' }
const STACK_SITES: Record<string, string> = { 'stackoverflow.com': 'stackoverflow', 'superuser.com': 'superuser', 'serverfault.com': 'serverfault', 'askubuntu.com': 'askubuntu', 'mathoverflow.net': 'mathoverflow.net', 'stackexchange.com': 'stackoverflow' }

/** the version made here for this address, or null when the Browser can open the site itself */
export function altFor(u: URL): AltHit | null {
  const h = u.hostname.toLowerCase().replace(/^(www|m)\./, '')
  const p = u.pathname
  const sp = u.searchParams
  const google = /^google\.[a-z.]{2,6}$/.test(h)

  // maps
  if (/^maps\.google\.[a-z.]{2,6}$/.test(h) || (google && p.startsWith('/maps')) || h === 'maps.app.goo.gl' || h === 'maps.apple.com' || (h === 'bing.com' && p.startsWith('/maps')) || h === 'mapquest.com') {
    const hit: AltHit = { alt: ALT.maps, site: h === 'maps.apple.com' ? 'Apple Maps' : h === 'bing.com' ? 'Bing Maps' : h === 'mapquest.com' ? 'MapQuest' : 'Google Maps', sure: true }
    const dir = /^\/maps\/dir\/([^/]+)\/([^/@]+)/.exec(p)
    if (dir) { hit.from = dec(dir[1]); hit.to = dec(dir[2]) }
    else {
      const s = /^\/maps\/(?:search|place)\/([^/@]+)/.exec(p)
      hit.q = s ? dec(s[1]) : (sp.get('q') ?? sp.get('query') ?? sp.get('daddr') ?? undefined)?.trim() || undefined
    }
    return hit
  }
  // translate
  if (/^translate\.google\.[a-z.]{2,6}$/.test(h) || h === 'deepl.com') {
    return { alt: ALT.translate, site: h === 'deepl.com' ? 'DeepL' : 'Google Translate', sure: true, q: sp.get('text') ?? undefined, sl: sp.get('sl') ?? undefined, tl: sp.get('tl') ?? undefined }
  }
  // scholar
  if (/^scholar\.google\.[a-z.]{2,6}$/.test(h)) return { alt: ALT.scholar, site: 'Google Scholar', sure: true, q: sp.get('q')?.trim() || undefined }
  // stack exchange
  const sub = /^([a-z]+)\.stackexchange\.com$/.exec(h)?.[1]
  const stack = sub && sub !== 'meta' ? sub : STACK_SITES[h]
  if (stack) {
    const id = /^\/(?:questions|q)\/(\d{1,10})/.exec(p)?.[1]
    return { alt: ALT.stack, site: h === 'stackoverflow.com' ? 'Stack Overflow' : 'Stack Exchange', sure: true, stack, question: id ? Number(id) : undefined, q: p === '/search' ? sp.get('q')?.trim() || undefined : undefined }
  }
  // YouTube (a video link plays in the embed before this is asked)
  if (/^(youtube\.com|youtu\.be|music\.youtube\.com)$/.test(h)) return { alt: ALT.youtube, site: 'YouTube', sure: true, q: p === '/results' ? sp.get('search_query')?.trim() || undefined : undefined }
  // AI chats
  if (CHAT[h]) return { alt: ALT.ask, site: CHAT[h], sure: true }
  // search engines: Google surely does not run here; the others are offered when they fail
  if (google) return { alt: ALT.search, site: 'Google', sure: true, q: p === '/search' ? sp.get('q')?.trim() || undefined : undefined }
  if (/^(bing\.com|duckduckgo\.com|html\.duckduckgo\.com|search\.brave\.com|search\.yahoo\.com|yahoo\.com|ecosia\.org)$/.test(h)) return { alt: ALT.search, site: h.replace(/^(search|html)\./, '').replace(/\.com$|\.org$/, '').replace(/^./, (c) => c.toUpperCase()), sure: false, q: (sp.get('q') ?? sp.get('p'))?.trim() || undefined }
  return null
}
