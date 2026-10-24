# Design: Friction

Retro-futurist, dark first. Direction set by the user: 3D ASCII, dot matrix, speed warp, morphing dots; a harsh line image with one vivid focal point on the landing page; dark means black, with a light toggle.

## Landing
Hard white hairlines on black (`LineImage`) part around one hard-edged sphere of colour. That sphere and the lines nearest it are the only spectrum colour anywhere in the product. Below: the wordmark in Doto (dot-matrix), one sentence, one button. The landing is black in both themes.

## App
- **Ground**: pure black `#000` (light: paper `#efece1`). `DotMorph` draws a dot matrix that morphs between rings, a wave, a pulsing disc and a lattice. Speed warp runs while a session is live. A live TV channel replaces the dots.
- **Surfaces**: flat, 1px ruled, corner registration ticks on the floating layer (`.glass`), a faint dot grid on content panels (`.material`). No blur, no gradient, no glow, radius 1-4px.
- **Colour**: bone ink `#f1eee4`, one heat colour `#ff5a1f` (light `#d93a05`) for live state, progress and the primary action, amber `#ffc400` as the second chart hue. Everything else is ink at different strengths.
- **Type**: Geist Mono for all UI text; Doto 800 (`.dot`) for the wordmark, page titles and the clock. Captions are uppercase mono (`.hud`).
- **3D ASCII**: `AsciiSolid` is a rotating torus in text. It is the timer's ground, the empty TV screen and the Debrief ornament. Its spin follows session state.

## Motion
Calm / Lively / Lots plus `prefers-reduced-motion`. Pulses and blinks use stepped timing to read as a display, not a UI toolkit. Exits are faster than entrances and use ease-in.

## Layout
One screen, no vertical scroll. Desktop: floating bar with the navigation. Phone: top bar, bottom tab bar (Focus, Radio, TV, Insights, More) and the player above it.
