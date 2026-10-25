import { BookOpen, BarChart3, Bot, FlaskConical, Home, Pause, Play, Radio, Settings, Tv } from 'lucide-react'
import { CATALOG_INDEX } from '@/components/registry/catalog-index'
import type { SpotlightSearchItem } from '@/components/ui/spotlight-search'
import type { View } from '@/components/app/Shell'
import { fx_say, quickPlay } from './actions'
import { play } from './player'
import { useStore } from './store'
import { useUI } from './ui'

const ic = 'size-4'

export const PRESETS: { label: string; kind: 'radio' | 'tv'; tag: string }[] = [
  { label: 'Lo-fi', kind: 'radio', tag: 'lofi' },
  { label: 'Ambient', kind: 'radio', tag: 'ambient' },
  { label: 'Classical', kind: 'radio', tag: 'classical' },
  { label: 'Documentaries', kind: 'tv', tag: 'documentary' },
  { label: 'Science', kind: 'tv', tag: 'science' },
  { label: 'Relax', kind: 'tv', tag: 'relax' },
]

/** Everything ⌘K can reach: screens, actions, tuning presets, saved and recent listings, and every Lab component. */
export function buildSearchItems(go: (v: View) => void): SpotlightSearchItem[] {
  const s = useStore.getState()
  const items: SpotlightSearchItem[] = [
    { id: 'go-focus', title: 'Focus', category: 'Navigation', icon: <Home className={ic} />, action: () => go('focus') },
    { id: 'go-radio', title: 'Radio', category: 'Navigation', icon: <Radio className={ic} />, action: () => go('radio') },
    { id: 'go-tv', title: 'TV', category: 'Navigation', icon: <Tv className={ic} />, action: () => go('tv') },
    { id: 'go-books', title: 'Books', category: 'Navigation', icon: <BookOpen className={ic} />, action: () => go('books') },
    { id: 'go-insights', title: 'Insights', category: 'Navigation', icon: <BarChart3 className={ic} />, action: () => go('insights') },
    { id: 'go-debrief', title: 'Debrief', category: 'Navigation', icon: <Bot className={ic} />, action: () => go('debrief') },
    { id: 'go-lab', title: 'Lab: all 131 components', category: 'Navigation', icon: <FlaskConical className={ic} />, action: () => go('lab') },
    { id: 'go-settings', title: 'Settings', category: 'Navigation', icon: <Settings className={ic} />, action: () => go('settings') },
    {
      id: 'act-lock',
      title: s.session ? (s.session.paused ? 'Resume session' : 'Pause session') : `Lock in for ${s.settings.sessionMin} minutes`,
      category: 'Actions',
      icon: s.session && !s.session.paused ? <Pause className={ic} /> : <Play className={ic} />,
      shortcut: ['L'],
      action: () => {
        go('focus')
        const st = useStore.getState()
        if (st.session) st.togglePause()
        else st.startSession(st.settings.sessionMin, 'silent', 'Silent focus')
      },
    },
    { id: 'act-tune', title: 'Tune in…', category: 'Actions', icon: <Radio className={ic} />, action: () => useUI.getState().set({ tuneOpen: true }) },
    ...PRESETS.map((p) => ({ id: `tune-${p.tag}`, title: `Tune: ${p.label}`, category: 'Stations', description: p.kind === 'radio' ? 'Radio' : 'TV', icon: p.kind === 'radio' ? <Radio className={ic} /> : <Tv className={ic} />, action: () => void quickPlay(p.kind, p.tag).catch(() => fx_say({ title: 'Could not reach the directory', variant: 'danger' })) })),
    ...[...s.favorites, ...s.recent.filter((r) => !s.favorites.some((f) => f.id === r.id))].slice(0, 12).map((m) => ({ id: `play-${m.id}`, title: m.name, category: 'Stations', description: m.kind === 'tv' ? 'TV' : 'Radio', icon: m.kind === 'tv' ? <Tv className={ic} /> : <Radio className={ic} />, action: () => play(m, [m]) })),
    ...CATALOG_INDEX.map((c) => ({ id: `lab-${c.id}`, title: c.name, category: 'Components', description: c.description.slice(0, 90), icon: <FlaskConical className={ic} />, action: () => go('lab') })),
  ]
  return items
}
