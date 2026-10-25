# Project guidelines

- Use EasyUI (easyui.site) components everywhere. All 131 are installed in `src/components/ui`; the Lab view shows each one and `src/lab/used.ts` records where the real app uses it. Add more with `npx shadcn@latest add Surajmaurya1/easyui/<slug> -y`.
- Read `PRODUCT.md` (who and why) and `DESIGN.md` (the look) before any UI change. The look is a broadcast station: blue-black ground, one yellow, ice data, Hanken + Barlow Condensed + Unbounded, test-card bars, ASCII torus, contour field. Retro against futuristic. Avoid monospace body text, dot-matrix type and a single red-orange accent (that is another brand's look). No glass, blur, gradients or glow in the app.
- Surfaces: `.glass` is the floating layer (dial, player, timer), `.material` is content. Flat, ruled, small radius. Full spectrum lives only in the colour-bar strip and the landing colour-bar strip. Themes live in `lib/themes.ts` plus `html[data-theme]` blocks in `index.css`; use tokens (`bg-ground`, `text-ink`, `bg-signal`, `text-on-signal`), never hex, in app code.
- No scroll guard. The site simply never scrolls; navigation is the tab deck (`NavDeck.tsx`) and routes (`lib/route.ts`). The measured unit is a drift: leaving the tab during a session.
- The app is a no-vertical-scroll, single-screen experience. Page lists (`useGridFit` + `SlidePagination`) or use tabs/slides instead of scrolling. `overflow-hidden` on `#canvas` is a safety net, not a layout strategy. Mobile hit targets are at least 44px.
- Every panel carries `data-movable` and can be dragged in Arrange mode (`Arrange.tsx`, offsets in `lib/layout.ts`, localStorage `friction:layout`). Paper (`html.light`) is a manga page: ink keylines, hard offset shadows, screentone, grain, Dela Gothic One.
- All user data lives in the browser (`src/lib/store.ts` for localStorage, `src/lib/cache.ts` for IndexedDB). Do not add a backend.
- Motion is a feature but it must answer something: respect the `motion` setting (0 calm / 1 lively / 2 lots) and `prefers-reduced-motion`. User-triggered motion settles under 300ms; exits use ease-in.
- Honest data only: never invent proof; demo history is flagged (`demo: true`) and removable. No AI and no chat anywhere: the Debrief is plain computed sentences.
- Before shipping UI: `npx tsc -b`, `npm run build`, an axe pass, and screenshots at 1440x900 and 390x844.
