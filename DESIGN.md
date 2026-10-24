# Design: dark Liquid Glass

Direction pinned by the user: dark, Liquid Glass, futuristic. It replaces the earlier light "listings guide" look.

## Layers
- **Backdrop** (`Backdrop.tsx`): ground `#05060a`, drifting aether orbs, a dot field, and the live TV picture when a channel plays (dimmed 35%).
- **Content** (`.material`): panels, rows, charts. Dark, thick, no refraction.
- **Functional glass** (`.glass`, `.glass-clear`, `.lens`): floating nav, player pill, timer lens, notices. Rim highlight plus pointer glint. `.lens` adds SVG refraction where supported.
- `html[data-glass]` = liquid | frost | solid (Settings). Reduce Transparency forces solid; Increase Contrast adds borders.

## Colour
Ink `#eef2fb`, ink-2 `#b4bccf`, ink-3 `#8f98ae`. One accent, ion cyan `#6ee7ff` (`--signal`), used on data, progress and focus. Warn `#ffb454`, danger `#ff6b81`, ok `#5eead4`. Colour sits on data and state, not decoration.

## Type
Geist for text, Geist Mono (`.fig`, `.hud`) for figures and captions.

## Motion
Three levels (Calm, Lively, Lots) plus `prefers-reduced-motion`. Views blur-slide in (240ms ease-out) and leave faster (120ms ease-in). Lots adds shooting stars, speed warp during a session and a second timer orbit.

## Layout
One screen, no vertical scroll. Desktop: floating glass navbar. Phone: top bar, glass tab bar (Focus, Radio, TV, Insights, More) and the player pill above it.
