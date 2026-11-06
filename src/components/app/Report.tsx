import { ExternalLink } from 'lucide-react'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { usePlayer } from '@/lib/player'
import { reportFor } from '@/lib/report'
import { useUI } from '@/lib/ui'

const Row = ({ href, label, note }: { href: string; label: string; note?: string }) => (
  <li className="border-b border-ink/10 last:border-b-0">
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-between gap-3 py-2 text-left text-[15px] text-ink hover:text-signal">
      <span className="min-w-0"><span className="block">{label}</span>{note && <span className="block text-[13px] leading-[1.35] text-ink-3">{note}</span>}</span>
      <ExternalLink aria-hidden className="size-4 shrink-0 text-ink-3" />
    </a>
  </li>
)

/** Report a problem with what is playing: Friction does not own it, so each source's own place to report is offered, with Friction's own contact last. */
export function ReportSheet() {
  const open = useUI((s) => s.reportOpen)
  const set = useUI((s) => s.set)
  const current = usePlayer((s) => s.current)
  const info = current ? reportFor(current) : null
  return (
    <Sheet open={open} onOpenChange={(o) => set({ reportOpen: o })}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Report a problem</SheetTitle>
          <SheetDescription>{current ? `${current.name} is published by ${info?.who}, not by Friction, so they are the ones who can fix or remove it.` : 'Play something first, then report it here.'}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          {info && (
            <>
              <ul>
                {info.links.map((l) => <Row key={l.label} {...l} />)}
                <Row href="/disclaimer#sources" label="Who owns what, and every source" note="Friction lists public streams and does not host them." />
                <Row href="/contact" label="Tell Friction" note="A problem with Friction itself. Rights holders: see how to ask for something to be hidden." />
              </ul>
              <p className="mt-3 text-[13px] leading-[1.4] text-ink-3">These open in a new tab. While you are locked in, leaving the tab counts as a drift.</p>
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
