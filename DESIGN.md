# Design: Friction

A broadcast station for staying put. Retro (a test card, an ident, CRT scanlines, ASCII) against futuristic (wide display type, flowing contour lines, smooth physics), without borrowing the monospace-and-dots look of a phone brand.

## Navigation is the idea
The site never scrolls. You move by tuning:
- **Landing (`/`)** opens only if you hold the button. Letting go early drains it. The image is a plain, regular dot matrix: dots swell and light up around your pointer, and a click sends a ring of light across it.
- **Radio** is a plain browser: chips, search, a scrubbable list.
- **Lock in** is hold-to-lock; **session length** is a ruler you drag.
- **Books** (`/books`) lists free, open texts from the Internet Archive (Gutenberg, Americana and Universal Library collections, nothing lent out) and opens them in our own reader frame: page turning, jump to page, find in book, a shelf. The Archive serves the pages, so the page itself is its embedded reader. Needs no key.
- **TV** has its own 16:9 screen with a fill-screen mode; video never sits behind the interface.
- **The deck** sits at the bottom of every screen: eight index tabs, the active one opens to show its name. Arrow keys move along it. **Arrange** (the move icon) lets you drag any panel; positions are kept in the browser.
- Every screen has its own address (`/focus`, `/radio`, `/tv`, `/insights`, `/debrief`, `/settings`); a subdomain label such as `radio.` also maps to a screen.

## Themes
Five complete palettes, switched with the palette button, `T` anywhere, or the swatches in Settings: **Station** (default), **Paper** (light), **Phosphor** (green CRT, all monospace), **Blueprint**, **Sunset**. `lib/themes.ts` defines them; `index.css` carries the variables per `html[data-theme]`. The landing page follows the theme too.

## Colour
Ground `#05070c`, ink `#f3f1ea`. One action colour, broadcast yellow `#ffd23f` (light theme: blue `#1f3bff`): buttons, the needle, the ident window. Ice `#7fd3ff` for the contour field and all data. The colour-bar strip and the landing sphere are the only full-spectrum things.

## Type
Hanken Grotesk for reading. Barlow Condensed, uppercase, tracked, for labels and idents. Unbounded for the wordmark, titles and the clock; its weight is animated on the landing. Geist Mono only inside ASCII art.

## Surfaces
Flat, ruled, 1-4px corners, registration ticks on floating plates. Retro windows (ident, the Focus dial's ASCII torus) carry scanlines. Futuristic areas never do. No blur, gradient, or glow in the app.

## Motion
Calm / Lively / Lots plus reduced motion. Stepped timing for retro (typing, blink, static), smooth springs for futuristic (needle, contour field). Static on station change; no more than 300ms for anything you trigger.
