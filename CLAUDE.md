# Project guidelines

- Use lots of EasyUI (easyui.site) components in this project. Add more with `npx shadcn@latest add Surajmaurya1/easyui/<slug> -y`.
- The app is a no-vertical-scroll, single-screen experience. Page lists (`useGridFit` + `SlidePagination`) or use slides instead of scrolling.
- All user data lives in the browser (`src/lib/store.ts` for localStorage, `src/lib/cache.ts` for IndexedDB). Do not add a backend.
- Motion is a feature. Respect the `motion` setting (0/1/2) and `prefers-reduced-motion`.
