import { motion } from 'motion/react'
import { useCallback } from 'react'
import { Browser } from '@/components/app/Browser'
import { Eq, Logo, Panel, Transport, VideoSurface } from '@/components/app/shared'
import { fetchCategory, TV_CATEGORIES, type TvCategory } from '@/lib/iptv'
import { play, usePlayer } from '@/lib/player'

function Screen() {
  const { current, status } = usePlayer()
  const queue = usePlayer((s) => s.queue)
  const tv = current?.kind === 'tv' ? current : null
  const idx = tv ? queue.findIndex((q) => q.id === tv.id) : -1
  const upNext = idx >= 0 ? queue.slice(idx + 1, idx + 5) : []
  return (
    <div className="grid gap-4">
      <Panel className={`items-center gap-3 p-3 lg:flex lg:flex-col lg:items-stretch ${tv ? 'flex' : 'hidden'}`}>
        <VideoSurface className="aspect-video w-24 shrink-0 sm:w-40 lg:w-full" />
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-1 lg:flex-none">
          <div className="flex min-w-0 items-center gap-3">
            {tv && <span className="hidden min-[400px]:block"><Logo item={tv} size={32} /></span>}
            <div className="min-w-0">
              <div className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                {tv?.name ?? 'Off air'} {tv && <Eq playing={status === 'playing'} />}
              </div>
              <div className="truncate text-[13px] text-ink-2">{tv?.meta || 'Public streams, some go offline'}</div>
            </div>
          </div>
          <Transport compact />
        </div>
      </Panel>
      {upNext.length > 0 && (
        <Panel className="hidden p-3 lg:block">
          <h2 className="mb-1 px-1 text-sm font-semibold">Up next</h2>
          <ul>
            {upNext.map((u, i) => (
              <motion.li key={u.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05, duration: 0.2 }}>
                <button onClick={() => play(u)} className="flex h-11 w-full items-center gap-3 border-b border-[var(--rule)] px-1 text-left last:border-b-0 hover:bg-raised">
                  <Logo item={u} size={28} />
                  <span className="min-w-0 truncate text-sm text-ink">{u.name}</span>
                </button>
              </motion.li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}

export function TvView() {
  const load = useCallback((cat: string) => fetchCategory(cat as TvCategory), [])
  return (
    <Browser
      kind="tv"
      title="TV"
      sub="Live public channels from iptv-org. Dead streams are skipped automatically."
      chips={TV_CATEGORIES}
      initialChip="documentary"
      load={load}
      remoteSearch={false}
      placeholder="Filter channels"
      side={<Screen />}
    />
  )
}
