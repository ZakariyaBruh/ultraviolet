# Design

A working screen that reads like a programme guide: your day is a grid of sources against hours, and every blocked scroll is a tick on it. Light, flat, ink-first. Colour lives on data only.

## Direction

- Mode: Operate. Style: achromatic ledger (taste skill, `--app`), form: TV listings grid (Impeccable direction roll, seed:1091aadac2101ae0).
- Signature move: the **Today listings grid** (`src/components/app/Listings.tsx`). Rows are Radio, TV, Silent; columns are hours; a blue block is focused time in that hour; an ink tick underneath is a blocked scroll; a 1px blue line marks now.
- Secondary move: figures in Geist Mono roll like a departure board; a blocked scroll drops a tick into the grid and the canvas recoils.

## Tokens (`src/index.css`)

| Role | Value |
| --- | --- |
| Ground | `#f2f4f7` (blue-grey, from a meter/ledger world) |
| Surface | `#ffffff`, 1px `#e1e4ea` border, no shadow at rest |
| Ink | `#0a0a0a`; secondary `#565d68`; tertiary `#626977` (all pass 4.5:1 on ground) |
| Signal (the one chart hue) | `#1d5fbf`: the live session, focused time, the now line |
| Primary action | near-black `#141414`, white label |
| Status | positive `#247b50`, negative `#c4242a`; pale pairs for pills |
| Radius | 8px panels, 6px controls, full pills for chips |
| Type | Geist 14/20 body, 24/600 title, 16/600 section, 13 labels, 12 meta; Geist Mono for every figure |

## Rules

- No gradients, glow, glass, aurora, grain, or tinted icon chips. The one gradient is a CSS mask that fades a chip row at its edge.
- KPIs are type in a divided strip: label over figure, no tile, no icon, no sparkline.
- One hue per chart. Blocked scrolls are drawn in ink; focused time in signal.
- Sentence case. No eyebrows, no tracked capitals, no index numbers.
- Nothing scrolls vertically. Lists page (`useGridFit` + `SlidePagination`); Insights and Settings are tabs.
- Motion answers what you do or what is happening: ring sweep and tick wake, digit roll, tick drop on a blocked scroll, listing blocks growing, 200ms view transitions with ease-in exits, sub-300ms springs. Calm / Lively / Lots in Settings; reduced motion always wins.

## Components

EasyUI (easyui.site), restyled to these tokens in place: Sidebar, AnimatedTabs (segmented), SplitButton, MagneticButton, IOSSearchBar, SlidePagination, ActivityHeatmap, BarChart, DonutChart, LiveLineChart, AnimatedNumber, TorqueDial, LiquidToggle, DragToConfirm, SmoothAccordion, Sheet, Skeleton, Badge, TextScrambleDecoder, OrbitalLoadingRing, UndoToast, DotField (Lots only).

## Phone

Brand bar, 5-tab bar with labels, Now playing strip above it, Sheet for quick tune. KPI strip becomes 2 columns or 3 compact cells; Score and Steadiness move to their own tab.
