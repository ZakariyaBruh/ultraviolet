# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Vite + React 19 + TypeScript + Tailwind v4 + shadcn (base-nova) + Motion. EasyUI (easyui.site) components are a binding requirement ("use lots"). Browser-only; no backend.

## Users
Primary: doomscrollers breaking a scrolling habit, who open it when they sit down to work, study or read and want to stay put. Secondary: students and remote workers who already do long focus blocks.

## Product Purpose
Anti-Scroll replaces the feed with one calm screen: internet radio and live IPTV as the thing you stay with, a session timer, and honest measurement of every urge to scroll. Success after a week is longer unbroken sessions and fewer scroll reflexes.

## Positioning
The only focus tool that treats a swallowed scroll gesture as the unit of progress, and keeps sound/TV (not silence) as the anchor. A neighbouring Pomodoro timer or lo-fi player cannot truthfully copy "the site does not scroll at all."

## Operating Context
Opened at the start of a work or study block, on a phone or laptop. The page never scrolls vertically; wheel, swipe and scroll keys are intercepted and counted. Audio from Radio Browser; video from public iptv-org HLS streams, some of which are dead or geo-blocked. Leaving the tab mid-session is logged as a "wandering".

## Capabilities and Constraints
- Radio: radio-browser.info directory, HTTPS streams only. TV: iptv-org category playlists via hls.js.
- All data in the browser: localStorage (settings, logs, sessions, favourites) and IndexedDB (cached lists). No accounts, no server.
- Heatmaps (weekday x hour, daily), circular/ring dashboards, charts, and LOTS of motion are explicit user requests. Motion must respect prefers-reduced-motion and the in-app Calm/Lively/LOTS setting.
- No vertical scroll anywhere: lists page, charts are slides.

## Brand Commitments
Name: Anti-Scroll ("Pro attention span"). Must use EasyUI components heavily. The user rejected the first version as looking AI-generated.

## Evidence on Hand
No real user data, testimonials or customers. A "Load demo history" button produces clearly labelled fake history so charts can be previewed; never present it as real.

## Product Principles
1. The unit of progress is a scroll you did not do.
2. One thing at a time: one sound or channel, one timer.
3. Measure honestly; never invent proof or streaks.
4. Motion is the product's pulse, but it answers what the person does and never blocks them.
5. Everything stays on the person's device.

## Accessibility & Inclusion
Target WCAG 2.2 AA. Motion has a reduced path. Controls keyboard reachable with visible focus. Touch targets at least 44px.
