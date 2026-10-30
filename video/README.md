# Friction trailer (v4)

A 45.6 s launch trailer. 1920x1080, 24 fps, 19 bars at 100 bpm so every cut lands on a bar line.
Renders, recordings and Blender frames are not in git (they are regenerated); everything that makes them is.

## The idea

Friction is the dial that will not stop. A yellow dial slides across black glass with no resistance,
faster and faster (no bottom, no edge, no brakes), then the floor rises into ridges and stops it. The dial
becomes the O of FRICTION. The product is shown as one session, told through its own screens standing on the
same black glass. The close says what Friction lacks.

## Pipeline

1. **3D, Blender 4.5 (Cycles, CPU).** `blender/knob.py` builds the dial (knurled lacquer, rubber insert, indicator),
   the glass floor, the ridges that rise ahead of it and the strip-lamp reflections.
   `blender/render_run.sh` renders 222 frames at 1280x720 into `public/v4/run/` and writes `ticks.json`
   (the moment the dial crosses each ridge, which the score reads). `knob.py -- top ...` renders the dial from above
   (the O of the wordmark).
   `blender -b -P blender/knob.py -- run <frame> 1280 720 14 out.png`
2. **The app, recorded.** `scripts/record-v4.cjs` drives the real app with Playwright at 2560x1440 (DSF 2) against
   `npx vite --port 5174` (it fast-forwards the timer through the store, and fakes leaving the tab for the drift).
   Clips go to `public/v4/ui/`. Run `node scripts/record-v4.cjs prep` once, then a clip name.
   No live Wikipedia lesson is recorded: its API rate-limits shared addresses and we do not work around that.
3. **Compose, Remotion.** `src/v4/`: `Hook` (Blender frames, the three lines, speed streaks), `Title` and `Mark`
   (the wordmark, the dial travelling into the O), `World` (the screens as 3D slabs on the glass, crops that follow
   the action, the veil for the drift), `Cta`. Fonts: Hanken, Unbounded, Barlow.
4. **Sound.** `scripts/score4.py` synthesises everything (no samples): drone, scroll ticks, the ratchet from
   `ticks.json`, the title pad, the beat, the app's own clicks, payout bells. Event times are on the master clock.
5. **Checks.** `scripts/qa.py movie.mp4` reports black frames, flashes, frozen stretches and loudness.

## Render

    npx remotion render src/index.ts Trailer out/trailer.mp4 --codec=h264 --crf=16 --concurrency=4
    # sound only changed: remux without re-rendering
    ffmpeg -i out/trailer.mp4 -i public/v4/score.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest out/final.mp4

`src/Ad.tsx` and `scripts/record-clips.cjs` are the earlier (v3) cut, kept for reference.

## Honest copy

Every line is true of the app: free, no account, no feed, data in the browser; a drift is six seconds away from the
tab; credits come from focus, lessons and trivia; sixteen games; five looks. No numbers or proof are invented.
