import { Coffee } from 'lucide-react'
import { motion } from 'motion/react'
import { Panel } from '@/components/app/shared'
import { thud } from '@/lib/clunk'
import { BREAK_MIN, SHOP } from '@/lib/credits'
import { useStore } from '@/lib/store'
import { fx_say } from '@/lib/actions'

const fmt = (n: number) => n.toLocaleString('en-US')

/** The Golden Brick, drawn flat in the signal colour. */
function Brick({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden>
      <polygon points="30,52 120,52 170,30 80,30" fill="var(--signal)" />
      <polygon points="30,52 120,52 120,100 30,100" fill="color-mix(in srgb, var(--signal) 72%, #000)" />
      <polygon points="120,52 170,30 170,78 120,100" fill="color-mix(in srgb, var(--signal) 48%, #000)" />
      <polygon points="36,56 114,56 114,62 36,62" fill="rgba(255,255,255,0.28)" />
      <polygon points="84,34 160,34 150,38 78,38" fill="rgba(255,255,255,0.35)" />
      <text x="75" y="88" textAnchor="middle" fontSize="13" fontWeight="700" letterSpacing="2" fill="color-mix(in srgb, var(--signal) 40%, #000)" style={{ fontFamily: 'var(--font-cond)' }}>FRICTION</text>
    </svg>
  )
}

const CLUNKS = (n: number) => (n >= 1000 ? 'It is still a brick.' : n >= 100 ? 'You have a problem.' : n >= 25 ? 'Very solid.' : n >= 5 ? 'Solid.' : 'Clunk.')

/** What credits can be spent on besides games. Fixed prices, nothing random. */
export function Shop() {
  const credits = useStore((s) => s.credits)
  const live = useStore((s) => !!s.session)
  const motionLevel = useStore((s) => s.settings.motion)
  const items = credits.items ?? { breaks: 0, brick: false, clunks: 0 }
  const buy = (id: 'break' | 'brick') => {
    if (useStore.getState().buyItem(id)) fx_say({ title: id === 'break' ? 'Break bought' : 'You own the Golden Brick', description: id === 'break' ? `Use it from the Focus screen while you are locked in.` : 'It does nothing. Press it anyway.', variant: 'success' })
  }
  return (
    <div className="grid min-h-0 flex-1 content-start gap-3 md:grid-cols-2">
      <Panel className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Coffee className="size-4 text-signal" />{SHOP.break.name}</h2>
          <span className="fig text-sm text-ink-2">{items.breaks} owned</span>
        </div>
        <p className="text-[13px] text-ink-2">{SHOP.break.blurb}</p>
        <p className="text-[13px] text-ink-3">{live ? 'You are locked in: the Break button is on the Focus screen.' : `Use it from the Focus screen once you are locked in. It lasts ${BREAK_MIN} minutes.`}</p>
        <button onClick={() => buy('break')} disabled={credits.bal < SHOP.break.price} className="mt-auto h-11 w-fit bg-signal px-5 text-sm font-semibold text-on-signal disabled:opacity-40">Buy one · {SHOP.break.price} credits</button>
      </Panel>

      <Panel className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{SHOP.brick.name}</h2>
          <span className="fig text-sm text-ink-2">{items.brick ? 'owned' : `${fmt(SHOP.brick.price)} credits`}</span>
        </div>
        {items.brick ? (
          <>
            <motion.button
              onClick={() => { useStore.getState().clunk(); thud() }}
              whileTap={motionLevel === 0 ? undefined : { scale: 0.93, rotate: -1.5 }}
              transition={{ duration: 0.12 }}
              aria-label="The Golden Brick. Press it."
              className="mx-auto block w-full max-w-[260px] cursor-pointer"
            >
              <Brick className="w-full" />
            </motion.button>
            <p className="text-center text-[13px] text-ink-2" role="status">{CLUNKS(items.clunks)} <span className="fig">{fmt(items.clunks)}</span> {items.clunks === 1 ? 'press' : 'presses'}, and nothing happened.</p>
          </>
        ) : (
          <>
            <p className="text-[13px] text-ink-2">{SHOP.brick.blurb} It has no use, no bonus and no effect on anything. That is the whole item.</p>
            <p className="text-[13px] text-ink-3">It costs about {Math.round(SHOP.brick.price / 260)} spotless 90-minute lock-ins.</p>
            <button onClick={() => buy('brick')} disabled={credits.bal < SHOP.brick.price} className="mt-auto h-11 w-fit border border-ink/40 px-5 text-sm font-semibold hover:bg-ink/10 disabled:opacity-40">Buy the brick · {fmt(SHOP.brick.price)} credits</button>
          </>
        )}
      </Panel>
    </div>
  )
}
