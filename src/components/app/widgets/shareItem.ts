import { fx_say } from '@/lib/actions'
import { itemLink } from '@/lib/codeshare'

/** copy a share link for a deck, a notepad page or a reference list; the data is in the link itself, so nothing is stored anywhere */
export async function shareItem(kind: 'deck' | 'note' | 'refs', text: string) {
  const { url, long } = await itemLink(kind, text)
  try {
    await navigator.clipboard.writeText(url)
    fx_say({ title: 'Link copied', description: long ? 'It is long, so some apps may cut it.' : 'What you shared is in the link. Nothing is stored.', variant: 'success' })
  } catch { fx_say({ title: 'Could not copy the link', variant: 'warning' }) }
}
