# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Vite + React 19 + TypeScript + Tailwind v4 + shadcn (base-nova) + Motion. EasyUI (easyui.site) components are a binding requirement ("use lots"). Browser-only; no backend.

## Users
Primary: doomscrollers breaking a scrolling habit, who open it when they sit down to work, study or read and want to stay put. Secondary: students and remote workers who already do long focus blocks.

## Product Purpose
Friction (formerly Anti-Scroll) replaces the feed with one calm screen: internet radio and live IPTV as the thing you stay with, a session timer, and honest measurement of every time you drift away. Success after a week is longer unbroken sessions and fewer drifts.

## Positioning
The only focus tool whose own site never scrolls and is navigated by tuning a dial, with sound or TV (not silence) as the anchor. A neighbouring Pomodoro timer or lo-fi player cannot truthfully copy that.

## Operating Context
Opened at the start of a work or study block, on a phone or laptop. The page never scrolls; screens fit the display and you move by dial, link, drag or key. Audio from Radio Browser; video from public iptv-org HLS streams, some of which are dead or geo-blocked. Leaving the tab mid-session is logged as a "wandering".

## Capabilities and Constraints
- Radio: radio-browser.info directory, HTTPS streams only. TV: iptv-org category playlists via hls.js.
- All data in the browser: localStorage (settings, logs, sessions, favourites) and IndexedDB (cached lists). No accounts, no server.
- Heatmaps (weekday x hour, daily), circular/ring dashboards, charts, and LOTS of motion are explicit user requests. Motion must respect prefers-reduced-motion and the in-app Calm/Lively/LOTS setting.
- No vertical scroll anywhere: lists page, charts are slides.

## Brand Commitments
Name: Friction ("Put the friction back"). Must use EasyUI components heavily. The user rejected the first version as looking AI-generated.

## Evidence on Hand
No real user data, testimonials or customers. A "Load demo history" button produces clearly labelled fake history so charts can be previewed; never present it as real.

## Product Principles
1. The unit of progress is an unbroken minute; the thing counted against you is a drift, leaving the tab mid-session.
2. One thing at a time: one sound or channel, one timer.
3. Measure honestly; never invent proof or streaks.
4. Motion is the product's pulse, but it answers what the person does and never blocks them.
5. Everything stays on the person's device.

## Accessibility & Inclusion
Target WCAG 2.2 AA. Motion has a reduced path. Controls keyboard reachable with visible focus. Touch targets at least 44px.


No chat anywhere, and AI in exactly one place: a lesson can ask Gemini to write a small interactive demo for its topic (`api/demo.ts`, only the topic title is sent, the demo runs in a sealed frame, it is labelled AI-made, and Settings turns it off). If it does not arrive the lesson goes on without it. The Debrief is plain sentences computed from stored numbers.
