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

export type BooksFailure = 'nokey' | 'quota' | 'network' | 'bad'
export class BooksError extends Error {
  kind: BooksFailure
  constructor(kind: BooksFailure, message?: string) {
    super(message ?? kind)
    this.kind = kind
  }
}

const KEY_LS = 'friction:books-key'
/** The key stays in this browser. A deploy can also bake one in with VITE_GOOGLE_BOOKS_KEY. */
export const getBooksKey = (): string => {
  try {
    return localStorage.getItem(KEY_LS) || (import.meta.env.VITE_GOOGLE_BOOKS_KEY as string | undefined) || ''
  } catch {
    return (import.meta.env.VITE_GOOGLE_BOOKS_KEY as string | undefined) || ''
  }
}
export const setBooksKey = (k: string) => {
  try {
    if (k.trim()) localStorage.setItem(KEY_LS, k.trim())
    else localStorage.removeItem(KEY_LS)
  } catch {
    /* storage blocked */
  }
}

/** Google's own words for the last refusal, shown so a bad key can be told from a blocked region. */
export let lastBooksError = ''

export const SUBJECTS = ['fiction', 'philosophy', 'science', 'history', 'poetry', 'mystery', 'classics', 'technology', 'biography', 'religion']

interface Vol {
  id: string
  volumeInfo?: { title?: string; authors?: string[]; pageCount?: number; imageLinks?: { thumbnail?: string; smallThumbnail?: string } }
  accessInfo?: { embeddable?: boolean; webReaderLink?: string }
}

/** Google Books, free ebooks only: the `filter=free-ebooks` parameter. */
export async function searchBooks(q: string, start = 0): Promise<{ items: BookRef[]; total: number }> {
  const key = getBooksKey()
  if (!key) throw new BooksError('nokey')
  const base =
    'https://www.googleapis.com/books/v1/volumes' +
    `?q=${encodeURIComponent(q)}&filter=free-ebooks&printType=books&maxResults=40&startIndex=${start}&projection=lite` +
    '&fields=totalItems,items(id,volumeInfo(title,authors,pageCount,imageLinks/thumbnail),accessInfo(embeddable,webReaderLink))'
  return cached(`books:${q}:${start}`, 6 * 3600 * 1000, async () => {
    const go = async (withKey: boolean) => {
      try {
        return await fetch(withKey ? `${base}&key=${encodeURIComponent(key)}` : base)
      } catch {
        throw new BooksError('network')
      }
    }
    // a key restricted to other sites or APIs is refused with 400/403; the open endpoint still answers a person's own browser
    let res = await go(true)
    if (res.status === 400 || res.status === 403) res = await go(false)
    if (!res.ok) {
      const msg = await res.json().then((j: { error?: { message?: string } }) => j.error?.message ?? '', () => '')
      lastBooksError = msg
      throw new BooksError(res.status === 429 ? 'quota' : res.status < 500 ? 'bad' : 'network', msg)
    }
    const d = (await res.json()) as { totalItems?: number; items?: Vol[] }
    const items = (d.items ?? []).map((v): BookRef => ({
      id: v.id,
      title: v.volumeInfo?.title ?? 'Untitled',
      authors: (v.volumeInfo?.authors ?? []).join(', '),
      thumb: (v.volumeInfo?.imageLinks?.thumbnail ?? v.volumeInfo?.imageLinks?.smallThumbnail)?.replace(/^http:/, 'https:'),
      pages: v.volumeInfo?.pageCount,
      embeddable: !!v.accessInfo?.embeddable,
      link: v.accessInfo?.webReaderLink,
    }))
    // only what actually opens in the reader; a book that cannot be shown here would only lead to Google's catalogue page
    const readable = items.filter((b) => b.embeddable)
    return { items: readable, total: d.totalItems ?? readable.length }
  })
}

/** Pulls a volume id out of a Google Books link, or accepts a bare id. */
export function parseVolumeId(input: string): string | null {
  const s = input.trim()
  const m = s.match(/[?&]id=([A-Za-z0-9_-]{6,20})/) ?? s.match(/books\/(?:edition|about)\/[^/]*\/([A-Za-z0-9_-]{8,16})/)
  if (m) return m[1]
  return /^[A-Za-z0-9_-]{8,16}$/.test(s) ? s : null
}

/** Google's own embedded reader page. Page, search and start position travel in the URL, which is how our controls drive it. */
export function embedUrl(id: string, page: number, term: string): string {
  const q = new URLSearchParams({ id, output: 'embed', hl: 'en' })
  if (page > 0) q.set('pg', `PA${page}`)
  else q.set('printsec', 'frontcover')
  if (term) q.set('q', term)
  return `https://books.google.com/books?${q.toString()}`
}
