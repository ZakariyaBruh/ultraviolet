# Project guidelines

- Use EasyUI (easyui.site) components everywhere. All 131 are installed in `src/components/ui`; the Lab view shows each one and `src/lab/used.ts` records where the real app uses it. Add more with `npx shadcn@latest add Surajmaurya1/easyui/<slug> -y`.
- Read `PRODUCT.md` (who and why) and `DESIGN.md` (the look) before any UI change. The look is dark, Liquid Glass and futuristic, pinned by the user: it overrides the "no glass" rules in the design skills.
- Glass discipline: glass (`.glass`, `.glass-clear`, `.lens`) is for the functional layer only (nav, player, timer lens, chips). Content (cards, rows, charts) uses `.material`. Clear glass only over media with a dim. Keep fallbacks for Reduce Transparency, Increase Contrast and Reduce Motion.
- The app is a no-vertical-scroll, single-screen experience. Page lists (`useGridFit` + `SlidePagination`) or use tabs/slides instead of scrolling. `overflow-hidden` on `#canvas` is a safety net, not a layout strategy. Mobile hit targets are at least 44px.
- All user data lives in the browser (`src/lib/store.ts` for localStorage, `src/lib/cache.ts` for IndexedDB). Do not add a backend.
- Motion is a feature but it must answer something: respect the `motion` setting (0 calm / 1 lively / 2 lots) and `prefers-reduced-motion`. User-triggered motion settles under 300ms; exits use ease-in.
- Honest data only: never invent proof; demo history is flagged (`demo: true`) and removable. The Coach is local rules over stored stats and must say so.
- Before shipping UI: `npx tsc -b`, `npm run build`, an axe pass, and screenshots at 1440x900 and 390x844.
