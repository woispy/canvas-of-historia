# Work log — 2026-09-19: honest interaction (no tricks)

## Owner order

Map must track the pointer stably — no blits, no approximations, no flashes.

## Changes

- Removed: offscreen pan-blit, zoom-blit approximation, 120ms gesture
  throttle on interaction. Interaction draws synchronously every rAF.
- Progressive refinement: `strideForScale(scale, gesturing)` quadruples stride
  during drag/wheel, full detail 150ms after release (+ neighbor prefetch).
- Tile arrivals use the trailing throttle (background only).
- Page/canvas sea-tone backdrop (no white flashes, ever).
- Tests: gesture stride table; throttle test kept for the helper.
  70/70 green.
