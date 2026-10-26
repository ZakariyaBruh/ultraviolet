# Friction

An attention-span trainer. One screen, no feed. Lock in with **internet radio** or **live IPTV**
while the site itself never scrolls. You get around with a tab deck, and any panel can be dragged where you like.

- **Focus**: a text-mode dial (spinning ASCII torus, wide clock), drifts, minutes held and streak, a now-playing panel, and the **Today listings grid** (sources against hours, drifts ticked underneath).
- **Radio**: stations from the [Radio Browser](https://api.radio-browser.info) directory (HTTPS streams only).
- **TV**: public channels from [iptv-org](https://github.com/iptv-org/iptv), played with hls.js; dead streams are skipped.
- **Podcasts**: search the Apple Podcasts directory (iTunes Search API), open a show, and the episodes are read straight from its RSS feed. Seek, back 15, forward 30.
- **News**: 90+ RSS feeds across nine categories, read in the browser (through a public CORS relay when a publisher blocks browsers). Hide any word or name for an hour, a day, a week or until you lift it; every change has an undo.
- **Learn**: search any topic and get a short lesson from Wikipedia, with fill-the-gap and which-came-first checks written from the text itself, a trivia round from the Open Trivia Database, XP, a learning streak, and a spaced-repetition review deck. No account. Each lesson can also get a small interactive demo written on the fly by Gemini (`api/demo.ts`, needs `GEMINI_API_KEY` on the server; only the topic title is sent; the demo runs in a sealed iframe with no network or storage and is marked AI-made; Settings can switch it off, and the lesson carries on without it whenever it does not arrive).
- **Leaders**: recommend Friction with your own link; your first new recommend puts you on a public leaderboard (Turso, via `api/lb.ts`). When the database nears 4.5 GB the bar rises to the lowest score and the lowest person is replaced.
- **Together**: make a room, share the code, and lock in at the same time with friends. Chat, listen or watch the same station or channel, and connect a Discord or Slack channel by webhook. Rooms close after a day of quiet.
- **Books**: free, open-access ebooks from the Internet Archive (no key, no account), read in a custom frame with page, find and shelf controls.
- **Insights**: attention score with its three parts, live steadiness, weekday-by-hour and daily heatmaps, trends, sessions.
- **Debrief**: plain sentences worked out from your own numbers. No AI, nothing to type.
- **Settings**: goal and session dials, motion (Calm / Lively / Lots), theme (Dark / Light), export / import / erase.

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
