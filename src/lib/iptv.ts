import { cached } from './cache'
import type { MediaItem } from './store'

/** Public playlists from https://github.com/iptv-org/iptv — only attention-friendly categories. */
export const TV_CATEGORIES = [
  'documentary',
  'science',
  'education',
  'relax',
  'nature',
  'travel',
  'culture',
  'classic',
  'music',
  'news',
  'weather',
  'outdoor',
] as const

export type TvCategory = (typeof TV_CATEGORIES)[number]

export function parseM3U(text: string): MediaItem[] {
  const out: MediaItem[] = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.startsWith('#EXTINF')) continue
    const attrs: Record<string, string> = {}
    for (const m of line.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[m[1]] = m[2]
    const name = line.slice(line.lastIndexOf(',') + 1).trim()
    let url = ''
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const l = lines[j].trim()
      if (l && !l.startsWith('#')) {
        url = l
        break
      }
    }
    if (!name || !url.startsWith('https://')) continue
    if (/geo-?blocked|not 24\/7/i.test(name)) continue
    const quality = name.match(/\((\d{3,4}p)\)/)?.[1]
    out.push({
      id: `tv:${attrs['tvg-id'] || name}:${url.length}`,
      kind: 'tv',
      name: name.replace(/\s*\(\d{3,4}p\)\s*/g, ' ').replace(/\s*\[.*?\]\s*/g, ' ').trim(),
      url,
      logo: attrs['tvg-logo']?.startsWith('https://') ? attrs['tvg-logo'] : undefined,
      meta: [attrs['group-title']?.split(';')[0], quality].filter(Boolean).join(' · '),
    })
  }
  const seen = new Set<string>()
  return out.filter((c) => {
    const k = c.name.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export async function fetchCategory(cat: TvCategory): Promise<MediaItem[]> {
  const url = `https://iptv-org.github.io/iptv/categories/${cat}.m3u`
  return cached(`iptv:${cat}`, 12 * 3600e3, async () => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return parseM3U(await res.text())
  })
}
