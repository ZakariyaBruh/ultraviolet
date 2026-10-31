# Friction trailer (v6)

A 39.6 s launch trailer, 1920x1080 at 30 fps, on a 120 bpm grid (beat 0.5 s, bar 2 s) so every cut and hit lands on a beat.
Renders, recordings and Blender frames are not in git (they are regenerated); everything that makes them is.
The v4/v5 notes further down are kept for the pieces v6 still uses.

## The cut

| time | what | how it is made |
| --- | --- | --- |
| 0.0 - 6.2 | The hook: a dial slides and spins faster and faster, "No bottom. No edge. No brakes.", the floor bites and it stops. | `blender/hook6.py`: the motion is simulated and baked into real keyframes, so Cycles motion blur sees true motion. |
| 6.2 - 7.0 | Black and silence. | The score gates everything except the room tone. |
| 7.0 - 13.0 | The dial is thrown, slows under friction and becomes the O of FRICTION; "Put the friction back."; the O turns into the app's text doughnut, which grows until the camera flies through its hole into the app (the move v3 had). | `src/v6/Title.tsx` (the doughnut is the app's own `ascii3d.ts` engine, `src/Ascii.tsx`), `Dial.tsx`. The hole is a mask over the title; the app scene is mounted 14 frames early underneath it. |
| 13.0 - 35.0 | The real app, one take, played through a spring camera. Set a length, lock in, leave the tab (it counts), finish, five looks, the Arcade, the front page. | `scripts/capture6.cjs` + `src/v6/App.tsx`. |
| 35.0 - 39.6 | The two endings that were liked, one above the other: v3's mark (the ring that draws itself, the square that lands) on top, v4's stack under it (FRICTION with the dial as its O, the address with its underline, Launching on Product Hunt), then the picture folds to a line and a dot. | `src/v6/End.tsx`. |

## What was learned (and applied)

* **Apple, Designing Fluid Interfaces (WWDC18 803):** motion is a spring described by a response time and a damping ratio, it keeps its
  velocity when its target changes (retargetable), and there is no cut between two fixed crops. `Spring` in `hook6.py`, `spr()` in `kit.tsx`,
  the camera table in `App.tsx` (a damped spring on centre and log-zoom that carries its velocity from key to key) and the pointer in `capture6.cjs`.
* **Blender 4.4+ layered actions (`FCurveKeyframePoints`):** `action.slots.new` -> `layers.new` -> `strips.new('KEYFRAME')` -> `channelbag.fcurves.new`
  -> `keyframe_points.add` + `foreach_set('co', ...)`. A frame-by-frame procedural render has nothing to blur; a baked curve does.
* **Deterministic app footage:** Chromium's virtual time is advanced exactly one frame between screenshots (`Emulation.setVirtualTimePolicy`
  with a budget), the screenshot is at device pixels (3840x2160 for the 1280x720 page) so a 2x camera zoom is still one to one,
  and the app's animation library is told it has no compositor animations (`delete Element.prototype.animate`) so its opacity springs
  follow the stepped clock too. The pointer is a spring overlay; clicks are real input events.
* **Sound:** the picture is a broadcast station, retro against futuristic, so the score is analogue-style, not orchestral (the first cut used a soundfont
  string section, choir and timpani and they did not belong to it): detuned-saw pads, a pulse-wave pluck through a dotted-eighth delay, a mono saw bass,
  an 808-style kit with a gated snare and metallic hats, polysynth stabs on the four big hits, station-ident tones, static between channels, a picture tube
  switching off at the end, generated hall and room reverbs, kick sidechain, gaps of silence before each hit. The dial's own sounds are read from the bake:
  its detent clicks from its angle, the glass hiss from its speed, the ridge thuds from the frames it crosses them; the title and end dials' clicks follow the
  law the picture draws. `scripts/tsfr.c` (a soundfont renderer) is no longer used by the score and is kept for experiments.
* **The brief's three gates** (`scripts/gate6.py` and the render checks in `scripts/qa.py`): first 45 frames must move, no static stretch over 30 frames,
  5% safe zone, contrast of text on its plate, frames looked at at 0.5, 1.5, 3.0 and 5.0 s and at every cue.

## Pipeline

    node scripts/capture6.cjs take                       # needs `npx vite --port 5174` in the app and /tmp/claude-0/state5174.json (a seeded profile)
    blender -b -P blender/hook6.py -- 1 186 public/v6/hook 1440 810 10     # or blender/render_hook6.sh (chunked)
    gcc -O2 -o tsfr tsfr.c -lm && python3 scripts/score6.py                 # writes public/v6/score.wav and cues.json
    npx remotion render src/index.ts V6 out/trailer6.mp4 --codec=h264 --crf=16
    python3 scripts/gate6.py out/trailer6.mp4 && python3 scripts/qa.py out/trailer6.mp4 30

The numbers on the app screens (drifts today, minutes held) are the app's own seeded demo history, which the app flags and lets you remove.

---

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
   (the O of the wordmark). `knob.py -- macro ...` is the title's product shot: a shallow-focus macro of the knurled edge that
   rises and pulls back (a dolly-zoom) to the top-down view while the dial clicks round the same detents as the sound, with a
   strip light sweeping the knurling; the floor goes black to the camera at the end so it hands off to the wordmark.
   `blender/render_macro.sh` renders it (46 frames) and then re-renders the hook's close-up (frames 150-222) at 1600x900.
   `blender -b -P blender/knob.py -- run <frame> 1280 720 14 out.png`
2. **The app, recorded.** `scripts/record-v4.cjs` drives the real app with Playwright at 2560x1440 (DSF 2) against
   `npx vite --port 5174` (it fast-forwards the timer through the store, and fakes leaving the tab for the drift).
   Clips go to `public/v4/ui/`. Run `node scripts/record-v4.cjs prep` once, then a clip name.
   No live Wikipedia lesson is recorded: its API rate-limits shared addresses and we do not work around that.
3. **Lens, Remotion.** `src/v4/Lens.tsx`: halation and one soft horizontal streak made from the picture itself, dust in the light,
   and a sideways smear on the camera glides sized to a 180 degree shutter. Captions pull into focus as they arrive.
4. **Compose, Remotion.** `src/v4/`: `Hook` (Blender frames, the three lines, speed streaks), `Title` and `Mark`
   (the wordmark, the dial travelling into the O), `World` (the screens as 3D slabs on the glass, crops that follow
   the action, the veil for the drift), `Cta`. Fonts: Hanken, Unbounded, Barlow.
5. **Sound.** `scripts/score4.py` synthesises everything (no samples): drone, scroll ticks, the ratchet from
   `ticks.json`, the title pad, the beat, the app's own clicks, payout bells. Event times are on the master clock.
6. **Checks.** `scripts/qa.py movie.mp4` reports black frames, flashes, frozen stretches and loudness.

## Render

    npx remotion render src/index.ts Trailer out/trailer.mp4 --codec=h264 --crf=16 --concurrency=4
    # sound only changed: remux without re-rendering
    ffmpeg -i out/trailer.mp4 -i public/v4/score.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest out/final.mp4

`src/Ad.tsx` and `scripts/record-clips.cjs` are the earlier (v3) cut, kept for reference.

## Honest copy

Every line is true of the app: free, no account, no feed, data in the browser; a drift is six seconds away from the
tab; credits come from focus, lessons and trivia; sixteen games; five looks. No numbers or proof are invented.
