/** The Cite window's saved list: the shapes and the check run on load. Kept apart from lib/cite.ts so the store, which is in the
 * start file, does not bring the formatter and the look-ups with it. */
export type Kind = 'article' | 'book' | 'web'
export interface Name { family: string; given: string }
export interface Source {
  id: string; kind: Kind; authors: Name[]; title: string
  container?: string; year?: number; month?: number; day?: number
  volume?: string; issue?: string; pages?: string; doi?: string; url?: string; publisher?: string; edition?: string; accessed?: string
}
export type Style = 'apa' | 'mla' | 'chicago' | 'harvard'
export const CITES_MAX = 100

export function sanitizeCites(v: unknown): Source[] | undefined {
  if (!Array.isArray(v)) return undefined
  const str = (x: unknown, n: number) => (typeof x === 'string' ? x.slice(0, n) : undefined)
  const int = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x) : undefined)
  return v.slice(0, CITES_MAX).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && typeof (x as Record<string, unknown>).title === 'string').map((x, i) => ({
    id: str(x.id, 24) ?? String(i), kind: (['article', 'book', 'web'].includes(String(x.kind)) ? x.kind : 'web') as Kind,
    authors: (Array.isArray(x.authors) ? x.authors : []).slice(0, 40).filter((a): a is Name => !!a && typeof a === 'object' && typeof (a as Name).family === 'string').map((a) => ({ family: a.family.slice(0, 80), given: String(a.given ?? '').slice(0, 80) })),
    title: String(x.title).slice(0, 400), container: str(x.container, 200), year: int(x.year), month: int(x.month), day: int(x.day),
    volume: str(x.volume, 20), issue: str(x.issue, 20), pages: str(x.pages, 40), doi: str(x.doi, 200), url: str(x.url, 600), publisher: str(x.publisher, 200), edition: str(x.edition, 20), accessed: str(x.accessed, 10),
  }))
}
