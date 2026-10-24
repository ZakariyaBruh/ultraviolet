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
    <div className="grid gap-3">
    <Panel className="flex flex-col gap-3 p-3">
      <VideoSurface className="mx-auto aspect-video max-h-[19dvh] w-full lg:max-h-none" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {tv && <Logo item={tv} size={36} />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 truncate text-sm font-semibold text-white">
              {tv?.name ?? 'Off air'} {tv && <Eq playing={status === 'playing'} className="text-sm" />}
            </div>
            <div className="truncate text-xs text-white/50">{tv?.meta || 'Live channels, public streams'}</div>
          </div>
        </div>
        <Transport compact />
      </div>
    </Panel>
    {upNext.length > 0 && (
      <Panel className="hidden gap-1.5 p-3 lg:grid">
        <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-200/70">Up next</div>
        {upNext.map((u, i) => (
          <motion.button
            key={u.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07, type: 'spring', stiffness: 260, damping: 22 }}
            whileHover={{ x: 4 }}
            onClick={() => play(u)}
            className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-2 py-1.5 text-left hover:bg-white/10"
          >
            <Logo item={u} size={30} />
            <span className="min-w-0 truncate text-sm text-white/80">{u.name}</span>
          </motion.button>
        ))}
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
      kicker="Live IPTV"
      title="Television, but finite"
      chips={TV_CATEGORIES}
      initialChip="documentary"
      load={load}
      remoteSearch={false}
      placeholder="Filter channels…"
      side={<Screen />}
    />
  )
}
