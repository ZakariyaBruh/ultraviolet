# Friction

An attention-span trainer. One screen, no feed. Lock in with **internet radio** or **live IPTV**
while the site itself never scrolls. You get around by tuning a radio dial.

- **Focus**: a text-mode dial (spinning ASCII torus, wide clock), drifts, minutes held and streak, a now-playing panel, and the **Today listings grid** (sources against hours, drifts ticked underneath).
- **Radio**: stations from the [Radio Browser](https://api.radio-browser.info) directory (HTTPS streams only).
- **TV**: public channels from [iptv-org](https://github.com/iptv-org/iptv), played with hls.js; dead streams are skipped.
- **Insights**: attention score with its three parts, live steadiness, weekday-by-hour and daily heatmaps, trends, sessions.
- **Debrief**: plain sentences worked out from your own numbers. No AI, nothing to type.
- **Settings**: goal and session dials, motion (Calm / Lively / Lots), theme (Dark / Light), export / import / erase.
- **Lab**: all 131 EasyUI components, live.

Nothing scrolls vertically: lists page, charts are slides. There is no scroll guard: the site just never scrolls. You move by a radio dial at the bottom of every screen. Leaving the tab mid-session is counted as a drift.

## Data

Everything stays in the browser. No account, no backend.

| What | Where |
| --- | --- |
| Settings, focus / urge logs, sessions, favorites, recents | `localStorage` (`anti-scroll:v1`) |
| Cached radio + channel lists | IndexedDB (6 h / 12 h TTL) |

Settings → Data → *Load demo history* fills the charts with clearly-labelled made-up data.

## Stack

Vite · React 19 · TypeScript · Tailwind v4 · Motion · zustand · hls.js ·
[EasyUI](https://easyui.site) components (in `src/components/ui`, installed with
`npx shadcn@latest add Surajmaurya1/easyui/<name>`).

## Run

```sh
npm install
npm run dev     # http://localhost:5173
npm run build
```

Some IPTV streams are offline or geo-blocked; the player hops to the next channel automatically.
