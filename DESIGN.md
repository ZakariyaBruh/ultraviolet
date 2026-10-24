# Design: Friction

A broadcast station for staying put. Retro (a test card, an ident, CRT scanlines, ASCII) against futuristic (wide display type, flowing contour lines, smooth physics), without borrowing the monospace-and-dots look of a phone brand.

## Navigation is the idea
The site never scrolls. You move by tuning:
- **Landing (`/`)** opens only if you hold the button. Letting go early drains it.
- **The dial** sits at the bottom of every screen: seven stations on a frequency band. Drag the needle, press a station, or use the arrow keys. Letting go snaps to the nearest station and a quarter second of static covers the cut.
- Every screen has its own address (`/focus`, `/radio`, `/tv`, `/insights`, `/debrief`, `/lab`, `/settings`); a subdomain label such as `radio.` also maps to a screen.

## Colour
Ground `#05070c`, ink `#f3f1ea`. One action colour, broadcast yellow `#ffd23f` (light theme: blue `#1f3bff`): buttons, the needle, the ident window. Ice `#7fd3ff` for the contour field and all data. The colour-bar strip and the landing sphere are the only full-spectrum things.

## Type
Hanken Grotesk for reading. Barlow Condensed, uppercase, tracked, for labels and idents. Unbounded for the wordmark, titles and the clock; its weight is animated on the landing. Geist Mono only inside ASCII art.

## Surfaces
Flat, ruled, 1-4px corners, registration ticks on floating plates. Retro windows (ident, the Focus dial's ASCII torus) carry scanlines. Futuristic areas never do. No blur, gradient, or glow in the app.

## Motion
Calm / Lively / Lots plus reduced motion. Stepped timing for retro (typing, blink, static), smooth springs for futuristic (needle, contour field). Static on station change; no more than 300ms for anything you trigger.
