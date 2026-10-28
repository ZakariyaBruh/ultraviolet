import { Users, Trophy, GraduationCap, Newspaper, Podcast, Music2, BarChart3, BookOpen, ClipboardList, Home, Radio, Settings, Tv, Gamepad2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { View } from '@/lib/route'

const ic = 'size-4'
export const NAV: { id: View; label: string; icon: ReactNode }[] = [
  { id: 'focus', label: 'Focus', icon: <Home className={ic} /> },
  { id: 'radio', label: 'Radio', icon: <Radio className={ic} /> },
  { id: 'tv', label: 'TV', icon: <Tv className={ic} /> },
  { id: 'podcasts', label: 'Podcasts', icon: <Podcast className={ic} /> },
  { id: 'music', label: 'Music', icon: <Music2 className={ic} /> },
  { id: 'news', label: 'News', icon: <Newspaper className={ic} /> },
  { id: 'learn', label: 'Learn', icon: <GraduationCap className={ic} /> },
  { id: 'together', label: 'Together', icon: <Users className={ic} /> },
  { id: 'leaders', label: 'Leaders', icon: <Trophy className={ic} /> },
  { id: 'books', label: 'Books', icon: <BookOpen className={ic} /> },
  { id: 'arcade', label: 'Arcade', icon: <Gamepad2 className={ic} /> },
  { id: 'insights', label: 'Insights', icon: <BarChart3 className={ic} /> },
  { id: 'debrief', label: 'Debrief', icon: <ClipboardList className={ic} /> },
  { id: 'settings', label: 'Settings', icon: <Settings className={ic} /> },
]
