import { GraduationCap, Newspaper, Podcast, BarChart3, BookOpen, ClipboardList, FlaskConical, Home, Radio, Settings, Tv } from 'lucide-react'
import type { ReactNode } from 'react'
import type { View } from '@/lib/route'

const ic = 'size-4'
export const NAV: { id: View; label: string; icon: ReactNode }[] = [
  { id: 'focus', label: 'Focus', icon: <Home className={ic} /> },
  { id: 'radio', label: 'Radio', icon: <Radio className={ic} /> },
  { id: 'tv', label: 'TV', icon: <Tv className={ic} /> },
  { id: 'podcasts', label: 'Podcasts', icon: <Podcast className={ic} /> },
  { id: 'news', label: 'News', icon: <Newspaper className={ic} /> },
  { id: 'learn', label: 'Learn', icon: <GraduationCap className={ic} /> },
  { id: 'books', label: 'Books', icon: <BookOpen className={ic} /> },
  { id: 'insights', label: 'Insights', icon: <BarChart3 className={ic} /> },
  { id: 'debrief', label: 'Debrief', icon: <ClipboardList className={ic} /> },
  { id: 'lab', label: 'Lab', icon: <FlaskConical className={ic} /> },
  { id: 'settings', label: 'Settings', icon: <Settings className={ic} /> },
]
