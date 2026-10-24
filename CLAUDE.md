# Project guidelines

- Use lots of EasyUI (easyui.site) components in this project. Add more with `npx shadcn@latest add Surajmaurya1/easyui/<slug> -y`, then restyle them to the tokens in `DESIGN.md` (they ship dark-only: replace hard-coded hex with `text-ink`, `bg-surface`, `border-[var(--control)]`, `--signal`).
- Read `PRODUCT.md` (who and why) and `DESIGN.md` (the look) before any UI change. The look is a light, flat "listings guide" (achromatic ledger): colour only on data, one hue (`--signal`), figures in Geist Mono, no gradients/glow/glass/eyebrows/tinted icon chips.
- The app is a no-vertical-scroll, single-screen experience. Page lists (`useGridFit` + `SlidePagination`) or use tabs/slides instead of scrolling. `overflow-hidden` on `#canvas` is a safety net, not a layout strategy.
- All user data lives in the browser (`src/lib/store.ts` for localStorage, `src/lib/cache.ts` for IndexedDB). Do not add a backend.
- Motion is a feature but it must answer something: respect the `motion` setting (0 calm / 1 lively / 2 lots) and `prefers-reduced-motion`. User-triggered motion settles under 300ms; exits use ease-in.
- Honest data only: never invent proof; demo history is flagged (`demo: true`) and removable.
- Before shipping UI: `npm run build`, `.claude/skills/impeccable/scripts/impeccable detect --json <files>`, `node .claude/skills/design-taste-frontend/scripts/lint.mjs --app src`, and an axe pass.
