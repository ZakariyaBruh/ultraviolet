import { Maximize2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback } from 'react'
import { Browser } from '@/components/app/Browser'
import { AsciiSolid } from '@/components/app/AsciiSolid'
import { VideoSlot } from '@/components/app/VideoSlot'
import { Logo } from '@/components/app/shared'
import { fetchCategory, TV_CATEGORIES, type TvCategory } from '@/lib/iptv'
import { play, usePlayer } from '@/lib/player'
import { useUI } from '@/lib/ui'

/** A proper screen: the channel sits in its own 16:9 frame with its controls underneath. */
function Stage() {
  const { current, status } = usePlayer()
  const queue = usePlayer((s) => s.queue)
  const theatre = useUI((s) => s.theatre)
  const set = useUI((s) => s.set)
  const tv = current?.kind === 'tv' ? current : null
  const idx = tv ? queue.findIndex((q) => q.id === tv.id) : -1
  const next = idx >= 0 ? queue.slice(idx + 1, idx + 4) : []
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="relative aspect-video w-full shrink-0 overflow-hidden border border-ink/30 bg-black">
        {tv && !theatre ? <VideoSlot className="size-full" /> : (
          <div className="grid size-full place-items-center text-center">
            {!tv && <div className="flex flex-col items-center gap-2"><AsciiSolid cols={40} rows={18} speed={0.6} className="text-[7px] text-signal" /><p className="hud">Off air. Pick a channel.</p></div>}
          </div>
        )}
        {tv && status === 'loading' && <div className="absolute inset-0 grid place-items-center bg-black/60"><span className="hud text-ink">Tuning…</span></div>}
        {tv && (
          <button onClick={() => set({ theatre: true })} className="absolute right-2 top-2 inline-flex h-11 items-center gap-2 bg-black/70 px-3 text-sm text-white hover:bg-black">
            <Maximize2 className="size-4" /> Fill screen
          </button>
        )}
      </div>
      {tv && (
        <>
          <div className="flex items-center gap-3 border border-ink/20 p-3">
            <Logo item={tv} size={44} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">{tv.name}</div>
              <div className="truncate text-[13px] text-ink-2">{status === 'loading' ? 'Tuning…' : tv.meta}</div>
            </div>
          </div>
          {next.length > 0 && (
            <div className="min-h-0 border border-ink/20 p-3">
              <div className="hud mb-2">Up next</div>
              <ul className="grid gap-1">{next.map((u) => <li key={u.id}><button onClick={() => play(u)} className="flex h-11 w-full items-center justify-between gap-3 text-left text-sm text-ink hover:text-signal"><span className="truncate">{u.name}</span><span className="hud shrink-0">Switch</span></button></li>)}</ul>
            </div>
          )}
        </>
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
