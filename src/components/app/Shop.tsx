import { MusicControls } from '@/components/app/MusicControls'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Panel } from '@/components/app/shared'
import { Scrubber } from '@/components/app/Scrubber'
import { Capsule, KitPreview, Solids } from '@/components/app/shop/Detail'
import { Mixer } from '@/components/app/shop/Mixer'
import { Brick, Cannon, Spinner } from '@/components/app/shop/Toys'
import { fx_say } from '@/lib/actions'
import { LIFELINES_PER_PACK, SHOP, SHOP_ORDER, type ItemId } from '@/lib/credits'
import { useGridFit } from '@/lib/hooks'
import { itemsOf, useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const fmt = (n: number) => n.toLocaleString('en-US')

/** what you hold of an item, in a few words */
function holding(id: ItemId, it: ReturnType<typeof itemsOf>): string {
  if (id === 'break') return `${it.breaks} in your pocket`
  if (id === 'longbreak') return `${it.longBreaks} in your pocket`
  if (id === 'shield') return `${it.shields} in your pocket`
  if (id === 'lifeline') return `${it.lifelines} left`
  if (id === 'capsule') return it.capsule ? 'one sealed' : 'none sealed'
  return it.owned.includes(id) ? 'owned' : ''
}

/** how an item is used once you have it, shown on its page */
const HOW: Partial<Record<ItemId, string>> = {
  break: 'Use it from the Focus screen while you are locked in.',
  longbreak: 'Use it from the Focus screen while you are locked in.',
  shield: 'It works by itself: when you drift after ten or more clean minutes, it is spent and the streak carries on.',
  lifeline: 'A 50:50 button appears under the answers in lessons and trivia.',
  sound: 'Open it from the Focus screen with the Sounds button.',
  automusic: 'Open the Music widget from the Focus screen and press play.',
  kit: 'It appears on the timer when you take a break.',
  solids: 'Pick one below. It turns in the timer from then on.',
}

function Tile({ id, onOpen }: { id: ItemId; onOpen: (id: ItemId) => void }) {
  const item = SHOP[id]
  const credits = useStore((s) => s.credits)
  const it = itemsOf(credits)
  const owned = item.kind === 'unlock' && it.owned.includes(id)
  const can = credits.bal >= item.price
  const buy = () => {
    if (useStore.getState().buyItem(id as Exclude<ItemId, 'capsule'>)) fx_say({ title: item.kind === 'use' ? `${item.name} bought` : `${item.name} is yours`, description: HOW[id] ?? 'Open it from the Shop.', variant: 'success' })
  }
  return (
    <Panel className="flex min-w-0 flex-col gap-1.5 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="min-w-0 truncate text-[15px] font-semibold">{item.name}</h3>
        <span className="fig shrink-0 text-[12px] text-ink-2">{owned ? 'owned' : `${fmt(item.price)} credits`}</span>
      </div>
      <p className="hud text-signal">{item.tag}{item.kind === 'use' ? ` · ${holding(id, it)}` : ''}</p>
      <p className="line-clamp-3 text-[13px] leading-[1.35] text-ink-2">{item.blurb}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        {item.kind === 'use' && id !== 'capsule' && <button onClick={buy} disabled={!can} className="h-11 bg-signal px-4 text-sm font-semibold text-on-signal disabled:opacity-40">Buy{id === 'lifeline' ? ` ${LIFELINES_PER_PACK}` : ''} · {fmt(item.price)}</button>}
        {id === 'capsule' && <button onClick={() => onOpen(id)} disabled={!can && !it.capsule} className="h-11 bg-signal px-4 text-sm font-semibold text-on-signal disabled:opacity-40">{it.capsule ? 'See it' : `Write one · ${item.price}`}</button>}
        {item.kind === 'unlock' && !owned && <button onClick={buy} disabled={!can} className={cn('h-11 px-4 text-sm font-semibold disabled:opacity-40', id === 'brick' ? 'border border-ink/40 hover:bg-ink/10' : 'bg-signal text-on-signal')}>Buy · {fmt(item.price)}</button>}
        {(id === 'solids' || id === 'kit') && !owned && <button onClick={() => onOpen(id)} className="h-11 border border-ink/30 px-4 text-sm hover:bg-ink/10">Try it</button>}
        {item.kind === 'unlock' && owned && <button onClick={() => onOpen(id)} className="h-11 border border-signal px-4 text-sm font-semibold text-signal hover:bg-signal/10">Open</button>}
      </div>
    </Panel>
  )
}

function Page({ id, onBack }: { id: ItemId; onBack: () => void }) {
  const item = SHOP[id]
  const credits = useStore((s) => s.credits)
  const live = useStore((s) => !!s.session)
  const it = itemsOf(credits)
  const owned = it.owned.includes(id)
  return (
    <Panel className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="inline-flex h-11 items-center gap-2 border border-ink/30 px-3 text-sm hover:bg-ink/10"><ArrowLeft className="size-4" />All items</button>
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{item.name}</h2>
        <span className="fig text-sm text-ink-2">{owned ? 'owned' : `${fmt(item.price)} credits`}</span>
      </div>
      {HOW[id] && <p className="text-[13px] text-ink-2">{HOW[id]}</p>}
      <div className="min-h-0 flex-1 overflow-hidden">
        {id === 'capsule' && <Capsule />}
        {id === 'sound' && (owned ? <Mixer /> : <p className="text-sm text-ink-2">Buy the sound machine to open it.</p>)}
        {id === 'automusic' && (owned ? <MusicControls compact /> : <p className="text-sm text-ink-2">Buy auto music to turn it on.</p>)}
        {id === 'kit' && <KitPreview />}
        {id === 'solids' && <Solids owned={owned} />}
        {id === 'spinner' && <Spinner locked={live} />}
        {id === 'confetti' && <Cannon locked={live} />}
        {id === 'brick' && <Brick />}
      </div>
    </Panel>
  )
}

/** What credits can be spent on besides games. Fixed prices, nothing random. */
export function Shop() {
  const [open, setOpen] = useState<ItemId | null>(null)
  const [page, setPage] = useState(1)
  const { ref, per, cols } = useGridFit(250, 168, 8, 3)
  const pages = Math.max(1, Math.ceil(SHOP_ORDER.length / per))
  const safe = Math.min(page, pages)
  const slice = SHOP_ORDER.slice((safe - 1) * per, safe * per)
  if (open) return <Page id={open} onBack={() => setOpen(null)} />
  return (
    <>
      <div ref={ref} className="min-h-[168px] flex-1 overflow-hidden">
        <div className="grid h-full content-start gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: '168px' }}>
          {slice.map((id) => <Tile key={id} id={id} onOpen={setOpen} />)}
        </div>
      </div>
      <Scrubber count={SHOP_ORDER.length} per={per} page={safe} onPage={setPage} labelAt={(i) => SHOP[SHOP_ORDER[i]]?.name ?? ''} />
    </>
  )
}
