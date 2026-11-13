import { frugal, part, whenIdle } from '@/components/app/Part'
import type { Route, View } from '@/lib/route'

/**
 * Every screen is a part of its own (see `Part.tsx`), so a visit fetches the screen it opens on and not the other fourteen. The rest
 * are fetched one at a time while the app is idle, which makes moving between screens instant and means a tab left open across an
 * update of the site already has every screen it will be asked for.
 */
export const Landing = part(() => import('@/components/app/Landing').then((m) => m.Landing))
export const Focus = part(() => import('@/views/FocusView').then((m) => m.FocusView))
export const Radio = part(() => import('@/views/RadioView').then((m) => m.RadioView))
export const Tv = part(() => import('@/views/TvView').then((m) => m.TvView))
export const Podcasts = part(() => import('@/views/PodcastsView').then((m) => m.PodcastsView))
export const Music = part(() => import('@/views/MusicView').then((m) => m.MusicView))
export const News = part(() => import('@/views/NewsView').then((m) => m.NewsView))
export const Learn = part(() => import('@/views/LearnView').then((m) => m.LearnView))
export const Together = part(() => import('@/views/TogetherView').then((m) => m.TogetherView))
export const Leaders = part(() => import('@/views/LeadersView').then((m) => m.LeadersView))
export const Books = part(() => import('@/views/BooksView').then((m) => m.BooksView))
export const Arcade = part(() => import('@/views/ArcadeView').then((m) => m.ArcadeView))
export const Insights = part(() => import('@/views/InsightsView').then((m) => m.InsightsView))
export const Debrief = part(() => import('@/views/DebriefView').then((m) => m.DebriefView))
export const Support = part(() => import('@/views/SupportView').then((m) => m.SupportView))
export const Settings = part(() => import('@/views/SettingsView').then((m) => m.SettingsView))

/** the things that sit over the screens and are only needed now and then */
export const Search = part(() => import('@/components/app/SearchLayer').then((m) => m.SearchLayer))
export const Celebration = part(() => import('@/components/app/Celebration').then((m) => m.Celebration))
export const Report = part(() => import('@/components/app/Report').then((m) => m.ReportSheet))
export const Onboarding = part(() => import('@/components/app/Onboarding').then((m) => m.Onboarding))
export const Tours = part(() => import('@/components/app/Tour').then((m) => m.Tours))
export const Install = part(() => import('@/components/app/Install').then((m) => m.InstallLayer))
export const Picker = part(() => import('@/components/app/widgets/Layer').then((m) => m.WidgetsPicker))
export const Mixer = part(() => import('@/components/app/shop/Mixer').then((m) => m.Mixer))

const SCREEN: Record<View, { preload: () => Promise<void> }> = { focus: Focus, radio: Radio, tv: Tv, podcasts: Podcasts, music: Music, news: News, learn: Learn, together: Together, leaders: Leaders, books: Books, arcade: Arcade, insights: Insights, debrief: Debrief, support: Support, settings: Settings }

/** Fetch a screen ahead of the tap: called when a tab is pointed at, pressed or focused. */
export const preloadScreen = (r: Route) => (r === 'home' ? Landing : SCREEN[r])?.preload() ?? Promise.resolve()

let rest = false
/**
 * Fetch everything else, most used first, one file at a time and only while the browser is idle. Not on a connection that asked to
 * save data: there, a screen is fetched when it is opened.
 */
export function preloadRest(now: View) {
  if (rest || frugal()) return
  rest = true
  const order: View[] = ['focus', 'radio', 'tv', 'podcasts', 'music', 'news', 'learn', 'settings', 'insights', 'debrief', 'arcade', 'together', 'leaders', 'books', 'support']
  // after the screens: search, the celebration card, and the study windows that work offline
  const windows = () => import('@/components/app/widgets/defs').then((m) => m.preloadLight(), () => undefined)
  const queue = [...order.filter((v) => v !== now).map((v) => SCREEN[v].preload), Search.preload, Celebration.preload, windows]
  const next = () => { const f = queue.shift(); if (f) void f().then(() => whenIdle(next, 250)) }
  whenIdle(next, 2500)
}
