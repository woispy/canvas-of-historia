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

## Transition polish (same day — pop still visible)

- Cost governor in `strideForScale(scale, gesturing, emaMs)`: >40ms doubles
  stride, >80ms doubles again (cap 32). Slow machines degrade gracefully.
- Sharpen crossfade: release triggers 3 alpha passes (0.35/0.7/1.0) over the
  gesture frame — detail dissolves in instead of snapping. New gesture
  cancels the fade. Release delay 150ms → 90ms.
- 71/71 green.

## Flicker post-mortem (same day — pır pır/flash on transitions)

Root cause: the crossfade alpha-blended TWO DIFFERENT geometries (coarse
gesture stride vs full release stride) = ghost double-image. Fix removes the
disease, not the symptom:
- Screen-space segment clip (`clipPolylineToRect`, tested): rasterizer only
  sees visible geometry → full detail affordable during gestures.
- Gesture stride relaxed ×4 → ×2 (governor unchanged).
- Crossfade deleted entirely: release draws the same geometry family, so
  there is nothing to pop. No alpha tricks anywhere.
- 72/72 green.
