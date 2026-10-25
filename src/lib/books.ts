import { cached } from './cache'

export interface BookRef {
  id: string
  title: string
  authors: string
  thumb?: string
  pages?: number
  embeddable: boolean
  link?: string
}

export type BooksFailure = 'network' | 'bad'
export class BooksError extends Error {
  kind: BooksFailure
  constructor(kind: BooksFailure, message?: string) {
    super(message ?? kind)
    this.kind = kind
  }
}

export const SUBJECTS = ['fiction', 'philosophy', 'science', 'history', 'poetry', 'mystery', 'classics', 'technology', 'biography', 'religion']

interface Doc { identifier: string; title?: string | string[]; creator?: string | string[]; imagecount?: number }
const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? ''
const esc = (s: string) => s.replace(/["\\()]/g, ' ').trim()

/**
 * Free ebooks from the Internet Archive: no key, no account. Only open texts (nothing lent out),
 * in English, from the Project Gutenberg, Americana and Universal Library collections, most downloaded first.
 */
export async function searchBooks(q: string, start = 0): Promise<{ items: BookRef[]; total: number }> {
  const subject = q.startsWith('subject:') ? esc(q.slice(8)) : ''
  const text = subject ? '' : esc(q)
  const terms = [
    'mediatype:texts',
    'NOT access-restricted-item:true',
    'language:(eng OR English)',
    '(collection:gutenberg OR collection:americana OR collection:universallibrary)',
    subject ? `subject:"${subject}"` : '',
    text ? `(title:(${text}) OR creator:(${text}))` : '',
  ].filter(Boolean).join(' AND ')
  const rows = 40
  const url =
    'https://archive.org/advancedsearch.php?' +
    new URLSearchParams({ q: terms, rows: String(rows), page: String(Math.floor(start / rows) + 1), output: 'json', 'sort[]': 'downloads desc' }).toString() +
    '&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=imagecount'
  return cached(`books2:${q}:${start}`, 6 * 3600 * 1000, async () => {
    let res: Response
    try {
      res = await fetch(url)
    } catch {
      throw new BooksError('network')
    }
    if (!res.ok) throw new BooksError(res.status < 500 ? 'bad' : 'network')
    const d = (await res.json()) as { response?: { numFound?: number; docs?: Doc[] } }
    const items = (d.response?.docs ?? []).map((v): BookRef => ({
      id: v.identifier,
      title: one(v.title) || 'Untitled',
      authors: one(v.creator),
      thumb: `https://archive.org/services/img/${encodeURIComponent(v.identifier)}`,
      pages: v.imagecount && v.imagecount > 1 ? v.imagecount : undefined,
      embeddable: true,
      link: `https://archive.org/details/${encodeURIComponent(v.identifier)}`,
    }))
    return { items, total: d.response?.numFound ?? items.length }
  })
}

/** The Archive's own reader, framed. Page and search travel in the URL hash, which is how our controls drive it. */
export function embedUrl(id: string, page: number, term: string): string {
  const base = `https://archive.org/details/${encodeURIComponent(id)}?view=theater&ui=embed&wrapper=false`
  return term ? `${base}#search/${encodeURIComponent(term)}` : `${base}#page/n${page}/mode/1up`
}

export const archiveLink = (id: string) => `https://archive.org/details/${encodeURIComponent(id)}`
