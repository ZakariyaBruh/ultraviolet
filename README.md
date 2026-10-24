# Anti-Scroll

An attention-span trainer. One screen, no feed. Lock in with **internet radio** or **live IPTV**
while the site swallows every scroll attempt and turns it into data.

- **Focus** – session timer ring, "scrolls resisted" counter, streak, now-playing panel.
- **Radio** – stations from the [Radio Browser](https://api.radio-browser.info) directory (HTTPS streams only).
- **TV** – public channels from [iptv-org](https://github.com/iptv-org/iptv), played with hls.js.
- **Insights** – attention score ring, live pulse, weekday×hour and daily heatmaps, trends, source split, session log.
- **Pledge** – motion level (calm / lively / LOTS), goals, volume, export / import / reset.

Nothing scrolls vertically: lists page, charts are slides. Wheel, swipe and scroll keys are
intercepted, counted and shown as "resisted". Leaving the tab mid-session logs a "wandering".

## Data

Everything stays in the browser. No account, no backend.

| What | Where |
| --- | --- |
| Settings, focus / urge logs, sessions, favorites, recents | `localStorage` (`anti-scroll:v1`) |
| Cached radio + channel lists | IndexedDB (6 h / 12 h TTL) |

Pledge → *Load demo history* fills the charts with clearly-labelled fake data.

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
