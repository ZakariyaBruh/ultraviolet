# Friction interactive demo

A click-through of the real app, built from screenshots of it. Published as an Artifact; the page is `index.html`, the data it reads is `data.js`.

How it is made (nothing here is drawn by hand):

1. `npx vite --port 5174 --strictPort` serves the app. Keep it running and do not edit `.html` files under the repo while a capture runs: vite reloads the page and spoils the shot in progress.
2. `node capture.cjs <station|paper|phosphor|blueprint|sunset>` drives the app in a real browser (seeded with the sample history, 1440x810, 1.3333x) and saves one PNG per state plus the click zones, measured from the live DOM. `node capture.cjs station look` captures the Retro x ASCII dial grid (Station only). `node capture.cjs <theme> shop` redoes the shop pages. Output goes to `/tmp/claude-0/demo/cap/<theme>`.
3. `python3 build.py` turns the PNGs into WebP, merges the click zones into `dist/data.js` and copies `index.html` to `dist/`.
4. `node test.cjs` serves `dist/`, checks every state has a picture and every click zone a target, and walks the guided path, free poking, a phone and a landscape phone.

The demo plays one 25 minute session. The history in the pictures is the app's own sample data, which the app flags as sample data. Radio, TV, podcasts, music, news, books, lessons, rooms and the leaderboard need the network, so they open as "lives in the real app" notes.
