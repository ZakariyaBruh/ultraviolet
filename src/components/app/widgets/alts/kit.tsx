import { ArrowLeft, Cloud } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Alt, AltHit } from '@/lib/alts'

/** what every made-here screen is given by the Browser window */
export interface AltProps {
  hit: AltHit
  onBack: () => void
  /** open an address in the window, so the blocklist and the offers still apply */
  onOpen: (url: string) => void
  /** open an address in the cloud browser */
  onCloud: (url: string) => void
}

/** the frame around every made-here screen: Back and its name on top, the real site in the cloud browser underneath */
export function AltFrame({ alt, site, cloudUrl, credit, onBack, onCloud, children }: { alt: Alt; site: string; cloudUrl: string; credit: ReactNode; onBack: () => void; onCloud: (url: string) => void; children: ReactNode }) {
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto]">
      <div className="flex items-center gap-2 border-b border-ink/15 pr-3">
        <button onClick={onBack} aria-label="Back" className="grid size-11 shrink-0 place-items-center text-ink-2 hover:text-ink"><ArrowLeft className="size-4" /></button>
        <p className="dot min-w-0 flex-1 truncate text-lg font-bold leading-none">{alt.name}</p>
      </div>
      <div className="min-h-0 overflow-hidden">{children}</div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 border-t border-ink/15 px-3 text-[12px] text-ink-3">
        <span className="py-1">{credit}</span>
        <button onClick={() => onCloud(cloudUrl)} className="inline-flex min-h-11 items-center gap-1.5 text-ink-2 hover:text-ink"><Cloud className="size-3.5 text-signal" aria-hidden />Open the real {site} in the cloud browser</button>
      </div>
    </div>
  )
}

export async function getJson(url: string, ms = 12000): Promise<unknown> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } })
    if (!r.ok) throw new Error(String(r.status))
    return await r.json()
  } finally { clearTimeout(t) }
}

/** text with the tags taken out and the entities (&amp; and the like) turned into letters */
export const plain = (html: unknown, max = 4000): string => {
  const raw = typeof html === 'string' ? html : ''
  try { return (new DOMParser().parseFromString(raw, 'text/html').body.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, max) } catch { return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) }
}

const KEEP = new Set(['P', 'BR', 'PRE', 'CODE', 'EM', 'STRONG', 'B', 'I', 'U', 'S', 'DEL', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'A', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'SUP', 'SUB', 'KBD'])
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'SVG', 'MATH', 'VIDEO', 'AUDIO', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE'])
/**
 * Someone else's formatted text, made safe to show: only a short list of tags survives, none keeps an attribute except a link's
 * address (https only), pictures become their description, and anything else is unwrapped to its words.
 */
export function safeHtml(html: string): string {
  const src = new DOMParser().parseFromString(html, 'text/html')
  const out = src.createElement('div')
  const walk = (from: Node, into: Node) => {
    from.childNodes.forEach((c) => {
      if (c.nodeType === 3) { into.appendChild(src.createTextNode(c.textContent ?? '')); return }
      if (c.nodeType !== 1) return
      const el = c as Element
      const tag = el.tagName.toUpperCase()
      if (tag === 'IMG') { const a = el.getAttribute('alt'); if (a) into.appendChild(src.createTextNode(`[image: ${a}]`)); return }
      if (DROP.has(tag)) return
      if (!KEEP.has(tag)) { walk(el, into); return }
      const n = src.createElement(tag.toLowerCase())
      if (tag === 'A') {
        const href = el.getAttribute('href') ?? ''
        if (/^https:\/\//i.test(href)) { n.setAttribute('href', href); n.setAttribute('rel', 'noopener noreferrer') }
      }
      walk(el, n)
      into.appendChild(n)
    })
  }
  walk(src.body, out)
  return out.innerHTML
}

/** the styling for text that came as HTML (an answer, an abstract): flat, and code scrolls inside its own box */
export const PROSE = 'text-[15px] leading-[1.5] text-ink [&_a]:text-signal [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-ink/30 [&_blockquote]:pl-3 [&_blockquote]:text-ink-2 [&_code]:font-mono [&_code]:text-[13px] [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:font-bold [&_li]:my-0.5 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-ink/15 [&_pre]:bg-ink/[0.06] [&_pre]:p-2 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:border-ink/15 [&_td]:px-2 [&_th]:border [&_th]:border-ink/15 [&_th]:px-2 [&_ul]:ml-5 [&_ul]:list-disc'

/** open links in a block of someone else's text in the window, never in a new tab, so the blocklist always applies */
export const linkClick = (onOpen: (u: string) => void) => (e: React.MouseEvent) => {
  const a = (e.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null
  if (!a) return
  e.preventDefault()
  onOpen(a.href)
}
