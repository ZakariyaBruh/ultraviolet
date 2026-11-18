/**
 * Citations for the Cite window: APA 7, MLA 9, Chicago (17th, bibliography) and Harvard (Cite Them Right), for a journal article,
 * a book or a web page. A DOI is looked up on Crossref and an ISBN on Open Library, both free and keyless, called from the browser
 * with only the number typed. A citation is returned as runs of text, some in italics, so it can be shown and copied either way.
 */
import type { Name, Source, Style } from './citeData'
export type { Kind, Name, Source, Style } from './citeData'
export type Run = { t: string; i?: boolean }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MON = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']
const initials = (given: string) => given.split(/[\s-]+/).filter(Boolean).map((p) => `${p[0].toUpperCase()}.`).join(' ')
const doiUrl = (s: Source) => (s.doi ? `https://doi.org/${s.doi}` : s.url ?? '')
const end = (t: string) => (/[.?!]$/.test(t) ? t : `${t}.`)
const pages = (p?: string) => (p ? p.replace(/-+/g, '–') : '')
const accessedDate = (s: Source, style: Style) => {
  if (!s.accessed) return ''
  const [y, m, d] = s.accessed.split('-').map(Number)
  if (!y || !m || !d) return ''
  return style === 'mla' ? `${d} ${MON[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]} ${y}`
}

function apaNames(a: Name[]) {
  const one = (n: Name) => (n.given ? `${n.family}, ${initials(n.given)}` : n.family)
  if (!a.length) return ''
  if (a.length === 1) return one(a[0])
  if (a.length <= 20) return `${a.slice(0, -1).map(one).join(', ')}, & ${one(a[a.length - 1])}`
  return `${a.slice(0, 19).map(one).join(', ')}, . . . ${one(a[a.length - 1])}`
}
function mlaNames(a: Name[]) {
  const first = (n: Name) => (n.given ? `${n.family}, ${n.given}` : n.family)
  const plain = (n: Name) => (n.given ? `${n.given} ${n.family}` : n.family)
  if (!a.length) return ''
  if (a.length === 1) return first(a[0])
  if (a.length === 2) return `${first(a[0])}, and ${plain(a[1])}`
  return `${first(a[0])}, et al`
}
function chicagoNames(a: Name[]) {
  const first = (n: Name) => (n.given ? `${n.family}, ${n.given}` : n.family)
  const plain = (n: Name) => (n.given ? `${n.given} ${n.family}` : n.family)
  if (!a.length) return ''
  if (a.length === 1) return first(a[0])
  if (a.length <= 10) return `${first(a[0])}, ${a.slice(1, -1).map((n) => `${plain(n)}, `).join('')}and ${plain(a[a.length - 1])}`
  return `${first(a[0])}, ${a.slice(1, 7).map(plain).join(', ')}, et al`
}
function harvardNames(a: Name[]) {
  const one = (n: Name) => (n.given ? `${n.family}, ${initials(n.given)}` : n.family)
  if (!a.length) return ''
  if (a.length === 1) return one(a[0])
  if (a.length <= 3) return `${a.slice(0, -1).map(one).join(', ')} and ${one(a[a.length - 1])}`
  return `${one(a[0])} et al.`
}

export function cite(s: Source, style: Style): Run[] {
  const year = s.year ? String(s.year) : 'n.d.'
  const url = doiUrl(s)
  const t = s.title.trim()
  const out: Run[] = []
  const say = (text: string, i = false) => { if (text) out.push({ t: text, i }) }
  if (style === 'apa') {
    const who = apaNames(s.authors)
    const date = s.kind === 'web' && s.year && s.month ? `${s.year}, ${MONTHS[s.month - 1]}${s.day ? ` ${s.day}` : ''}` : year
    say(who ? `${end(who)} (${date}). ` : '')
    if (s.kind === 'article') {
      if (!who) say(`${end(t)} (${date}). `); else say(`${end(t)} `)
      if (s.container) { say(s.container, true); say(s.volume ? ', ' : '') }
      if (s.volume) { say(s.volume, true); say(s.issue ? `(${s.issue})` : '') }
      say(s.pages ? `, ${pages(s.pages)}` : '')
      say('. ')
      say(url)
    } else if (s.kind === 'book') {
      if (!who) say(`(${date}). `)
      say(t, true); say(s.edition ? ` (${s.edition} ed.)` : ''); say('. ')
      say(s.publisher ? `${end(s.publisher)} ` : '')
      say(url)
    } else {
      if (!who) { say(t, true); say(`. (${date}). `) } else { say(t, true); say('. ') }
      say(s.container ? `${end(s.container)} ` : '')
      say(url)
    }
  } else if (style === 'mla') {
    const who = mlaNames(s.authors)
    say(who ? `${end(who)} ` : '')
    if (s.kind === 'book') {
      say(t, true); say('. ')
      say(s.edition ? `${s.edition} ed., ` : '')
      say(s.publisher ? `${s.publisher}, ` : ''); say(`${year}.`)
    } else {
      say(`“${end(t)}” `)
      if (s.container) { say(s.container, true); say(', ') }
      if (s.kind === 'article') {
        say(s.volume ? `vol. ${s.volume}, ` : ''); say(s.issue ? `no. ${s.issue}, ` : '')
        say(`${year}`); say(s.pages ? `, pp. ${pages(s.pages)}` : ''); say(url ? `, ${url}.` : '.')
      } else {
        say(s.year ? `${s.day ? `${s.day} ` : ''}${s.month ? `${MON[s.month - 1]} ` : ''}${s.year}, ` : '')
        say(url ? `${url}.` : '')
        const acc = accessedDate(s, 'mla'); say(acc ? ` Accessed ${acc}.` : '')
      }
    }
  } else if (style === 'chicago') {
    const who = chicagoNames(s.authors)
    say(who ? `${end(who)} ` : '')
    if (s.kind === 'article') {
      say(`“${end(t)}” `)
      if (s.container) { say(s.container, true); say(' ') }
      say(s.volume ?? ''); say(s.issue ? `, no. ${s.issue}` : '')
      say(` (${year})`); say(s.pages ? `: ${pages(s.pages)}` : ''); say('.')
      say(url ? ` ${url}.` : '')
    } else if (s.kind === 'book') {
      say(t, true); say('. ')
      say(s.edition ? `${s.edition} ed. ` : '')
      say(s.publisher ? `${s.publisher}, ` : ''); say(`${year}.`)
      say(url ? ` ${url}.` : '')
    } else {
      say(`“${end(t)}” `)
      say(s.container ? `${end(s.container)} ` : '')
      say(s.year && s.month ? `${MONTHS[s.month - 1]} ${s.day ? `${s.day}, ` : ''}${s.year}. ` : s.year ? `${s.year}. ` : '')
      say(url ? `${url}.` : '')
    }
  } else {
    const who = harvardNames(s.authors)
    say(who ? `${who} (${year}) ` : `${t} (${year}) `)
    if (s.kind === 'article') {
      if (who) say(`‘${t}’, `)
      if (s.container) { say(s.container, true); say(', ') }
      say(s.volume ? `${s.volume}${s.issue ? `(${s.issue})` : ''}, ` : '')
      say(s.pages ? `pp. ${pages(s.pages)}. ` : '')
      say(url ? `Available at: ${url}` : '')
      const acc = accessedDate(s, 'harvard'); say(url && acc ? ` (Accessed: ${acc}).` : url ? '.' : '')
    } else if (s.kind === 'book') {
      if (who) { say(t, true); say('. ') }
      say(s.edition ? `${s.edition} edn. ` : '')
      say(s.publisher ? `${end(s.publisher)}` : '')
    } else {
      if (who) { say(t, true); say('. ') }
      say(url ? `Available at: ${url}` : '')
      const acc = accessedDate(s, 'harvard'); say(url && acc ? ` (Accessed: ${acc}).` : url ? '.' : '')
    }
  }
  // tidy the joins: no double spaces or doubled full stops
  const runs = out.filter((r) => r.t)
  for (const r of runs) r.t = r.t.replace(/\s{2,}/g, ' ').replace(/\.\./g, '.')
  if (runs.length) runs[runs.length - 1].t = runs[runs.length - 1].t.trimEnd()
  return runs
}
export const plain = (runs: Run[]) => runs.map((r) => r.t).join('')
export const html = (runs: Run[]) => runs.map((r) => { const e = r.t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); return r.i ? `<i>${e}</i>` : e }).join('')
/** for sorting a reference list: the first author's family name, else the title */
export const sortKey = (s: Source) => (s.authors[0]?.family || s.title).toLowerCase()

const nameOf = (full: string): Name => {
  const t = full.trim().replace(/\s+/g, ' ')
  if (t.includes(',')) { const [family, given] = t.split(',').map((x) => x.trim()); return { family, given: given ?? '' } }
  const i = t.lastIndexOf(' ')
  return i < 0 ? { family: t, given: '' } : { family: t.slice(i + 1), given: t.slice(0, i) }
}
export const parseNames = (lines: string) => lines.split(/\n|;/).map((l) => l.trim()).filter(Boolean).map(nameOf)

/** what was typed: a DOI, an ISBN, an address, or nothing we know */
export function recognise(input: string): { kind: 'doi'; v: string } | { kind: 'isbn'; v: string } | { kind: 'url'; v: string } | null {
  const t = input.trim()
  const doi = /(10\.\d{4,9}\/[^\s"<>]+)/i.exec(t)
  if (doi) return { kind: 'doi', v: doi[1].replace(/[.,;]+$/, '') }
  const digits = t.replace(/[^0-9Xx]/g, '')
  if (/^(97[89])?\d{9}[\dXx]$/.test(digits) && !/[a-wyz]/i.test(t.replace(/isbn/i, ''))) return { kind: 'isbn', v: digits.toUpperCase() }
  if (/^https?:\/\/\S+\.\S+/i.test(t)) return { kind: 'url', v: t }
  return null
}

export async function lookUp(input: string, signal?: AbortSignal): Promise<Partial<Source> | null> {
  const r = recognise(input)
  if (!r) return null
  if (r.kind === 'doi') {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(r.v)}`, { signal })
    if (!res.ok) return null
    const m = (await res.json()).message as Record<string, unknown>
    const parts = ((m.issued as { 'date-parts'?: number[][] })?.['date-parts']?.[0] ?? []) as number[]
    const type = String(m.type ?? '')
    return {
      kind: /book/.test(type) && !/chapter/.test(type) ? 'book' : 'article',
      authors: ((m.author as { family?: string; given?: string; name?: string }[]) ?? []).map((a) => ({ family: a.family ?? a.name ?? '', given: a.given ?? '' })).filter((a) => a.family),
      title: String((m.title as string[])?.[0] ?? '').replace(/<[^>]+>/g, ''),
      container: String((m['container-title'] as string[])?.[0] ?? '') || undefined,
      year: parts[0], month: parts[1], day: parts[2],
      volume: m.volume ? String(m.volume) : undefined, issue: m.issue ? String(m.issue) : undefined, pages: m.page ? String(m.page) : undefined,
      publisher: m.publisher ? String(m.publisher) : undefined, doi: r.v,
    }
  }
  if (r.kind === 'isbn') {
    const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${r.v}&format=json&jscmd=data`, { signal })
    if (!res.ok) return null
    const b = Object.values(await res.json())[0] as Record<string, unknown> | undefined
    if (!b) return null
    const y = /(\d{4})/.exec(String(b.publish_date ?? ''))
    return {
      kind: 'book', title: String(b.title ?? '') + (b.subtitle ? `: ${b.subtitle}` : ''),
      authors: ((b.authors as { name: string }[]) ?? []).map((a) => nameOf(a.name)),
      year: y ? Number(y[1]) : undefined, publisher: (b.publishers as { name: string }[])?.[0]?.name,
    }
  }
  // a web page: its address and today's date; the rest is typed in
  const d = new Date()
  return { kind: 'web', url: r.v, accessed: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, container: new URL(r.v).hostname.replace(/^www\./, '') }
}
