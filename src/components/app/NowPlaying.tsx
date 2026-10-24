import { Pause, Play } from 'lucide-react'
import { motion } from 'motion/react'
import { Logo, Eq } from '@/components/app/shared'
import { TextScrambleDecoder } from '@/components/ui/text-scramble-decoder'
import { toggle, usePlayer } from '@/lib/player'
import { cn } from '@/lib/utils'

/** The player, always one tap away: sits in the sidebar and above the phone's tab bar. */
export function NowPlaying({ onOpen, className }: { onOpen?: () => void; className?: string }) {
  const { current, status } = usePlayer()
  if (!current) {
    return (
      <div className={cn('rounded-md border border-dashed border-[var(--control)] px-3 py-2 text-[13px] text-ink-2', className)}>
        Nothing playing. Pick a station or channel.
      </div>
    )
  }
  const sub = status === 'loading' ? 'Tuning…' : status === 'error' ? 'Stream unavailable' : current.kind === 'tv' ? 'Live TV' : 'Radio'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex items-center gap-2.5 rounded-md border border-[var(--border)] bg-surface p-2', className)}
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" aria-label={`Now playing ${current.name}. Open focus`}>
        <Logo item={current} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">
            <TextScrambleDecoder key={current.id} text={current.name} trigger="mount" duration={600} className="!font-sans !text-[13px] !tracking-normal" />
          </span>
          <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
            {status === 'playing' && <Eq playing />}
            {sub}
          </span>
        </span>
      </button>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={toggle}
        aria-label={status === 'playing' ? 'Pause' : 'Play'}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-white md:size-9"
      >
        {status === 'playing' ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
      </motion.button>
    </motion.div>
  )
}
