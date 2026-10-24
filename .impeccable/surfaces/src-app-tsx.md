---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/views/FocusView.tsx"]
---

# Surface brief: Anti-Scroll app (Focus, Radio, TV, Insights, Settings)

Mode: Operate. Visitor is a doomscroller (or student/remote worker) starting a work block on a phone or laptop.

## Direction contract

THESIS: A working screen that does not scroll, built like a broadcast listings guide: your day is a grid of channels (Radio, TV, Silent) against hours, and every blocked scroll is a tick on it. Refuses the category default of a dark neon timer with glass cards and aurora.

OWN-WORLD: Light. Blue-grey ground (#f2f4f7), white flat panels with 1px borders, near-black ink, one chart hue (#1d5fbf) reserved for the live session and focused time. Geist for UI, Geist Mono for every figure (times, counts), sentence case, no uppercase tracking, no gradients, glow or glass. Listing rows are 1px-ruled, dense, mono times at the left like a programme guide. Product mark: a plain ring with a notch (a held dial).

STORY: Open it, press Lock in, stay. The person sees one calm screen where the timer answers "how long is left", the strip answers "how did today go", and every attempt to scroll is swallowed and logged. After a week: longer unbroken sessions, fewer attempts per hour.

FIRST VIEWPORT: 240px sidebar on the ground (mark + Anti-Scroll, scope "My desk", nav Focus/Radio/TV/Insights/Settings, now-playing block with transport at the bottom). Canvas: title "Focus" 24/600 with one finding line; left, the session panel with a thin ring and the countdown in Geist Mono 44px, divided KPI strip (blocked today, held today, streak); right, now-playing screen and presets as listing rows; full width below, "Today" listings grid (rows Radio/TV/Silent, hours across, blue blocks for sessions, ink ticks for blocked scrolls, a now line). Primary action Lock in (near-black) in the title row. Phone: top bar + 5-tab bottom bar with labels.

FORM: TV listings grid, position 4 of my grounded list; seed:1091aadac2101ae0. Signature move: the Today listings grid, plus a split-flap-style roll on figures. Motion is meaningful: ring sweep, digit rolls, a tick dropping into the grid when a scroll is blocked, listing blocks growing as time passes, staggered row entrances under 400ms total.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
