# Project guidelines

- Use EasyUI (easyui.site) components everywhere. All 131 are installed in `src/components/ui`; the Lab view shows each one and `src/lab/used.ts` records where the real app uses it. Add more with `npx shadcn@latest add Surajmaurya1/easyui/<slug> -y`.
- Read `PRODUCT.md` (who and why) and `DESIGN.md` (the look) before any UI change. The look is retro-futurist: black ground, dot matrix, 3D ASCII, one heat colour, dark first with a light toggle. No glass, blur, gradients or glow in the app.
- Surfaces: `.glass` is the floating layer (nav, player, timer), `.material` is content. Flat, ruled, small radius. The only spectrum colour is the landing image's focal point.
- The app is a no-vertical-scroll, single-screen experience. Page lists (`useGridFit` + `SlidePagination`) or use tabs/slides instead of scrolling. `overflow-hidden` on `#canvas` is a safety net, not a layout strategy. Mobile hit targets are at least 44px.
- All user data lives in the browser (`src/lib/store.ts` for localStorage, `src/lib/cache.ts` for IndexedDB). Do not add a backend.
- Motion is a feature but it must answer something: respect the `motion` setting (0 calm / 1 lively / 2 lots) and `prefers-reduced-motion`. User-triggered motion settles under 300ms; exits use ease-in.
- Honest data only: never invent proof; demo history is flagged (`demo: true`) and removable. No AI and no chat anywhere: the Debrief is plain computed sentences.
- Before shipping UI: `npx tsc -b`, `npm run build`, an axe pass, and screenshots at 1440x900 and 390x844.
