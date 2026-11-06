import type { MediaItem } from './store'

/**
 * Where to take a problem with something that is playing. Friction does not own or host any of it (see /disclaimer#sources), so the report
 * goes to the source that publishes it, with the item's name filled in where the source's own form allows it. Nothing is sent from here:
 * these are plain links that open the source's page in a new tab.
 */
export interface ReportLink { label: string; href: string; note?: string }
export interface ReportInfo { who: string; whoUrl: string; links: ReportLink[] }

const GH = 'https://github.com'
const enc = encodeURIComponent
const SONG_HELP: Record<string, { who: string; url: string; help: ReportLink }> = {
  audius: { who: 'Audius', url: 'https://audius.co', help: { label: 'Audius help and copyright', href: 'https://help.audius.co/' } },
  openverse: { who: 'Openverse', url: 'https://openverse.org', help: { label: 'Report on the Openverse page', href: '', note: 'Every Openverse item has a Report this content button.' } },
  commons: { who: 'Wikimedia Commons', url: 'https://commons.wikimedia.org', help: { label: 'Commons deletion and copyright requests', href: 'https://commons.wikimedia.org/wiki/Commons:Deletion_requests' } },
  loc: { who: 'Library of Congress', url: 'https://www.loc.gov/collections/national-jukebox/', help: { label: 'Ask a Librarian', href: 'https://ask.loc.gov/' } },
}
const ARCHIVE = { who: 'Internet Archive', url: 'https://archive.org', help: { label: 'Internet Archive help and copyright', href: 'https://help.archive.org/' } }
const OWN: Record<string, string> = { musopen: 'Musopen (on the Internet Archive)', fma: 'Free Music Archive (on the Internet Archive)', live: 'Live Music Archive (on the Internet Archive)', archive: 'Internet Archive' }

export function reportFor(item: MediaItem): ReportInfo {
  const id = item.id
  if (id.startsWith('tv:')) {
    return {
      who: 'iptv-org', whoUrl: `${GH}/iptv-org/iptv`,
      links: [
        { label: 'Report a broken stream', href: `${GH}/iptv-org/iptv/issues/new?assignees=&labels=streams:remove&projects=&template=3_streams_report.yml&title=${enc(`Broken: ${item.name}`)}`, note: 'Needs a free GitHub account. They ask you to check it is broken for everyone, not just blocked where you are.' },
        { label: 'Request removal or report a copyright concern', href: `${GH}/iptv-org/iptv/issues/new?assignees=&labels=removal+request&projects=&template=6_copyright-claim.yml&title=${enc(`Remove: ${item.name}`)}` },
        { label: 'Wrong name, logo or country', href: `${GH}/iptv-org/database/issues` },
      ],
    }
  }
  if (id.startsWith('radio:')) {
    const uuid = item.uuid || id.slice(6)
    return {
      who: 'Radio Browser', whoUrl: 'https://www.radio-browser.info',
      links: [
        { label: 'Open this station on Radio Browser', href: `https://www.radio-browser.info/history/${enc(uuid)}`, note: 'Its page shows the station\'s details and history, and where to correct or flag it.' },
        { label: 'Report a problem with the directory', href: `${GH}/segler-alex/radiobrowser-api/issues` },
      ],
    }
  }
  if (id.startsWith('song:')) {
    const source = id.split(':')[1] ?? ''
    const owned = OWN[source]
    const src = SONG_HELP[source] ?? ARCHIVE
    const links: ReportLink[] = []
    if (item.page) links.push({ label: `Open it on ${owned ?? src.who}`, href: item.page, note: source === 'openverse' ? 'Use Report this content on that page.' : 'The report or flag option is on that page.' })
    if (src.help.href) links.push(src.help)
    return { who: owned ?? src.who, whoUrl: src.url, links }
  }
  if (id.startsWith('pod:')) {
    const show = id.split(':')[1] ?? ''
    return {
      who: 'the podcast\'s publisher and Apple Podcasts', whoUrl: 'https://podcasts.apple.com',
      links: /^\d+$/.test(show) ? [{ label: 'Open the show on Apple Podcasts', href: `https://podcasts.apple.com/podcast/id${show}`, note: 'Its page has Report a Concern. The publisher\'s own website is linked there too.' }] : [],
    }
  }
  return { who: 'its publisher', whoUrl: '', links: [] }
}
