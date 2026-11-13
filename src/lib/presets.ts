/** The quick picks in the Tune in sheet, on the Focus screen and in search. Kept apart so that the screens that only list them do not pull in the search index. */
export const PRESETS: { label: string; kind: 'radio' | 'tv'; tag: string }[] = [
  { label: 'Lo-fi', kind: 'radio', tag: 'lofi' },
  { label: 'Ambient', kind: 'radio', tag: 'ambient' },
  { label: 'Classical', kind: 'radio', tag: 'classical' },
  { label: 'News', kind: 'tv', tag: 'news' },
  { label: 'Public TV', kind: 'tv', tag: 'general' },
  { label: 'Learning', kind: 'tv', tag: 'education' },
]
