import { Maximize2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback } from 'react'
import { Browser } from '@/components/app/Browser'
import { AsciiSolid } from '@/components/app/AsciiSolid'
import { Glass } from '@/components/app/glass'
import { Logo } from '@/components/app/shared'
import { StackUnfoldPanel } from '@/components/ui/stack-unfold-panel'
import { fetchCategory, TV_CATEGORIES, type TvCategory } from '@/lib/iptv'
import { play, usePlayer } from '@/lib/player'
import { useUI } from '@/lib/ui'

/** The channel itself is the backdrop. This side only says what is on and what is next. */
function Stage() {
  const { current, status } = usePlayer()
  const queue = usePlayer((s) => s.queue)
  const set = useUI((s) => s.set)
  const tv = current?.kind === 'tv' ? current : null
  const idx = tv ? queue.findIndex((q) => q.id === tv.id) : -1
  const next = idx >= 0 ? queue.slice(idx + 1, idx + 4) : []
  return (
    <div className="flex h-full min-h-0 flex-col justify-between">
      <div className="flex justify-end">
        {tv && (
          <Glass clear radius={999} as="button" onClick={() => set({ theatre: true })} className="inline-flex h-11 items-center gap-2 px-4 text-sm text-ink">
            <Maximize2 className="size-4" /> Theatre
          </Glass>
        )}
      </div>
      {!tv ? (
        <div className="flex flex-col items-center gap-3 self-center text-center text-ink-2">
          <AsciiSolid cols={52} rows={24} speed={0.6} className="text-[9px] text-signal" />
          <p className="hud">Off air. Pick a channel and it plays behind everything.</p>
        </div>
      ) : (
        <div className="grid gap-3 self-end md:max-w-[360px]">
          <Glass clear radius={22} className="flex items-center gap-3 p-3">
            <Logo item={tv} size={44} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-ink">{tv.name}</div>
              <div className="truncate text-[13px] text-ink-2">{status === 'loading' ? 'Tuning…' : tv.meta}</div>
            </div>
          </Glass>
          {next.length > 0 && (
            <div className="material p-2 [--r:20px]"><StackUnfoldPanel variant="minimal" cards={next.map((u, i) => ({ id: u.id, title: u.name, subtitle: `Up next ${i + 1}`, content: <button onClick={() => play(u)} className="text-sm text-signal hover:underline">Switch to {u.name}</button> }))} /></div>
          )}
        </div>
      )}
    </div>
  )
}

export function TvView() {
  const load = useCallback((cat: string) => fetchCategory(cat as TvCategory), [])
  return (
    <motion.div className="h-full" initial={false}>
      <Browser kind="tv" layout="rail" kicker="Live IPTV" title="TV" sub="Public channels from iptv-org. Dead streams are skipped." chips={TV_CATEGORIES} initialChip="documentary" load={load} remoteSearch={false} placeholder="Filter channels" aside={<Stage />} />
    </motion.div>
  )
}
