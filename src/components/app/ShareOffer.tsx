import { useMemo } from 'react'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { fx_say } from '@/lib/actions'
import { CARDS_MAX, DECKS_MAX, makeCard, newId, sanitizeDecks, total } from '@/lib/cards'
import { sanitizeCites, CITES_MAX } from '@/lib/citeData'
import { NOTES_MAX, NOTE_MAX, useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'

/**
 * A flashcard deck, notepad page or reference list that arrived in a link (lib/codeshare.ts). It is read and checked, then offered:
 * nothing is added until the person says so, and what is added is a copy, never a replacement of anything they have.
 */
type Offer = { title: string; what: string; take: () => string }
export function ShareOffer() {
  const item = useUI((s) => s.sharedItem)
  const close = () => useUI.setState({ sharedItem: null })
  const offer = useMemo<Offer | null>(() => {
    if (!item) return null
    const st = useStore.getState()
    try {
      if (item.lang === 'deck') {
        const j = JSON.parse(item.text) as { name?: unknown; cards?: unknown }
        const cards = (Array.isArray(j.cards) ? j.cards : []).filter((c): c is [string, string] => Array.isArray(c) && typeof c[0] === 'string' && typeof c[1] === 'string' && !!c[0].trim() && !!c[1].trim())
        if (!cards.length) return null
        const name = String(typeof j.name === 'string' ? j.name : 'Shared deck').slice(0, 40) || 'Shared deck'
        return { title: 'A flashcard deck', what: `“${name}”, ${cards.length} card${cards.length === 1 ? '' : 's'}`, take: () => {
          const decks = st.widgets.decks ?? []
          if (decks.length >= DECKS_MAX) return `You have ${DECKS_MAX} decks already. Delete one first.`
          const room = CARDS_MAX - total(decks)
          if (room <= 0) return 'Your decks are full.'
          const now = Date.now()
          const d = sanitizeDecks([{ id: newId(), name, cards: cards.slice(0, room).map(([f, b]) => makeCard(f, b, now)) }])
          if (!d?.length) return 'That deck could not be read.'
          st.setDecks([...decks, ...d])
          return cards.length > room ? `Added the first ${room} cards: that is all the room you have.` : ''
        } }
      }
      if (item.lang === 'note') {
        const text = item.text.slice(0, NOTE_MAX)
        if (!text.trim()) return null
        return { title: 'A notepad page', what: `“${text.trim().split('\n')[0].slice(0, 40)}”, ${text.trim().split(/\s+/).length} words`, take: () => {
          const pages = st.widgets.notes?.length ? st.widgets.notes : [st.widgets.note]
          if (pages.length >= NOTES_MAX) return `You have ${NOTES_MAX} pages already.`
          st.setNotes([...pages, text])
          return ''
        } }
      }
      if (item.lang === 'refs') {
        const list = sanitizeCites(JSON.parse(item.text))
        if (!list?.length) return null
        return { title: 'A reference list', what: `${list.length} reference${list.length === 1 ? '' : 's'}`, take: () => {
          const mine = st.widgets.cites ?? []
          const fresh = list.map((c) => ({ ...c, id: Math.random().toString(36).slice(2, 10) })).filter((c) => !mine.some((m) => m.title === c.title && m.year === c.year))
          if (mine.length + fresh.length > CITES_MAX) return `Your list holds ${CITES_MAX} at most.`
          st.setCites([...mine, ...fresh])
          return fresh.length < list.length ? 'Ones you already have were left out.' : ''
        } }
      }
    } catch { /* not readable: the broken-link notice below */ }
    return null
  }, [item])
  if (!item) return null
  const open = true
  if (!offer) {
    fx_say({ title: 'That link is broken', description: 'What was shared could not be read.', variant: 'warning' })
    queueMicrotask(close)
    return null
  }
  const take = () => {
    const problem = offer.take()
    const widget = item.lang === 'deck' ? 'cards' : item.lang === 'note' ? 'notes' : 'cite'
    if (problem && /^(You|Your|That)/.test(problem)) { fx_say({ title: 'Not added', description: problem, variant: 'warning' }); close(); return }
    useStore.getState().setWidget(widget, true)
    fx_say({ title: 'Added', description: problem || undefined, variant: 'success' })
    close()
  }
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) close() }}>
      <SheetContent side="bottom">
        <SheetHeader><SheetTitle>{offer.title} was shared with you</SheetTitle><SheetDescription>{offer.what}. Nothing is added until you say so, and it is added as a copy next to what you have.</SheetDescription></SheetHeader>
        <SheetBody>
          <div className="flex flex-wrap gap-2">
            <button onClick={take} className="h-11 bg-signal px-5 text-sm font-semibold text-on-signal">Add it</button>
            <button onClick={close} className="h-11 border border-ink/25 px-4 text-sm text-ink hover:bg-ink/10">No thanks</button>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
