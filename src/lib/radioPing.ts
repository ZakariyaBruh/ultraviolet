/**
 * Telling the Radio Browser directory that a station was played. It lives apart from `radio.ts` so that the player, which every screen
 * has, does not carry the whole station list with it.
 */
const MIRRORS = ['https://de1.api.radio-browser.info', 'https://de2.api.radio-browser.info', 'https://all.api.radio-browser.info']

async function rb(path: string): Promise<unknown> {
  let last: unknown
  for (const base of MIRRORS) {
    try { const res = await fetch(base + path, { signal: AbortSignal.timeout(7000) }); if (res.ok) return await res.json() } catch (err) { last = err }
  }
  throw last instanceof Error ? last : new Error('Radio directory unreachable')
}

/** Be a good citizen: tell the directory this station was played. */
export function registerClick(uuid?: string) {
  if (!uuid) return
  void rb(`/json/url/${uuid}`).catch(() => undefined)
}
