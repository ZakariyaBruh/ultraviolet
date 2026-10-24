# Anti-Scroll

An attention-span trainer. One screen, no feed. Lock in with **internet radio** or **live IPTV**
while the site swallows every scroll attempt and turns it into data.

- **Focus**: a glass lens timer, a divided strip of blocked scrolls, minutes held and streak, a now-playing panel, and the **Today listings grid** (sources against hours, blocked scrolls ticked underneath).
- **Radio**: stations from the [Radio Browser](https://api.radio-browser.info) directory (HTTPS streams only).
- **TV**: public channels from [iptv-org](https://github.com/iptv-org/iptv), played with hls.js; dead streams are skipped.
- **Insights**: attention score with its three parts, live steadiness, weekday-by-hour and daily heatmaps, trends, sessions.
- **Coach**: ask your own numbers. Local rules, not an AI model.
- **Settings**: goal and session dials, scroll guard, motion (Calm / Lively / Lots), glass (Liquid / Frost / Solid), export / import / erase.
- **Lab**: all 131 EasyUI components, live.

Nothing scrolls vertically: lists page, charts are slides. Wheel, swipe and scroll keys are
intercepted, counted and shown as "resisted". Leaving the tab mid-session logs a "wandering".

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
