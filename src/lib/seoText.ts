/**
 * The words for each screen: its title and description, and the plain text a screen reader or a crawler gets (`AboutScreen` in
 * App.tsx; the built pages carry the same text, see scripts/prerender.mjs). It is about 15 KB that no first paint needs (the built
 * page already has the right title), so it is fetched just after the app starts.
 */
export interface ScreenText { title: string; description: string; h1: string; lead: string; points: string[]; more: string; name: string }
export type SeoTable = Record<string, ScreenText>

let table: SeoTable | null = null
let going: Promise<SeoTable> | null = null
export const loadSeo = () => (going ??= import('./seo.json').then((m) => (table = m.default as SeoTable), (e) => { going = null; throw e }))
export const seoNow = () => table
