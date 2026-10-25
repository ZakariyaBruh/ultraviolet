import { Maximize2, Radio, Volume2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Eq, Logo, Transport } from '@/components/app/shared'
import { Glass } from '@/components/app/glass'
import { TextScrambleDecoder } from '@/components/ui/text-scramble-decoder'
import { TorqueDial } from '@/components/ui/torque-dial'
import { setVolume, usePlayer } from '@/lib/player'
import { useStore } from '@/lib/store'
import { useUI } from '@/lib/ui'

/** The player floats above everything as one Liquid Glass lens; tap the name to open its dial. */
export function PlayerIsland() {
  const { current, status } = usePlayer()
  const volume = useStore((s) => s.settings.volume)
  const [open, setOpen] = useState(false)
  const set = useUI((s) => s.set)
  const sub = status === 'loading' ? 'Tuning…' : status === 'error' ? 'Stream unavailable, skipping' : current ? (current.kind === 'tv' ? 'Live TV' : 'Radio') : 'Nothing playing'

  return (
    <Glass lens radius={36} className="w-[min(440px,calc(100vw-24px))] overflow-visible lg:max-xl:w-[300px]">
      <motion.div layout className="flex items-center gap-3 p-2.5 pr-3">
        {current ? (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 rounded-full text-left" aria-label={`Now playing ${current.name}. ${open ? 'Close' : 'Open'} volume`}>
            <Logo item={current} size={44} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">
                <TextScrambleDecoder key={current.id} text={current.name} trigger="mount" duration={650} className="!font-sans !text-sm !tracking-normal !text-ink" />
              </span>
              <span className="flex items-center gap-2 text-[13px] text-ink-2">
                {status === 'playing' && <Eq playing />}
                {sub}
              </span>
            </span>
          </button>
        ) : (
          <button type="button" onClick={() => set({ tuneOpen: true })} className="flex min-w-0 flex-1 items-center gap-3 rounded-full text-left">
            <span className="grid size-11 place-items-center rounded-full bg-ink/10 text-ink"><Radio className="size-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">Nothing playing</span>
              <span className="text-[13px] text-ink-2">Tap to tune in</span>
            </span>
          </button>
        )}
        <Transport compact />
        {current?.kind === 'tv' && (
          <button type="button" onClick={() => set({ theatre: true })} aria-label="Theatre mode" className="grid size-11 place-items-center md:size-9 text-ink hover:bg-ink/10">
            <Maximize2 className="size-4" />
          </button>
        )}
      </motion.div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between gap-4 border-t border-ink/10 px-5 py-3">
              <div className="flex items-center gap-2 text-[13px] text-ink-2"><Volume2 className="size-4" />Volume</div>
              <TorqueDial value={Math.round(volume * 100)} min={0} max={100} step={5} unit="%" size={84} label="Volume" onChange={(v) => setVolume(v / 100)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Glass>
  )
}
